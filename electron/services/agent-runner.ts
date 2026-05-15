import type { AgentChatMessage, AgentEvent, LlmToolResponse } from '../../src/types/agent'
import type { LlmProviderConfig } from '../../src/types/config'
import { createLlmAdapter } from './llm-adapter'
import { AGENT_TOOL_DEFINITIONS, executeToolCall } from './agent-tools'
import { AGENT_SYSTEM_PROMPT, REVIEW_STEPS } from './review-steps'

type EventSender = (event: AgentEvent) => void

interface SessionState {
  messages: readonly AgentChatMessage[]
  aborted: boolean
  resolveReply: ((reply: string) => void) | null
}

let session: SessionState | null = null

export function isAgentRunning(): boolean {
  return session !== null && !session.aborted
}

export function receiveUserReply(reply: string): void {
  if (!session?.resolveReply) {
    return
  }

  const resolve = session.resolveReply
  session = { ...session, resolveReply: null }
  resolve(reply)
}

export function stopAgent(): void {
  if (!session) {
    return
  }

  const pendingReply = session.resolveReply
  session = null

  if (pendingReply) {
    pendingReply('')
  }
}

export async function startAgent(
  filePath: string,
  documentContent: string,
  providerConfig: LlmProviderConfig,
  decryptedApiKey: string,
  sendEvent: EventSender
): Promise<void> {
  stopAgent()

  const adapter = createLlmAdapter({ ...providerConfig, apiKey: decryptedApiKey })
  const initialSession = createSession(documentContent)

  session = initialSession

  try {
    await runReviewSteps(initialSession, adapter, filePath, documentContent, sendEvent)

    if (!isCurrentSession(initialSession) || initialSession.aborted) {
      return
    }

    await runAnnotationPhase(initialSession, adapter, filePath, documentContent, sendEvent)

    if (isCurrentSession(initialSession) && !initialSession.aborted) {
      sendStatus(sendEvent, 'done')
      sendEvent({ type: 'done', data: {} })
    }
  } catch (error) {
    sendStatus(sendEvent, 'error')
    sendEvent({ type: 'error', data: { error: toErrorMessage(error) } })
  } finally {
    if (isCurrentSession(initialSession)) {
      session = null
    }
  }
}

function createSession(documentContent: string): SessionState {
  return {
    messages: [{ role: 'user', content: `以下是待审查的PRD文档：\n\n${documentContent}` }],
    aborted: false,
    resolveReply: null
  }
}

async function runReviewSteps(
  state: SessionState,
  adapter: ReturnType<typeof createLlmAdapter>,
  filePath: string,
  documentContent: string,
  sendEvent: EventSender
): Promise<void> {
  for (let index = 0; index < REVIEW_STEPS.length; index++) {
    if (!isCurrentSession(state) || state.aborted) {
      return
    }

    const step = REVIEW_STEPS[index]

    sendEvent({
      type: 'step',
      data: { stepName: `${step.name} (${index + 1}/${REVIEW_STEPS.length})` }
    })

    appendUserMessage(state, step.prompt)
    await runStepLoop(state, adapter, filePath, documentContent, sendEvent)
  }
}

async function runAnnotationPhase(
  state: SessionState,
  adapter: ReturnType<typeof createLlmAdapter>,
  filePath: string,
  documentContent: string,
  sendEvent: EventSender
): Promise<void> {
  sendStatus(sendEvent, 'thinking')
  appendUserMessage(
    state,
    '所有审查维度已完成。请针对你发现的每个问题，调用 add_annotation 工具逐条生成批注。quote 要精确引用文档原文。'
  )

  await runToolOnlyLoop(state, adapter, filePath, documentContent, sendEvent)
}

