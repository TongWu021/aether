import {
  BooleanNumber,
  BorderStyleTypes,
  HorizontalAlign,
  LocaleType,
  VerticalAlign
} from '@univerjs/presets'

import type { ICellData, IStyleData, IWorkbookData, IWorksheetData } from '@univerjs/presets'
import type {
  MergedRange,
  SheetCell,
  SheetCellStyle,
  SheetDocument,
  SheetTab
} from '../types/sheet'

type UniverCellMatrix = NonNullable<IWorksheetData['cellData']>
type UniverRowData = NonNullable<IWorksheetData['rowData']>
type UniverColumnData = NonNullable<IWorksheetData['columnData']>
type UniverBorderSide = {
  readonly s: BorderStyleTypes
  readonly cl: { readonly rgb: string }
}

const WORKBOOK_ID = 'aether-workbook'
const WORKBOOK_NAME = 'Aether Workbook'
const APP_VERSION = '0.21.1'
const DEFAULT_ROW_HEIGHT = 28
const DEFAULT_COLUMN_WIDTH = 96
const AUTO_FIT_MIN_WIDTH = 72
const AUTO_FIT_MAX_WIDTH = 320
const AUTO_FIT_CHAR_WIDTH = 8
const AUTO_FIT_CJK_CHAR_WIDTH = 14
const AUTO_FIT_PADDING = 24
const AUTO_FIT_MIN_ROW_HEIGHT = 28
const AUTO_FIT_MAX_ROW_HEIGHT = 64

export function sheetDocumentToUniver(doc: SheetDocument): IWorkbookData {
  return {
    id: WORKBOOK_ID,
    name: WORKBOOK_NAME,
    appVersion: APP_VERSION,
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder: doc.sheets.map((sheet) => sheet.id),
    sheets: Object.fromEntries(doc.sheets.map((sheet) => [sheet.id, mapSheetToUniver(sheet)]))
  }
}

export function univerSnapshotToSheetDocument(
  snapshot: IWorkbookData,
  format: 'xlsx' | 'csv'
): SheetDocument {
  const sheets = snapshot.sheetOrder
    .map((sheetId) => snapshot.sheets[sheetId])
    .filter((sheet): sheet is Partial<IWorksheetData> => sheet !== undefined)
    .map((sheet) => mapSheetFromUniver(sheet, snapshot.styles))

  return {
    format,
    sheets,
    activeSheetId: sheets[0]?.id ?? ''
  }
}

function mapSheetToUniver(sheet: SheetTab): Partial<IWorksheetData> {
  const fittedWidths = autoFitColumnWidths(sheet)
  const fittedHeights = clampRowHeights(sheet.rowHeights, sheet.rowCount)

  return {
    id: sheet.id,
    name: sheet.name,
    rowCount: sheet.rowCount,
    columnCount: sheet.colCount,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    cellData: mapCellsToUniver(sheet.cells),
    mergeData: sheet.mergedRanges.map(mapMergeToUniver),
    columnData: mapColumnWidthsToUniver(fittedWidths),
    rowData: mapRowHeightsToUniver(fittedHeights),
    rowHeader: { width: 46 },
    columnHeader: { height: 24 },
    showGridlines: BooleanNumber.TRUE,
    gridlinesColor: '#ECECEA'
  }
}

function autoFitColumnWidths(sheet: SheetTab): readonly number[] {
  const mergeMap = collectMergeRangesByRow(sheet.mergedRanges)
  const widths: number[] = []

  for (let col = 0; col < sheet.colCount; col += 1) {
    let maxChars = 0

    for (let row = 0; row < sheet.rowCount; row += 1) {
      if (isInsideMergeButNotLead(row, col, mergeMap)) continue
      const cell = sheet.cells[row]?.[col]
      if (!cell || cell.value == null) continue
      const text = String(cell.value)
      const chars = countWeightedChars(text)
      if (chars > maxChars) maxChars = chars
    }

    const computed =
      maxChars > 0
        ? Math.min(AUTO_FIT_MAX_WIDTH, Math.max(AUTO_FIT_MIN_WIDTH, maxChars + AUTO_FIT_PADDING))
        : DEFAULT_COLUMN_WIDTH
    const saved = sheet.columnWidths?.[col]
    widths.push(saved && saved > computed ? Math.min(saved, AUTO_FIT_MAX_WIDTH) : computed)
  }

  return widths
}

