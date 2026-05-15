import { watch as watchFileSystem, type FSWatcher } from 'node:fs'
import { lstat } from 'node:fs/promises'
import { resolve } from 'node:path'

import { shouldIgnorePath } from './file-ignore'

const MAX_WATCHED_DIRECTORIES = 96

export interface FileChangeEvent {
  readonly type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  readonly path: string
}

export type FileChangeCallback = (events: readonly FileChangeEvent[]) => void

/**
 * 文件监听服务
 *
 * 设计要点：
 * - 纯 Node.js，不 import electron
 * - 只监听当前 UI 已加载的目录，避免对大工作区递归建 watcher
 * - 300ms debounce：收集短时间内的所有变化，批量通知
 * - 支持同时监听多个目录
 * - 支持动态添加/移除监听目录
 */
export class FileWatcher {
  private watchers = new Map<string, FSWatcher>()
  private readonly callback: FileChangeCallback
  private pendingEvents: FileChangeEvent[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs: number
  private watchedPaths = new Set<string>()

  constructor(options: {
    readonly onChange: FileChangeCallback
    readonly debounceMs?: number
  }) {
    this.callback = options.onChange
    this.debounceMs = options.debounceMs ?? 300
  }

  /** 开始监听指定目录列表 */
  watch(paths: readonly string[]): void {
    this.close()

    if (paths.length === 0) {
      return
    }

    const normalizedPaths = [...new Set(paths.map((path) => resolve(path)))]
      .filter((path) => !shouldIgnorePath(path))
      .sort(comparePathDepth)
      .slice(0, MAX_WATCHED_DIRECTORIES)

    if (normalizedPaths.length === 0) {
      return
    }

    if (normalizedPaths.length < paths.length) {
      console.warn(
        `[FileWatcher] Reduced watch scope from ${paths.length} to ${normalizedPaths.length} directories.`
      )
    }

    this.watchedPaths = new Set(normalizedPaths)

    for (const dirPath of normalizedPaths) {
      this.attachWatcher(dirPath)
    }
  }

  /** 添加一个新的监听目录（不影响已有的） */
  addPath(dirPath: string): void {
    const normalizedPath = resolve(dirPath)

    if (this.watchedPaths.has(normalizedPath)) {
      return
    }

    if (this.watchedPaths.size >= MAX_WATCHED_DIRECTORIES) {
      console.warn(
        `[FileWatcher] Watch scope limit (${MAX_WATCHED_DIRECTORIES}) reached, skipping ${normalizedPath}.`
      )
      return
    }

    this.watchedPaths.add(normalizedPath)
    this.attachWatcher(normalizedPath)
  }

  /** 移除一个监听目录 */
  removePath(dirPath: string): void {
    const normalizedPath = resolve(dirPath)
    this.watchedPaths.delete(normalizedPath)
    this.closeWatcher(normalizedPath)
  }

  /** 关闭所有监听 */
  close(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.pendingEvents.length > 0) {
      this.flush()
    }

    for (const path of [...this.watchers.keys()]) {
      this.closeWatcher(path)
    }

    this.watchedPaths.clear()
  }

  /** 获取当前监听的目录列表 */
  getWatchedPaths(): readonly string[] {
    return [...this.watchedPaths]
  }

  private enqueue(event: FileChangeEvent): void {
    this.pendingEvents.push(event)

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.flush()
    }, this.debounceMs)
  }

  private flush(): void {
    if (this.pendingEvents.length === 0) {
      return
    }

    const events = [...this.pendingEvents]
    this.pendingEvents = []
    this.debounceTimer = null

    this.callback(events)
  }

  private attachWatcher(dirPath: string): void {
    try {
      const watcher = watchFileSystem(dirPath, { persistent: true }, (eventType, fileName) => {
        void this.handleWatchEvent(dirPath, eventType, fileName?.toString())
      })

      watcher.on('error', (error) => {
        this.handleWatchError(dirPath, error)
      })

      this.watchers.set(dirPath, watcher)
    } catch (error) {
      this.handleWatchError(dirPath, error)
    }
  }

  private closeWatcher(dirPath: string): void {
    const watcher = this.watchers.get(dirPath)

    if (!watcher) {
      return
    }

    watcher.removeAllListeners()
    watcher.close()
    this.watchers.delete(dirPath)
  }

  private async handleWatchEvent(
    watchedDirectory: string,
    eventType: 'rename' | 'change',
    fileName?: string
  ): Promise<void> {
    const targetPath = fileName ? resolve(watchedDirectory, fileName) : watchedDirectory

    if (shouldIgnorePath(targetPath)) {
      return
    }

    if (eventType === 'change') {
      this.enqueue({ type: 'change', path: targetPath })
      return
    }

    this.enqueue(await classifyRenameEvent(targetPath))
  }

  private handleWatchError(dirPath: string, error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error)

    if (isErrnoException(error) && error.code === 'EMFILE') {
      console.warn(
        `[FileWatcher] Watch limit reached while watching ${dirPath}. Auto-refresh will stay limited to the remaining open directories.`
      )
      this.closeWatcher(dirPath)
      this.watchedPaths.delete(dirPath)
      return
    }

    console.warn('[FileWatcher] Error:', reason)
  }
}

async function classifyRenameEvent(targetPath: string): Promise<FileChangeEvent> {
  try {
    const stats = await lstat(targetPath)

    return {
      type: stats.isDirectory() ? 'addDir' : 'add',
      path: targetPath
    }
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return {
        type: 'unlink',
        path: targetPath
      }
    }

    return {
      type: 'change',
      path: targetPath
    }
  }
}

function comparePathDepth(left: string, right: string): number {
  const depthDifference = getPathDepth(left) - getPathDepth(right)
  return depthDifference !== 0 ? depthDifference : left.localeCompare(right)
}

function getPathDepth(value: string): number {
  return value.split(/[\\/]/).filter(Boolean).length
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}
