import { useEffect, useMemo, useRef, useState } from 'react'

import type { FileNode } from '../../types'

interface FileSearchProps {
  readonly files: readonly FileNode[]
  readonly onSelect: (node: FileNode) => void
}

export function FileSearch({ files, onSelect }: FileSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const results = useMemo(() => {
    const normalizedQuery = normalizeQuery(query)
    const keywords = extractKeywords(normalizedQuery)

    if (!normalizedQuery || keywords.length === 0) {
      return []
    }

    return files
      .map((node) => ({
        node,
        score: scoreFileMatch(node, normalizedQuery, keywords)
      }))
      .filter((item) => item.score >= 0)
      .sort((left, right) => left.score - right.score || compareResultNodes(left.node, right.node))
      .slice(0, 30)
      .map((item) => item.node)
  }, [files, query])

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  useEffect(() => {
    setHighlightedIndex(0)
    setOpen(query.trim().length > 0)
  }, [query])

  useEffect(() => {
    if (highlightedIndex >= results.length) {
      setHighlightedIndex(results.length > 0 ? results.length - 1 : 0)
    }
  }, [highlightedIndex, results.length])

  const handleSelect = (node: FileNode): void => {
    onSelect(node)
    setQuery('')
    setOpen(false)
    setHighlightedIndex(0)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="text"
        aria-label="搜索文件"
        value={query}
        placeholder="搜索文件..."
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        onFocus={() => {
          if (query.trim()) {
            setOpen(true)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setQuery('')
            setOpen(false)
            setHighlightedIndex(0)
            return
          }

          if (!open || results.length === 0) {
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlightedIndex((current) => (current + 1) % results.length)
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlightedIndex((current) => (current - 1 + results.length) % results.length)
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            const selected = results[highlightedIndex]

            if (selected) {
              handleSelect(selected)
            }
          }
        }}
        className="h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-accent"
      />

      {open ? (
        <div className="aether-scrollbar absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((node, index) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    handleSelect(node)
                  }}
                  className={[
                    'block w-full cursor-pointer px-3 py-2 text-left transition-colors duration-150 hover:bg-hover',
                    index === highlightedIndex ? 'bg-highlight' : ''
                  ].join(' ')}
                >
                  <div className="truncate text-sm text-text-primary">{node.name}</div>
                  <div className="mt-1 truncate text-xs text-text-muted">
                    {node.relativePath}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-text-muted">未找到匹配文件</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractKeywords(query: string): string[] {
  return query
    .split(/[\s/\\._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function scoreFileMatch(node: FileNode, query: string, keywords: readonly string[]): number {
  const lowerName = node.name.toLowerCase()
  const lowerPath = node.relativePath.toLowerCase()
  const searchableText = `${lowerName} ${lowerPath}`
  const compactQuery = query.replace(/[\\/\s_-]+/g, '')
  const compactName = lowerName.replace(/[\\/\s_-]+/g, '')
  const compactPath = lowerPath.replace(/[\\/\s_-]+/g, '')
  const compactKeywords = keywords.map((keyword) => keyword.replace(/[\\/\s_-]+/g, ''))

  const keywordScore = getKeywordScore(searchableText, keywords)

  if (keywordScore >= 0) {
    return keywordScore
  }

  const compactKeywordScore = getCompactKeywordScore(compactName, compactPath, compactKeywords)

  if (compactKeywordScore >= 0) {
    return 120 + compactKeywordScore
  }

  if (lowerName === query) {
    return 200
  }

  if (lowerPath === query) {
    return 201
  }

  if (lowerName.startsWith(query)) {
    return 210
  }

  if (lowerName.includes(query)) {
    return 220 + lowerName.indexOf(query)
  }

  if (lowerPath.includes(query)) {
    return 260 + lowerPath.indexOf(query)
  }

  if (compactQuery && compactName.includes(compactQuery)) {
    return 320 + compactName.indexOf(compactQuery)
  }

  if (compactQuery && compactPath.includes(compactQuery)) {
    return 360 + compactPath.indexOf(compactQuery)
  }

  const fuzzyNameScore = getFuzzyScore(lowerName, query)

  if (fuzzyNameScore >= 0) {
    return 420 + fuzzyNameScore
  }

  const fuzzyPathScore = getFuzzyScore(lowerPath, query)

  if (fuzzyPathScore >= 0) {
    return 520 + fuzzyPathScore
  }

  return -1
}

function getKeywordScore(searchableText: string, keywords: readonly string[]): number {
  let score = 0

  for (const keyword of keywords) {
    const index = searchableText.indexOf(keyword)

    if (index < 0) {
      return -1
    }

    score += index
  }

  return score
}

function getCompactKeywordScore(
  compactName: string,
  compactPath: string,
  compactKeywords: readonly string[]
): number {
  let score = 0

  for (const keyword of compactKeywords) {
    if (!keyword) {
      continue
    }

    const nameIndex = compactName.indexOf(keyword)
    const pathIndex = compactPath.indexOf(keyword)

    if (nameIndex >= 0) {
      score += nameIndex
      continue
    }

    if (pathIndex >= 0) {
      score += 40 + pathIndex
      continue
    }

    return -1
  }

  return score
}

function getFuzzyScore(value: string, query: string): number {
  let queryIndex = 0
  let score = 0

  for (const [index, char] of [...value].entries()) {
    if (char === query[queryIndex]) {
      queryIndex += 1
      score += index

      if (queryIndex === query.length) {
        return score
      }
    }
  }

  return -1
}

function compareResultNodes(left: FileNode, right: FileNode): number {
  return (
    left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' }) ||
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  )
}
