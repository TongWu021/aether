import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

let dataDir = ''

interface MemoRecord {
  readonly filePath: string
  readonly content: string
  readonly updatedAt: string
}

export function initMemoStore(dir: string): void {
  dataDir = dir
}

export async function getMemo(filePath: string): Promise<string> {
  const targetPath = getDataPath(filePath)

  if (!(await pathExists(targetPath))) {
    return ''
  }

  const content = await readFile(targetPath, 'utf8')
  return (JSON.parse(content) as MemoRecord).content
}

export async function saveMemo(filePath: string, content: string): Promise<boolean> {
  if (!content) {
    return deleteMemo(filePath)
  }

  ensureDataDir()
  await mkdir(dataDir, { recursive: true })
  const targetPath = getDataPath(filePath)
  const tempPath = `${targetPath}.tmp`
  const record: MemoRecord = { filePath, content, updatedAt: new Date().toISOString() }

  await writeFile(tempPath, JSON.stringify(record, null, 2), 'utf8')
  await rename(tempPath, targetPath)
  return true
}

export async function deleteMemo(filePath: string): Promise<boolean> {
  const targetPath = getDataPath(filePath)

  if (!(await pathExists(targetPath))) {
    return false
  }

  await unlink(targetPath)
  return true
}

export async function exportMemo(originalFilePath: string, content: string): Promise<string> {
  const fileName = basename(originalFilePath).replace(/\.[^.]+$/, '')
  const exportPath = join(dirname(originalFilePath), `${fileName}备忘.md`)
  const tempPath = `${exportPath}.tmp`

  await writeFile(tempPath, htmlToMarkdown(content), 'utf8')
  await rename(tempPath, exportPath)
  return exportPath
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getDataPath(filePath: string): string {
  ensureDataDir()
  const hash = createHash('sha256').update(filePath).digest('hex')
  return join(dataDir, `${hash}.json`)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

function ensureDataDir(): void {
  if (!dataDir) {
    throw new Error('Memo store is not initialized')
  }
}
