import { useEffect, useState } from 'react'

import { MarkdownEditor } from '../editor/MarkdownEditor'
import { MarkdownViewer } from '../editor/MarkdownViewer'
import { ModeButton } from '../shared/ModeButton'
import { useToast } from '../shared/Toast'

interface LongTermMemoryProps {
  readonly filePath: string | null
}

export function LongTermMemory({ filePath }: LongTermMemoryProps): React.JSX.Element {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const hasUnsavedChanges = draft !== content
  const fileName = filePath ? getBaseName(filePath) : '长期记忆'

  useEffect(() => {
    if (!filePath) {
      setMode('preview')
      setContent('')
      setDraft('')
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const loadContent = async (): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const nextContent = await window.electronAPI.file.readFile(filePath)

        if (!cancelled) {
          setContent(nextContent)
          setDraft(nextContent)
        }
      } catch (readError) {
        if (!cancelled) {
          setContent('')
          setDraft('')
          setError(toLongTermMemoryErrorMessage(readError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadContent()

    return () => {
      cancelled = true
    }
  }, [filePath])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()

        if (mode === 'edit' && hasUnsavedChanges) {
          void handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasUnsavedChanges, mode, draft, filePath])

  const handleSave = async (): Promise<void> => {
    if (!filePath || !hasUnsavedChanges) {
      return
    }

    try {
      await window.electronAPI.file.writeFile(filePath, draft)
      setContent(draft)
      showToast('长期记忆已保存', 'success')
    } catch (saveError) {
      showToast(toLongTermMemorySaveErrorMessage(saveError), 'error')
    }
  }

  if (!filePath) {
    return (
      <div className="flex min-h-[400px] w-full flex-1 items-center justify-center text-center">
        <div className="max-w-md px-6">
          <div className="text-sm font-medium text-text-primary">还没有配置长期记忆文件</div>
          <div className="mt-2 text-sm text-text-secondary">
            在设置中配置记忆文件路径后，这里会显示长期记忆内容。
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-medium text-text-primary">{fileName}</div>
          <div className="mt-2 text-xs text-text-muted">长期记忆文件</div>
        </div>

        <div className="grid min-h-[520px] flex-1 place-items-center text-sm text-text-muted">
          正在读取长期记忆...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-medium text-text-primary">{fileName}</div>
          <div className="mt-2 text-xs text-text-muted">长期记忆文件</div>
        </div>

        <div className="grid min-h-[520px] flex-1 place-items-center px-6 text-center text-sm text-error">
          <div className="max-w-md">
            <div className="font-medium">无法读取长期记忆文件</div>
            <div className="mt-2 text-xs text-text-muted">{error}</div>
            <div className="mt-2 text-xs text-text-muted">
              请检查文件路径或权限设置后重试。
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text-primary" title={fileName}>
            {fileName}
          </div>
          <div className="mt-2 text-xs text-text-muted">长期记忆文件</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex rounded-lg bg-hover p-1">
            <ModeButton
              active={mode === 'preview'}
              label="预览"
              onClick={() => {
                setMode('preview')
              }}
            />
            <ModeButton
              active={mode === 'edit'}
              label="编辑"
              onClick={() => {
                setMode('edit')
              }}
            />
          </div>

          {hasUnsavedChanges ? (
            <button
              type="button"
              onClick={() => {
                void handleSave()
              }}
              className="rounded-lg bg-accent px-3 py-1 text-xs text-text-inverse transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
            >
              保存
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-[520px] flex-1">
        {mode === 'edit' ? (
          <MarkdownEditor
            content={draft}
            onChange={setDraft}
            className="h-[calc(100vh-240px)] min-h-[520px]"
          />
        ) : (
          <div className="px-6 py-6">
            <MarkdownViewer content={draft} filePath={filePath} />
          </div>
        )}
      </div>
    </div>
  )
}

function toLongTermMemoryErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '读取长期记忆失败'
  return `无法读取长期记忆文件: ${detail}`
}

function toLongTermMemorySaveErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '保存长期记忆失败'
  return `保存失败: ${detail}`
}

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? filePath
}
