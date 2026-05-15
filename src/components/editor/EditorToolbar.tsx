interface EditorToolbarProps {
  readonly fileName: string
  readonly filePath: string
  readonly mode: 'preview' | 'edit'
  readonly hasUnsavedChanges: boolean
  readonly contentWidth?: 'standard' | 'medium' | 'full'
  readonly onModeChange: (mode: 'preview' | 'edit') => void
  readonly onContentWidthChange?: (width: 'standard' | 'medium' | 'full') => void
  readonly onBack: () => void
  readonly onSave: () => void
  readonly onCopyPath: (path: string) => void
  readonly onBuildFileContext?: () => void
}

export function EditorToolbar({
  fileName,
  filePath,
  mode,
  hasUnsavedChanges,
  contentWidth = 'standard',
  onBuildFileContext,
  onModeChange,
  onContentWidthChange = () => undefined,
  onBack,
  onSave,
  onCopyPath
}: EditorToolbarProps): React.JSX.Element {
  return (
    <div className="flex min-h-11 items-center gap-3 bg-surface/88 px-4 py-2">
      <div className="flex min-w-0 max-w-[min(44vw,30rem)] items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          title="返回文件树"
          aria-label="返回文件树"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-sm text-text-secondary transition-colors duration-150 hover:border-border hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
        >
          ←
        </button>

        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="truncate text-[13px] font-medium tracking-[-0.01em] text-text-primary"
            title={fileName}
          >
            {fileName}
          </span>
          {hasUnsavedChanges ? (
            <span className="shrink-0 text-[11px] leading-none text-accent" title="存在未保存更改">
              ●
            </span>
          ) : null}
        </div>
      </div>

      <div className="mr-auto flex shrink-0 items-center gap-1.5">
        <div className="relative inline-grid h-7 grid-cols-2 items-center rounded-full border border-border bg-sidebar p-0.5">
          <div
            aria-hidden="true"
            className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-surface shadow-[0_1px_2px_rgba(10,10,10,0.08)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: mode === 'edit' ? 'translateX(100%)' : 'translateX(0)'
            }}
          />

          <button
            type="button"
            onClick={() => {
              onModeChange('preview')
            }}
            className={[
              'relative z-10 inline-flex h-6 min-w-12 items-center justify-center rounded-full px-3 text-[12px] font-medium transition-colors duration-150',
              mode === 'preview' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            ].join(' ')}
          >
            预览
          </button>

          <button
            type="button"
            onClick={() => {
              onModeChange('edit')
            }}
            className={[
              'relative z-10 inline-flex h-6 min-w-12 items-center justify-center rounded-full px-3 text-[12px] font-medium transition-colors duration-150',
              mode === 'edit' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            ].join(' ')}
          >
            编辑
          </button>
        </div>

        {hasUnsavedChanges ? (
          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-7 items-center rounded-full bg-accent px-3 text-[12px] font-medium text-text-inverse transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
          >
            保存
          </button>
        ) : null}

        {mode === 'preview' ? (
          <WidthToggleButton width={contentWidth} onChange={onContentWidthChange} />
        ) : null}

        {mode === 'preview' && onBuildFileContext ? (
          <button
            type="button"
            onClick={onBuildFileContext}
            title="打包当前文件上下文"
            aria-label="打包当前文件上下文"
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
          >
            <PackIcon />
            <span className="text-[12px] font-medium">打包</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onCopyPath(filePath)
          }}
          title="复制路径"
          aria-label="复制路径"
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
        >
          <CopyIcon />
          <span className="text-[12px] font-medium">复制</span>
        </button>
      </div>
    </div>
  )
}

function WidthToggleButton({
  width,
  onChange
}: {
  readonly width: 'standard' | 'medium' | 'full'
  readonly onChange: (width: 'standard' | 'medium' | 'full') => void
}): React.JSX.Element {
  const next = width === 'standard' ? 'medium' : width === 'medium' ? 'full' : 'standard'
  const label = width === 'standard' ? '标准' : width === 'medium' ? '适中' : '全宽'

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`内容宽度: ${label}`}
      aria-label={`切换内容宽度，当前: ${label}`}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
    >
      <WidthIcon width={width} />
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  )
}

function WidthIcon({
  width
}: {
  readonly width: 'standard' | 'medium' | 'full'
}): React.JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <rect x="4" y="4" width="8" height="1.5" rx="0.75" opacity={width === 'standard' ? 1 : 0.3} />
      <rect x="2.5" y="7.25" width="11" height="1.5" rx="0.75" opacity={width === 'medium' ? 1 : 0.3} />
      <rect x="1" y="10.5" width="14" height="1.5" rx="0.75" opacity={width === 'full' ? 1 : 0.3} />
    </svg>
  )
}

function PackIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
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

function CopyIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    </svg>
  )
}
