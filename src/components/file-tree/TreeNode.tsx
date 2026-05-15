import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { FileNode } from '../../types'
import { formatFileSize } from '../../utils/format'
import { CopyButton } from '../shared/CopyButton'
import { Icon } from '../shared/Icon'

interface TreeNodeProps {
  readonly node: FileNode
  readonly depth: number
  readonly selectedPath: string | null
  readonly expandedPaths: ReadonlySet<string>
  readonly onSelect: (node: FileNode) => void
  readonly onCopyPath: (path: string) => void
  readonly onBuildContext?: (folderPath: string) => void
  readonly onToggleExpand?: (node: FileNode, expanded: boolean) => void
}

export function TreeNode({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onSelect,
  onCopyPath,
  onBuildContext,
  onToggleExpand
}: TreeNodeProps): React.JSX.Element {
  const isDirectory = node.type === 'directory'
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const children = node.children ?? []
  const isSelected = !isDirectory && selectedPath === node.path
  const expanded = manualExpanded ?? (expandedPaths.has(node.path) || depth === 0)

  useEffect(() => {
    if (expandedPaths.has(node.path)) {
      setManualExpanded(null)
    }
  }, [expandedPaths, node.path])

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isSelected])

  useEffect(() => {
    if (!contextMenuPos) {
      return
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setContextMenuPos(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenuPos])

  const handleToggleExpand = (): void => {
    const nextExpanded = !expanded
    setManualExpanded(nextExpanded)
    onToggleExpand?.(node, nextExpanded)
  }

  const handleRowClick = (): void => {
    if (isDirectory) {
      handleToggleExpand()
      return
    }

    onSelect(node)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!isDirectory || !onBuildContext) {
      return
    }

    event.preventDefault()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
  }

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleRowClick()
      return
    }

    if (!isDirectory) {
      return
    }

    if (event.key === 'ArrowRight' && !expanded) {
      event.preventDefault()
      handleToggleExpand()
      return
    }

    if (event.key === 'ArrowLeft' && expanded) {
      event.preventDefault()
      handleToggleExpand()
    }
  }

  return (
    <div className="text-sm text-text-primary">
      <div
        ref={rowRef}
        role="treeitem"
        tabIndex={0}
        aria-level={depth + 1}
        aria-expanded={isDirectory ? expanded : undefined}
        aria-selected={!isDirectory ? isSelected : undefined}
        className={[
          'group flex h-8 items-center border-l-2 pr-2 transition-colors duration-150',
          isSelected ? 'border-accent bg-highlight' : 'border-transparent hover:bg-hover'
        ].join(' ')}
        style={{ paddingLeft: depth * 24 }}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        onContextMenu={handleContextMenu}
      >
        <button
          type="button"
          aria-label={isDirectory ? `${expanded ? '收起' : '展开'} ${node.name}` : undefined}
          className={[
            'flex h-8 w-6 items-center justify-center rounded-md text-text-muted transition-colors duration-150',
            isDirectory ? 'hover:bg-hover hover:text-text-secondary' : 'pointer-events-none'
          ].join(' ')}
          onClick={(event) => {
            event.stopPropagation()

            if (isDirectory) {
              handleToggleExpand()
            }
          }}
        >
          {isDirectory ? <DirectoryChevron expanded={expanded} /> : null}
        </button>

        <div className="flex w-6 items-center justify-center">{renderNodeIcon(node, expanded)}</div>

        <div className="ml-2 flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-text-primary">{node.name}</span>
          {!isDirectory && (node.extension || node.size !== undefined) ? (
            <span className="shrink-0 text-xs text-text-secondary">
              {renderMeta(node.extension, node.size)}
            </span>
          ) : null}
        </div>

        <CopyButton
          path={node.path}
          size="sm"
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>

      <FolderContextMenu
        folderPath={node.path}
        contextMenuPos={contextMenuPos}
        onBuildContext={onBuildContext}
        onClose={() => {
          setContextMenuPos(null)
        }}
      />

      {isDirectory && children.length > 0 ? (
        <div
          role="group"
          className={[
            'grid overflow-hidden transition-all duration-200 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          ].join(' ')}
        >
          <div className="overflow-hidden">
            {children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onSelect={onSelect}
                onCopyPath={onCopyPath}
                onBuildContext={onBuildContext}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FolderContextMenu({
  folderPath,
  contextMenuPos,
  onBuildContext,
  onClose
}: {
  readonly folderPath: string
  readonly contextMenuPos: { x: number; y: number } | null
  readonly onBuildContext?: (folderPath: string) => void
  readonly onClose: () => void
}): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!contextMenuPos) {
      setIsVisible(false)
      return
    }

    setIsVisible(false)
    setPosition(contextMenuPos)
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      setIsVisible(false)
    }
  }, [contextMenuPos])

  useEffect(() => {
    if (!menuRef.current || !contextMenuPos) {
      return
    }

    const rect = menuRef.current.getBoundingClientRect()
    const x =
      contextMenuPos.x + rect.width > window.innerWidth
        ? contextMenuPos.x - rect.width
        : contextMenuPos.x
    const y =
      contextMenuPos.y + rect.height > window.innerHeight
        ? contextMenuPos.y - rect.height
        : contextMenuPos.y

    setPosition({ x, y })
  }, [contextMenuPos])

  if (!contextMenuPos || !onBuildContext) {
    return null
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className={[
          'fixed z-50 min-w-[180px] rounded-xl border border-border bg-surface p-1.5',
          'shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out',
          'motion-reduce:transform-none motion-reduce:transition-none',
          isVisible ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'
        ].join(' ')}
        style={{
          top: position.y,
          left: position.x,
          transformOrigin: 'top left'
        }}
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <button
          type="button"
          onClick={() => {
            onBuildContext(folderPath)
            onClose()
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-text-primary transition-colors duration-150 hover:bg-accent-subtle hover:text-accent"
        >
          <ContextIcon />
          生成上下文
        </button>
      </div>
    </>,
    document.body
  )
}

function ContextIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 8.5h4" />
    </svg>
  )
}

function DirectoryChevron({ expanded }: { readonly expanded: boolean }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={[
        'h-3.5 w-3.5 transition-transform duration-200 ease-out',
        expanded ? 'rotate-90' : 'rotate-0'
      ].join(' ')}
      fill="none"
    >
      <path
        d="M4 2.5L8 6L4 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function renderNodeIcon(node: FileNode, expanded: boolean): React.JSX.Element {
  if (node.type === 'directory') {
    return <Icon name={expanded ? 'folder-open' : 'folder-closed'} size={16} />
  }

  switch (node.extension) {
    case 'md':
      return <Icon name="file-markdown" size={16} />
    case 'json':
      return <Icon name="file-json" size={16} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
      return <Icon name="file-image" size={16} />
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'css':
    case 'scss':
    case 'html':
    case 'vue':
      return <Icon name="file-code" size={16} />
    default:
      return <Icon name="file-generic" size={16} />
  }
}

function renderMeta(extension?: string, size?: number): string {
  const meta: string[] = []

  if (extension) {
    meta.push(extension.toUpperCase())
  }

  if (size !== undefined) {
    meta.push(formatFileSize(size))
  }

  return meta.join(' · ')
}
