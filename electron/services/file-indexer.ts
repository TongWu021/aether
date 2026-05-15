import { createHash } from 'node:crypto'
import { lstat, readdir, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import type { FileNode } from '../../src/types/file'
import { shouldIgnoreEntryName } from './file-ignore'

export interface ScanDirectoryOptions {
  readonly maxDepth?: number
}

export function generateFileId(filePath: string, size: number, modifiedAt: string): string {
  const hash = createHash('md5')
  hash.update(filePath)
  hash.update(String(size))
  hash.update(modifiedAt)
  return hash.digest('hex')
}

export async function scanDirectory(
  rootPath: string,
  options: ScanDirectoryOptions = {}
): Promise<FileNode> {
  if (!isAbsolute(rootPath)) {
    throw new Error(`Root path must be an absolute path: ${rootPath}`)
  }

  const normalizedRootPath = resolve(rootPath)
  const rootStats = await getRootStats(normalizedRootPath)

  if (!rootStats.isDirectory()) {
    throw new Error(`Root path is not a directory: ${normalizedRootPath}`)
  }

  return buildDirectoryNode(normalizedRootPath, normalizedRootPath, rootStats, options.maxDepth)
}

export async function listFiles(rootPath: string): Promise<readonly FileNode[]> {
  if (!isAbsolute(rootPath)) {
    throw new Error(`Root path must be an absolute path: ${rootPath}`)
  }

  const normalizedRootPath = resolve(rootPath)
  const rootStats = await getRootStats(normalizedRootPath)

  if (!rootStats.isDirectory()) {
    throw new Error(`Root path is not a directory: ${normalizedRootPath}`)
  }

  const files: FileNode[] = []
  await collectFiles(normalizedRootPath, normalizedRootPath, files)
  files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' })
  )
  return files
}

async function getRootStats(rootPath: string) {
  try {
    return await stat(rootPath)
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new Error(`Root path does not exist: ${rootPath}`)
    }

    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to access root path "${rootPath}": ${reason}`)
  }
}

async function buildDirectoryNode(
  directoryPath: string,
  rootPath: string,
  directoryStats: Awaited<ReturnType<typeof stat>>,
  depthRemaining?: number
): Promise<FileNode> {
  if (depthRemaining !== undefined && depthRemaining <= 0) {
    return createDirectoryNode(directoryPath, rootPath, directoryStats)
  }

  const directoryEntries = await readdir(directoryPath, { withFileTypes: true })
  const children: FileNode[] = []
  const nextDepth = depthRemaining === undefined ? undefined : depthRemaining - 1

  for (const entry of directoryEntries) {
    if (shouldIgnoreEntry(entry.name)) {
      continue
    }

    const entryPath = join(directoryPath, entry.name)

    try {
      const entryStats = await lstat(entryPath)

      if (entryStats.isDirectory()) {
        children.push(await buildDirectoryNode(entryPath, rootPath, entryStats, nextDepth))
        continue
      }

      if (entryStats.isFile()) {
        children.push(await buildFileNode(entryPath, rootPath, entryStats))
        continue
      }

      console.warn(`[file-indexer] Skipping unsupported entry: ${entryPath}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`[file-indexer] Skipping "${entryPath}": ${reason}`)
    }
  }

  children.sort(compareNodes)

  return {
    ...createDirectoryNode(directoryPath, rootPath, directoryStats),
    children,
    childrenLoaded: true
  }
}

async function collectFiles(directoryPath: string, rootPath: string, files: FileNode[]): Promise<void> {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true })

  for (const entry of directoryEntries) {
    if (shouldIgnoreEntry(entry.name)) {
      continue
    }

    const entryPath = join(directoryPath, entry.name)

    try {
      const entryStats = await lstat(entryPath)

      if (entryStats.isDirectory()) {
        await collectFiles(entryPath, rootPath, files)
        continue
      }

      if (entryStats.isFile()) {
        files.push(await buildFileNode(entryPath, rootPath, entryStats))
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`[file-indexer] Skipping "${entryPath}": ${reason}`)
    }
  }
}

function createDirectoryNode(
  directoryPath: string,
  rootPath: string,
  directoryStats: Awaited<ReturnType<typeof stat>>
): FileNode {
  return {
    id: hashString(directoryPath),
    name: basename(directoryPath),
    path: directoryPath,
    relativePath: toRelativePath(rootPath, directoryPath),
    type: 'directory',
    modifiedAt: directoryStats.mtime.toISOString(),
    children: [],
    childrenLoaded: false
  }
}

async function buildFileNode(filePath: string, rootPath: string, fileStats: Awaited<ReturnType<typeof lstat>>): Promise<FileNode> {
  const extension = extname(filePath).replace(/^\./, '') || undefined
  const size = normalizeFileSize(fileStats.size)
  const modifiedAt = fileStats.mtime.toISOString()

  return {
    id: generateFileId(filePath, size, modifiedAt),
    name: basename(filePath),
    path: filePath,
    relativePath: toRelativePath(rootPath, filePath),
    type: 'file',
    extension,
    size,
    modifiedAt
  }
}

function compareNodes(left: FileNode, right: FileNode): number {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

function toRelativePath(rootPath: string, targetPath: string): string {
  const value = relative(rootPath, targetPath)
  return value === '' ? '' : value.split(sep).join('/')
}

function hashString(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

function normalizeFileSize(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value
}

function shouldIgnoreEntry(name: string): boolean {
  return shouldIgnoreEntryName(name)
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}
