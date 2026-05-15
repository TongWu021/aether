import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'

interface SheetTabBarProps {
  readonly sheets: ReadonlyArray<{ readonly id: string; readonly name: string }>
  readonly activeSheetId: string
  readonly onActivate: (id: string) => void
  readonly onRename: (id: string, newName: string) => void
  readonly onAdd: () => void
  readonly onDelete: (id: string) => void
  readonly onDuplicate: (id: string) => void
  readonly onReorder: (newOrder: readonly string[]) => void
}

interface ContextMenuState {
  readonly id: string
  readonly x: number
  readonly y: number
}

export function SheetTabBar({
  sheets,
  activeSheetId,
  onActivate,
  onRename,
  onAdd,
  onDelete,
  onDuplicate,
  onReorder
}: SheetTabBarProps): React.JSX.Element {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const orderedIds = useMemo(() => sheets.map((sheet) => sheet.id), [sheets])

  useEffect(() => {
    if (editingTabId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingTabId])

  useEffect(() => {
    const closeMenu = (): void => setContextMenu(null)
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) {
        return
      }

      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return
      }

      event.preventDefault()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      activateByOffset(activeSheetId, direction, sheets, onActivate)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSheetId, onActivate, sheets])

  const startEditing = (id: string, name: string): void => {
    setEditingTabId(id)
    setEditingName(name)
    setContextMenu(null)
  }

  const commitEditing = (): void => {
    if (!editingTabId) {
      return
    }

    const nextName = editingName.trim()
    if (nextName.length > 0) {
      onRename(editingTabId, nextName)
    }

    setEditingTabId(null)
  }

  const cancelEditing = (): void => {
    setEditingTabId(null)
    setEditingName('')
  }

  const handleDrop = (targetId: string): void => {
    if (!draggingTabId || draggingTabId === targetId) {
      setDraggingTabId(null)
      setDragOverTabId(null)
      return
    }

    onReorder(reorderIds(orderedIds, draggingTabId, targetId))
    setDraggingTabId(null)
    setDragOverTabId(null)
  }

  return (
    <div className="aether-scrollbar flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-t border-border-subtle px-4">
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeSheetId
        const isEditing = sheet.id === editingTabId
        const isDragging = sheet.id === draggingTabId
        const isDragOver = sheet.id === dragOverTabId

        return (
          <button
            key={sheet.id}
            type="button"
            draggable={!isEditing}
            onClick={() => onActivate(sheet.id)}
            onDoubleClick={() => startEditing(sheet.id, sheet.name)}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({ id: sheet.id, x: event.clientX, y: event.clientY })
            }}
            onDragStart={() => setDraggingTabId(sheet.id)}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOverTabId(sheet.id)
            }}
            onDragLeave={() => setDragOverTabId(null)}
            onDrop={() => handleDrop(sheet.id)}
            onDragEnd={() => {
              setDraggingTabId(null)
              setDragOverTabId(null)
            }}
            className={getTabClassName(isActive, isDragging, isDragOver)}
          >
            {isActive ? <span className="h-1 w-1 shrink-0 rounded-full bg-accent" /> : null}
            {isEditing ? (
              <input
                ref={inputRef}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={commitEditing}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitEditing()
                  if (event.key === 'Escape') cancelEditing()
                }}
                className="h-5 rounded-sm bg-transparent px-0 text-[12px] text-text-primary outline-none ring-1 ring-text-secondary/30"
                style={{ width: Math.max(48, editingName.length * 7 + 18) }}
              />
            ) : (
              <span className="max-w-[160px] truncate">{sheet.name}</span>
            )}
          </button>
        )
      })}

      <button
        type="button"
        onClick={onAdd}
        className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-secondary"
        aria-label="新增 Sheet"
      >
        <Plus size={14} />
      </button>

      {contextMenu ? (
        <SheetContextMenu
          contextMenu={contextMenu}
          canDelete={sheets.length > 1}
          onRename={() => {
            const sheet = sheets.find((item) => item.id === contextMenu.id)
            if (sheet) startEditing(sheet.id, sheet.name)
          }}
          onDuplicate={() => {
            onDuplicate(contextMenu.id)
            setContextMenu(null)
          }}
          onDelete={() => {
            onDelete(contextMenu.id)
            setContextMenu(null)
          }}
        />
      ) : null}
    </div>
  )
}

function SheetContextMenu({
  contextMenu,
  canDelete,
  onRename,
  onDuplicate,
  onDelete
}: {
  readonly contextMenu: ContextMenuState
  readonly canDelete: boolean
  readonly onRename: () => void
  readonly onDuplicate: () => void
  readonly onDelete: () => void
}): React.JSX.Element {
  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-md border border-border bg-surface-raised py-1 shadow-md"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(event) => event.stopPropagation()}
    >
      <MenuItem icon={<Pencil size={14} />} label="重命名" onClick={onRename} />
      <MenuItem icon={<Copy size={14} />} label="复制" onClick={onDuplicate} />
      <MenuItem
        icon={<Trash2 size={14} />}
        label="删除"
        danger
        disabled={!canDelete}
        onClick={onDelete}
      />
    </div>
  )
}

function MenuItem({
  icon,
  label,
  danger,
  disabled,
  onClick
}: {
  readonly icon: React.ReactNode
  readonly label: string
  readonly danger?: boolean
  readonly disabled?: boolean
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex h-7 w-full items-center gap-2 px-3 text-left text-[13px] transition-colors duration-150',
        danger
          ? 'text-error hover:bg-error/8 hover:text-error'
          : 'text-text-secondary hover:bg-hover hover:text-text-primary',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

function getTabClassName(isActive: boolean, isDragging: boolean, isDragOver: boolean): string {
  return [
    'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-secondary',
    isActive
      ? 'bg-highlight font-medium text-text-primary'
      : 'font-normal text-text-muted hover:bg-hover hover:text-text-secondary',
    isDragging ? 'cursor-grabbing opacity-50' : 'cursor-pointer',
    isDragOver ? 'bg-hover' : ''
  ].join(' ')
}

function activateByOffset(
  activeSheetId: string,
  offset: number,
  sheets: SheetTabBarProps['sheets'],
  onActivate: (id: string) => void
): void {
  const activeIndex = sheets.findIndex((sheet) => sheet.id === activeSheetId)
  const nextIndex = (activeIndex + offset + sheets.length) % sheets.length
  const nextSheet = sheets[nextIndex]

  if (nextSheet) {
    onActivate(nextSheet.id)
  }
}

function reorderIds(ids: readonly string[], fromId: string, toId: string): readonly string[] {
  const nextIds = ids.filter((id) => id !== fromId)
  const targetIndex = nextIds.indexOf(toId)
  return [...nextIds.slice(0, targetIndex), fromId, ...nextIds.slice(targetIndex)]
}
