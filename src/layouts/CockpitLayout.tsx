interface CockpitLayoutProps {
  readonly topBar: React.ReactNode
  readonly sidebar: React.ReactNode
  readonly main: React.ReactNode
  readonly detail: React.ReactNode | null
  readonly statusBar: React.ReactNode
}

export function CockpitLayout({
  topBar,
  sidebar,
  main,
  detail,
  statusBar
}: CockpitLayoutProps): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="relative z-30 shrink-0 bg-canvas/96 backdrop-blur-sm" style={{ height: 52 }}>
        {topBar}
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <div className="shrink-0">{sidebar}</div>
        <main className="min-w-0 flex-1" style={{ minWidth: 480 }}>
          {main}
        </main>
        {detail}
      </div>

      <footer className="shrink-0 bg-canvas/88" style={{ height: 28 }}>
        {statusBar}
      </footer>
    </div>
  )
}
