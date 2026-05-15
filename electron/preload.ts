import { contextBridge, ipcRenderer } from 'electron'

import type { Annotation } from '../src/types/annotation'

contextBridge.exposeInMainWorld('electronAPI', {
  file: {
    scanWorkspace: (dirPath: string, options?: { maxDepth?: number }) =>
      ipcRenderer.invoke('file:scan-workspace', dirPath, options),
    listFiles: (dirPath: string) => ipcRenderer.invoke('file:list-files', dirPath),
    selectDirectory: () => ipcRenderer.invoke('file:select-directory'),
    readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('file:write', filePath, content),
    copyPath: (filePath: string) => ipcRenderer.invoke('file:copy-path', filePath),
    watch: (paths: string[]) => ipcRenderer.invoke('file:watch', paths),
    unwatch: () => ipcRenderer.invoke('file:unwatch'),
    onFileChanges: (callback: (events: unknown[]) => void) => {
      const handler = (_event: unknown, events: unknown[]) => callback(events)
      ipcRenderer.on('file:changes', handler)

      return () => ipcRenderer.removeListener('file:changes', handler)
    }
  },
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    get: () => ipcRenderer.invoke('config:get'),
    save: (config: unknown) => ipcRenderer.invoke('config:save', config),
    addWorkspace: (workspace: unknown) => ipcRenderer.invoke('config:add-workspace', workspace),
    removeWorkspace: (id: string) => ipcRenderer.invoke('config:remove-workspace', id),
    addLlmProvider: (provider: unknown) => ipcRenderer.invoke('config:add-llm-provider', provider),
    removeLlmProvider: (id: string) => ipcRenderer.invoke('config:remove-llm-provider', id),
    getApiKey: (providerId: string) => ipcRenderer.invoke('config:get-api-key', providerId)
  },
  llm: {
    testConnection: (providerId: string) => ipcRenderer.invoke('llm:test-connection', providerId),
    chat: (
      documentContent: string,
      question: string,
      history: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[]
    ) => ipcRenderer.invoke('ai:chat', documentContent, question, history)
  },
  context: {
    build: (folderPath: string) => ipcRenderer.invoke('context:build', folderPath),
    buildFile: (filePath: string) => ipcRenderer.invoke('context:build-file', filePath)
  },
  memory: {
    load: () => ipcRenderer.invoke('memory:load'),
    scan: (memoryDir: string) => ipcRenderer.invoke('memory:scan', memoryDir),
    getAll: () => ipcRenderer.invoke('memory:get-all'),
    dashboard: (memoryDir: string) => ipcRenderer.invoke('memory:dashboard', memoryDir),
    updateMeta: (fileId: string, updates: unknown) =>
      ipcRenderer.invoke('memory:update-meta', fileId, updates),
    getTags: () => ipcRenderer.invoke('memory:get-tags'),
    renameEntry: (memoryDir: string, filePath: string, newTitle: string) =>
      ipcRenderer.invoke('memory:rename-entry', memoryDir, filePath, newTitle)
  },
  annotation: {
    list: (filePath: string): Promise<readonly Annotation[]> =>
      ipcRenderer.invoke('annotation:list', filePath),
    add: (
      filePath: string,
      data: {
        selectedText: string
        comment: string
        lineStart: number
        lineEnd: number
        anchor?: Annotation['anchor']
      }
    ): Promise<Annotation> => ipcRenderer.invoke('annotation:add', filePath, data),
    update: (
      filePath: string,
      id: string,
      updates: { comment: string }
    ): Promise<Annotation | null> => ipcRenderer.invoke('annotation:update', filePath, id, updates),
    delete: (filePath: string, id: string): Promise<boolean> =>
      ipcRenderer.invoke('annotation:delete', filePath, id),
    deleteAll: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke('annotation:delete-all', filePath),
    export: (filePath: string, annotations: readonly Annotation[]): Promise<string> =>
      ipcRenderer.invoke('annotation:export', filePath, annotations)
  },
  memo: {
    get: (filePath: string): Promise<string> => ipcRenderer.invoke('memo:get', filePath),
    save: (filePath: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke('memo:save', filePath, content),
    delete: (filePath: string): Promise<boolean> => ipcRenderer.invoke('memo:delete', filePath),
    export: (filePath: string, content: string): Promise<string> =>
      ipcRenderer.invoke('memo:export', filePath, content)
  },
  excel: {
    read: (filePath: string) => ipcRenderer.invoke('excel:read', filePath),
    save: (filePath: string, doc: unknown) => ipcRenderer.invoke('excel:save', filePath, doc),
    listBackups: (filePath: string) => ipcRenderer.invoke('excel:list-backups', filePath),
    previewBackup: (filePath: string, backupName: string) =>
      ipcRenderer.invoke('excel:preview-backup', filePath, backupName),
    restoreBackup: (filePath: string, backupName: string) =>
      ipcRenderer.invoke('excel:restore-backup', filePath, backupName),
    selectBackupDir: () => ipcRenderer.invoke('excel:select-backup-dir'),
    migrateBackupDir: (fromDir: string, toDir: string) =>
      ipcRenderer.invoke('excel:migrate-backup-dir', fromDir, toDir)
  }
})
