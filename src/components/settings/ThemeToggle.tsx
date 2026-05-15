import { useTheme, type ThemeMode } from '../../hooks/useTheme'

interface ThemeOption {
  readonly id: ThemeMode
  readonly label: string
  readonly icon: React.ReactNode
}

const THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
  { id: 'system', label: '跟随系统', icon: <SystemIcon /> },
  { id: 'light', label: '浅色', icon: <SunIcon /> },
  { id: 'dark', label: '深色', icon: <MoonIcon /> }
]

export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const activeIndex = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.id === theme)
  )

  return (
    <div
      role="radiogroup"
      aria-label="界面主题"
      className="relative grid h-11 w-full max-w-sm grid-cols-3 items-center rounded-full border border-border bg-sidebar p-1"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-surface shadow-[0_1px_2px_rgba(10,10,10,0.06),0_0_0_0.5px_rgba(10,10,10,0.04)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: 'calc((100% - 8px) / 3)',
          transform: `translateX(${activeIndex * 100}%)`
        }}
      />

      {THEME_OPTIONS.map((option) => {
        const active = option.id === theme

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setTheme(option.id)
            }}
            className={[
              'relative z-10 inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none',
              active
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            ].join(' ')}
          >
            <span className="flex shrink-0 items-center" aria-hidden="true">
              {option.icon}
            </span>
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SunIcon(): React.JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v1.8" />
      <path d="M12 19.2V21" />
      <path d="M3 12h1.8" />
      <path d="M19.2 12H21" />
      <path d="M5.64 5.64l1.27 1.27" />
      <path d="M17.09 17.09l1.27 1.27" />
      <path d="M5.64 18.36l1.27-1.27" />
      <path d="M17.09 6.91l1.27-1.27" />
    </svg>
  )
}

function MoonIcon(): React.JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a7 7 0 0 0 10.8 10.8Z" />
    </svg>
  )
}

function SystemIcon(): React.JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path
        d="M12 3.5a8.5 8.5 0 0 1 0 17Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}
