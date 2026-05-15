import type { Annotation } from './annotation'
import type { FileNode } from './file'
import type { CockpitConfig, LlmProviderConfig, WorkspaceConfig } from './config'
import type { MemoryRenameResult, ShortTermMemoryCard, ShortTermMemoryMeta } from './memory'
import type { BackupEntry, SheetDocument } from './sheet'

type IpcResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string }

interface FileChangeEvent {
  readonly type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  readonly path: string
}

interface FileAPI {
  scanWorkspace: (dirPath: string, options?: { maxDepth?: number }) => Promise<FileNode>
  listFiles: (dirPath: string) => Promise<readonly FileNode[]>
  selectDirectory: () => Promise<string | null>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  copyPath: (filePath: string) => Promise<boolean>
  watch: (paths: string[]) => Promise<boolean>
  unwatch: () => Promise<boolean>
  onFileChanges: (callback: (events: FileChangeEvent[]) => void) => () => void
}

interface ConfigAPI {
  load: () => Promise<CockpitConfig>
  get: () => Promise<CockpitConfig>
  save: (config: CockpitConfig) => Promise<boolean>
  addWorkspace: (workspace: Omit<WorkspaceConfig, 'id'>) => Promise<CockpitConfig>
  removeWorkspace: (id: string) => Promise<CockpitConfig>
  addLlmProvider: (provider: Omit<LlmProviderConfig, 'id'>) => Promise<CockpitConfig>
  removeLlmProvider: (id: string) => Promise<CockpitConfig>
  getApiKey: (providerId: string) => Promise<string | undefined>
}

interface MemoryAPI {
  load: () => Promise<readonly ShortTermMemoryMeta[]>
  scan: (memoryDir: string) => Promise<readonly ShortTermMemoryMeta[]>
  getAll: () => Promise<readonly ShortTermMemoryMeta[]>
  dashboard: (memoryDir: string) => Promise<readonly ShortTermMemoryCard[]>
  updateMeta: (
    fileId: string,
    updates: Partial<Pick<ShortTermMemoryMeta, 'title' | 'tags' | 'status'>>
  ) => Promise<ShortTermMemoryMeta | undefined>
  getTags: () => Promise<readonly string[]>
  renameEntry: (
    memoryDir: string,
    filePath: string,
    newTitle: string
  ) => Promise<MemoryRenameResult>
}

interface LlmAPI {
  testConnection: (
    providerId: string
  ) => Promise<{ success: boolean; data: boolean; error?: string }>
  chat: (
    documentContent: string,
    question: string,
    history: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[]
  ) => Promise<{
    success: boolean
    answer: string
    error?: string
  }>
}

interface ContextAPI {
  build: (folderPath: string) => Promise<string>
  buildFile: (filePath: string) => Promise<string>
}

interface AnnotationAPI {
  list: (filePath: string) => Promise<readonly Annotation[]>
  add: (
    filePath: string,
    data: {
      selectedText: string
      comment: string
      lineStart: number
      lineEnd: number
      anchor?: Annotation['anchor']
    }
  ) => Promise<Annotation>
  update: (filePath: string, id: string, updates: { comment: string }) => Promise<Annotation | null>
  delete: (filePath: string, id: string) => Promise<boolean>
  deleteAll: (filePath: string) => Promise<boolean>
  export: (filePath: string, annotations: readonly Annotation[]) => Promise<string>
}

interface MemoAPI {
  get: (filePath: string) => Promise<string>
  save: (filePath: string, content: string) => Promise<boolean>
  delete: (filePath: string) => Promise<boolean>
  export: (filePath: string, content: string) => Promise<string>
}

interface ExcelAPI {
  read: (filePath: string) => Promise<IpcResult<SheetDocument>>
  save: (
    filePath: string,
    doc: SheetDocument
  ) => Promise<IpcResult<{ readonly backupCreated: string }>>
  listBackups: (filePath: string) => Promise<IpcResult<readonly BackupEntry[]>>
  previewBackup: (filePath: string, backupName: string) => Promise<IpcResult<SheetDocument>>
  restoreBackup: (
    filePath: string,
    backupName: string
  ) => Promise<IpcResult<{ readonly restored: true }>>
  selectBackupDir: () => Promise<IpcResult<string>>
  migrateBackupDir: (
    fromDir: string,
    toDir: string
  ) => Promise<IpcResult<{ readonly migrated: true }>>
}

interface UpdateCheckData {
  readonly hasUpdate: boolean
  readonly currentVersion: string
  readonly latestVersion: string | null
  readonly releaseUrl: string | null
  readonly publishedAt: string | null
}

interface VersionAPI {
  current: () => Promise<string>
  checkLatest: () => Promise<
    | { readonly success: true; readonly data: UpdateCheckData }
    | { readonly success: false; readonly error: string }
  >
}

interface ElectronAPI {
  file: FileAPI
  config: ConfigAPI
  llm: LlmAPI
  context: ContextAPI
  memory: MemoryAPI
  annotation: AnnotationAPI
  memo: MemoAPI
  excel: ExcelAPI
  version: VersionAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
