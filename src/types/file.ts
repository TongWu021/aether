export type FileCategory = 'prd' | 'dialog' | 'skill' | 'mcp' | 'memory' | 'process' | 'other'

export interface FileMetadata {
  readonly tags: readonly string[]
  readonly summary?: string
  readonly title?: string
  readonly category?: FileCategory
  readonly starred?: boolean
  readonly lastOpenedAt?: string
}

export interface FileNode {
  readonly id: string // md5(文件前1KB + 文件大小)
  readonly name: string
  readonly path: string // 绝对路径
  readonly relativePath: string // 相对于工作区根目录
  readonly type: 'file' | 'directory'
  readonly extension?: string
  readonly size?: number
  readonly modifiedAt: string
  readonly children?: readonly FileNode[]
  readonly childrenLoaded?: boolean
  readonly metadata?: FileMetadata
}
