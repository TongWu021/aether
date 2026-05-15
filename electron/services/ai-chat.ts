import type { LlmProviderConfig } from '../../src/types/config'
import { createLlmAdapter } from './llm-adapter'

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export async function chatWithDocument(
  documentContent: string,
  question: string,
  history: readonly ChatMessage[],
  providerConfig: LlmProviderConfig,
  decryptedApiKey: string
): Promise<{ success: boolean; answer: string; error?: string }> {
  const adapter = createLlmAdapter({
    ...providerConfig,
    apiKey: decryptedApiKey
  })
  const historyText = history
    .map((message) => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`)
    .join('\n\n')
  const prompt = historyText ? `${historyText}\n\n用户：${question}` : question
  const systemPrompt = `你是一位产品文档助手。用户正在阅读以下文档，请基于文档内容回答用户的问题。如果文档中没有相关信息，请如实说明。回答要简洁精准。

文档内容：
${documentContent}`
  const result = await adapter.complete(prompt, {
    temperature: 0.5,
    maxTokens: providerConfig.maxTokens ?? 4096,
    systemPrompt
  })

  if (!result.success) {
    return {
      success: false,
      answer: '',
      error: result.error
    }
  }

  return {
    success: true,
    answer: result.data
  }
}
