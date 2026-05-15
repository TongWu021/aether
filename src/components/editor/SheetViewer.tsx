import '@univerjs/presets/lib/styles/preset-sheets-core.css'

import { CommandType, LocaleType, createUniver } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core'
import zhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import type { SheetDocument } from '../../types/sheet'
import { sheetDocumentToUniver, univerSnapshotToSheetDocument } from '../../utils/univer-adapter'
import { SheetTabBar } from './SheetTabBar'

export interface SheetViewerHandle {
  readonly getSnapshot: () => SheetDocument
  readonly zoomToFit: () => void
}

export interface SheetViewerProps {
  readonly document: SheetDocument
  readonly readOnly?: boolean
  readonly onDirty?: () => void
  readonly activeSheetId?: string
  readonly onActiveSheetChange?: (sheetId: string) => void
  readonly onRenameSheet?: (sheetId: string, newName: string) => void
  readonly onAddSheet?: () => void
  readonly onDeleteSheet?: (sheetId: string) => void
  readonly onDuplicateSheet?: (sheetId: string) => void
  readonly onReorderSheets?: (newOrder: readonly string[]) => void
}

type UniverBundle = ReturnType<typeof createUniver>

const TAB_SWITCH_DURATION_MS = 100
const UNIVER_CELL_FONT = "'Noto Sans SC Variable', 'Space Grotesk Variable', system-ui, sans-serif"

export const SheetViewer = forwardRef<SheetViewerHandle, SheetViewerProps>(function SheetViewer(
  {
    document,
    readOnly = false,
    onDirty,
    activeSheetId,
    onActiveSheetChange,
    onRenameSheet,
    onAddSheet,
    onDeleteSheet,
    onDuplicateSheet,
    onReorderSheets
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<UniverBundle['univer'] | null>(null)
  const univerApiRef = useRef<UniverBundle['univerAPI'] | null>(null)
  const initStateRef = useRef({
    document,
    readOnly,
    resolvedActiveSheetId: activeSheetId ?? document.activeSheetId
  })
  const dirtyRef = useRef(false)
  const onDirtyRef = useRef(onDirty)
  onDirtyRef.current = onDirty
  const [error, setError] = useState<string | null>(null)
  const documentKey = useMemo(() => createDocumentKey(document), [document])
  const [uncontrolledActiveSheet, setUncontrolledActiveSheet] = useState({
    documentKey,
    sheetId: document.activeSheetId
  })
  const resolvedActiveSheetId =
    activeSheetId ??
    (uncontrolledActiveSheet.documentKey === documentKey
      ? uncontrolledActiveSheet.sheetId
      : document.activeSheetId)
  initStateRef.current = { document, readOnly, resolvedActiveSheetId }

  useImperativeHandle(
    ref,
    () => ({
      getSnapshot: () => {
        const snapshot = univerApiRef.current?.getActiveWorkbook()?.save()
        return snapshot ? univerSnapshotToSheetDocument(snapshot, document.format) : document
      },
      zoomToFit: () => {
        zoomActiveSheetToFit(univerApiRef.current, containerRef.current)
      }
    }),
    [document]
  )

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    dirtyRef.current = false
    setError(null)
    const {
      document: initialDocument,
      readOnly: initialReadOnly,
      resolvedActiveSheetId: initialActiveSheetId
    } = initStateRef.current

    try {
      const bundle = createUniver({
        locale: LocaleType.ZH_CN,
        locales: { [LocaleType.ZH_CN]: zhCN },
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        presets: [
          UniverSheetsCorePreset({
            container,
            header: false,
            toolbar: false,
            formulaBar: false,
            footer: false,
            disableAutoFocus: true,
            customFontFamily: {
              override: true,
              list: [{ label: 'Aether Sans', value: UNIVER_CELL_FONT }]
            }
          })
        ]
      })

      const workbook = bundle.univerAPI.createUniverSheet(sheetDocumentToUniver(initialDocument))
      workbook.setEditable(!initialReadOnly)
      if (initialActiveSheetId) {
        workbook.setActiveSheet(initialActiveSheetId)
      }

      const commandDisposable = bundle.univerAPI.onCommandExecuted((commandInfo) => {
        if (dirtyRef.current || commandInfo.type !== CommandType.MUTATION) {
          return
        }

        dirtyRef.current = true
        onDirtyRef.current?.()
      })

      univerRef.current = bundle.univer
      univerApiRef.current = bundle.univerAPI

      return () => {
        commandDisposable.dispose()
        univerApiRef.current = null
        univerRef.current?.dispose()
        univerRef.current = null
        container.innerHTML = ''
      }
    } catch (initError) {
      setError(toErrorMessage(initError))
      container.innerHTML = ''
      return undefined
    }
  }, [documentKey])

  useEffect(() => {
    if (resolvedActiveSheetId) {
      univerApiRef.current?.getActiveWorkbook()?.setActiveSheet(resolvedActiveSheetId)
    }
  }, [resolvedActiveSheetId])

  useEffect(() => {
    univerApiRef.current?.getActiveWorkbook()?.setEditable(!readOnly)
  }, [readOnly])

  const handleActivate = (sheetId: string): void => {
    univerApiRef.current?.getActiveWorkbook()?.setActiveSheet(sheetId)
    if (activeSheetId === undefined) {
      setUncontrolledActiveSheet({ documentKey, sheetId })
    }
    onActiveSheetChange?.(sheetId)
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <style>{UNIVER_CHROME_CSS}</style>
      <div
        ref={containerRef}
        className={[
          'aether-univer-container relative min-h-0 flex-1 transition-opacity duration-100',
          readOnly ? 'aether-univer-container--readonly' : ''
        ].join(' ')}
        style={{ transitionDuration: `${TAB_SWITCH_DURATION_MS}ms` }}
      />
      {error ? (
        <div className="absolute left-4 right-4 top-4 rounded-md border border-error/30 bg-surface px-3 py-2 text-[12px] text-error">
          表格初始化失败：{error}
        </div>
      ) : null}
      <SheetTabBar
        sheets={document.sheets.map((sheet) => ({ id: sheet.id, name: sheet.name }))}
        activeSheetId={resolvedActiveSheetId}
        onActivate={handleActivate}
        onRename={(sheetId, newName) => onRenameSheet?.(sheetId, newName)}
        onAdd={() => onAddSheet?.()}
        onDelete={(sheetId) => onDeleteSheet?.(sheetId)}
        onDuplicate={(sheetId) => onDuplicateSheet?.(sheetId)}
        onReorder={(newOrder) => onReorderSheets?.(newOrder)}
      />
    </div>
  )
})