async function runStepLoop(
  state: SessionState,
  adapter: ReturnType<typeof createLlmAdapter>,
  filePath: string,
  documentContent: string,
  sendEvent: EventSender
): Promise<void> {
  for (let turn = 0; turn < 30; turn++) {
    if (!isCurrentSession(state) || state.aborted) {
      return
    }

    sendStatus(sendEvent, 'thinking')
    const response = await callLlm(state, adapter)

    if (!response.success) {
      sendStatus(sendEvent, 'error')
      sendEvent({ type: 'error', data: { error: response.error ?? 'LLM 调用失败' } })
      return
    }

    appendAssistantMessage(state, response)

    if (response.toolCalls.length > 0) {
      const finished = await handleToolCalls(state, response, filePath, documentContent, sendEvent)

      if (finished) {
        return
      }

      continue
    }

    if (!response.content) {
      continue
    }

    sendEvent({ type: 'message', data: { content: response.content } })
    sendStatus(sendEvent, 'waiting_user')

    const reply = await waitForReply(state)

    if (!isCurrentSession(state) || state.aborted || !reply) {
      return
    }

    appendUserMessage(state, reply)
  }
}

async function runToolOnlyLoop(
  state: SessionState,
  adapter: ReturnType<typeof createLlmAdapter>,
  filePath: string,
  documentContent: string,
  sendEvent: EventSender
): Promise<void> {
  for (let turn = 0; turn < 10; turn++) {
    if (!isCurrentSession(state) || state.aborted) {
      return
    }

    sendStatus(sendEvent, 'thinking')
    const response = await callLlm(state, adapter)

    if (!response.success || response.toolCalls.length === 0) {
      return
    }

    appendAssistantMessage(state, response)
    await handleToolCalls(state, response, filePath, documentContent, sendEvent)
  }
}

function callLlm(
  state: SessionState,
  adapter: ReturnType<typeof createLlmAdapter>
): Promise<LlmToolResponse> {
  return adapter.chatWithTools(state.messages, AGENT_TOOL_DEFINITIONS, {
    systemPrompt: AGENT_SYSTEM_PROMPT,
    temperature: 0.4,
    maxTokens: 4096
  })
}

function appendUserMessage(state: SessionState, content: string): void {
  updateSession(state, {
    messages: [...state.messages, { role: 'user', content }]
  })
}

function appendAssistantMessage(state: SessionState, response: LlmToolResponse): void {
  updateSession(state, {
    messages: [
      ...state.messages,
      {
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls.length > 0 ? response.toolCalls : undefined
      }
    ]
  })
}

async function handleToolCalls(
  state: SessionState,
  response: LlmToolResponse,
  filePath: string,
  documentContent: string,
  sendEvent: EventSender
): Promise<boolean> {
  let stepFinished = false

  for (const toolCall of response.toolCalls) {
    if (!isCurrentSession(state) || state.aborted) {
      return stepFinished
    }

    sendStatus(sendEvent, 'executing_tool')
    sendEvent({
      type: 'tool_call',
      data: {
        toolName: toolCall.function.name,
        toolInput: parseToolInput(toolCall.function.arguments)
      }
    })

    const result = await executeToolCall(toolCall, filePath, documentContent)

    appendToolMessage(state, toolCall.id, result.output)
    sendEvent({
      type: 'tool_result',
      data: { toolName: toolCall.function.name, toolOutput: result.output }
    })

    if (result.isFinishStep) {
      stepFinished = true
    }
  }

  return stepFinished
}

function appendToolMessage(state: SessionState, toolCallId: string, content: string): void {
  updateSession(state, {
    messages: [...state.messages, { role: 'tool', tool_call_id: toolCallId, content }]
  })
}

function waitForReply(state: SessionState): Promise<string> {
  return new Promise((resolve) => {
    updateSession(state, { resolveReply: resolve })
  })
}

function updateSession(state: SessionState, patch: Partial<SessionState>): void {
  if (!isCurrentSession(state)) {
    return
  }

  Object.assign(state, patch)
  session = state
}

function isCurrentSession(state: SessionState): boolean {
  return session === state
}

function parseToolInput(argumentsText: string): Record<string, unknown> {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return {}
  }
}

function sendStatus(sendEvent: EventSender, status: AgentEvent['data']['status']): void {
  sendEvent({ type: 'status', data: { status } })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}
