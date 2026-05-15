// 纯业务逻辑，禁止 import electron。所有路径通过参数注入。
import { readFile, writeFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

import { Workbook } from 'exceljs'
import { parse, unparse } from 'papaparse'

import type {
  Alignment,
  Border,
  Borders,
  Cell,
  CellErrorValue,
  CellFormulaValue,
  CellHyperlinkValue,
  CellRichTextValue,
  CellSharedFormulaValue,
  CellValue,
  Color,
  Fill,
  Font,
  Worksheet
} from 'exceljs'
import type {
  MergedRange,
  SheetCell,
  SheetCellStyle,
  SheetDocument,
  SheetTab
} from '../../src/types/sheet'

type SheetFormat = SheetDocument['format']
type ValidationResult = { ok: true } | { ok: false; reason: string }

const TEMP_FILE_SUFFIX = '.tmp'
const DEFAULT_BORDER_STYLE = 'thin'

export async function readSheetFile(absolutePath: string): Promise<SheetDocument> {
  try {
    const format = detectSheetFormat(absolutePath)
    return format === 'csv' ? await readCsvFile(absolutePath) : await readXlsxFile(absolutePath)
  } catch (error) {
    throw new Error(`Unable to read sheet file "${absolutePath}": ${getErrorMessage(error)}`)
  }
}

export async function writeSheetFile(tmpPath: string, doc: SheetDocument): Promise<void> {
  try {
    assertTemporaryPath(tmpPath)

    if (doc.format === 'csv') {
      await writeCsvFile(tmpPath, doc)
      return
    }

    await writeXlsxFile(tmpPath, doc)
  } catch (error) {
    throw new Error(`Unable to write sheet file "${tmpPath}": ${getErrorMessage(error)}`)
  }
}

export async function validateSheetFile(
  absolutePath: string,
  expected: SheetDocument
): Promise<ValidationResult> {
  try {
    const actual = await readSheetFile(absolutePath)

    if (actual.sheets.length !== expected.sheets.length) {
      return createValidationFailure(
        `Sheet count mismatch: expected ${expected.sheets.length}, got ${actual.sheets.length}`
      )
    }

    return validateSheetCellCounts(actual, expected)
  } catch (error) {
    return createValidationFailure(getErrorMessage(error))
  }
}

async function readCsvFile(absolutePath: string): Promise<SheetDocument> {
  const content = await readFile(absolutePath, 'utf-8')
  const result = parse<readonly string[]>(content, { skipEmptyLines: false })

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join('; '))
  }

  const rows = normalizeCsvRows(result.data)
  const colCount = getMaxRowLength(rows)
  const sheet: SheetTab = {
    id: 'csv',
    name: getFileStem(absolutePath),
    rowCount: rows.length,
    colCount,
    cells: rows.map((row) => createCsvCellRow(row, colCount)),
    mergedRanges: []
  }

  return { format: 'csv', sheets: [sheet], activeSheetId: sheet.id }
}

async function readXlsxFile(absolutePath: string): Promise<SheetDocument> {
  const workbook = new Workbook()
  await workbook.xlsx.readFile(absolutePath)

  const sheets = workbook.worksheets.map(readWorksheet)
  return {
    format: 'xlsx',
    sheets,
    activeSheetId: sheets[0]?.id ?? ''
  }
}

async function writeCsvFile(tmpPath: string, doc: SheetDocument): Promise<void> {
  const sheet = doc.sheets[0]
  const rows = sheet ? sheetToCsvRows(sheet).map((row) => [...row]) : []
  await writeFile(tmpPath, unparse(rows), 'utf-8')
}

async function writeXlsxFile(tmpPath: string, doc: SheetDocument): Promise<void> {
  const workbook = new Workbook()

  for (const sheet of doc.sheets) {
    writeWorksheet(workbook.addWorksheet(sheet.name), sheet)
  }

  await workbook.xlsx.writeFile(tmpPath)
}

function readWorksheet(worksheet: Worksheet): SheetTab {
  const rowCount = worksheet.rowCount
  const colCount = getWorksheetColumnCount(worksheet)

  return {
    id: String(worksheet.id),
    name: worksheet.name,
    rowCount,
    colCount,
    cells: readWorksheetCells(worksheet, rowCount, colCount),
    mergedRanges: readMergedRanges(worksheet),
    columnWidths: readColumnWidths(worksheet, colCount),
    rowHeights: readRowHeights(worksheet, rowCount)
  }
}

