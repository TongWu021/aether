// 纯业务逻辑，禁止 import electron。所有路径通过参数注入。
import {
  access,
  copyFile,
  cp,
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

import type { BackupEntry } from '../../src/types/sheet'

interface BackupStoreOptions {
  readonly backupDir: string
  readonly maxBackupsPerFile: number
  readonly dailyKeepDays: number
}

interface CreateBackupArgs {
  readonly originalPath: string
  readonly fileHash: string
}

interface CreateBackupResult {
  readonly backupPath: string
  readonly timestamp: string
}

interface RestoreBackupArgs {
  readonly fileHash: string
  readonly backupName: string
  readonly targetPath: string
}

interface BackupFile {
  readonly name: string
  readonly timestamp: string
  readonly time: number
  readonly size: number
}

interface BackupMeta {
  readonly originalPath: string
  readonly originalName: string
}

const META_FILE_NAME = 'meta.json'
const TEMP_FILE_SUFFIX = '.tmp'
const TIMESTAMP_PATTERN = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/

export class BackupStore {
  private readonly backupDir: string
  private readonly maxBackupsPerFile: number
  private readonly dailyKeepDays: number

  constructor(options: BackupStoreOptions) {
    this.backupDir = options.backupDir
    this.maxBackupsPerFile = options.maxBackupsPerFile
    this.dailyKeepDays = options.dailyKeepDays
  }

  /** 在 {backupDir}/{fileHash}/ 写入 {timestamp}.{ext}（直接拷贝原文件） */
  async createBackup(args: CreateBackupArgs): Promise<CreateBackupResult> {
    try {
      const directory = this.getFileBackupDir(args.fileHash)
      const ext = extname(args.originalPath)

      await mkdir(directory, { recursive: true })
      const timestamp = await createAvailableTimestamp(directory, ext)
      const backupPath = join(directory, `${timestamp}${ext}`)

      await writeMetaFile(directory, {
        originalPath: args.originalPath,
        originalName: basename(args.originalPath)
      })
      await copyFileAtomically(args.originalPath, backupPath)

      return { backupPath, timestamp }
    } catch (error) {
      throw new Error(`Unable to create backup: ${getErrorMessage(error)}`)
    }
  }

  /** 列出某 fileHash 下所有备份，时间倒序 */
  async listBackups(fileHash: string): Promise<readonly BackupEntry[]> {
    try {
      const files = await listBackupFiles(this.getFileBackupDir(fileHash))
      return files.map((file) => ({ name: file.name, timestamp: file.timestamp, size: file.size }))
    } catch (error) {
      throw new Error(`Unable to list backups: ${getErrorMessage(error)}`)
    }
  }

  /** 把指定备份复制到 targetPath（覆盖） */
  async restoreBackup(args: RestoreBackupArgs): Promise<void> {
    try {
      assertSafeBackupName(args.backupName)

      const sourcePath = join(this.getFileBackupDir(args.fileHash), args.backupName)
      await copyFileAtomically(sourcePath, args.targetPath)
    } catch (error) {
      throw new Error(`Unable to restore backup: ${getErrorMessage(error)}`)
    }
  }

  /** 清理：保留最近 N 份 + 每天最后一份（最多 daysKeep 天） */
  async cleanup(fileHash: string): Promise<void> {
    try {
      const directory = this.getFileBackupDir(fileHash)
      const files = await listBackupFiles(directory)
      const keepNames = getCleanupKeepNames(files, this.maxBackupsPerFile, this.dailyKeepDays)

      await Promise.all(
        files
          .filter((file) => !keepNames.has(file.name))
          .map((file) => unlinkIfExists(join(directory, file.name)))
      )
    } catch (error) {
      throw new Error(`Unable to cleanup backups: ${getErrorMessage(error)}`)
    }
  }

  /** 获取备份目录的绝对路径（用于 IPC 层报错友好提示） */
  getBackupDir(): string {
    return this.backupDir
  }

  /** 把所有备份从旧目录迁移到新目录（用于用户改备份目录时） */
  static async migrate(args: { readonly fromDir: string; readonly toDir: string }): Promise<void> {
    try {
      if (args.fromDir === args.toDir || !(await pathExists(args.fromDir))) {
        return
      }

      await mkdir(dirname(args.toDir), { recursive: true })
      await cp(args.fromDir, args.toDir, { recursive: true })
    } catch (error) {
      throw new Error(`Unable to migrate backups: ${getErrorMessage(error)}`)
    }
  }

  private getFileBackupDir(fileHash: string): string {
    return join(this.backupDir, fileHash)
  }
}

async function listBackupFiles(directory: string): Promise<readonly BackupFile[]> {
  if (!(await pathExists(directory))) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.filter(isBackupDirent).map((entry) => readBackupFile(directory, entry.name))
  )

  return files.sort((left, right) => right.time - left.time || right.name.localeCompare(left.name))
}

