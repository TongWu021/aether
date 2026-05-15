import { dialog, ipcMain } from 'electron'
import { rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'

import type { BackupEntry, SheetDocument } from '../../src/types/sheet'
import { BackupStore } from '../services/backup-store'
import { readSheetFile, validateSheetFile, writeSheetFile } from '../services/excel-io'
import { computeFileId } from '../utils/file-id'
import { getConfigStore } from './config.ipc'

type IpcResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string }

interface SaveResult {
  readonly backupCreated: string
}

function getBackupStore(): BackupStore {
  const config = getConfigStore().get()
  return new BackupStore({
    backupDir: config.excel.backupDir,
    maxBackupsPerFile: config.excel.maxBackupsPerFile,
    dailyKeepDays: config.excel.dailyKeepDays
  })
}

export function registerExcelIpc(): void {
  ipcMain.handle(
    'excel:read',
    async (_event, filePath: string): Promise<IpcResult<SheetDocument>> => {
      try {
        return createSuccess(await readSheetFile(filePath))
      } catch (error) {
        return createFailure(error)
      }
    }
  )

  ipcMain.handle(
    'excel:save',
    async (_event, filePath: string, doc: SheetDocument): Promise<IpcResult<SaveResult>> => {
      try {
        return createSuccess(await executeSafeSave(filePath, doc))
      } catch (error) {
        return createFailure(error)
      }
    }
  )

  ipcMain.handle(
    'excel:list-backups',
    async (_event, filePath: string): Promise<IpcResult<readonly BackupEntry[]>> => {
      try {
        const fileHash = await computeFileId(filePath)
        return createSuccess(await getBackupStore().listBackups(fileHash))
      } catch (error) {
        return createFailure(error)
      }
    }
  )

  ipcMain.handle(
    'excel:preview-backup',
    async (_event, filePath: string, backupName: string): Promise<IpcResult<SheetDocument>> => {
      try {
        const backupStore = getBackupStore()
        const fileHash = await computeFileId(filePath)
        const backupAbsolutePath = getBackupAbsolutePath(backupStore, fileHash, backupName)

        return createSuccess(await readSheetFile(backupAbsolutePath))
      } catch (error) {
        return createFailure(error)
      }
    }
  )

  ipcMain.handle(
    'excel:restore-backup',
    async (
      _event,
      filePath: string,
      backupName: string
    ): Promise<IpcResult<{ readonly restored: true }>> => {
      try {
        const backupStore = getBackupStore()
        const fileHash = await computeFileId(filePath)

        await backupStore.createBackup({ originalPath: filePath, fileHash })
        await backupStore.restoreBackup({ fileHash, backupName, targetPath: filePath })
        await backupStore.cleanup(fileHash)

        return createSuccess({ restored: true })
      } catch (error) {
        return createFailure(error)
      }
    }
  )

  ipcMain.handle('excel:select-backup-dir', async (): Promise<IpcResult<string>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择备份目录'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'canceled' }
      }

      return createSuccess(result.filePaths[0])
    } catch (error) {
      return createFailure(error)
    }
  })

  ipcMain.handle(
    'excel:migrate-backup-dir',
    async (
      _event,
      fromDir: string,
      toDir: string
    ): Promise<IpcResult<{ readonly migrated: true }>> => {
      try {
        await BackupStore.migrate({ fromDir, toDir })
        return createSuccess({ migrated: true })
      } catch (error) {
        return createFailure(error)
      }
    }
  )
}

async function executeSafeSave(filePath: string, doc: SheetDocument): Promise<SaveResult> {
  const backupStore = getBackupStore()
  const fileHash = await computeFileId(filePath)
  const backupResult = await backupStore.createBackup({ originalPath: filePath, fileHash })
  const tmpPath = `${filePath}.tmp`

  try {
    await writeSheetFile(tmpPath, doc)
    await validateTmpFile(tmpPath, doc)
    await rename(tmpPath, filePath)
  } catch (error) {
    await cleanupTmpFile(tmpPath)
    throw error
  }

  await cleanupBackups(backupStore, fileHash)
  return { backupCreated: backupResult.timestamp }
}

async function validateTmpFile(tmpPath: string, doc: SheetDocument): Promise<void> {
  const validation = await validateSheetFile(tmpPath, doc)

  if (!validation.ok) {
    await cleanupTmpFile(tmpPath)
    throw new Error(`保存校验失败：${validation.reason}，原文件未改动`)
  }
}

async function cleanupBackups(backupStore: BackupStore, fileHash: string): Promise<void> {
  try {
    await backupStore.cleanup(fileHash)
  } catch (error) {
    console.warn(`[excel] Backup cleanup failed: ${getErrorMessage(error)}`)
  }
}

async function cleanupTmpFile(tmpPath: string): Promise<void> {
  await unlink(tmpPath).catch(() => {})
}

function getBackupAbsolutePath(
  backupStore: BackupStore,
  fileHash: string,
  backupName: string
): string {
  assertSafeBackupName(backupName)
  return join(backupStore.getBackupDir(), fileHash, backupName)
}

function assertSafeBackupName(backupName: string): void {
  if (
    backupName === '' ||
    backupName === '.' ||
    backupName === '..' ||
    backupName.includes('/') ||
    backupName.includes('\\')
  ) {
    throw new Error(`Invalid backup name: ${backupName}`)
  }
}

function createSuccess<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function createFailure<T = never>(error: unknown): IpcResult<T> {
  return { success: false, error: getErrorMessage(error) }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
