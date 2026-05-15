import { Icon } from '../shared/Icon'

import type { WorkspaceConfig } from '../../types/config'

export type AppModule = 'files' | 'memory' | 'prd' | 'settings'

interface SidebarProps {
  readonly activeModule: AppModule
  readonly onModuleChange: (module: AppModule) => void
  readonly workspaces: readonly WorkspaceConfig[]
  readonly activeWorkspaceId: string | null
  readonly onSwitchWorkspace: (workspace: WorkspaceConfig) => void
  readonly onAddWorkspace: () => void
}

const MODULES = [
  { id: 'files', label: 'Document', icon: 'folder-closed' },
  { id: 'memory', label: 'Memory', icon: 'module-brain' },
  { id: 'prd', label: 'PRD', icon: 'module-prd' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
] as const satisfies ReadonlyArray<{ id: AppModule; label: string; icon: string }>

export function Sidebar({
  activeModule,
  onModuleChange,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onAddWorkspace
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="aether-glass flex h-full w-56 flex-col rounded-[24px] px-3 py-4">
      <div>
        {workspaces.length > 0 ? (
          <div>
            <div className="aether-scrollbar max-h-40 space-y-1 overflow-y-auto pr-1">
              {workspaces.map((workspace) => {
                const active = workspace.id === activeWorkspaceId

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => {
                      onSwitchWorkspace(workspace)
                    }}
                    className={[
                      'flex h-8 w-full items-center justify-between rounded-md px-3 py-1 text-left text-sm transition-colors duration-150',
                      active
                        ? 'bg-hover/90 font-medium text-text-primary'
                        : 'text-text-secondary hover:bg-hover/70'
                    ].join(' ')}
                    title={workspace.name}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon name="folder-closed" size={16} className="shrink-0 text-text-secondary" />
                      <span className="truncate">{workspace.name}</span>
                    </span>
                    {active ? <span className="shrink-0 text-xs text-accent">✓</span> : null}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={onAddWorkspace}
              className="mt-3 px-3 py-1 text-xs text-text-muted transition-colors duration-150 hover:text-accent focus-visible:text-accent focus-visible:outline-none"
            >
              + 添加
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAddWorkspace}
            className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-secondary transition-colors duration-150 hover:border-accent hover:bg-hover hover:text-accent focus-visible:border-accent focus-visible:outline-none"
          >
            + 选择工作区
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
          Modules
        </div>
        <nav className="space-y-0.5">
          {MODULES.map((module) => {
            const active = activeModule === module.id

            return (
              <button
                key={module.id}
                type="button"
                onClick={() => {
                  onModuleChange(module.id)
                }}
                className={[
                  'flex h-9 w-full items-center gap-2 rounded-xl px-3 text-sm transition-colors duration-150',
                  active
                    ? 'bg-hover font-medium text-text-primary shadow-[inset_0_0_0_1px_rgba(10,10,10,0.05)]'
                    : 'text-text-secondary hover:bg-hover/70'
                ].join(' ')}
              >
                <span className="flex w-5 items-center justify-center text-base">
                  {module.icon === '⚙️' ? (
                    <span aria-hidden="true">⚙️</span>
                  ) : (
                    <Icon
                      name={module.icon}
                      size={16}
                      className={active ? 'text-text-primary' : 'text-text-secondary'}
                    />
                  )}
                </span>
                <span>{module.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
