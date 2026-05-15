import type { CockpitConfig, FileNode } from '../types'

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function getParentDirectory(path: string): string | null {
  const normalizedPath = path.trim().replace(/\\/g, '/')

  if (!normalizedPath) {
    return null
  }

  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  return lastSlashIndex > 0 ? normalizedPath.slice(0, lastSlashIndex) : null
}

export function getAncestorDirectoryPaths(
  workspacePath: string | null,
  targetPath: string | null
): string[] {
  if (!workspacePath || !targetPath || !isPathInsideWorkspace(workspacePath, targetPath)) {
    return []
  }

  const normalizedWorkspacePath = normalizePath(workspacePath)
  const parentDirectory = getParentDirectory(targetPath)

  if (!parentDirectory || normalizePath(parentDirectory) === normalizedWorkspacePath) {
    return []
  }

  const relativePath = normalizePath(parentDirectory).slice(normalizedWorkspacePath.length + 1)
  const segments = relativePath.split('/').filter(Boolean)

  return segments.map(
    (_, index) => `${normalizedWorkspacePath}/${segments.slice(0, index + 1).join('/')}`
  )
}

export function isPathInsideWorkspace(workspacePath: string, targetPath: string): boolean {
  const normalizedWorkspacePath = normalizePath(workspacePath)
  const normalizedTargetPath = normalizePath(targetPath)

  return (
    normalizedTargetPath === normalizedWorkspacePath ||
    normalizedTargetPath.startsWith(`${normalizedWorkspacePath}/`)
  )
}

export function collectHydratePaths(
  workspacePath: string,
  expandedPaths: ReadonlySet<string>,
  selectedFilePath: string | null
): string[] {
  const workspaceExpandedPaths = [...expandedPaths].filter((path) =>
    isPathInsideWorkspace(workspacePath, path)
  )

  return [...new Set([...workspaceExpandedPaths, ...getAncestorDirectoryPaths(workspacePath, selectedFilePath)])]
}

export function findAncestorPaths(root: FileNode, targetPath: string): string[] {
  const search = (node: FileNode, path: readonly string[]): string[] | null => {
    if (node.path === targetPath) {
      return [...path]
    }

    if (node.type !== 'directory' || !node.children) {
      return null
    }

    for (const child of node.children) {
      const result = search(child, [...path, node.path])

      if (result) {
        return result
      }
    }

    return null
  }

  return search(root, []) ?? []
}

export function mergeExpandedPaths(
  paths: ReadonlySet<string> | undefined,
  additions: readonly string[]
): Set<string> {
  return additions.reduce((nextPaths, path) => {
    nextPaths.add(path)
    return nextPaths
  }, new Set(paths))
}

export function toggleExpandedPath(
  paths: ReadonlySet<string> | undefined,
  path: string,
  expanded: boolean
): Set<string> {
  const nextPaths = new Set(paths)

  if (expanded) {
    nextPaths.add(path)
  } else {
    nextPaths.delete(path)
  }

  return nextPaths
}

export function normalizeDirectory(path: string): string | null {
  const normalizedPath = normalizePath(path.trim())
  return normalizedPath ? normalizedPath : null
}

export function getMemoryDirectory(config: CockpitConfig): string | null {
  return (
    normalizeDirectory(config.memory.shortTermDir) ??
    normalizeDirectory(config.dialogRecorder.outputDir) ??
    getParentDirectory(config.memory.longTermFile)
  )
}
