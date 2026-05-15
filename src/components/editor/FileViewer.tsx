import { useState } from 'react'

import type { Annotation, FileNode, SheetDocument } from '../../types'
import { AnnotationPopover } from './AnnotationPopover'
import { EditorToolbar } from './EditorToolbar'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownViewer } from './MarkdownViewer'
import { OutlineBar } from './OutlineBar'
import { SearchBar } from './SearchBar'
import { SheetViewer, type SheetViewerHandle } from './SheetViewer'
import { TabBar } from './TabBar'
import { WordCountBar } from './WordCountBar'

interface FileViewerProps {
  readonly file: FileNode
  readonly openTabs: readonly FileNode[]
  readonly editorMode: 'preview' | 'edit'
  readonly editContent: string
  readonly annotations: readonly Annotation[]
  readonly activeAnnotationId: string | null
  readonly hasUnsavedChanges: boolean
  readonly markdownLoading: boolean
  readonly markdownError: string | null
  readonly searchVisible: boolean
  readonly sheetFile: FileNode | null
  readonly sheetDocument: SheetDocument | null
  readonly sheetLoading: boolean
  readonly sheetError: string | null
  readonly sheetViewerRef?: React.Ref<SheetViewerHandle>
  readonly viewerContainerRef: React.RefObject<HTMLDivElement | null>
  readonly onEditorModeChange: (mode: 'preview' | 'edit') => void
  readonly onEditContentChange: (value: string) => void
  readonly onSwitchTab: (file: FileNode) => void
  readonly onCloseTab: (file: FileNode) => void
  readonly onAddAnnotation: (data: {
    selectedText: string
    comment: string
    lineStart: number
    lineEnd: number
    anchor?: Annotation['anchor']
  }) => Promise<void>
  readonly onSave: () => void
  readonly onCloseSearch: () => void
  readonly onBack: () => void
  readonly onCopyPath: (path: string) => void
  readonly onBuildFileContext?: () => void
  readonly onSheetDirty?: () => void
  readonly onSheetFitWidth?: () => void
}

