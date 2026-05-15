export interface WorkspaceConfig {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly icon?: string
}

export interface LlmProviderConfig {
  readonly id: string
  readonly name: string
  readonly provider: 'openai-compatible' | 'anthropic' | 'custom'
  readonly endpoint: string
  readonly apiKey: string // 加密后存储
  readonly model: string
  readonly maxTokens?: number
}

export interface ExcelConfig {
  readonly backupDir: string // 默认 "/Users/tiamo/excel-backups"
  readonly maxBackupsPerFile: number // 默认 10
  readonly dailyKeepDays: number // 默认 7
  readonly readOnlyRowThreshold: number // 默认 10000
}

export interface CockpitConfig {
  readonly workspaces: readonly WorkspaceConfig[]
  readonly llm: readonly LlmProviderConfig[]
  readonly llmRouting: {
    readonly summarize: string
    readonly tagging: string
  }
  readonly dialogRecorder: {
    readonly enabled: boolean
    readonly outputDir: string
    readonly autoSync: boolean
  }
  readonly memory: {
    readonly shortTermDir: string
    readonly longTermFile: string
  }
  readonly excel: ExcelConfig
}
