import { app, ipcMain } from 'electron'

import { checkForUpdate, type UpdateCheckResult } from '../services/version-checker'

const REPO = { owner: 'TongWu021', name: 'aether' } as const

interface VersionCheckResponse {
  readonly success: boolean
  readonly data?: UpdateCheckResult
  readonly error?: string
}

export function registerVersionIpc(): void {
  ipcMain.handle('version:current', () => app.getVersion())

  ipcMain.handle('version:check-latest', async (): Promise<VersionCheckResponse> => {
    try {
      const data = await checkForUpdate(app.getVersion(), REPO)
      return { success: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })
}
