interface ModeButtonProps {
  readonly active: boolean
  readonly label: string
  readonly compact?: boolean
  readonly onClick: () => void
}

export function ModeButton({
  active,
  label,
  compact = false,
  onClick
}: ModeButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        compact
          ? 'h-7 rounded-full px-3 text-[13px] font-medium transition-all duration-150'
          : 'rounded-md px-3 py-1 text-sm transition-all duration-150',
        active
          ? 'border border-border-subtle bg-surface text-text-primary shadow-[0_1px_2px_rgba(10,10,10,0.06)]'
          : 'text-text-muted hover:text-text-secondary'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
