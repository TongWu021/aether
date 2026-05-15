import { useEffect, useMemo, useRef, useState } from 'react'

import type { ShortTermMemoryCard } from '../../types'

const PAGE_SIZE = 20

interface ShortTermMemoryProps {
  readonly entries: readonly ShortTermMemoryCard[]
  readonly loading: boolean
  readonly activeFileId?: string | null
  readonly onSelect: (entry: ShortTermMemoryCard) => void
}

export function ShortTermMemory({
  entries,
  loading,
  activeFileId = null,
  onSelect
}: ShortTermMemoryProps): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState(1)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const totalPages = Math.ceil(entries.length / PAGE_SIZE)

  const pagedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return entries.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, entries])

  useEffect(() => {
    setCurrentPage(1)
  }, [entries])

  useEffect(() => {
    if (!activeFileId) {
      return
    }

    const activeIndex = entries.findIndex((entry) => entry.fileId === activeFileId)

    if (activeIndex < 0) {
      return
    }

    const nextPage = Math.floor(activeIndex / PAGE_SIZE) + 1
    setCurrentPage(nextPage)
  }, [activeFileId, entries])

  useEffect(() => {
    if (!listContainerRef.current || totalPages <= 1) {
      return
    }

    listContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentPage, totalPages])

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border border-border text-sm text-text-muted">
        正在扫描短期记忆...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border text-sm text-text-muted">
        未扫描到短期记忆
      </div>
    )
  }

  return (
    <div ref={listContainerRef} className="overflow-hidden rounded-lg border border-border bg-surface">
      {pagedEntries.map((entry) => (
        <MemoryListItem
          key={entry.fileId}
          entry={entry}
          active={entry.fileId === activeFileId}
          onSelect={onSelect}
        />
      ))}

      {totalPages > 1 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onSelectPage={setCurrentPage}
        />
      ) : null}
    </div>
  )
}

interface MemoryListItemProps {
  readonly entry: ShortTermMemoryCard
  readonly active: boolean
  readonly onSelect: (entry: ShortTermMemoryCard) => void
}

function MemoryListItem({ entry, active, onSelect }: MemoryListItemProps): React.JSX.Element {
  const rowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (active && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active])

  return (
    <button
      ref={active ? rowRef : undefined}
      type="button"
      onClick={() => {
        onSelect(entry)
      }}
      className={[
        'block w-full border-b border-border px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-hover',
        active ? 'border-l-2 border-l-accent bg-highlight hover:bg-highlight' : ''
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm text-text-muted">◌</span>
          <span className="truncate text-sm font-medium text-text-primary">{entry.title}</span>
        </div>
        <div className="shrink-0 text-xs text-text-muted">{formatDate(entry.lastUpdatedAt)}</div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
        <span>{entry.wordCount.toLocaleString()} 字</span>
        <StatusIndicator status={entry.status} />
        <span>{entry.category}</span>
        {entry.tags.length > 0 ? <span className="truncate">{entry.tags.join(' · ')}</span> : null}
      </div>
    </button>
  )
}

interface PaginationProps {
  readonly currentPage: number
  readonly totalPages: number
  readonly onSelectPage: (page: number) => void
}

function Pagination({ currentPage, totalPages, onSelectPage }: PaginationProps): React.JSX.Element {
  const pages = buildVisiblePages(currentPage, totalPages)

  return (
    <div className="flex items-center justify-center gap-2 border-t border-border py-3">
      <button
        type="button"
        onClick={() => {
          onSelectPage(currentPage - 1)
        }}
        disabled={currentPage === 1}
        className="rounded px-2 py-1 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        ← 上一页
      </button>

      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-text-muted">
            ...
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => {
              onSelectPage(page)
            }}
            aria-current={page === currentPage ? 'page' : undefined}
            className={[
              'h-8 w-8 rounded text-sm transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none',
              page === currentPage
                ? 'bg-accent text-text-inverse'
                : 'text-text-secondary hover:bg-hover'
            ].join(' ')}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => {
          onSelectPage(currentPage + 1)
        }}
        disabled={currentPage === totalPages}
        className="rounded px-2 py-1 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        下一页 →
      </button>
    </div>
  )
}

interface StatusIndicatorProps {
  readonly status: ShortTermMemoryCard['status']
}

function StatusIndicator({ status }: StatusIndicatorProps): React.JSX.Element {
  switch (status) {
    case 'processed':
      return (
        <span className="inline-flex items-center gap-1 text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-error">
          <span className="h-1.5 w-1.5 rounded-full bg-error" />
          <span>处理失败</span>
        </span>
      )
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
          <span>待处理</span>
        </span>
      )
  }
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toISOString().slice(0, 10)
}

function buildVisiblePages(currentPage: number, totalPages: number): ReadonlyArray<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const visiblePages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const normalizedPages = [...visiblePages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)

  const result: Array<number | 'ellipsis'> = []

  for (let index = 0; index < normalizedPages.length; index += 1) {
    const page = normalizedPages[index]
    const previousPage = normalizedPages[index - 1]

    if (previousPage !== undefined && page - previousPage > 1) {
      result.push('ellipsis')
    }

    result.push(page)
  }

  return result
}
