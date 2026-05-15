import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react'
import { createPortal } from 'react-dom'

interface ToastMessage {
  readonly id: string
  readonly text: string
  readonly type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  readonly showToast: (text: string, type?: ToastMessage['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [messages, setMessages] = useState<readonly ToastMessage[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const message = { id, text, type } satisfies ToastMessage

    setMessages((current) => [...current, message])

    window.setTimeout(() => {
      setMessages((current) => current.filter((item) => item.id !== id))
    }, 2500)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
              <div className="flex max-w-[400px] flex-col-reverse gap-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="toast-message pointer-events-auto flex max-w-[400px] items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary shadow-lg"
                  >
                    <span className={['shrink-0', getToastIconClass(message.type)].join(' ')}>
                      {getToastIcon(message.type)}
                    </span>
                    <div>{message.text}</div>
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}

function getToastIcon(type: ToastMessage['type']): string {
  switch (type) {
    case 'success':
      return '✓'
    case 'error':
      return '✕'
    case 'info':
    default:
      return 'ℹ'
  }
}

function getToastIconClass(type: ToastMessage['type']): string {
  switch (type) {
    case 'success':
      return 'text-success'
    case 'error':
      return 'text-error'
    case 'info':
    default:
      return 'text-accent'
  }
}
