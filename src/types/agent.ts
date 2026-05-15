export interface ToolDefinition {
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly description: string
    readonly parameters: Record<string, unknown>
  }
}

export interface ToolCall {
  readonly id: string
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly arguments: string
  }
}

export interface ChatMessageUser {
  readonly role: 'user'
  readonly content: string
}

export interface ChatMessageAssistant {
  readonly role: 'assistant'
  readonly content: string | null
  readonly tool_calls?: readonly ToolCall[]
}

export interface ChatMessageTool {
  readonly role: 'tool'
  readonly tool_call_id: string
  readonly content: string
}

export type AgentChatMessage = ChatMessageUser | ChatMessageAssistant | ChatMessageTool

export interface LlmToolResponse {
  readonly success: boolean
  readonly content: string | null
  readonly toolCalls: readonly ToolCall[]
  readonly finishReason: 'stop' | 'tool_calls' | 'length'
  readonly error?: string
}

export interface ReviewStep {
  readonly name: string
  readonly prompt: string
}

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'waiting_user'
  | 'executing_tool'
  | 'done'
  | 'error'

export interface AgentEvent {
  readonly type: 'message' | 'tool_call' | 'tool_result' | 'status' | 'step' | 'done' | 'error'
  readonly data: {
    readonly content?: string
    readonly toolName?: string
    readonly toolInput?: Record<string, unknown>
    readonly toolOutput?: string
    readonly status?: AgentStatus
    readonly stepName?: string
    readonly annotations?: readonly { readonly quote: string; readonly comment: string }[]
    readonly error?: string
  }
}
