interface MemoryTagFilterProps {
  readonly tags: readonly string[]
  readonly selectedTags: readonly string[]
  readonly onToggleTag: (tag: string) => void
  readonly onClearAll: () => void
}

export function MemoryTagFilter({
  tags,
  selectedTags,
  onToggleTag,
  onClearAll
}: MemoryTagFilterProps): React.JSX.Element | null {
  if (tags.length === 0) {
    return null
  }

  const isAllSelected = selectedTags.length === 0

  return (
    <div className="flex flex-wrap gap-2">
      <TagButton active={isAllSelected} label="全部" onClick={onClearAll} />

      {tags.map((tag) => (
        <TagButton
          key={tag}
          active={selectedTags.includes(tag)}
          label={tag}
          onClick={() => {
            onToggleTag(tag)
          }}
        />
      ))}
    </div>
  )
}

interface TagButtonProps {
  readonly active: boolean
  readonly label: string
  readonly onClick: () => void
}

function TagButton({ active, label, onClick }: TagButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-full border px-3 py-1 text-xs transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none',
        active
          ? 'border-accent bg-accent text-text-inverse'
          : 'border-border bg-canvas text-text-secondary hover:bg-hover'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
