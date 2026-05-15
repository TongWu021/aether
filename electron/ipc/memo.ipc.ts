import { ipcMain } from 'electron'

import { deleteMemo, exportMemo, getMemo, saveMemo } from '../services/memo-store'

export function registerMemoIpc(): void {
  ipcMain.handle('memo:get', (_event, filePath: string) => getMemo(filePath))
  ipcMain.handle('memo:save', (_event, filePath: string, content: string) => saveMemo(filePath, content))
  ipcMain.handle('memo:delete', (_event, filePath: string) => deleteMemo(filePath))
  ipcMain.handle('memo:export', (_event, filePath: string, content: string) => exportMemo(filePath, content))
}
