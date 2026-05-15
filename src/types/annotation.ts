export interface AnnotationAnchor {
  readonly startOffset: number
  readonly endOffset: number
  readonly occurrenceIndex: number
  readonly prefixText: string
  readonly suffixText: string
}

export interface Annotation {
  readonly id: string
  readonly filePath: string
  readonly selectedText: string
  readonly comment: string
  readonly lineStart: number
  readonly lineEnd: number
  readonly anchor?: AnnotationAnchor
  readonly createdAt: string
}

export interface AnnotationExport {
  readonly filePath: string
  readonly fileName: string
  readonly annotations: readonly Annotation[]
}
