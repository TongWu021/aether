import type { LlmAdapter, LlmOptions, LlmResult, TokenUsage } from '../../src/types/llm'
import type { AgentChatMessage, LlmToolResponse, ToolCall, ToolDefinition } from '../../src/types/agent'
import type { LlmProviderConfig } from '../../src/types/config'

/**
 * OpenAI 兼容接口适配器
 *
 * 覆盖：通义千问、DeepSeek、Moonshot、OpenAI、本地 Ollama 等
 * 只需换 endpoint + apiKey + model 即可
 *
 * 设计要点：
 * - 纯 Node.js，不 import electron
 * - 所有返回值用 LlmResult 统一格式
 * - 包含 tokenUsage 统计
 */
export class OpenAICompatibleAdapter implements LlmAdapter {
  readonly id: string
  readonly name: string
  private readonly config: LlmProviderConfig
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly model: string
  private readonly maxTokens: number

  constructor(config: LlmProviderConfig) {
    this.config = config
    this.id = config.id
    this.name = config.name
    this.endpoint = config.endpoint.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.model = config.model
    this.maxTokens = config.maxTokens ?? 2048
  }

  /**
   * 文本生成
   * POST {endpoint}/v1/chat/completions
   */
  async complete(prompt: string, options?: LlmOptions): Promise<LlmResult<string>> {
    const url = `${this.endpoint}/v1/chat/completions`
    const messages: Array<{ readonly role: string; readonly content: string }> = []

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey.trim()) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    const body = {
      model: this.model,
      messages,
      max_tokens: options?.maxTokens ?? this.maxTokens,
      temperature: options?.temperature ?? 0.7
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return {
          success: false,
          data: '',
          error: `API 请求失败 (${response.status}): ${errorText}`
        }
      }

      const json = (await response.json()) as OpenAIResponse
      const content = extractMessageContent(json)
      const tokenUsage = toTokenUsage(json)

      return {
        success: true,
        data: content,
        tokenUsage
      }
    } catch (error) {
      return {
        success: false,
        data: '',
        error: toErrorMessage(error)
      }
    }
  }

  /**
   * 连通性测试
   * 发送一个简单请求测试 API 是否可用
   */
  async testConnection(): Promise<LlmResult<boolean>> {
    const result = await this.complete('Hi, respond with just "ok".', {
      maxTokens: 10,
      temperature: 0
    })

    if (result.success) {
      return {
        success: true,
        data: true,
        tokenUsage: result.tokenUsage
      }
    }

    return {
      success: false,
      data: false,
      error: result.error
    }
  }

  async chatWithTools(
    messages: readonly AgentChatMessage[],
    tools: readonly ToolDefinition[],
    options?: LlmOptions
  ): Promise<LlmToolResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: createHeaders(this.apiKey),
        body: JSON.stringify(createToolRequestBody(this.config, messages, tools, options)),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return toToolErrorResponse(`API ${response.status}: ${errorText}`)
      }

      const json = (await response.json()) as OpenAIToolResponse
      return toToolResponse(json)
    } catch (error) {
      return toToolErrorResponse(toErrorMessage(error, 120))
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

interface OpenAIResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string
    }
  }>
  readonly usage?: {
    readonly prompt_tokens: number
    readonly completion_tokens: number
    readonly total_tokens: number
  }
}

interface OpenAIToolResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string | null
      readonly tool_calls?: readonly ToolCall[]
    }
    readonly finish_reason?: string
  }>
}

function extractMessageContent(response: OpenAIResponse): string {
  return response.choices?.[0]?.message?.content ?? ''
}

function toTokenUsage(response: OpenAIResponse): TokenUsage | undefined {
  if (!response.usage) {
    return undefined
  }

  return {
    prompt: response.usage.prompt_tokens,
    completion: response.usage.completion_tokens
  }
}

function createHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

function createToolRequestBody(
  config: LlmProviderConfig,
  messages: readonly AgentChatMessage[],
  tools: readonly ToolDefinition[],
  options?: LlmOptions
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...messages
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048
  }

  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  return body
}

function toToolResponse(response: OpenAIToolResponse): LlmToolResponse {
  const choice = response.choices?.[0]

  if (!choice?.message) {
    return toToolErrorResponse('No response from model')
  }

  const toolCalls = choice.message.tool_calls ?? []

  return {
    success: true,
    content: choice.message.content ?? null,
    toolCalls,
    finishReason: toFinishReason(choice.finish_reason, toolCalls)
  }
}

function toFinishReason(
  finishReason: string | undefined,
  toolCalls: readonly ToolCall[]
): LlmToolResponse['finishReason'] {
  if (toolCalls.length > 0) {
    return 'tool_calls'
  }

  return finishReason === 'length' ? 'length' : 'stop'
}

function toToolErrorResponse(error: string): LlmToolResponse {
  return {
    success: false,
    content: null,
    toolCalls: [],
    finishReason: 'stop',
    error
  }
}

function toErrorMessage(error: unknown, timeoutSeconds = 60): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return `LLM 请求超时（${timeoutSeconds} 秒）`
    }

    return error.message
  }

  return 'Unknown error'
}

/** 根据配置创建 LLM 适配器 */
export function createLlmAdapter(config: LlmProviderConfig): OpenAICompatibleAdapter {
  switch (config.provider) {
    case 'openai-compatible':
    case 'anthropic':
    case 'custom':
    default:
      return new OpenAICompatibleAdapter(config)
  }
}
