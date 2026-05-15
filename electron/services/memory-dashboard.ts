import { createHash } from 'node:crypto'
import { open, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'

import type { MemoryRenameResult, ShortTermMemoryCard } from '../../src/types/memory'
import { MetadataStore } from './metadata-store'

const SUMMARIES_FILE = 'summaries.json'

const CATEGORY_RULES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['开机剧本', ['开机剧本', 'boot script', '开机', '剧本优化']],
  ['冰激凌剧本', ['冰激凌', '冰淇淋', '破冰', 'ice cream']],
  ['PRD & 需求评审', ['PRD', 'prd', '需求评审', '评审', '需求文档', 'review.*需求', '需求.*review']],
  ['需求设计', ['需求设计', '需求', '功能设计', '方案设计', '负一屏', '新手引导', 'Typeless']],
  ['用户画像', ['用户画像', '画像', 'persona']],
  ['调研', ['调研', '调查', 'research', '算法', '推荐']],
  ['文案 & 文档', ['文案', '文档', '述职', 'OKR', '转正']],
  [
    '工具 & 配置',
    ['skill', 'plugin', '安装', '依赖', '配置', '工具', 'Claude', 'claude', 'CLI', 'node', 'figma', 'Figma', '版本', 'upgrade']
  ],
  ['寒雪项目', ['寒雪', '家长端', '小程序', '家教机']],
  ['Cowork & 协作', ['cowork', 'Cowork', '协作', 'codex', 'Codex']],
  ['创业 & 探索', ['创业', 'Aether', 'aether']],
  ['聊天记录管理', ['聊天记录', '对话记录', 'memory', 'Memory', '保存.*记录', '导出']]
]

export async function loadMemoryDashboard(
  memoryDir: string,
  metadataStore: MetadataStore
): Promise<readonly ShortTermMemoryCard[]> {
  const normalizedMemoryDir = resolve(memoryDir)
  const entries = await readdir(normalizedMemoryDir, { withFileTypes: true })
  const summaries = await loadSummaries(normalizedMemoryDir)
  const cards: ShortTermMemoryCard[] = []

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.md') {
      continue
    }

    const filePath = join(normalizedMemoryDir, entry.name)
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      continue
    }

    const content = await readFile(filePath, 'utf-8')
    const fileSize = normalizeFileSize(fileStat.size)
    const fileId = await generateMemoryFileId(filePath, fileSize)
    const meta = metadataStore.getMeta(fileId)
    const aiSummary = summaries[entry.name]
    const isEmptyByAi = aiSummary === '[空对话]'
    const fallbackSummary = extractSummary(content)
    const summary = aiSummary && !isEmptyByAi ? aiSummary : fallbackSummary
    const category = detectCategory(`${aiSummary ?? ''}\n${content.slice(0, 3000)}`)
    const title = meta?.title?.trim() || generateTitle(entry.name, summary)
    const msgCount = countMessages(content)
    const wordCount = meta?.wordCount ?? countWords(content)
    const createdAt = meta?.createdAt ?? fileStat.birthtime.toISOString()
    const lastUpdatedAt = fileStat.mtime.toISOString()
    const searchText = buildSearchText({
      title,
      summary,
      category,
      filename: entry.name,
      tags: meta?.tags ?? [],
      content
    })

    cards.push({
      fileId,
      filename: entry.name,
      filePath,
      title,
      summary,
      category,
      searchText,
      tags: meta?.tags ?? [],
      status: meta?.status ?? 'pending',
      createdAt,
      lastUpdatedAt,
      wordCount,
      msgCount,
      fileSize,
      isEmpty: isEmptyByAi || fileSize < 500 || msgCount <= 1 || fallbackSummary === '（无有效内容）'
    })
  }

  cards.sort(
    (left, right) => new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime()
  )

  return cards
}

