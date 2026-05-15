import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

interface AiChatProps {
  readonly messages: readonly ChatMessage[]
  readonly loading: boolean
  readonly onSend: (question: string) => Promise<void>
}

export function AiChat({ messages, loading, onSend }: AiChatProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  const handleSubmit = (): void => {
    const trimmed = input.trim()

    if (!trimmed || loading) {
      return
    }

    setInput('')
    void onSend(trimmed)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="aether-scrollbar min-h-0 flex-1 overflow-y-auto pr-3">
        {messages.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-text-muted">
            基于当前文档提问，AI 将根据文档内容回答
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex'}>
                <div
                  className={[
                    'max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                    message.role === 'user'
                      ? 'bg-accent text-text-inverse'
                      : 'border border-border bg-canvas text-text-primary'
                  ].join(' ')}
                >
                  {message.role === 'assistant' ? (
                    <div className="ai-chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 px-1 py-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-muted border-t-accent motion-reduce:animate-none" />
                <span className="text-xs text-text-muted">思考中...</span>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="问一下这个文档..."
          disabled={loading}
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2.5 text-[13px] text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-accent/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-text-inverse transition-colors duration-150 hover:bg-accent-hover disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
