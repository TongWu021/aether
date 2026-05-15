import { useEffect, useState } from 'react'

import { truncatePath } from '../../utils/format'
import { useToast } from './Toast'

interface CopyButtonProps {
  readonly path: string
  readonly size?: 'sm' | 'md'
  readonly className?: string
}

export function CopyButton({
  path,
  size = 'md',
  className
}: CopyButtonProps): React.JSX.Element {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false)
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copied])

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await window.electronAPI.file.copyPath(path)
      setCopied(true)
      showToast(`已复制: ${truncatePath(path)}`, 'success')
    } catch (error) {
      showToast(toErrorMessage(error), 'error')
    }
  }

  return (
    <button
      type="button"
      aria-label="复制路径"
      onClick={(event) => {
        void handleClick(event)
      }}
      className={[
        'inline-flex items-center justify-center rounded bg-transparent text-text-secondary transition-colors duration-150 hover:bg-hover',
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
        className ?? ''
      ].join(' ')}
    >
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </button>
  )
}

function toErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '复制路径失败'
  return `复制失败: ${detail}`
}

function ClipboardIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    </svg>
  )
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
