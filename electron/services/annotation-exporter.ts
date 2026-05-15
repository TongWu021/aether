import { rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import type { Annotation } from '../../src/types/annotation'

export async function exportAnnotations(
  filePath: string,
  annotations: readonly Annotation[]
): Promise<string> {
  if (annotations.length === 0) {
    throw new Error('没有可导出的批注')
  }

  const fileName = basename(filePath).replace(/\.[^.]+$/, '')
  const dir = dirname(filePath)
  const exportPath = join(dir, `${fileName}批注.md`)
  const content = formatAnnotationsMarkdown(filePath, fileName, annotations)
  const tmpPath = `${exportPath}.tmp`

  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, exportPath)

  return exportPath
}

function formatAnnotationsMarkdown(
  filePath: string,
  fileName: string,
  annotations: readonly Annotation[]
): string {
  const lines = [
    `# 批注: ${fileName}.md`,
    '',
    `> 原文件: ${filePath}`,
    `> 导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `> 共 ${annotations.length} 条批注`,
    ''
  ]
  const sorted = [...annotations].sort((left, right) => left.lineStart - right.lineStart)

  for (const [index, annotation] of sorted.entries()) {
    const lineRange =
      annotation.lineStart === annotation.lineEnd
        ? `第 ${annotation.lineStart} 行`
        : `第 ${annotation.lineStart}-${annotation.lineEnd} 行`

    lines.push(`## ${index + 1}. ${lineRange}`)
    lines.push('')
    lines.push(`> ${annotation.selectedText.split('\n').join('\n> ')}`)
    lines.push('')
    lines.push(annotation.comment)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
