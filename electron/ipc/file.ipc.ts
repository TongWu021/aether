import { BrowserWindow, ipcMain } from 'electron'

import { listFiles, scanDirectory, type ScanDirectoryOptions } from '../services/file-indexer'
import { FileWatcher, type FileChangeEvent } from '../services/file-watcher'

let fileWatcher: FileWatcher | null = null

export function registerFileIpc(): void {
  ipcMain.handle(
    'file:scan-workspace',
    async (_event, dirPath: string, options?: ScanDirectoryOptions) => {
      return scanDirectory(dirPath, options)
    }
  )

  ipcMain.handle('file:list-files', async (_event, dirPath: string) => {
    return listFiles(dirPath)
  })

  ipcMain.handle('file:select-directory', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择工作区文件夹'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const fs = await import('node:fs/promises')
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    const fs = await import('node:fs/promises')
    const tmpPath = `${filePath}.tmp`

    await fs.writeFile(tmpPath, content, 'utf-8')
    await fs.rename(tmpPath, filePath)

    return true
  })

  ipcMain.handle('file:copy-path', async (_event, filePath: string) => {
    const { clipboard } = await import('electron')
    clipboard.writeText(filePath)
    return true
  })

  ipcMain.handle('file:watch', async (_event, paths: string[]) => {
    fileWatcher?.close()

    fileWatcher = new FileWatcher({
      onChange: (events: readonly FileChangeEvent[]) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('file:changes', events)
        }
      }
    })

    fileWatcher.watch(paths)
    return true
  })

  ipcMain.handle('file:unwatch', async () => {
    fileWatcher?.close()
    fileWatcher = null
    return true
  })
}
