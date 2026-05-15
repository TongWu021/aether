import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { CockpitConfig, LlmProviderConfig, WorkspaceConfig } from '../../src/types/config'

const DEFAULT_CONFIG: CockpitConfig = {
  workspaces: [],
  llm: [],
  llmRouting: {
    summarize: '',
    tagging: ''
  },
  dialogRecorder: {
    enabled: false,
    outputDir: '',
    autoSync: false
  },
  memory: {
    shortTermDir: '',
    longTermFile: ''
  },
  excel: {
    backupDir: '/Users/tiamo/excel-backups',
    maxBackupsPerFile: 10,
    dailyKeepDays: 7,
    readOnlyRowThreshold: 10000
  }
}

function cloneDefaultConfig(): CockpitConfig {
  return {
    workspaces: [],
    llm: [],
    llmRouting: {
      summarize: DEFAULT_CONFIG.llmRouting.summarize,
      tagging: DEFAULT_CONFIG.llmRouting.tagging
    },
    dialogRecorder: {
      enabled: DEFAULT_CONFIG.dialogRecorder.enabled,
      outputDir: DEFAULT_CONFIG.dialogRecorder.outputDir,
      autoSync: DEFAULT_CONFIG.dialogRecorder.autoSync
    },
    memory: {
      shortTermDir: DEFAULT_CONFIG.memory.shortTermDir,
      longTermFile: DEFAULT_CONFIG.memory.longTermFile
    },
    excel: {
      backupDir: DEFAULT_CONFIG.excel.backupDir,
      maxBackupsPerFile: DEFAULT_CONFIG.excel.maxBackupsPerFile,
      dailyKeepDays: DEFAULT_CONFIG.excel.dailyKeepDays,
      readOnlyRowThreshold: DEFAULT_CONFIG.excel.readOnlyRowThreshold
    }
  }
}

function mergeConfigWithDefaults(config: Partial<CockpitConfig>): CockpitConfig {
  const defaults = cloneDefaultConfig()

  return {
    ...defaults,
    ...config,
    workspaces: config.workspaces ?? defaults.workspaces,
    llm: config.llm ?? defaults.llm,
    llmRouting: {
      ...defaults.llmRouting,
      ...config.llmRouting
    },
    dialogRecorder: {
      ...defaults.dialogRecorder,
      ...config.dialogRecorder
    },
    memory: {
      ...defaults.memory,
      ...config.memory
    },
    excel: {
      ...defaults.excel,
      ...config.excel
    }
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

/**
 * 配置存储服务
 *
 * 设计要点：
 * - 纯 Node.js，不 import electron
 * - 数据目录通过构造函数注入
 * - 加解密函数通过构造函数注入（由 IPC 层提供 safeStorage 的包装）
 * - 所有写操作使用原子写入（先写 .tmp 再 rename）
 */
export class ConfigStore {
  private readonly configPath: string
  private readonly encryptFn?: (plainText: string) => string
  private readonly decryptFn?: (encrypted: string) => string
  private config: CockpitConfig = cloneDefaultConfig()

  constructor(options: {
    readonly dataDir: string
    readonly encrypt?: (plainText: string) => string
    readonly decrypt?: (encrypted: string) => string
  }) {
    this.configPath = join(options.dataDir, 'config.json')
    this.encryptFn = options.encrypt
    this.decryptFn = options.decrypt
  }

  /** 加载配置。文件不存在时返回默认配置并写入文件 */
  async load(): Promise<CockpitConfig> {
    try {
      await access(this.configPath)
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'ENOENT') {
        throw error
      }

      this.config = cloneDefaultConfig()
      await this.save()
      return this.config
    }

    const raw = await readFile(this.configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<CockpitConfig>

    this.config = mergeConfigWithDefaults(parsed)
    return this.config
  }

  /** 获取当前配置（内存中的） */
  get(): CockpitConfig {
    return this.config
  }

  /** 更新配置（整体替换），原子写入 */
  async save(newConfig?: CockpitConfig): Promise<void> {
    if (newConfig) {
      this.config = newConfig
    }

    await mkdir(dirname(this.configPath), { recursive: true })

    const tmpPath = `${this.configPath}.tmp`
    await writeFile(tmpPath, JSON.stringify(this.config, null, 2), 'utf-8')
    await rename(tmpPath, this.configPath)
  }

  /** 更新配置的某个部分（不可变更新），原子写入 */
  async update(updater: (current: CockpitConfig) => CockpitConfig): Promise<CockpitConfig> {
    const updated = updater(this.config)
    await this.save(updated)
    return this.config
  }

  // ===== 工作区便捷方法 =====

  async addWorkspace(workspace: Omit<WorkspaceConfig, 'id'>): Promise<CockpitConfig> {
    return this.update((config) => ({
      ...config,
      workspaces: [
        ...config.workspaces,
        {
          id: crypto.randomUUID(),
          name: workspace.name,
          path: workspace.path,
          icon: workspace.icon
        }
      ]
    }))
  }

  async removeWorkspace(id: string): Promise<CockpitConfig> {
    return this.update((config) => ({
      ...config,
      workspaces: config.workspaces.filter((workspace) => workspace.id !== id)
    }))
  }

  // ===== LLM 配置便捷方法 =====

  /** 添加 LLM 配置。apiKey 在存储前加密 */
  async addLlmProvider(provider: Omit<LlmProviderConfig, 'id'>): Promise<CockpitConfig> {
    const encryptedKey = this.encryptFn ? this.encryptFn(provider.apiKey) : provider.apiKey

    return this.update((config) => ({
      ...config,
      llm: [
        ...config.llm,
        {
          ...provider,
          id: crypto.randomUUID(),
          apiKey: encryptedKey
        }
      ]
    }))
  }

  /** 获取解密后的 API Key */
  getDecryptedApiKey(providerId: string): string | undefined {
    const provider = this.config.llm.find((item) => item.id === providerId)

    if (!provider) {
      return undefined
    }

    return this.decryptFn ? this.decryptFn(provider.apiKey) : provider.apiKey
  }

  async removeLlmProvider(id: string): Promise<CockpitConfig> {
    return this.update((config) => ({
      ...config,
      llm: config.llm.filter((provider) => provider.id !== id)
    }))
  }
}