export function FileViewer({
  file,
  openTabs,
  editorMode,
  editContent,
  annotations,
  activeAnnotationId,
  hasUnsavedChanges,
  markdownLoading,
  markdownError,
  searchVisible,
  sheetFile,
  sheetDocument,
  sheetLoading,
  sheetError,
  sheetViewerRef,
  viewerContainerRef,
  onEditorModeChange,
  onEditContentChange,
  onSwitchTab,
  onCloseTab,
  onAddAnnotation,
  onSave,
  onCloseSearch,
  onBack,
  onCopyPath,
  onBuildFileContext,
  onSheetDirty,
  onSheetFitWidth
}: FileViewerProps): React.JSX.Element {
  const [contentWidth, setContentWidth] = useState<'standard' | 'medium' | 'full'>('standard')
  const isSheet = sheetFile !== null
  const previewVisible = !isSheet && editorMode === 'preview' && !markdownLoading && !markdownError

  return (
    <div className="aether-glass flex h-full flex-col overflow-hidden rounded-[24px]">
      {openTabs.length > 1 ? (
        <TabBar
          tabs={openTabs}
          activeTabPath={file.path}
          hasUnsavedChanges={hasUnsavedChanges}
          onSwitch={onSwitchTab}
          onClose={onCloseTab}
        />
      ) : null}

      {isSheet ? (
        <SheetFileHeader
          file={file}
          hasUnsavedChanges={hasUnsavedChanges}
          onBack={onBack}
          onCopyPath={onCopyPath}
          onSave={onSave}
          onFitWidth={onSheetFitWidth}
        />
      ) : (
        <EditorToolbar
          fileName={file.name}
          filePath={file.path}
          mode={editorMode}
          hasUnsavedChanges={hasUnsavedChanges}
          contentWidth={contentWidth}
          onModeChange={onEditorModeChange}
          onContentWidthChange={setContentWidth}
          onBack={onBack}
          onSave={onSave}
          onCopyPath={onCopyPath}
          onBuildFileContext={onBuildFileContext}
        />
      )}

      {isSheet ? null : (
        <SearchBar
          visible={searchVisible && editorMode === 'preview'}
          onClose={onCloseSearch}
          containerRef={viewerContainerRef}
        />
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={viewerContainerRef}
          className={isSheet ? 'h-full overflow-hidden' : 'aether-scrollbar h-full overflow-y-auto'}
        >
          {isSheet ? (
            renderSheetContent({
              document: sheetDocument,
              loading: sheetLoading,
              error: sheetError,
              sheetViewerRef,
              onDirty: onSheetDirty
            })
          ) : markdownLoading ? (
            <div className="grid h-full place-items-center text-sm text-text-muted">
              读取文件中...
            </div>
          ) : markdownError ? (
            <div className="grid h-full place-items-center px-6 text-sm text-error">
              {markdownError}
            </div>
          ) : editorMode === 'edit' ? (
            <MarkdownEditor
              content={editContent}
              onChange={onEditContentChange}
              className="h-full"
            />
          ) : (
            <MarkdownViewer
              content={editContent}
              filePath={file.path}
              contentWidth={contentWidth}
              annotations={annotations}
              activeAnnotationId={activeAnnotationId}
            />
          )}
        </div>
        {previewVisible ? (
          <OutlineBar containerRef={viewerContainerRef} content={editContent} />
        ) : null}
      </div>

      {previewVisible ? (
        <AnnotationPopover
          containerRef={viewerContainerRef}
          content={editContent}
          onAdd={onAddAnnotation}
        />
      ) : null}

      {previewVisible ? <WordCountBar content={editContent} /> : null}
    </div>
  )
}

function SheetFileHeader({
  file,
  hasUnsavedChanges,
  onBack,
  onCopyPath,
  onSave,
  onFitWidth
}: {
  readonly file: FileNode
  readonly hasUnsavedChanges: boolean
  readonly onBack: () => void
  readonly onCopyPath: (path: string) => void
  readonly onSave: () => void
  readonly onFitWidth?: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface/88 px-4">
      <div className="flex min-w-0 items-center gap-2.5">
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
            title={file.name}
          >
            {file.name}
          </span>
          {hasUnsavedChanges ? (
            <span
              aria-label="未保存"
              title="存在未保存更改"
              className="ml-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onFitWidth ? (
          <button
            type="button"
            onClick={onFitWidth}
            title="适配宽度"
            aria-label="适配宽度"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
          >
            <SheetFitWidthIcon />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onCopyPath(file.path)}
          title="复制路径"
          aria-label="复制路径"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
        >
          <SheetCopyIcon />
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!hasUnsavedChanges}
          title="保存 (⌘S)"
          aria-label="保存"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
        >
          <SheetSaveIcon />
        </button>
      </div>
    </div>
  )
}

function renderSheetContent({
  document,
  loading,
  error,
  sheetViewerRef,
  onDirty
}: {
  readonly document: SheetDocument | null
  readonly loading: boolean
  readonly error: string | null
  readonly sheetViewerRef?: React.Ref<SheetViewerHandle>
  readonly onDirty?: () => void
}): React.JSX.Element | null {
  if (loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-text-muted">读取表格中...</div>
    )
  }

  if (error) {
    return <div className="grid h-full place-items-center px-6 text-sm text-error">{error}</div>
  }

  return document ? (
    <SheetViewer ref={sheetViewerRef} document={document} onDirty={onDirty} />
  ) : null
}

function SheetCopyIcon(): React.JSX.Element {
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

function SheetFitWidthIcon(): React.JSX.Element {
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
      <path d="M4 6v12" />
      <path d="M20 6v12" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <polyline points="10 9 7 12 10 15" />
      <polyline points="14 9 17 12 14 15" />
    </svg>
  )
}

function SheetSaveIcon(): React.JSX.Element {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}
