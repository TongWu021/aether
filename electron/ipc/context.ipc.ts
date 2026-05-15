import { ipcMain } from 'electron'
import { basename, relative } from 'node:path'

import { buildContext, buildFileContext, scanFolder } from '../services/context-builder'
import { getAnnotations } from '../services/annotation-store'
import { getMemo } from '../services/memo-store'

export function registerContextIpc(): void {
  ipcMain.handle('context:build', async (_event, folderPath: string) => {
    const filePaths = await scanFolder(folderPath)
    const fileContexts = await Promise.all(
      filePaths.map(async (absolutePath) => ({
        name: basename(absolutePath),
        absolutePath,
        relativePath: relative(folderPath, absolutePath),
        annotations: await getAnnotations(absolutePath),
        memo: await getMemo(absolutePath)
      }))
    )

    return buildContext(folderPath, fileContexts)
  })

  ipcMain.handle('context:build-file', async (_event, filePath: string) => {
    const annotations = await getAnnotations(filePath)
    const memo = await getMemo(filePath)
    return buildFileContext(filePath, annotations, memo)
  })
}
