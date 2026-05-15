import type { FileNode } from './file'

/** 长期记忆：本质上就是一个 .md 文件，驾驶舱提供可视化编辑 */
export interface LongTermMemory {
  readonly filePath: string
  readonly content: string
  readonly lastModified: string
}

/** 短期记忆条目：对话记录文件 + 元数据 */
export interface ShortTermMemoryEntry {
  readonly fileNode: FileNode
  readonly title: string
  readonly tags: readonly string[]
  readonly createdAt: string
  readonly lastUpdatedAt: string
  readonly wordCount: number
}

/** 对话记录的处理状态 */
export type MemoryProcessingStatus = 'pending' | 'processed' | 'failed'

/** 短期记忆条目（含处理状态，供 metadata-store 使用） */
export interface ShortTermMemoryMeta {
  readonly fileId: string
  readonly title: string
  readonly tags: readonly string[]
  readonly status: MemoryProcessingStatus
  readonly createdAt: string
  readonly lastUpdatedAt: string
  readonly wordCount: number
}

export interface ShortTermMemoryCard {
  readonly fileId: string
  readonly filename: string
  readonly filePath: string
  readonly title: string
  readonly summary: string
  readonly category: string
  readonly searchText: string
  readonly tags: readonly string[]
  readonly status: MemoryProcessingStatus
  readonly createdAt: string
  readonly lastUpdatedAt: string
  readonly wordCount: number
  readonly msgCount: number
  readonly fileSize: number
  readonly isEmpty: boolean
}

export interface MemoryRenameResult {
  readonly oldFilePath: string
  readonly newFilePath: string
  readonly newFilename: string
  readonly title: string
}
