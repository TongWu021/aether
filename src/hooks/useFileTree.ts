import { useCallback, useState } from 'react'

import type { FileNode } from '../types'

interface UseFileTreeReturn {
  readonly tree: FileNode | null
  readonly loading: boolean
  readonly error: string | null
  readonly scanDirectory: (dirPath: string, options?: ScanTreeOptions) => Promise<void>
  readonly loadDirectory: (dirPath: string) => Promise<void>
  readonly resetTree: () => void
  readonly selectedFile: FileNode | null
  readonly selectFile: (node: FileNode | null) => void
}

interface ScanTreeOptions {
  readonly hydratePaths?: readonly string[]
  readonly preserveSelectedPath?: string | null
}

export function useFileTree(): UseFileTreeReturn {
  const [tree, setTree] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)

  const scanDirectory = useCallback(async (dirPath: string, options: ScanTreeOptions = {}) => {
    setLoading(true)
    setError(null)

    try {
      const nextTree = await window.electronAPI.file.scanWorkspace(dirPath, { maxDepth: 2 })
      const hydratedTree = await hydrateTree(nextTree, options.hydratePaths)
      const preservedPath = options.preserveSelectedPath

      setTree(hydratedTree)
      setSelectedFile((current) => {
        const targetPath = preservedPath ?? current?.path
        return targetPath ? findNodeByPath(hydratedTree, targetPath) : null
      })
    } catch (scanError) {
      setTree(null)
      setSelectedFile(null)
      setError(toErrorMessage(scanError))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDirectory = useCallback(async (dirPath: string) => {
    if (!tree) {
      return
    }

    try {
      const rawNode = await window.electronAPI.file.scanWorkspace(dirPath, { maxDepth: 1 })
      const nextNode = rebaseNodeRelativePaths(rawNode, tree.path)

      setTree((currentTree) => (currentTree ? replaceNode(currentTree, dirPath, nextNode) : currentTree))
      setSelectedFile((current) =>
        current && current.path.startsWith(dirPath)
          ? findNodeByPath(nextNode, current.path) ?? current
          : current
      )
    } catch (scanError) {
      setError(toErrorMessage(scanError))
    }
  }, [tree])

  const selectFile = useCallback((node: FileNode | null) => {
    setSelectedFile(node)
  }, [])

  const resetTree = useCallback(() => {
    setTree(null)
    setLoading(false)
    setError(null)
    setSelectedFile(null)
  }, [])

  return {
    tree,
    loading,
    error,
    scanDirectory,
    loadDirectory,
    resetTree,
    selectedFile,
    selectFile
  }
}

async function hydrateTree(root: FileNode, hydratePaths: readonly string[] | undefined): Promise<FileNode> {
  if (!hydratePaths || hydratePaths.length === 0) {
    return root
  }

  let nextTree = root
  const normalizedPaths = [...new Set(hydratePaths)].sort(comparePathDepth)

  for (const path of normalizedPaths) {
    const targetNode = findNodeByPath(nextTree, path)

    if (!targetNode || targetNode.type !== 'directory') {
      continue
    }

    const loadedNode = await window.electronAPI.file.scanWorkspace(path, { maxDepth: 1 })
    nextTree = replaceNode(nextTree, path, rebaseNodeRelativePaths(loadedNode, root.path))
  }

  return nextTree
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '扫描文件夹时发生未知错误'
}

function findNodeByPath(node: FileNode, targetPath: string): FileNode | null {
  if (node.path === targetPath) {
    return node
  }

  if (node.type === 'file' || !node.children) {
    return null
  }

  for (const child of node.children) {
    const match = findNodeByPath(child, targetPath)

    if (match) {
      return match
    }
  }

  return null
}

function replaceNode(root: FileNode, targetPath: string, nextNode: FileNode): FileNode {
  if (root.path === targetPath) {
    return nextNode
  }

  if (root.type === 'file' || !root.children) {
    return root
  }

  return {
    ...root,
    children: root.children.map((child) => replaceNode(child, targetPath, nextNode))
  }
}

function rebaseNodeRelativePaths(node: FileNode, workspaceRootPath: string): FileNode {
  const normalizedRootPath = normalizePath(workspaceRootPath)
  const normalizedNodePath = normalizePath(node.path)
  const relativePath =
    normalizedNodePath === normalizedRootPath
      ? ''
      : normalizedNodePath.slice(normalizedRootPath.length + 1)

  return {
    ...node,
    relativePath,
    children:
      node.type === 'directory' && node.children
        ? node.children.map((child) => rebaseNodeRelativePaths(child, workspaceRootPath))
        : node.children
  }
}

function comparePathDepth(left: string, right: string): number {
  const depthDifference = getPathDepth(left) - getPathDepth(right)
  return depthDifference !== 0 ? depthDifference : left.localeCompare(right)
}

function getPathDepth(value: string): number {
  return value.split(/[\\/]/).filter(Boolean).length
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}
