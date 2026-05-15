import { createHash } from 'node:crypto'
import { access, mkdir, open, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

import type { ShortTermMemoryMeta } from '../../src/types/memory'

/**
 * 元数据存储
 *
 * 职责：
 * 1. 扫描目录中的 .md 文件，生成 ShortTermMemoryMeta 列表
 * 2. 持久化元数据到 JSON（标签、标题、处理状态等）
 * 3. 提供增删改查元数据的方法
 *
 * 存储结构：
 *   {dataDir}/metadata/memory-meta.json  — 所有对话记录的元数据
 */
export class MetadataStore {
  private readonly metaFilePath: string
  private metaMap = new Map<string, ShortTermMemoryMeta>()

  constructor(options: { readonly dataDir: string }) {
    this.metaFilePath = join(options.dataDir, 'metadata', 'memory-meta.json')
  }

  /** 加载已保存的元数据 */
  async load(): Promise<void> {
    try {
      await access(this.metaFilePath)
      const raw = await readFile(this.metaFilePath, 'utf-8')
      const entries = JSON.parse(raw) as ShortTermMemoryMeta[]
      this.metaMap = new Map(entries.map((entry) => [entry.fileId, entry]))
    } catch {
      this.metaMap = new Map()
    }
  }

  /** 原子写入保存（用唯一临时文件名避免并发冲突） */
  private async save(): Promise<void> {
    await mkdir(dirname(this.metaFilePath), { recursive: true })

    const tmpPath = `${this.metaFilePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
    const data = JSON.stringify([...this.metaMap.values()], null, 2)

    await writeFile(tmpPath, data, 'utf-8')
    await rename(tmpPath, this.metaFilePath)
  }

  /**
   * 扫描指定目录中的 .md 文件，生成/更新元数据列表
   */
  async scanMemoryDir(memoryDir: string): Promise<readonly ShortTermMemoryMeta[]> {
    const entries = await readdir(memoryDir)
    const mdFiles = entries.filter((name) => extname(name).toLowerCase() === '.md')
    const scannedIds = new Set<string>()

    for (const fileName of mdFiles) {
      const filePath = join(memoryDir, fileName)
      const fileStat = await stat(filePath)

      if (!fileStat.isFile()) {
        continue
      }

      const fileId = await this.generateFileId(filePath, normalizeFileSize(fileStat.size))
      scannedIds.add(fileId)

      const existing = this.metaMap.get(fileId)

      if (existing) {
        this.metaMap.set(fileId, {
          ...existing,
          lastUpdatedAt: fileStat.mtime.toISOString()
        })
        continue
      }

      const content = await readFile(filePath, 'utf-8')
      const title = this.extractTitle(content, fileName)
      const wordCount = this.countWords(content)
      const createdAt = this.extractCreatedAt(content, fileStat)

      this.metaMap.set(fileId, {
        fileId,
        title,
        tags: [],
        status: 'pending',
        createdAt,
        lastUpdatedAt: fileStat.mtime.toISOString(),
        wordCount
      })
    }

    for (const fileId of [...this.metaMap.keys()]) {
      if (!scannedIds.has(fileId)) {
        this.metaMap.delete(fileId)
      }
    }

    await this.save()

    return sortMetaByLastUpdated([...this.metaMap.values()])
  }

  /** 获取单个文件的元数据 */
  getMeta(fileId: string): ShortTermMemoryMeta | undefined {
    return this.metaMap.get(fileId)
  }

  /** 获取所有元数据 */
  getAll(): readonly ShortTermMemoryMeta[] {
    return sortMetaByLastUpdated([...this.metaMap.values()])
  }

  /** 更新元数据（AI 生成标题/标签后调用） */
  async updateMeta(
    fileId: string,
    updates: Partial<Pick<ShortTermMemoryMeta, 'title' | 'tags' | 'status'>>
  ): Promise<ShortTermMemoryMeta | undefined> {
    const existing = this.metaMap.get(fileId)

    if (!existing) {
      return undefined
    }

    const updated: ShortTermMemoryMeta = {
      ...existing,
      ...updates,
      tags: updates.tags ?? existing.tags
    }

    this.metaMap.set(fileId, updated)
    await this.save()

    return updated
  }

  /** 获取所有已有的标签（去重） */
  getAllTags(): readonly string[] {
    const tagSet = new Set<string>()

    for (const meta of this.metaMap.values()) {
      for (const tag of meta.tags) {
        tagSet.add(tag)
      }
    }

    return [...tagSet].sort()
  }

  /** 生成文件 ID：md5(前1KB + 文件大小)，跟 file-indexer 保持一致 */
  private async generateFileId(filePath: string, size: number): Promise<string> {
    const fileHandle = await open(filePath, 'r')

    try {
      const buffer = Buffer.alloc(1024)
      const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0)
      const hash = createHash('md5')

      hash.update(buffer.subarray(0, bytesRead))
      hash.update(String(size))

      return hash.digest('hex')
    } finally {
      await fileHandle.close()
    }
  }

  /**
   * 从文件内容提取标题
   * 优先级：
   * 1. 文件内容第一行的 # 标题
   * 2. 文件内容 frontmatter 中的 title
   * 3. 文件名（去掉 .md 后缀）
   */
  private extractTitle(content: string, fileName: string): string {
    const lines = content.split('\n')

    for (const line of lines.slice(0, 10)) {
      const trimmed = line.trim()

      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        return trimmed.replace(/^#\s+/, '').trim()
      }
    }

    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)

    if (frontmatterMatch) {
      const titleMatch = frontmatterMatch[1].match(/^\s*title\s*:\s*(.+)\s*$/im)

      if (titleMatch) {
        return titleMatch[1].replace(/^['"]|['"]$/g, '').trim()
      }
    }

    return basename(fileName, '.md')
  }

  /**
   * 提取创建时间
   * 优先从内容中匹配时间戳格式，否则用文件 birthtime
   */
  private extractCreatedAt(
    content: string,
    fileStat: Awaited<ReturnType<typeof stat>>
  ): string {
    const timeMatch = content.match(/开始时间[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)

    if (timeMatch) {
      return new Date(timeMatch[1].replace(/\s+/, 'T')).toISOString()
    }

    return fileStat.birthtime.toISOString()
  }

  /** 统计中文+英文字数 */
  private countWords(content: string): number {
    const cleaned = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*_\->`~\[\]()!|]/g, '')
      .trim()

    const chineseChars = (cleaned.match(/[\u4e00-\u9fff]/g) ?? []).length
    const englishWords = (cleaned.match(/[a-zA-Z]+/g) ?? []).length

    return chineseChars + englishWords
  }
}

function sortMetaByLastUpdated(entries: readonly ShortTermMemoryMeta[]): readonly ShortTermMemoryMeta[] {
  return [...entries].sort(
    (left, right) => new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime()
  )
}

function normalizeFileSize(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value
}