function clampRowHeights(
  heights: readonly number[] | undefined,
  rowCount: number
): readonly number[] {
  const result: number[] = []
  for (let row = 0; row < rowCount; row += 1) {
    const saved = heights?.[row]
    if (typeof saved === 'number' && Number.isFinite(saved)) {
      result.push(Math.min(AUTO_FIT_MAX_ROW_HEIGHT, Math.max(AUTO_FIT_MIN_ROW_HEIGHT, saved)))
    } else {
      result.push(DEFAULT_ROW_HEIGHT)
    }
  }
  return result
}

function countWeightedChars(text: string): number {
  let total = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    total += code > 127 ? AUTO_FIT_CJK_CHAR_WIDTH : AUTO_FIT_CHAR_WIDTH
  }
  return total
}

function collectMergeRangesByRow(
  ranges: readonly MergedRange[]
): ReadonlyMap<number, ReadonlyArray<{ readonly startCol: number; readonly endCol: number }>> {
  const map = new Map<number, Array<{ startCol: number; endCol: number }>>()
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      const list = map.get(row) ?? []
      list.push({ startCol: range.startCol, endCol: range.endCol })
      map.set(row, list)
    }
  }
  return map
}

/** 判断 (row, col) 是否落在某个合并范围内但不是首列（首列保留参与列宽计算） */
function isInsideMergeButNotLead(
  row: number,
  col: number,
  mergeMap: ReadonlyMap<number, ReadonlyArray<{ readonly startCol: number; readonly endCol: number }>>
): boolean {
  const list = mergeMap.get(row)
  if (!list) return false
  return list.some((range) => col > range.startCol && col <= range.endCol)
}

function mapSheetFromUniver(
  sheet: Partial<IWorksheetData>,
  styles: IWorkbookData['styles']
): SheetTab {
  const rowCount = getSheetRowCount(sheet)
  const colCount = getSheetColumnCount(sheet)

  return {
    id: sheet.id ?? crypto.randomUUID(),
    name: sheet.name ?? 'Sheet',
    rowCount,
    colCount,
    cells: mapCellsFromUniver(sheet.cellData, rowCount, colCount, styles),
    mergedRanges: (sheet.mergeData ?? []).map(mapMergeFromUniver),
    columnWidths: mapColumnWidthsFromUniver(sheet.columnData, colCount),
    rowHeights: mapRowHeightsFromUniver(sheet.rowData, rowCount)
  }
}

function mapCellsToUniver(cells: SheetTab['cells']): UniverCellMatrix {
  return cells.reduce<UniverCellMatrix>((matrix, row, rowIndex) => {
    const rowData = mapRowToUniver(row)

    if (Object.keys(rowData).length > 0) {
      matrix[rowIndex] = rowData
    }

    return matrix
  }, {})
}

function mapRowToUniver(row: ReadonlyArray<SheetCell | null>): Record<number, ICellData> {
  return row.reduce<Record<number, ICellData>>((result, cell, colIndex) => {
    if (!cell) {
      return result
    }

    result[colIndex] = mapCellToUniver(cell)
    return result
  }, {})
}

function mapCellToUniver(cell: SheetCell): ICellData {
  const style = cell.style ? mapStyleToUniver(cell.style) : undefined
  return style ? { v: cell.value, s: style } : { v: cell.value }
}

function mapCellsFromUniver(
  cellData: UniverCellMatrix | undefined,
  rowCount: number,
  colCount: number,
  styles: IWorkbookData['styles']
): ReadonlyArray<ReadonlyArray<SheetCell | null>> {
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: colCount }, (_, colIndex) =>
      mapCellFromUniver(cellData?.[rowIndex]?.[colIndex], styles)
    )
  )
}

