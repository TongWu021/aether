import type { Annotation } from '../../types'

interface AnnotationListProps {
  readonly annotations: readonly Annotation[]
  readonly onScrollTo: (annotation: Annotation) => void
  readonly onDelete: (id: string) => void
  readonly onCopySingle: (annotation: Annotation) => void
  readonly onExportAll: () => void
}

export function AnnotationList({
  annotations,
  onScrollTo,
  onDelete,
  onCopySingle,
  onExportAll
}: AnnotationListProps): React.JSX.Element {
  if (annotations.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-sm text-text-muted">
        暂无批注，选中文字即可添加
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-text-muted">{annotations.length} 条批注</span>
        <button
          type="button"
          onClick={onExportAll}
          className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary"
        >
          导出全部
        </button>
      </div>
      <div className="space-y-2">
      {annotations.map((annotation) => (
        <div
          key={annotation.id}
          className="group cursor-pointer rounded-xl border border-border bg-canvas/50 p-3 transition-colors duration-150 hover:border-accent/30 hover:bg-accent-subtle/50"
          onClick={() => {
            onScrollTo(annotation)
          }}
        >
          <div className="mb-1.5 line-clamp-2 text-xs text-text-secondary">
            "{annotation.selectedText}"
          </div>
          <div className="text-sm text-text-primary">{annotation.comment}</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-text-muted">
              第 {annotation.lineStart}
              {annotation.lineStart !== annotation.lineEnd ? `-${annotation.lineEnd}` : ''} 行
            </span>
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onCopySingle(annotation)
                }}
                className="rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-hover hover:text-text-primary"
              >
                复制
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(annotation.id)
                }}
                className="rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-hover hover:text-error"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}
