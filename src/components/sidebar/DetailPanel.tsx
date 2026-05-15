import { useEffect, useRef, useState } from 'react'

import type { Annotation, FileNode } from '../../types'
import { formatDate, formatFileSize } from '../../utils/format'
import { toLocalResourceUrl } from '../../utils/url'
import { AiChat } from './AiChat'
import { AnnotationList } from './AnnotationList'
import { MemoEditor } from './MemoEditor'
import { CopyButton } from '../shared/CopyButton'

interface DetailPanelProps {
  readonly selectedFile: FileNode | null
  readonly annotations: readonly Annotation[]
  readonly onScrollToAnnotation: (annotation: Annotation) => void
  readonly onDeleteAnnotation: (id: string) => void
  readonly onCopyAnnotation: (annotation: Annotation) => void
  readonly onExportAll: () => void
  readonly memoContent: string
  readonly memoLoading: boolean
  readonly onMemoChange: (html: string) => void
  readonly onMemoExport: () => void
  readonly chatMessages: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[]
  readonly chatLoading: boolean
  readonly onChatSend: (question: string) => Promise<void>
  readonly isPreviewMode: boolean
  readonly onCopyPath: (path: string) => void
  readonly panelWidth: number
  readonly onPanelWidthChange: (width: number) => void
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
}