function mapCellFromUniver(
  cell: ICellData | undefined,
  styles: IWorkbookData['styles']
): SheetCell | null {
  if (!cell) {
    return null
  }

  const style = mapStyleFromUniver(resolveStyle(cell.s, styles))
  const value = cell.v ?? null

  if (value === null && !style) {
    return null
  }

  return style ? { value, style } : { value }
}

function mapStyleToUniver(style: SheetCellStyle): IStyleData {
  return removeUndefined({
    ff: style.fontFamily,
    fs: style.fontSize,
    bl: booleanToNumber(style.bold),
    it: booleanToNumber(style.italic),
    ul: style.underline ? { s: BooleanNumber.TRUE } : undefined,
    cl: colorToUniver(style.color),
    bg: colorToUniver(style.background),
    bd: mapBorderToUniver(style.border),
    ht: horizontalAlignToUniver(style.horizontalAlign),
    vt: verticalAlignToUniver(style.verticalAlign)
  })
}

function mapStyleFromUniver(style: IStyleData | undefined): SheetCellStyle | undefined {
  if (!style) {
    return undefined
  }

  const sheetStyle: SheetCellStyle = removeUndefined({
    fontFamily: style.ff ?? undefined,
    fontSize: style.fs,
    bold: numberToBoolean(style.bl),
    italic: numberToBoolean(style.it),
    underline: style.ul?.s === BooleanNumber.TRUE,
    color: colorFromUniver(style.cl),
    background: colorFromUniver(style.bg),
    border: mapBorderFromUniver(style.bd ?? undefined),
    horizontalAlign: horizontalAlignFromUniver(style.ht ?? undefined),
    verticalAlign: verticalAlignFromUniver(style.vt ?? undefined)
  })

  return Object.keys(sheetStyle).length > 0 ? sheetStyle : undefined
}

function mapBorderToUniver(style: SheetCellStyle['border']): IStyleData['bd'] {
  if (!style) {
    return undefined
  }

  const border = removeUndefined({
    t: borderSideToUniver(style.top),
    r: borderSideToUniver(style.right),
    b: borderSideToUniver(style.bottom),
    l: borderSideToUniver(style.left)
  })

  return Object.keys(border).length > 0 ? border : undefined
}

function mapBorderFromUniver(border: IStyleData['bd']): SheetCellStyle['border'] {
  if (!border) {
    return undefined
  }

  const result = removeUndefined({
    top: colorFromUniver(border.t?.cl),
    right: colorFromUniver(border.r?.cl),
    bottom: colorFromUniver(border.b?.cl),
    left: colorFromUniver(border.l?.cl)
  })

  return Object.keys(result).length > 0 ? result : undefined
}

function borderSideToUniver(color: string | undefined): UniverBorderSide | undefined {
  const univerColor = colorToUniver(color)
  return univerColor ? { s: BorderStyleTypes.THIN, cl: univerColor } : undefined
}

function mapMergeToUniver(range: MergedRange): {
  readonly startRow: number
  readonly endRow: number
  readonly startColumn: number
  readonly endColumn: number
} {
  return {
    startRow: range.startRow,
    endRow: range.endRow,
    startColumn: range.startCol,
    endColumn: range.endCol
  }
}

function mapMergeFromUniver(range: {
  readonly startRow: number
  readonly endRow: number
  readonly startColumn: number
  readonly endColumn: number
}): MergedRange {
  return {
    startRow: range.startRow,
    endRow: range.endRow,
    startCol: range.startColumn,
    endCol: range.endColumn
  }
}

function mapColumnWidthsToUniver(widths: readonly number[] | undefined): UniverColumnData {
  return mapDimensionsToUniver(widths, 'w')
}

function mapRowHeightsToUniver(heights: readonly number[] | undefined): UniverRowData {
  return mapDimensionsToUniver(heights, 'h')
}

function mapColumnWidthsFromUniver(
  columnData: UniverColumnData | undefined,
  colCount: number
): readonly number[] | undefined {
  return mapDimensionsFromUniver(columnData, colCount, 'w')
}

