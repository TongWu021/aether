import { readFile } from 'node:fs/promises'

import type { ToolCall, ToolDefinition } from '../../src/types/agent'
import { addAnnotation } from './annotation-store'

export const AGENT_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取指定路径的文件内容，用于交叉参考其他文档',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件的绝对路径' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_annotation',
      description: '给当前文档添加一条审查批注。每个发现的问题调用一次。',
      parameters: {
        type: 'object',
        properties: {
          quote: { type: 'string', description: '文档中的原文（精确引用）' },
          comment: { type: 'string', description: '审查意见' }
        },
        required: ['quote', 'comment']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish_step',
      description: '当前审查维度已完成，进入下一个维度。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
]

export interface ToolResult {
  readonly output: string
  readonly isFinishStep: boolean
}

export async function executeToolCall(
  toolCall: ToolCall,
  filePath: string,
  documentContent: string
): Promise<ToolResult> {
  const args = parseToolArguments(toolCall.function.arguments)

  switch (toolCall.function.name) {
    case 'read_file':
      return executeReadFile(args)
    case 'add_annotation':
      return executeAddAnnotation(args, filePath, documentContent)
    case 'finish_step':
      return { output: '进入下一步', isFinishStep: true }
    default:
      return { output: `[未知工具: ${toolCall.function.name}]`, isFinishStep: false }
  }
}

async function executeReadFile(args: Record<string, unknown>): Promise<ToolResult> {
  const output = await handleReadFile(toStringArg(args.path))
  return { output, isFinishStep: false }
}

async function executeAddAnnotation(
  args: Record<string, unknown>,
  filePath: string,
  documentContent: string
): Promise<ToolResult> {
  const output = await handleAddAnnotation(
    toStringArg(args.quote),
    toStringArg(args.comment),
    filePath,
    documentContent
  )

  return { output, isFinishStep: false }
}

async function handleReadFile(path: string): Promise<string> {
  try {
    const content = await readFile(path, 'utf-8')
    return truncateFileContent(content)
  } catch {
    return `[错误] 无法读取文件: ${path}`
  }
}

async function handleAddAnnotation(
  quote: string,
  comment: string,
  filePath: string,
  documentContent: string
): Promise<string> {
  const { lineStart, lineEnd } = findLineRange(documentContent, quote)

  await addAnnotation(filePath, {
    selectedText: quote,
    comment: `[AI 审查] ${comment}`,
    lineStart,
    lineEnd
  })

  return '批注已添加'
}

function findLineRange(content: string, quote: string): { readonly lineStart: number; readonly lineEnd: number } {
  const exactIndex = content.indexOf(quote)

  if (exactIndex >= 0) {
    return buildLineRange(content, exactIndex, exactIndex + quote.length)
  }

  const partialIndex = content.indexOf(quote.slice(0, 30))

  if (partialIndex >= 0) {
    return buildLineRange(content, partialIndex, partialIndex)
  }

  return { lineStart: 1, lineEnd: 1 }
}

function buildLineRange(
  content: string,
  startIndex: number,
  endIndex: number
): { readonly lineStart: number; readonly lineEnd: number } {
  return {
    lineStart: content.slice(0, startIndex).split('\n').length,
    lineEnd: content.slice(0, endIndex).split('\n').length
  }
}

function parseToolArguments(argumentsText: string): Record<string, unknown> {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return {}
  }
}

function toStringArg(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function truncateFileContent(content: string): string {
  const maxLength = 20_000

  if (content.length <= maxLength) {
    return content
  }

  return `${content.slice(0, maxLength)}\n\n[文件被截断，共 ${content.length} 字符]`
}
