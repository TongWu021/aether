export interface SheetCellStyle {
  readonly fontFamily?: string
  readonly fontSize?: number
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly color?: string // hex e.g. "#1F2937"
  readonly background?: string // hex
  readonly border?: {
    readonly top?: string
    readonly right?: string
    readonly bottom?: string
    readonly left?: string
  }
  readonly horizontalAlign?: 'left' | 'center' | 'right'
  readonly verticalAlign?: 'top' | 'middle' | 'bottom'
}

export interface SheetCell {
  readonly value: string | number | boolean | null
  readonly style?: SheetCellStyle
}

export interface MergedRange {
  readonly startRow: number // 0-based, inclusive
  readonly endRow: number // inclusive
  readonly startCol: number
  readonly endCol: number
}

export interface SheetTab {
  readonly id: string
  readonly name: string
  readonly rowCount: number
  readonly colCount: number
  readonly cells: ReadonlyArray<ReadonlyArray<SheetCell | null>>
  readonly mergedRanges: readonly MergedRange[]
  readonly columnWidths?: readonly number[]
  readonly rowHeights?: readonly number[]
}

export interface SheetDocument {
  readonly format: 'xlsx' | 'csv'
  readonly sheets: readonly SheetTab[]
  readonly activeSheetId: string
}

export interface BackupEntry {
  readonly name: string // e.g. "20260429-143022.xlsx"
  readonly timestamp: string // ISO 8601
  readonly size: number // bytes
}