async function readBackupFile(directory: string, name: string): Promise<BackupFile> {
  const path = join(directory, name)
  const fileStats = await stat(path)
  const date = parseBackupDate(name) ?? fileStats.mtime

  return {
    name,
    timestamp: date.toISOString(),
    time: date.getTime(),
    size: fileStats.size
  }
}

async function writeMetaFile(directory: string, meta: BackupMeta): Promise<void> {
  const targetPath = join(directory, META_FILE_NAME)
  const tmpPath = `${targetPath}${TEMP_FILE_SUFFIX}`
  await writeFile(tmpPath, JSON.stringify(meta, null, 2), 'utf-8')
  await rename(tmpPath, targetPath)
}

async function copyFileAtomically(sourcePath: string, targetPath: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true })
  const tmpPath = `${targetPath}${TEMP_FILE_SUFFIX}`
  await copyFile(sourcePath, tmpPath)
  await rename(tmpPath, targetPath)
}

async function createAvailableTimestamp(directory: string, ext: string): Promise<string> {
  const now = new Date()

  for (let offset = 0; offset < 60; offset += 1) {
    const timestamp = formatTimestamp(new Date(now.getTime() + offset * 1000))

    if (!(await pathExists(join(directory, `${timestamp}${ext}`)))) {
      return timestamp
    }
  }

  return formatTimestamp(new Date(now.getTime() + 60_000))
}

function getCleanupKeepNames(
  files: readonly BackupFile[],
  maxBackupsPerFile: number,
  dailyKeepDays: number
): ReadonlySet<string> {
  const recent = files.slice(0, Math.max(0, maxBackupsPerFile))
  const daily = getDailyKeepFiles(files.slice(recent.length), dailyKeepDays)

  return new Set([...recent, ...daily].map((file) => file.name))
}

function getDailyKeepFiles(
  files: readonly BackupFile[],
  dailyKeepDays: number
): readonly BackupFile[] {
  const seenDates = new Set<string>()
  const cutoff = getDailyCutoff(dailyKeepDays)
  const keepFiles: BackupFile[] = []

  for (const file of files) {
    const dayKey = getLocalDateKey(new Date(file.time))
    if (file.time >= cutoff && !seenDates.has(dayKey)) {
      seenDates.add(dayKey)
      keepFiles.push(file)
    }
  }

  return keepFiles
}

function getDailyCutoff(dailyKeepDays: number): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - Math.max(0, dailyKeepDays - 1))
  return date.getTime()
}

function parseBackupDate(name: string): Date | null {
  const match = name.match(TIMESTAMP_PATTERN)

  if (!match) {
    return null
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  )
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isBackupDirent(entry: { readonly isFile: () => boolean; readonly name: string }): boolean {
  return entry.isFile() && entry.name !== META_FILE_NAME && !entry.name.endsWith(TEMP_FILE_SUFFIX)
}

function assertSafeBackupName(backupName: string): void {
  if (backupName === '' || backupName === '.' || backupName === '..' || /[/\\]/.test(backupName)) {
    throw new Error(`Invalid backup name: ${backupName}`)
  }
}

async function unlinkIfExists(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') {
      throw error
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