export function DetailPanel({
  selectedFile,
  annotations,
  onScrollToAnnotation,
  onDeleteAnnotation,
  onCopyAnnotation,
  onExportAll,
  memoContent,
  memoLoading,
  onMemoChange,
  onMemoExport,
  chatMessages,
  chatLoading,
  onChatSend,
  isPreviewMode,
  onCopyPath,
  panelWidth,
  onPanelWidthChange,
  collapsed,
  onToggleCollapse
}: DetailPanelProps): React.JSX.Element {
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)
  const [panelTab, setPanelTab] = useState<'details' | 'annotations' | 'memo' | 'ai'>('details')
  const sliderOffset =
    panelTab === 'details' ? 0 : panelTab === 'annotations' ? 100 : panelTab === 'memo' ? 200 : 300

  useEffect(() => {
    setImagePreviewFailed(false)
  }, [selectedFile?.path])

  useEffect(() => {
    if (!isPreviewMode) {
      setPanelTab('details')
    }
  }, [isPreviewMode])

  const prevAnnotationsCountRef = useRef(annotations.length)
  const prevFilePathRef = useRef(selectedFile?.path)

  useEffect(() => {
    const sameFile = selectedFile?.path === prevFilePathRef.current
    const countIncreased = annotations.length > prevAnnotationsCountRef.current

    if (sameFile && countIncreased && isPreviewMode) {
      setPanelTab('annotations')
    }

    prevAnnotationsCountRef.current = annotations.length
    prevFilePathRef.current = selectedFile?.path
  }, [annotations.length, selectedFile?.path, isPreviewMode])

  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = (event: React.MouseEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    setIsDragging(true)

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const delta = startX - moveEvent.clientX
      onPanelWidthChange(clampPanelWidth(startWidth + delta))
    }

    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setIsDragging(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (collapsed) {
    return (
      <aside className="aether-glass relative flex h-full w-11 shrink-0 justify-center rounded-[24px] transition-[width] duration-250 ease-in-out">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mt-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-sm text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
          aria-label="展开详情面板"
        >
          «
        </button>
      </aside>
    )
  }

  return (
    <div className="flex h-full shrink-0" style={{ width: panelWidth }}>
      <div
        className="-ml-3 flex w-3 shrink-0 cursor-col-resize items-center justify-center"
        onMouseDown={handleDragStart}
      />
      <aside
        className={[
          'aether-glass relative h-full min-w-0 flex-1 rounded-[24px]',
          isDragging ? '' : 'transition-[width] duration-250 ease-in-out'
        ].join(' ')}
      >

      {selectedFile ? (
        <div className="flex h-full flex-col px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center gap-2">
            {isPreviewMode ? (
              <div className="relative grid h-7 min-w-0 flex-1 grid-cols-4 items-center rounded-full border border-border bg-sidebar p-0.5">
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0.5 left-0.5 w-[calc(25%-2px)] rounded-full bg-surface shadow-[0_1px_2px_rgba(10,10,10,0.08)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(${sliderOffset}%)` }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('details')
                  }}
                  className={[
                    'relative z-10 inline-flex h-6 items-center justify-center rounded-full px-1 text-[11px] font-medium transition-colors duration-150',
                    panelTab === 'details'
                      ? 'text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  ].join(' ')}
                >
                  详情
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('annotations')
                  }}
                  className={[
                    'relative z-10 inline-flex h-6 items-center justify-center rounded-full px-1 text-[11px] font-medium transition-colors duration-150',
                    panelTab === 'annotations'
                      ? 'text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  ].join(' ')}
                >
                  批注
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('memo')
                  }}
                  className={[
                    'relative z-10 inline-flex h-6 items-center justify-center rounded-full px-1 text-[11px] font-medium transition-colors duration-150',
                    panelTab === 'memo' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  ].join(' ')}
                >
                  备忘
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('ai')
                  }}
                  className={[
                    'relative z-10 inline-flex h-6 items-center justify-center rounded-full px-1 text-[11px] font-medium transition-colors duration-150',
                    panelTab === 'ai' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  ].join(' ')}
                >
                  AI
                </button>
              </div>
            ) : <div />}

            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
              aria-label="折叠详情面板"
            >
              »
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {panelTab === 'ai' ? (
              <AiChat messages={chatMessages} loading={chatLoading} onSend={onChatSend} />
            ) : panelTab === 'memo' ? (
              <MemoEditor
                content={memoContent}
                loading={memoLoading}
                onChange={onMemoChange}
                onExport={onMemoExport}
              />
            ) : panelTab === 'annotations' ? (
              <AnnotationList
                annotations={annotations}
                onScrollTo={onScrollToAnnotation}
                onDelete={onDeleteAnnotation}
                onCopySingle={onCopyAnnotation}
                onExportAll={onExportAll}
              />
            ) : (
              <div>
                <div className="mb-2 text-base font-semibold text-text-primary">{selectedFile.name}</div>

                <div className="mb-4 flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onCopyPath(selectedFile.path)
                    }}
                    className="truncate text-left text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
                    title={selectedFile.path}
                  >
                    {selectedFile.path}
                  </button>
                  <CopyButton path={selectedFile.path} size="sm" className="shrink-0" />
                </div>

                {isImageFile(selectedFile) ? (
                  <div className="mb-4 overflow-hidden rounded-2xl bg-canvas/88 shadow-[inset_0_0_0_1px_rgba(10,10,10,0.04)]">
                    {imagePreviewFailed ? (
                      <div
                        className="grid place-items-center px-4 py-8 text-sm text-text-muted"
                        style={{ minHeight: 120 }}
                      >
                        无法预览
                      </div>
                    ) : (
                      <img
                        src={toLocalResourceUrl(selectedFile.path)}
                        alt={selectedFile.name}
                        className="w-full object-contain"
                        style={{ maxHeight: 200 }}
                        onError={() => {
                          setImagePreviewFailed(true)
                        }}
                      />
                    )}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <DetailRow label="类型" value={selectedFile.type === 'directory' ? '文件夹' : '文件'} />
                  <DetailRow label="扩展名" value={selectedFile.extension ? `.${selectedFile.extension}` : '—'} />
                  <DetailRow
                    label="大小"
                    value={selectedFile.size !== undefined ? formatFileSize(selectedFile.size) : '—'}
                  />
                  <DetailRow label="修改时间" value={formatDate(selectedFile.modifiedAt)} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid h-full place-items-center px-6 text-sm text-text-muted">
          选择文件查看详情
        </div>
      )}
    </aside>
    </div>
  )
}

interface DetailRowProps {
  readonly label: string
  readonly value: string
}

function DetailRow({ label, value }: DetailRowProps): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  )
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'])

function clampPanelWidth(width: number): number {
  return Math.max(280, Math.min(560, width))
}

function isImageFile(node: FileNode): boolean {
  return node.type === 'file' && IMAGE_EXTENSIONS.has((node.extension ?? '').toLowerCase())
}
