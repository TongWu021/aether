import type { FileNode } from '../types'

export type FileKind = 'text' | 'sheet' | 'unsupported'

export function getFileKind(node: FileNode | null): FileKind {
  if (!node || node.type !== 'file') {
    return 'unsupported'
  }

  const extension = node.extension?.toLowerCase()

  if (extension === 'md' || extension === 'txt') {
    return 'text'
  }

  if (extension === 'csv' || extension === 'xlsx') {
    return 'sheet'
  }

  return 'unsupported'
}

export function isSheetFile(node: FileNode | null): node is FileNode {
  return getFileKind(node) === 'sheet'
}

export function isTextFile(node: FileNode | null): node is FileNode {
  if (!node || node.type !== 'file') {
    return false
  }

  const extension = node.extension?.toLowerCase()
  return extension === 'md' || extension === 'txt'
}

export function countTreeStats(tree: FileNode | null): { files: number; directories: number } {
  if (!tree) {
    return { files: 0, directories: 0 }
  }

  return (tree.children ?? []).reduce(
    (acc, child) => {
      const childCounts = countNodeStats(child)
      return {
        files: acc.files + childCounts.files,
        directories: acc.directories + childCounts.directories
      }
    },
    { files: 0, directories: 0 }
  )
}

function countNodeStats(node: FileNode): { files: number; directories: number } {
  if (node.type === 'file') {
    return { files: 1, directories: 0 }
  }

  return (node.children ?? []).reduce(
    (acc, child) => {
      const childCounts = countNodeStats(child)
      return {
        files: acc.files + childCounts.files,
        directories: acc.directories + childCounts.directories
      }
    },
    { files: 0, directories: 1 }
  )
}

export function toReadErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '读取 Markdown 失败'
  return `读取失败: ${detail}`
}

export function toSaveErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '保存 Markdown 失败'
  return `保存失败: ${detail}`
}

export function toCopyErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '复制路径失败'
  return `复制失败: ${detail}`
}

export function getModulePlaceholder(module: string): string {
  switch (module) {
    case 'prd':
      return 'PRD 中心模块将在后续阶段接入。'
    default:
      return ''
  }
}