function writeWorksheet(worksheet: Worksheet, sheet: SheetTab): void {
  writeSheetCells(worksheet, sheet)
  writeMergedRanges(worksheet, sheet.mergedRanges)
  writeColumnWidths(worksheet, sheet.columnWidths)
  writeRowHeights(worksheet, sheet.rowHeights)
}

function readWorksheetCells(
  worksheet: Worksheet,
  rowCount: number,
  colCount: number
): ReadonlyArray<ReadonlyArray<SheetCell | null>> {
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    readWorksheetRow(worksheet, rowIndex + 1, colCount)
  )
}

function readWorksheetRow(
  worksheet: Worksheet,
  rowNumber: number,
  colCount: number
): ReadonlyArray<SheetCell | null> {
  const row = worksheet.getRow(rowNumber)
  return Array.from({ length: colCount }, (_, colIndex) =>
    mapCellToSheetCell(row.getCell(colIndex + 1))
  )
}

function writeSheetCells(worksheet: Worksheet, sheet: SheetTab): void {
  for (let rowIndex = 0; rowIndex < sheet.rowCount; rowIndex += 1) {
    const row = sheet.cells[rowIndex] ?? []

    for (let colIndex = 0; colIndex < sheet.colCount; colIndex += 1) {
      const sheetCell = row[colIndex] ?? null
      if (sheetCell) {
        mapSheetCellToCell(worksheet.getCell(rowIndex + 1, colIndex + 1), sheetCell)
      }
    }
  }
}

function mapCellToSheetCell(cell: Cell): SheetCell | null {
  const value = normalizeCellValue(cell.value)
  const style = mapExcelStyleToSheetStyle(cell)

  if (value === null && !style) {
    return null
  }

  return style ? { value, style } : { value }
}

function mapSheetCellToCell(cell: Cell, sheetCell: SheetCell): void {
  cell.value = mapSheetValueToCellValue(sheetCell.value)

  if (sheetCell.style) {
    applySheetStyleToCell(cell, sheetCell.style)
  }
}

function mapExcelStyleToSheetStyle(cell: Cell): SheetCellStyle | undefined {
  const style: SheetCellStyle = {
    ...mapFontStyle(cell.font),
    background: mapFillBackground(cell.fill),
    border: mapBorderStyle(cell.border),
    ...mapAlignmentStyle(cell.alignment)
  }

  return pruneSheetStyle(style)
}

function applySheetStyleToCell(cell: Cell, style: SheetCellStyle): void {
  const fill = mapSheetFill(style)

  cell.font = mapSheetFont(style)
  cell.border = mapSheetBorder(style)
  cell.alignment = mapSheetAlignment(style)

  if (fill) {
    cell.fill = fill
  }
}

function mapFontStyle(font: Partial<Font> | undefined): SheetCellStyle {
  return {
    fontFamily: font?.name,
    fontSize: font?.size,
    bold: font?.bold,
    italic: font?.italic,
    underline: normalizeUnderline(font?.underline),
    color: argbToHex(font?.color)
  }
}

function mapFillBackground(fill: Fill | undefined): string | undefined {
  if (!fill || fill.type !== 'pattern' || fill.pattern !== 'solid') {
    return undefined
  }

  return argbToHex(fill.fgColor)
}

function mapBorderStyle(border: Partial<Borders> | undefined): SheetCellStyle['border'] {
  const result = {
    top: mapBorderColor(border?.top),
    right: mapBorderColor(border?.right),
    bottom: mapBorderColor(border?.bottom),
    left: mapBorderColor(border?.left)
  }

  return Object.values(result).some(Boolean) ? result : undefined
}

function mapAlignmentStyle(alignment: Partial<Alignment> | undefined): SheetCellStyle {
  return {
    horizontalAlign: normalizeHorizontalAlign(alignment?.horizontal),
    verticalAlign: normalizeVerticalAlign(alignment?.vertical)
  }
}

function mapSheetFont(style: SheetCellStyle): Partial<Font> {
  return removeUndefined({
    name: style.fontFamily,
    size: style.fontSize,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    color: hexToColor(style.color)
  })
}

function mapSheetFill(style: SheetCellStyle): Fill | undefined {
  const fgColor = hexToColor(style.background)

  if (!fgColor) {
    return undefined
  }

  return { type: 'pattern', pattern: 'solid', fgColor }
}

