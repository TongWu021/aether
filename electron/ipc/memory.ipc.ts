import { app, ipcMain } from 'electron'

import type { ShortTermMemoryMeta } from '../../src/types/memory'
import { loadMemoryDashboard, renameMemoryEntry } from '../services/memory-dashboard'
import { MetadataStore } from '../services/metadata-store'

let metadataStore: MetadataStore | null = null

function getMetadataStore(): MetadataStore {
  if (!metadataStore) {
    metadataStore = new MetadataStore({
      dataDir: app.getPath('userData')
    })
  }

  return metadataStore
}

export function registerMemoryIpc(): void {
  ipcMain.handle('memory:load', async () => {
    const store = getMetadataStore()
    await store.load()
    return store.getAll()
  })

  ipcMain.handle('memory:scan', async (_event, memoryDir: string) => {
    const store = getMetadataStore()
    await store.load()
    return store.scanMemoryDir(memoryDir)
  })

  ipcMain.handle('memory:get-all', async () => {
    const store = getMetadataStore()
    await store.load()
    return store.getAll()
  })

  ipcMain.handle('memory:dashboard', async (_event, memoryDir: string) => {
    const store = getMetadataStore()
    await store.load()
    await store.scanMemoryDir(memoryDir)
    return loadMemoryDashboard(memoryDir, store)
  })

  ipcMain.handle(
    'memory:update-meta',
    async (
      _event,
      fileId: string,
      updates: Partial<Pick<ShortTermMemoryMeta, 'title' | 'tags' | 'status'>>
    ) => {
      const store = getMetadataStore()
      await store.load()
      return store.updateMeta(fileId, updates)
    }
  )

  ipcMain.handle('memory:get-tags', async () => {
    const store = getMetadataStore()
    await store.load()
    return store.getAllTags()
  })

  ipcMain.handle('memory:rename-entry', async (_event, memoryDir: string, filePath: string, newTitle: string) => {
    const store = getMetadataStore()
    await store.load()
    await store.scanMemoryDir(memoryDir)
    return renameMemoryEntry(memoryDir, filePath, newTitle, store)
  })
}
