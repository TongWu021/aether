import { useEffect, useRef, useState } from 'react'

const inactiveMarkClassName = 'rounded bg-search-hl px-0.5 text-text-primary'
const activeMarkClassName = 'rounded bg-search-active px-0.5 text-text-primary'
const buttonClassName =
  'rounded border border-border px-2 py-1 text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50'

interface SearchBarProps {
  readonly visible: boolean
  readonly onClose: () => void
  readonly containerRef: React.RefObject<HTMLDivElement | null>
}

export function SearchBar({
  visible,
  onClose,
  containerRef
}: SearchBarProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const matchesRef = useRef<HTMLElement[]>([])
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [matchCount, setMatchCount] = useState(0)

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus()
      return
    }

    resetSearch(containerRef.current, matchesRef, setQuery, setCurrentIndex, setMatchCount)
  }, [containerRef, visible])

  useEffect(() => {
    if (!visible) {
      return
    }

    const matches = highlightMatches(containerRef.current, query)
    matchesRef.current = matches
    setMatchCount(matches.length)
    setCurrentIndex(matches.length > 0 ? 0 : -1)
  }, [containerRef, query, visible])

  useEffect(() => {
    if (!visible) {
      return
    }

    syncActiveMatch(matchesRef.current, currentIndex)
  }, [currentIndex, visible])

  if (!visible) {
    return null
  }

  const currentMatchLabel = matchCount > 0 && currentIndex >= 0 ? currentIndex + 1 : 0

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2 text-xs shadow-sm">
      <input
        ref={inputRef}
        aria-label="搜索"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            setCurrentIndex(getNextIndex(matchesRef.current.length, currentIndex, event.shiftKey))
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
        placeholder="搜索文内内容"
        className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-text-primary outline-none placeholder:text-text-muted focus:border-text-secondary"
      />
      <button
        type="button"
        onClick={() => {
          setCurrentIndex(getNextIndex(matchesRef.current.length, currentIndex, true))
        }}
        disabled={matchCount === 0}
        className={buttonClassName}
      >
        上一个
      </button>
      <button
        type="button"
        onClick={() => {
          setCurrentIndex(getNextIndex(matchesRef.current.length, currentIndex, false))
        }}
        disabled={matchCount === 0}
        className={buttonClassName}
      >
        下一个
      </button>
      <span className="w-12 text-center text-text-muted">{currentMatchLabel}/{matchCount}</span>
      <button type="button" onClick={onClose} className={buttonClassName}>
        关闭
      </button>
    </div>
  )
}

function resetSearch(
  container: HTMLDivElement | null,
  matchesRef: React.MutableRefObject<HTMLElement[]>,
  setQuery: React.Dispatch<React.SetStateAction<string>>,
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>,
  setMatchCount: React.Dispatch<React.SetStateAction<number>>
): void {
  clearHighlights(container)
  matchesRef.current = []
  setQuery('')
  setCurrentIndex(-1)
  setMatchCount(0)
}

function highlightMatches(container: HTMLDivElement | null, rawQuery: string): HTMLElement[] {
  if (!container) {
    return []
  }

  clearHighlights(container)
  const query = rawQuery.trim().toLowerCase()

  if (!query) {
    return []
  }

  const matches: HTMLElement[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest('mark[data-search-highlight="true"]') || !node.textContent?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes: Text[] = []
  let currentNode = walker.nextNode()

  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  for (const textNode of textNodes) {
    highlightTextNode(textNode, query, matches)
  }

  return matches
}

function clearHighlights(container: HTMLDivElement | null): void {
  if (!container) {
    return
  }

  const parents = new Set<HTMLElement>()

  for (const mark of container.querySelectorAll<HTMLElement>('mark[data-search-highlight="true"]')) {
    const parent = mark.parentElement

    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark)
    }

    mark.remove()

    if (parent) {
      parents.add(parent)
    }
  }

  for (const parent of parents) {
    parent.normalize()
  }
}

function highlightTextNode(textNode: Text, query: string, matches: HTMLElement[]): void {
  const text = textNode.textContent ?? ''
  const lowerText = text.toLowerCase()
  let searchIndex = lowerText.indexOf(query)

  if (searchIndex < 0) {
    return
  }

  let cursor = 0
  const fragment = document.createDocumentFragment()

  while (searchIndex >= 0) {
    fragment.append(text.slice(cursor, searchIndex))
    const mark = document.createElement('mark')
    mark.dataset.searchHighlight = 'true'
    mark.className = inactiveMarkClassName
    mark.textContent = text.slice(searchIndex, searchIndex + query.length)
    fragment.append(mark)
    matches.push(mark)
    cursor = searchIndex + query.length
    searchIndex = lowerText.indexOf(query, cursor)
  }

  fragment.append(text.slice(cursor))
  textNode.parentNode?.replaceChild(fragment, textNode)
}

function syncActiveMatch(matches: readonly HTMLElement[], currentIndex: number): void {
  for (const [index, match] of matches.entries()) {
    const isActive = index === currentIndex
    match.className = isActive ? activeMarkClassName : inactiveMarkClassName

    if (isActive) {
      match.scrollIntoView({ block: 'center' })
    }
  }
}

function getNextIndex(total: number, currentIndex: number, reverse: boolean): number {
  if (total === 0) {
    return -1
  }

  if (currentIndex < 0) {
    return reverse ? total - 1 : 0
  }

  return reverse ? (currentIndex - 1 + total) % total : (currentIndex + 1) % total
}
