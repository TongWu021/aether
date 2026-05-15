import { useEffect, useMemo, useState } from 'react'

import type { MemoryRenameResult, ShortTermMemoryCard } from '../../types'
import { truncatePath } from '../../utils/format'
import { useToast } from '../shared/Toast'

interface ShortTermMemoryDashboardProps {
  readonly cards: readonly ShortTermMemoryCard[]
  readonly loading: boolean
  readonly onOpenRecord: (card: ShortTermMemoryCard) => void
  readonly onRename: (card: ShortTermMemoryCard, nextTitle: string) => Promise<MemoryRenameResult>
}

export function ShortTermMemoryDashboard({
  cards,
  loading,
  onOpenRecord,
  onRename
}: ShortTermMemoryDashboardProps): React.JSX.Element {
  const [selectedCardPath, setSelectedCardPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const { showToast } = useToast()

  const selectedCard = useMemo(
    () => cards.find((card) => card.filePath === selectedCardPath) ?? null,
    [cards, selectedCardPath]
  )

  useEffect(() => {
    if (!selectedCard) {
      setRenameOpen(false)
      return
    }

    setRenameValue(selectedCard.title)
  }, [selectedCard])

  if (loading) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-[22px] border border-border bg-surface text-sm text-text-muted">
        正在整理短期记忆...
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-[22px] border border-dashed border-border bg-surface px-6 text-center">
        <div>
          <div className="text-sm font-medium text-text-primary">短期记忆还是空的</div>
          <div className="mt-2 text-sm text-text-secondary">
            新的对话记录导出后，这里会自动生成对应的记忆卡片。
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 pr-1">
        {cards.map((card) => (
          <button
            key={card.filePath}
            type="button"
            onClick={() => {
              setSelectedCardPath(card.filePath)
            }}
            className={[
              'group flex min-h-[224px] flex-col rounded-[22px] border bg-surface p-5 text-left transition-[transform,border-color,box-shadow,background-color] duration-200',
              card.isEmpty
                ? 'border-border/70 opacity-65 hover:border-border hover:bg-hover/40 hover:opacity-100'
                : 'border-border hover:-translate-y-0.5 hover:border-accent/35 hover:bg-hover/35 hover:shadow-[0_18px_30px_rgba(10,10,10,0.06)]'
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-6 items-center rounded-full border border-border bg-canvas px-2.5 text-[11px] font-medium text-text-secondary">
                {card.category}
              </span>
              <span className="shrink-0 text-[11px] text-text-muted">{formatDate(card.lastUpdatedAt)}</span>
            </div>

            <div className="mt-4 text-[15px] font-semibold leading-6 tracking-[-0.01em] text-text-primary">
              {card.title}
            </div>

            <div className="mt-3 line-clamp-4 text-[13px] leading-6 text-text-secondary">
              {card.summary}
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                <span>{card.wordCount.toLocaleString()} 字</span>
                <span>{card.msgCount} 轮</span>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  void copyPath(card.filePath, showToast)
                }}
                className="inline-flex items-center px-1 py-0.5 text-[4px] font-normal leading-none tracking-[0.02em] text-text-muted transition-colors duration-150 hover:text-text-primary"
              >
                复制路径
              </button>
            </div>
          </button>
        ))}
      </div>

      {selectedCard ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(10,10,10,0.38)] px-6 py-10 backdrop-blur-[3px]"
          onClick={() => {
            if (renaming) {
              return
            }

            setSelectedCardPath(null)
          }}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_26px_60px_rgba(10,10,10,0.14)]"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
                短期记忆详情
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCardPath(null)
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary"
              >
                ×
              </button>
            </div>

            <div className="aether-scrollbar min-h-0 overflow-y-auto px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full border border-border bg-canvas px-2.5 text-[11px] font-medium text-text-secondary">
                  {selectedCard.category}
                </span>
                <span className="text-[11px] text-text-muted">
                  更新于 {formatDateTime(selectedCard.lastUpdatedAt)}
                </span>
              </div>

              {renameOpen ? (
                <div className="mt-4">
                  <input
                    value={renameValue}
                    autoFocus
                    onChange={(event) => {
                      setRenameValue(event.target.value)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleRename()
                      }
                    }}
                    className="h-11 w-full rounded-2xl border border-border bg-canvas px-4 text-[15px] font-semibold text-text-primary outline-none transition-colors duration-150 focus:border-accent/45"
                  />

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={renaming}
                      onClick={() => {
                        void handleRename()
                      }}
                      className="inline-flex h-8 items-center rounded-full bg-accent px-3.5 text-[12px] font-medium text-text-inverse transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {renaming ? '保存中...' : '确认改名'}
                    </button>
                    <button
                      type="button"
                      disabled={renaming}
                      onClick={() => {
                        setRenameOpen(false)
                        setRenameValue(selectedCard.title)
                      }}
                      className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[24px] font-semibold tracking-[-0.03em] text-text-primary">
                      {selectedCard.title}
                    </div>
                    <div className="mt-3 text-[13px] leading-6 text-text-secondary">
                      {selectedCard.summary}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRenameOpen(true)
                      setRenameValue(selectedCard.title)
                    }}
                    className="inline-flex h-8 shrink-0 items-center rounded-full border border-border px-3 text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary"
                  >
                    改名
                  </button>
                </div>
              )}

              <div className="mt-6 rounded-[22px] border border-border bg-canvas p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label="文件名" value={selectedCard.filename} />
                  <DetailItem label="字数" value={`${selectedCard.wordCount.toLocaleString()} 字`} />
                  <DetailItem label="对话轮次" value={`${selectedCard.msgCount} 轮`} />
                  <DetailItem label="文件大小" value={formatFileSize(selectedCard.fileSize)} />
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
                    文件路径
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-text-secondary" title={selectedCard.filePath}>
                    {truncatePath(selectedCard.filePath)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  void copyPath(selectedCard.filePath, showToast)
                }}
                className="inline-flex h-8 items-center rounded-full border border-border px-3 text-[11px] font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary"
              >
                复制文件路径
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenRecord(selectedCard)
                  setSelectedCardPath(null)
                }}
                className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[12px] font-medium text-text-inverse transition-colors duration-150 hover:bg-accent-hover"
              >
                打开原文
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  async function handleRename(): Promise<void> {
    if (!selectedCard || !renameValue.trim() || renameValue.trim() === selectedCard.title) {
      setRenameOpen(false)
      return
    }

    try {
      setRenaming(true)
      const result = await onRename(selectedCard, renameValue.trim())
      showToast(`已改名为: ${result.title}`, 'success')
      setSelectedCardPath(result.newFilePath)
      setRenameOpen(false)
    } catch (error) {
      showToast(toErrorMessage(error, '改名失败'), 'error')
    } finally {
      setRenaming(false)
    }
  }
}

interface DetailItemProps {
  readonly label: string
  readonly value: string
}

function DetailItem({ label, value }: DetailItemProps): React.JSX.Element {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">{label}</div>
      <div className="mt-1 text-[13px] leading-6 text-text-primary">{value}</div>
    </div>
  )
}

async function copyPath(path: string, showToast: (message: string, type?: 'success' | 'error' | 'info') => void): Promise<void> {
  try {
    await window.electronAPI.file.copyPath(path)
    showToast(`已复制: ${truncatePath(path)}`, 'success')
  } catch (error) {
    showToast(toErrorMessage(error, '复制失败'), 'error')
  }
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toISOString().slice(0, 10)
}

function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