const UNIVER_CHROME_CSS = `
.aether-univer-container .univer-formula-bar,
.aether-univer-container [data-id="formula-bar"],
.aether-univer-container .formula-bar-container,
.aether-univer-container .univer-toolbar,
.aether-univer-container .univer-ribbon,
.aether-univer-container .univer-sheet-bar,
.aether-univer-container [data-u-comp="formula-bar"],
.aether-univer-container [data-u-comp="toolbar"],
.aether-univer-container [data-u-comp="sheet-bar"] {
  display: none !important;
}

.aether-univer-container .univer-sheet-header,
.aether-univer-container [data-u-comp="sheet-header"] {
  background: var(--color-canvas, #FAFAFA) !important;
  color: var(--color-text-muted, #767676) !important;
  font-size: 11px !important;
  font-weight: 400 !important;
  border-color: var(--color-border-subtle, #F0F0EE) !important;
}

.aether-univer-container .univer-cell-border,
.aether-univer-container [data-u-comp="cell-border"] {
  border-color: #ECECEA !important;
}

.aether-univer-container [data-univer-cell],
.aether-univer-container .univer-cell {
  font-family: 'Noto Sans SC Variable', 'Space Grotesk Variable', system-ui, sans-serif !important;
  font-size: 13px !important;
}

.aether-univer-container .univer-selection,
.aether-univer-container [data-u-comp="selection"] {
  border-color: var(--color-accent, #4A6B5C) !important;
  background: color-mix(in srgb, var(--color-accent-subtle, #EDF2EF) 50%, transparent) !important;
}

.aether-univer-container.aether-univer-container--readonly {
  pointer-events: none;
}

@media (prefers-color-scheme: dark) {
  .aether-univer-container .univer-cell-border,
  .aether-univer-container [data-u-comp="cell-border"] {
    border-color: #1F1F1F !important;
  }

  .aether-univer-container .univer-sheet-header,
  .aether-univer-container [data-u-comp="sheet-header"] {
    background: #0E0E0E !important;
  }
}
`

function createDocumentKey(document: SheetDocument): string {
  return JSON.stringify({
    format: document.format,
    sheets: document.sheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      colCount: sheet.colCount,
      cells: sheet.cells,
      mergedRanges: sheet.mergedRanges,
      columnWidths: sheet.columnWidths,
      rowHeights: sheet.rowHeights
    }))
  })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const ZOOM_FIT_MIN_RATIO = 0.4
const ZOOM_FIT_MAX_RATIO = 1
const ROW_HEADER_WIDTH_PX = 46
const ZOOM_FIT_PADDING_PX = 16
const FALLBACK_DEFAULT_COLUMN_WIDTH = 96

function zoomActiveSheetToFit(
  api: UniverBundle['univerAPI'] | null,
  container: HTMLDivElement | null
): void {
  if (!api || !container) return

  try {
    const workbook = api.getActiveWorkbook()
    if (!workbook) return

    const snapshot = workbook.save()
    const activeSheet = workbook.getActiveSheet()
    const activeSheetId =
      (typeof activeSheet?.getSheetId === 'function' ? activeSheet.getSheetId() : null) ??
      snapshot.sheetOrder[0]
    const sheetData = activeSheetId ? snapshot.sheets[activeSheetId] : undefined
    if (!sheetData) return

    const totalColumnWidth = computeTotalColumnWidth(sheetData)
    if (totalColumnWidth <= 0) return

    const available = container.clientWidth - ROW_HEADER_WIDTH_PX - ZOOM_FIT_PADDING_PX
    if (available <= 0) return

    const ratio = clamp(available / totalColumnWidth, ZOOM_FIT_MIN_RATIO, ZOOM_FIT_MAX_RATIO)

    activeSheet?.zoom(ratio)
  } catch (zoomError) {
    console.warn('[SheetViewer] zoomToFit failed', zoomError)
  }
}

function computeTotalColumnWidth(sheetData: Partial<IWorksheetDataLike>): number {
  const colCount = sheetData.columnCount ?? 0
  const defaultWidth = sheetData.defaultColumnWidth ?? FALLBACK_DEFAULT_COLUMN_WIDTH
  let total = 0
  for (let col = 0; col < colCount; col += 1) {
    const width = sheetData.columnData?.[col]?.w
    total += typeof width === 'number' && width > 0 ? width : defaultWidth
  }
  return total
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface IWorksheetDataLike {
  readonly columnCount?: number
  readonly defaultColumnWidth?: number
  readonly columnData?: Record<number, { readonly w?: number } | undefined>
}