export async function renameMemoryEntry(
  memoryDir: string,
  filePath: string,
  newTitle: string,
  metadataStore: MetadataStore
): Promise<MemoryRenameResult> {
  const normalizedMemoryDir = resolve(memoryDir)
  const normalizedFilePath = resolve(filePath)

  if (!normalizedFilePath.startsWith(`${normalizedMemoryDir}/`) && normalizedFilePath !== normalizedMemoryDir) {
    throw new Error('只能重命名记忆目录中的文件')
  }

  const oldStats = await stat(normalizedFilePath)

  if (!oldStats.isFile()) {
    throw new Error('目标不是文件')
  }

  const sanitizedTitle = sanitizeFileName(newTitle)

  if (!sanitizedTitle) {
    throw new Error('标题不能为空')
  }

  const oldFilename = basename(normalizedFilePath)
  const nextFilename = `${sanitizedTitle}.md`
  const nextFilePath = join(normalizedMemoryDir, nextFilename)

  if (nextFilePath !== normalizedFilePath) {
    try {
      const nextStats = await stat(nextFilePath)

      if (nextStats.isFile()) {
        throw new Error(`文件已存在: ${nextFilename}`)
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  const fileId = await generateMemoryFileId(normalizedFilePath, normalizeFileSize(oldStats.size))

  if (nextFilePath !== normalizedFilePath) {
    await rename(normalizedFilePath, nextFilePath)
    await renameSummaryEntry(normalizedMemoryDir, oldFilename, nextFilename)
  }

  await metadataStore.updateMeta(fileId, { title: sanitizedTitle })

  return {
    oldFilePath: normalizedFilePath,
    newFilePath: nextFilePath,
    newFilename: nextFilename,
    title: sanitizedTitle
  }
}

async function loadSummaries(memoryDir: string): Promise<Record<string, string>> {
  const filePath = join(memoryDir, SUMMARIES_FILE)

  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed
  } catch {
    return {}
  }
}

async function renameSummaryEntry(memoryDir: string, oldFilename: string, nextFilename: string): Promise<void> {
  const filePath = join(memoryDir, SUMMARIES_FILE)
  const summaries = await loadSummaries(memoryDir)

  if (!(oldFilename in summaries)) {
    return
  }

  summaries[nextFilename] = summaries[oldFilename]
  delete summaries[oldFilename]

  await writeFile(filePath, JSON.stringify(summaries, null, 2), 'utf-8')
}

function detectCategory(text: string): string {
  for (const [category, keywords] of CATEGORY_RULES) {
    for (const keyword of keywords) {
      if (new RegExp(keyword, 'i').test(text.slice(0, 3000))) {
        return category
      }
    }
  }

  return '其他'
}

function extractSummary(content: string, maxLength = 200): string {
  const patterns = [
    /#\s*you asked\s*\n+([\s\S]*?)(?:\n---|\n#)/i,
    /##\s*👤\s*用户.*?\n+([\s\S]*?)(?:\n---|\n##)/i
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)

    if (!match) {
      continue
    }

    const text = sanitizeSummaryText(match[1])

    if (text.length > 20) {
      return trimSummary(text, maxLength)
    }
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (
      trimmed.length > 30 &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('>') &&
      !trimmed.startsWith('<') &&
      !trimmed.includes('会话 ID') &&
      !trimmed.includes('开始时间') &&
      !trimmed.includes('工作目录') &&
      !trimmed.includes('消息数量')
    ) {
      return trimSummary(trimmed, maxLength)
    }
  }

  return '（无有效内容）'
}

function sanitizeSummaryText(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/```[\s\S]*?```/g, '[代码块]').trim()
}

function buildSearchText(options: {
  readonly title: string
  readonly summary: string
  readonly category: string
  readonly filename: string
  readonly tags: readonly string[]
  readonly content: string
}): string {
  return normalizeSearchValue(
    [
      options.title,
      options.summary,
      options.category,
      options.filename,
      options.tags.join(' '),
      stripMarkdownForSearch(options.content)
    ].join('\n')
  )
}

function stripMarkdownForSearch(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[，。、“”‘’：；！？,.!?:;()[\]{}\\/|'"`~@#$%^&*=+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimSummary(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value
}

function generateTitle(filename: string, summary: string): string {
  const cleanName = basename(filename, '.md')
  const noiseStarts = [
    '未知主题',
    '1',
    'Base directory',
    'Unknown',
    'hello',
    'Users',
    '。',
    'Create an Agent',
    'Claude--help',
    "'UserstiamoDesktop"
  ]
  const isNoisy = noiseStarts.some((value) => cleanName.startsWith(value)) || cleanName.length > 30

  if (!isNoisy && cleanName.length > 3) {
    return cleanName
  }

  const title = summary.split('。')[0]?.split('，')[0]?.split('\n')[0]?.trim() ?? cleanName
  const sanitized = title.replace(/<[^>]+>/g, '').replace(/\[.*?\]/g, '').trim()

  if (!sanitized) {
    return cleanName
  }

  return sanitized.length > 50 ? `${sanitized.slice(0, 50)}...` : sanitized
}

function countMessages(content: string): number {
  return (content.match(/(##\s*👤|#\s*you asked)/g) ?? []).length
}

function countWords(content: string): number {
  const cleaned = content.replace(/```[\s\S]*?```/g, '').replace(/[#*_\->`~\[\]()!|]/g, '').trim()
  const chineseChars = (cleaned.match(/[\u4e00-\u9fff]/g) ?? []).length
  const englishWords = (cleaned.match(/[a-zA-Z]+/g) ?? []).length

  return chineseChars + englishWords
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '')
}

async function generateMemoryFileId(filePath: string, size: number): Promise<string> {
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

function normalizeFileSize(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
