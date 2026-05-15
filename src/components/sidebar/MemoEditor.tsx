import { useEffect, useRef, useState } from 'react'

interface MemoEditorProps {
  readonly content: string
  readonly loading: boolean
  readonly onChange: (html: string) => void
  readonly onExport: () => void
}

type BlockFormat = 'p' | 'h1' | 'h2' | 'h3' | 'ol' | 'ul'

const BLOCK_OPTIONS: readonly { readonly value: BlockFormat; readonly label: string }[] = [
  { value: 'p', label: '正文' },
  { value: 'h1', label: '一级标题' },
  { value: 'h2', label: '二级标题' },
  { value: 'h3', label: '三级标题' },
  { value: 'ol', label: '有序列表' },
  { value: 'ul', label: '无序列表' }
]

export function MemoEditor({
  content,
  loading,
  onChange,
  onExport
}: MemoEditorProps): React.JSX.Element {
  const editorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const isComposingRef = useRef(false)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content
    }
  }, [content])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }

      setBlockMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const handleInput = (): void => {
    if (isComposingRef.current) {
      return
    }

    onChange(editorRef.current?.innerHTML ?? '')
  }

  const saveSelection = (): void => {
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const restoreAndFocus = (): void => {
    editorRef.current?.focus()
    const range = savedRangeRef.current

    if (!range) {
      return
    }

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const handleInlineFormat = (command: string): void => {
    restoreAndFocus()
    document.execCommand(command, false)
    handleInput()
  }

  const handleBlockFormat = (format: BlockFormat): void => {
    restoreAndFocus()

    if (format === 'ol') {
      document.execCommand('insertOrderedList', false)
    } else if (format === 'ul') {
      document.execCommand('insertUnorderedList', false)
    } else {
      document.execCommand('formatBlock', false, `<${format}>`)
    }

    handleInput()
    setBlockMenuOpen(false)
  }

  const preventBlur = (event: React.MouseEvent): void => {
    event.preventDefault()
    saveSelection()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-1">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            title="段落格式"
            onMouseDown={preventBlur}
            onClick={() => {
              setBlockMenuOpen((previous) => !previous)
            }}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-surface px-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          >
            <span>T</span>
            <span className="text-[9px]">▾</span>
          </button>

          {blockMenuOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-lg border border-border bg-surface py-1 shadow-lg">
              {BLOCK_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => {
                    handleBlockFormat(option.value)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <ToolbarDivider />

        <InlineButton
          label="B"
          title="加粗"
          fontStyle="font-bold"
          onMouseDown={preventBlur}
          onClick={() => {
            handleInlineFormat('bold')
          }}
        />
        <InlineButton
          label="S"
          title="删除线"
          fontStyle="line-through"
          onMouseDown={preventBlur}
          onClick={() => {
            handleInlineFormat('strikeThrough')
          }}
        />
        <InlineButton
          label="I"
          title="斜体"
          fontStyle="italic"
          onMouseDown={preventBlur}
          onClick={() => {
            handleInlineFormat('italic')
          }}
        />
        <InlineButton
          label="U"
          title="下划线"
          fontStyle="underline"
          onMouseDown={preventBlur}
          onClick={() => {
            handleInlineFormat('underline')
          }}
        />

        <div className="ml-auto">
          <button
            type="button"
            onClick={onExport}
            className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          >
            导出
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center text-sm text-text-muted">加载中...</div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
            handleInput()
          }}
          onClick={() => {
            setBlockMenuOpen(false)
          }}
          className="memo-editor aether-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-canvas/50 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/40"
          data-placeholder="记录你的想法..."
        />
      )}
    </div>
  )
}

function InlineButton({
  label,
  title,
  fontStyle,
  onMouseDown,
  onClick
}: {
  readonly label: string
  readonly title: string
  readonly fontStyle: string
  readonly onMouseDown: (event: React.MouseEvent) => void
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded border border-transparent px-1 text-[12px] text-text-secondary transition-colors hover:border-border hover:bg-hover hover:text-text-primary ${fontStyle}`}
    >
      {label}
    </button>
  )
}

function ToolbarDivider(): React.JSX.Element {
  return <div className="mx-0.5 h-4 w-px bg-border" />
}
