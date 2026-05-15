import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { getSelectionAnchorRect, readAnnotationSelection, resolveAnnotationMatch } from './annotation-utils'
import type { Annotation } from '../../types'

interface AnnotationPopoverProps {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly content: string
  readonly onAdd: (data: {
    selectedText: string
    comment: string
    lineStart: number
    lineEnd: number
    anchor?: Annotation['anchor']
  }) => Promise<void>
}

interface SelectionState {
  readonly selectedText: string
  readonly rect: DOMRect
  readonly anchor: Annotation['anchor']
}

export function AnnotationPopover({
  containerRef,
  content,
  onAdd
}: AnnotationPopoverProps): React.JSX.Element | null {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null)
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const buttonStyle = useMemo(() => getButtonStyle(selectionState?.rect), [selectionState?.rect])
  const cardStyle = useMemo(() => getCardStyle(selectionState?.rect), [selectionState?.rect])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const updateSelection = (): void => {
      const nextSelection = readSelection(container)

      if (!nextSelection) {
        closePopover(setSelectionState, setComment, setEditing)
        return
      }

      setSelectionState(nextSelection)
      setComment('')
      setEditing(false)
    }

    container.addEventListener('mouseup', updateSelection)
    container.addEventListener('keyup', updateSelection)
    return () => {
      container.removeEventListener('mouseup', updateSelection)
      container.removeEventListener('keyup', updateSelection)
    }
  }, [containerRef])

  useEffect(() => {
    if (!editing) {
      return
    }

    textareaRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!selectionState) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target

      if (
        target instanceof Node &&
        !cardRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        closePopover(setSelectionState, setComment, setEditing)
      }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closePopover(setSelectionState, setComment, setEditing)
      }
    }

    const handleViewportChange = (): void => {
      closePopover(setSelectionState, setComment, setEditing)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [selectionState])

  if (!selectionState) {
    return null
  }

  return createPortal(
    editing ? (
      <div
        ref={cardRef}
        className="fixed z-[70] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-border bg-surface p-3 shadow-xl"
        style={cardStyle}
      >
        <div className="truncate text-xs text-text-muted">{selectionState.selectedText}</div>
        <textarea
          ref={textareaRef}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleConfirm(
                content,
                selectionState.selectedText,
                selectionState.anchor,
                comment,
                onAdd,
                setSubmitting,
                setError,
                setSelectionState,
                setComment,
                setEditing
              )
            }
          }}
          rows={4}
          placeholder="输入批注内容"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
        />
        {error ? <div className="mt-1 line-clamp-2 text-xs text-error">{error}</div> : null}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              closePopover(setSelectionState, setComment, setEditing)
            }}
            className="rounded-full px-3 py-1 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting || !comment.trim()}
            onClick={() => {
              void handleConfirm(
                content,
                selectionState.selectedText,
                selectionState.anchor,
                comment,
                onAdd,
                setSubmitting,
                setError,
                setSelectionState,
                setComment,
                setEditing
              )
            }}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-text-inverse transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? '保存中...' : '确定'}
          </button>
        </div>
      </div>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setEditing(true)
        }}
        className="fixed z-[70] rounded-full bg-accent px-3 py-1 text-xs font-medium text-text-inverse shadow-lg"
        style={buttonStyle}
      >
        添加批注
      </button>
    ),
    document.body
  )
}

function readSelection(container: HTMLDivElement): SelectionState | null {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  const ancestor =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement

  if (!ancestor || !container.contains(ancestor)) {
    return null
  }

  const snapshot = readAnnotationSelection(container, range)

  if (!snapshot) {
    return null
  }

  return {
    selectedText: snapshot.selectedText,
    rect: getSelectionAnchorRect(range),
    anchor: snapshot.anchor
  }
}

async function handleConfirm(
  content: string,
  selectedText: string,
  anchor: Annotation['anchor'],
  comment: string,
  onAdd: (data: {
    selectedText: string
    comment: string
    lineStart: number
    lineEnd: number
    anchor?: Annotation['anchor']
  }) => Promise<void>,
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectionState: React.Dispatch<React.SetStateAction<SelectionState | null>>,
  setComment: React.Dispatch<React.SetStateAction<string>>,
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
): Promise<void> {
  const trimmedComment = comment.trim()

  if (!trimmedComment) {
    setError('请输入批注内容')
    return
  }

  setSubmitting(true)
  setError(null)
  const { lineStart, lineEnd } = findLineRange(content, selectedText, anchor)

  try {
    await onAdd({ selectedText, comment: trimmedComment, lineStart, lineEnd, anchor })
    window.getSelection()?.removeAllRanges()
    closePopover(setSelectionState, setComment, setEditing)
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : String(caught)
    console.error('[Annotation] Save failed:', caught)
    setError(`保存失败: ${message}`)
  } finally {
    setSubmitting(false)
  }
}

function findLineRange(
  content: string,
  selectedText: string,
  anchor: Annotation['anchor']
): { lineStart: number; lineEnd: number } {
  const match = resolveAnnotationMatch(
    content,
    {
      selectedText,
      anchor
    },
    new Set()
  )

  if (!match) {
    return { lineStart: 1, lineEnd: 1 }
  }

  return {
    lineStart: content.slice(0, match.startOffset).split('\n').length,
    lineEnd: content.slice(0, match.endOffset).split('\n').length
  }
}

function closePopover(
  setSelectionState: React.Dispatch<React.SetStateAction<SelectionState | null>>,
  setComment: React.Dispatch<React.SetStateAction<string>>,
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
): void {
  setSelectionState(null)
  setComment('')
  setEditing(false)
}

function getButtonStyle(rect: DOMRect | undefined): React.CSSProperties | undefined {
  if (!rect) {
    return undefined
  }

  const margin = 16
  const viewportWidth = window.innerWidth
  const buttonWidth = 88
  const buttonHeight = 32
  const preferredTop = rect.top - buttonHeight - 8
  const fallbackTop = rect.bottom + 8

  return {
    top:
      preferredTop >= margin
        ? preferredTop
        : Math.min(fallbackTop, window.innerHeight - margin - buttonHeight),
    left: clamp(rect.left + rect.width / 2 - buttonWidth / 2, margin, viewportWidth - margin - buttonWidth)
  }
}

function getCardStyle(rect: DOMRect | undefined): React.CSSProperties | undefined {
  if (!rect) {
    return undefined
  }

  const margin = 16
  const gap = 8
  const maxWidth = Math.min(320, window.innerWidth - margin * 2)
  const estimatedHeight = Math.min(260, window.innerHeight - margin * 2)
  const preferredBelowTop = rect.bottom + gap
  const preferredAboveTop = rect.top - gap - estimatedHeight
  const top =
    preferredBelowTop + estimatedHeight <= window.innerHeight - margin || preferredAboveTop < margin
      ? clamp(preferredBelowTop, margin, window.innerHeight - margin - estimatedHeight)
      : clamp(preferredAboveTop, margin, window.innerHeight - margin - estimatedHeight)

  return {
    top,
    left: clamp(rect.left + rect.width / 2 - maxWidth / 2, margin, window.innerWidth - margin - maxWidth),
    width: maxWidth
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
