import type { FileNode } from '../../types'

interface TabBarProps {
  readonly tabs: readonly FileNode[]
  readonly activeTabPath: string
  readonly hasUnsavedChanges: boolean
  readonly onSwitch: (file: FileNode) => void
  readonly onClose: (file: FileNode) => void
}

export function TabBar({
  tabs,
  activeTabPath,
  hasUnsavedChanges,
  onSwitch,
  onClose
}: TabBarProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-end gap-0 overflow-x-auto border-b border-border bg-canvas/50">
      {tabs.map((tab, index) => {
        const active = tab.path === activeTabPath
        const showUnsaved = active && hasUnsavedChanges
        const isFirst = index === 0

        return (
          <div
            key={tab.path}
            className={[
              'group relative flex h-8 max-w-48 items-center gap-1.5 rounded-t-lg px-3 text-[12px] transition-colors duration-100',
              isFirst ? 'pl-4' : '',
              active
                ? 'bg-surface text-text-primary'
                : 'text-text-muted hover:bg-hover hover:text-text-secondary'
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSwitch(tab)}
              className="min-w-0 truncate"
              title={tab.name}
            >
              {tab.name}
            </button>

            {showUnsaved ? <span className="shrink-0 text-[10px] leading-none text-accent">●</span> : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab)
              }}
              className="ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-hover hover:text-text-primary"
              aria-label={`关闭 ${tab.name}`}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
