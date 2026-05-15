import { readdir, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

import type { Annotation } from '../../src/types/annotation'

interface FileContext {
  readonly name: string
  readonly absolutePath: string
  readonly relativePath: string
  readonly annotations: readonly Annotation[]
  readonly memo: string
}

export async function buildFileContext(
  filePath: string,
  annotations: readonly Annotation[],
  memo: string
): Promise<string> {
  const fileName = basename(filePath, extname(filePath))
  const dir = dirname(filePath)
  const outputPath = join(dir, `${fileName}_上下文.md`)
  const content = formatSingleFileContext(filePath, fileName, annotations, memo)
  const tmpPath = `${outputPath}.tmp`

  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, outputPath)
  return outputPath
}

function formatSingleFileContext(
  filePath: string,
  fileName: string,
  annotations: readonly Annotation[],
  memo: string
): string {
  const lines = [
    `# ${fileName} 上下文`,
    '',
    `> 文件路径: ${filePath}`,
    `> 生成时间: ${new Date().toLocaleString('zh-CN')}`,
    ''
  ]

  if (annotations.length > 0) {
    lines.push(...formatAnnotations(annotations))
  }

  const memoText = htmlToPlainText(memo)
  if (memoText) {
    lines.push('## 备忘', '', memoText, '')
  }

  if (annotations.length === 0 && !memoText) {
    lines.push('（无批注和备忘）', '')
  }

  return lines.join('\n')
}

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.tmp'])

export async function scanFolder(folderPath: string): Promise<readonly string[]> {
  const results: string[] = []

  await walkFolder(folderPath, results)
  return results.sort()
}

export async function buildContext(
  folderPath: string,
  fileContexts: readonly FileContext[]
): Promise<string> {
  const outputPath = join(folderPath, `${basename(folderPath)}_上下文.md`)
  const content = formatContext(basename(folderPath), folderPath, fileContexts)
  const tempPath = `${outputPath}.tmp`

  await writeFile(tempPath, content, 'utf-8')
  await rename(tempPath, outputPath)
  return outputPath
}

async function walkFolder(dir: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) {
      continue
    }

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await walkFolder(fullPath, results)
      continue
    }

    if (entry.isFile() && !entry.name.endsWith('_上下文.md')) {
      results.push(fullPath)
    }
  }
}

function formatContext(
  folderName: string,
  folderPath: string,
  files: readonly FileContext[]
): string {
  const header = createHeader(folderName, folderPath, files.length)
  const sections = files.flatMap((file) => formatFileSection(file))

  return [...header, ...sections].join('\n')
}

function createHeader(folderName: string, folderPath: string, fileCount: number): string[] {
  return [
    `# 项目上下文: ${folderName}`,
    '',
    `> 路径: ${folderPath}`,
    `> 生成时间: ${new Date().toLocaleString('zh-CN')}`,
    `> 共 ${fileCount} 个文件`,
    ''
  ]
}

function formatFileSection(file: FileContext): string[] {
  const memoText = htmlToPlainText(file.memo)
  const lines = [`## ${file.relativePath}`, `路径: ${file.absolutePath}`, '']

  if (file.annotations.length > 0) {
    lines.push(...formatAnnotations(file.annotations))
  }

  if (memoText) {
    lines.push('### 备忘', memoText, '')
  }

  if (file.annotations.length === 0 && !memoText) {
    lines.push('（无批注和备忘）', '')
  }

  lines.push('---', '')
  return lines
}

function formatAnnotations(annotations: readonly Annotation[]): string[] {
  const lines = ['### 批注']
  const sorted = [...annotations].sort((a, b) => a.lineStart - b.lineStart)

  for (const annotation of sorted) {
    lines.push(formatAnnotation(annotation))
  }

  lines.push('')
  return lines
}

function formatAnnotation(annotation: Annotation): string {
  const range =
    annotation.lineStart === annotation.lineEnd
      ? `第 ${annotation.lineStart} 行`
      : `第 ${annotation.lineStart}-${annotation.lineEnd} 行`

  return `- ${range} | 原文: "${truncateText(annotation.selectedText)}" → ${annotation.comment}`
}

function truncateText(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}...` : text
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '$1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
