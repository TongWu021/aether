/** LLM 调用选项 */
export interface LlmOptions {
  readonly maxTokens?: number
  readonly temperature?: number
  readonly systemPrompt?: string
}

/** Token 用量统计 */
export interface TokenUsage {
  readonly prompt: number
  readonly completion: number
}

/**
 * LLM 统一返回格式
 * 所有 LLM 调用都返回这个格式（CLAUDE.md 架构红线第 5 条）
 */
export interface LlmResult<T = string> {
  readonly success: boolean
  readonly data: T
  readonly error?: string
  readonly tokenUsage?: TokenUsage
}

/** LLM 适配器接口 - 所有模型都实现这个接口 */
export interface LlmAdapter {
  readonly id: string
  readonly name: string

  /** 基础文本生成 */
  complete(prompt: string, options?: LlmOptions): Promise<LlmResult<string>>

  /** 连通性测试 */
  testConnection(): Promise<LlmResult<boolean>>
}

/** 摘要/标签生成的结构化返回 */
export interface MemoryAnalysis {
  readonly title: string
  readonly tags: readonly string[]
}