function mapRowHeightsFromUniver(
  rowData: UniverRowData | undefined,
  rowCount: number
): readonly number[] | undefined {
  return mapDimensionsFromUniver(rowData, rowCount, 'h')
}

function mapDimensionsToUniver(
  values: readonly number[] | undefined,
  key: 'w' | 'h'
): Record<number, { readonly w?: number; readonly h?: number }> {
  if (!values) {
    return {}
  }

  return values.reduce<Record<number, { readonly w?: number; readonly h?: number }>>(
    (result, value, index) => {
      if (value > 0) {
        result[index] = { [key]: value }
      }

      return result
    },
    {}
  )
}

function mapDimensionsFromUniver(
  data: Record<number, { readonly w?: number; readonly h?: number }> | undefined,
  count: number,
  key: 'w' | 'h'
): readonly number[] | undefined {
  const values = Array.from({ length: count }, (_, index) => data?.[index]?.[key] ?? 0)
  return values.some((value) => value > 0) ? values : undefined
}

function resolveStyle(
  style: ICellData['s'],
  styles: IWorkbookData['styles']
): IStyleData | undefined {
  if (!style) {
    return undefined
  }

  return typeof style === 'string' ? (styles[style] ?? undefined) : style
}

function colorToUniver(color: string | undefined): { readonly rgb: string } | undefined {
  return color ? { rgb: color } : undefined
}

function colorFromUniver(color: IStyleData['cl'] | undefined): string | undefined {
  return color?.rgb ?? undefined
}

function booleanToNumber(value: boolean | undefined): BooleanNumber | undefined {
  return value === undefined ? undefined : value ? BooleanNumber.TRUE : BooleanNumber.FALSE
}

function numberToBoolean(value: BooleanNumber | undefined | null): boolean | undefined {
  return value === undefined || value === null ? undefined : value === BooleanNumber.TRUE
}

function horizontalAlignToUniver(
  align: SheetCellStyle['horizontalAlign']
): HorizontalAlign | undefined {
  if (align === 'left') return HorizontalAlign.LEFT
  if (align === 'center') return HorizontalAlign.CENTER
  if (align === 'right') return HorizontalAlign.RIGHT
  return undefined
}

function horizontalAlignFromUniver(
  align: HorizontalAlign | undefined
): SheetCellStyle['horizontalAlign'] {
  if (align === HorizontalAlign.LEFT) return 'left'
  if (align === HorizontalAlign.CENTER) return 'center'
  if (align === HorizontalAlign.RIGHT) return 'right'
  return undefined
}

function verticalAlignToUniver(align: SheetCellStyle['verticalAlign']): VerticalAlign | undefined {
  if (align === 'top') return VerticalAlign.TOP
  if (align === 'middle') return VerticalAlign.MIDDLE
  if (align === 'bottom') return VerticalAlign.BOTTOM
  return undefined
}

function verticalAlignFromUniver(
  align: VerticalAlign | undefined
): SheetCellStyle['verticalAlign'] {
  if (align === VerticalAlign.TOP) return 'top'
  if (align === VerticalAlign.MIDDLE) return 'middle'
  if (align === VerticalAlign.BOTTOM) return 'bottom'
  return undefined
}

function getSheetRowCount(sheet: Partial<IWorksheetData>): number {
  return Math.max(sheet.rowCount ?? 0, getMaxIndex(sheet.cellData) + 1)
}

function getSheetColumnCount(sheet: Partial<IWorksheetData>): number {
  const maxCellColumn = Object.values(sheet.cellData ?? {}).reduce(
    (max, row) => Math.max(max, getMaxIndex(row)),
    -1
  )

  return Math.max(sheet.columnCount ?? 0, maxCellColumn + 1)
}

function getMaxIndex(value: Record<number, unknown> | undefined): number {
  return Math.max(-1, ...Object.keys(value ?? {}).map(Number))
}

function removeUndefined<T extends object>(value: T): T {
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== undefined
  )
  return Object.fromEntries(entries) as T
}