function mapSheetBorder(style: SheetCellStyle): Partial<Borders> {
  return removeUndefined({
    top: mapSheetBorderSide(style.border?.top),
    right: mapSheetBorderSide(style.border?.right),
    bottom: mapSheetBorderSide(style.border?.bottom),
    left: mapSheetBorderSide(style.border?.left)
  })
}

function mapSheetAlignment(style: SheetCellStyle): Partial<Alignment> {
  return removeUndefined({
    horizontal: style.horizontalAlign,
    vertical: style.verticalAlign
  })
}

function readMergedRanges(worksheet: Worksheet): readonly MergedRange[] {
  return worksheet.model.merges
    .map(parseMergedRange)
    .filter((range): range is MergedRange => range !== null)
}

function writeMergedRanges(worksheet: Worksheet, ranges: readonly MergedRange[]): void {
  for (const range of ranges) {
    worksheet.mergeCells(range.startRow + 1, range.startCol + 1, range.endRow + 1, range.endCol + 1)
  }
}

function readColumnWidths(worksheet: Worksheet, colCount: number): readonly number[] | undefined {
  const widths = Array.from(
    { length: colCount },
    (_, index) => worksheet.getColumn(index + 1).width ?? 0
  )
  return widths.some((width) => width > 0) ? widths : undefined
}

function readRowHeights(worksheet: Worksheet, rowCount: number): readonly number[] | undefined {
  const heights = Array.from(
    { length: rowCount },
    (_, index) => worksheet.getRow(index + 1).height ?? 0
  )
  return heights.some((height) => height > 0) ? heights : undefined
}

function writeColumnWidths(worksheet: Worksheet, widths: readonly number[] | undefined): void {
  widths?.forEach((width, index) => {
    if (width > 0) {
      worksheet.getColumn(index + 1).width = width
    }
  })
}

function writeRowHeights(worksheet: Worksheet, heights: readonly number[] | undefined): void {
  heights?.forEach((height, index) => {
    if (height > 0) {
      worksheet.getRow(index + 1).height = height
    }
  })
}

function normalizeCellValue(value: CellValue): SheetCell['value'] {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return normalizeObjectCellValue(value)
}

function normalizeObjectCellValue(
  value: Exclude<CellValue, null | undefined | string | number | boolean>
): SheetCell['value'] {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (isFormulaValue(value)) {
    return value.result === undefined ? getFormulaText(value) : normalizeCellValue(value.result)
  }

  if (isHyperlinkValue(value)) {
    return value.text
  }

  if (isRichTextValue(value)) {
    return value.richText.map((item) => item.text).join('')
  }

  return isErrorValue(value) ? value.error : String(value)
}

function mapSheetValueToCellValue(value: SheetCell['value']): CellValue {
  return value
}

function sheetToCsvRows(sheet: SheetTab): readonly (readonly SheetCell['value'][])[] {
  return Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    Array.from(
      { length: sheet.colCount },
      (_, colIndex) => sheet.cells[rowIndex]?.[colIndex]?.value ?? ''
    )
  )
}

function normalizeCsvRows(rows: readonly (readonly string[])[]): readonly (readonly string[])[] {
  if (rows.length === 1 && rows[0]?.length === 1 && rows[0][0] === '') {
    return []
  }

  return rows
}

function createCsvCellRow(
  row: readonly string[],
  colCount: number
): ReadonlyArray<SheetCell | null> {
  return Array.from({ length: colCount }, (_, index) => {
    const value = row[index] ?? ''
    return value === '' ? null : { value }
  })
}

function validateSheetCellCounts(actual: SheetDocument, expected: SheetDocument): ValidationResult {
  for (let index = 0; index < expected.sheets.length; index += 1) {
    const expectedCount = countSheetCells(expected.sheets[index])
    const actualCount = countSheetCells(actual.sheets[index])

    if (actualCount !== expectedCount) {
      return createValidationFailure(
        `Cell count mismatch in sheet ${index + 1}: expected ${expectedCount}, got ${actualCount}`
      )
    }
  }

  return { ok: true }
}

function countSheetCells(sheet: SheetTab | undefined): number {
  return (
    sheet?.cells.reduce((total, row) => total + row.filter((cell) => cell !== null).length, 0) ?? 0
  )
}

function parseMergedRange(value: string): MergedRange | null {
  const [start, end] = stripSheetName(value).split(':')
  const startAddress = parseCellAddress(start)
  const endAddress = parseCellAddress(end ?? start)

  if (!startAddress || !endAddress) {
    return null
  }

  return {
    startRow: startAddress.row,
    endRow: endAddress.row,
    startCol: startAddress.col,
    endCol: endAddress.col
  }
}

function parseCellAddress(
  value: string | undefined
): { readonly row: number; readonly col: number } | null {
  const match = value?.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i)

  if (!match) {
    return null
  }

  return {
    row: Number(match[2]) - 1,
    col: columnLettersToIndex(match[1])
  }
}

function columnLettersToIndex(value: string): number {
  return (
    [...value.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  )
}

function getWorksheetColumnCount(worksheet: Worksheet): number {
  return Math.max(worksheet.columnCount, worksheet.columns.length)
}

function getMaxRowLength(rows: readonly (readonly string[])[]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0)
}

function getFileStem(absolutePath: string): string {
  return basename(absolutePath)
    .replace(extname(absolutePath), '')
    .replace(/\.(csv|xlsx)$/i, '')
}

function detectSheetFormat(absolutePath: string): SheetFormat {
  const lowerPath = absolutePath.toLowerCase()

  if (lowerPath.endsWith('.csv') || lowerPath.endsWith('.csv.tmp')) {
    return 'csv'
  }

  if (lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xlsx.tmp')) {
    return 'xlsx'
  }

  throw new Error(`Unsupported sheet format: ${extname(absolutePath) || 'unknown'}`)
}

function assertTemporaryPath(tmpPath: string): void {
  if (!tmpPath.endsWith(TEMP_FILE_SUFFIX)) {
    throw new Error(`writeSheetFile expects a "${TEMP_FILE_SUFFIX}" path`)
  }
}

function normalizeUnderline(value: Partial<Font>['underline'] | undefined): boolean | undefined {
  if (value === undefined || value === false || value === 'none') {
    return undefined
  }

  return true
}

function normalizeHorizontalAlign(
  value: Partial<Alignment>['horizontal'] | undefined
): SheetCellStyle['horizontalAlign'] {
  return value === 'left' || value === 'center' || value === 'right' ? value : undefined
}

function normalizeVerticalAlign(
  value: Partial<Alignment>['vertical'] | undefined
): SheetCellStyle['verticalAlign'] {
  return value === 'top' || value === 'middle' || value === 'bottom' ? value : undefined
}

function mapBorderColor(border: Partial<Border> | undefined): string | undefined {
  return argbToHex(border?.color)
}

function mapSheetBorderSide(color: string | undefined): Partial<Border> | undefined {
  const borderColor = hexToColor(color)
  return borderColor ? { style: DEFAULT_BORDER_STYLE, color: borderColor } : undefined
}

function argbToHex(color: Partial<Color> | undefined): string | undefined {
  const argb = color?.argb

  if (!argb) {
    return undefined
  }

  const rgb = argb.replace(/^#/, '').slice(-6)
  return /^[0-9a-f]{6}$/i.test(rgb) ? `#${rgb.toUpperCase()}` : undefined
}

function hexToColor(hex: string | undefined): Partial<Color> | undefined {
  if (!hex) {
    return undefined
  }

  const rgb = hex.replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(rgb) ? { argb: `FF${rgb.toUpperCase()}` } : undefined
}

function pruneSheetStyle(style: SheetCellStyle): SheetCellStyle | undefined {
  const pruned = removeUndefined(style)
  return Object.keys(pruned).length > 0 ? pruned : undefined
}

function removeUndefined<T extends object>(value: T): T {
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== undefined
  )
  return Object.fromEntries(entries) as T
}

function stripSheetName(value: string): string {
  const markerIndex = value.lastIndexOf('!')
  return markerIndex === -1 ? value : value.slice(markerIndex + 1)
}

function isFormulaValue(value: object): value is CellFormulaValue | CellSharedFormulaValue {
  return 'formula' in value || 'sharedFormula' in value
}

function getFormulaText(value: CellFormulaValue | CellSharedFormulaValue): string | null {
  return 'formula' in value ? (value.formula ?? null) : value.sharedFormula
}

function isHyperlinkValue(value: object): value is CellHyperlinkValue {
  return 'hyperlink' in value && 'text' in value
}

function isRichTextValue(value: object): value is CellRichTextValue {
  return 'richText' in value
}

function isErrorValue(value: object): value is CellErrorValue {
  return 'error' in value
}

function createValidationFailure(reason: string): ValidationResult {
  return { ok: false, reason }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
