import type { Annotation, AnnotationAnchor } from '../../types'

const CONTEXT_WINDOW = 24

export interface AnnotationMatch {
  readonly startOffset: number
  readonly endOffset: number
}

export interface AnnotationSelectionSnapshot {
  readonly selectedText: string
  readonly anchor: AnnotationAnchor
}

export function readAnnotationSelection(
  container: HTMLElement,
  range: Range
): AnnotationSelectionSnapshot | null {
  const fullText = getContainerText(container)
  const rawStartOffset = getBoundaryOffset(container, range.startContainer, range.startOffset)
  const rawEndOffset = getBoundaryOffset(container, range.endContainer, range.endOffset)

  if (rawEndOffset <= rawStartOffset) {
    return null
  }

  const rawSelectedText = fullText.slice(rawStartOffset, rawEndOffset)
  const leadingWhitespaceLength = rawSelectedText.length - rawSelectedText.trimStart().length
  const trailingWhitespaceLength = rawSelectedText.length - rawSelectedText.trimEnd().length
  const startOffset = rawStartOffset + leadingWhitespaceLength
  const endOffset = rawEndOffset - trailingWhitespaceLength

  if (endOffset <= startOffset) {
    return null
  }

  const selectedText = fullText.slice(startOffset, endOffset)

  if (!selectedText.trim()) {
    return null
  }

  return {
    selectedText,
    anchor: createAnnotationAnchor(fullText, startOffset, endOffset, selectedText)
  }
}

export function resolveAnnotationMatch(
  fullText: string,
  annotation: Pick<Annotation, 'selectedText' | 'anchor'>,
  usedRanges: Set<string>
): AnnotationMatch | null {
  const query = annotation.selectedText

  if (!query) {
    return null
  }

  const anchoredMatch = getAnchoredMatch(fullText, query, annotation.anchor, usedRanges)

  if (anchoredMatch) {
    return anchoredMatch
  }

  const candidates = findMatchCandidates(fullText, query)

  if (candidates.length === 0) {
    return null
  }

  const rankedCandidates = candidates
    .filter((candidate) => !usedRanges.has(toRangeKey(candidate.startOffset, candidate.endOffset)))
    .sort(
      (left, right) =>
        scoreCandidate(fullText, right, annotation.anchor) -
        scoreCandidate(fullText, left, annotation.anchor)
    )

  const match = rankedCandidates[0] ?? candidates[0]

  if (!match) {
    return null
  }

  usedRanges.add(toRangeKey(match.startOffset, match.endOffset))

  return {
    startOffset: match.startOffset,
    endOffset: match.endOffset
  }
}

export function getSelectionAnchorRect(range: Range): DOMRect {
  const clientRects = [...range.getClientRects()].filter((rect) => rect.width > 0 || rect.height > 0)
  const targetRect = clientRects[clientRects.length - 1] ?? range.getBoundingClientRect()

  return new DOMRect(targetRect.x, targetRect.y, targetRect.width, targetRect.height)
}

function getAnchoredMatch(
  fullText: string,
  query: string,
  anchor: AnnotationAnchor | undefined,
  usedRanges: Set<string>
): AnnotationMatch | null {
  if (!anchor) {
    return null
  }

  if (
    anchor.startOffset < 0 ||
    anchor.endOffset > fullText.length ||
    anchor.endOffset <= anchor.startOffset
  ) {
    return null
  }

  if (fullText.slice(anchor.startOffset, anchor.endOffset) !== query) {
    return null
  }

  const rangeKey = toRangeKey(anchor.startOffset, anchor.endOffset)

  if (usedRanges.has(rangeKey)) {
    return null
  }

  usedRanges.add(rangeKey)

  return {
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset
  }
}

function createAnnotationAnchor(
  fullText: string,
  startOffset: number,
  endOffset: number,
  selectedText: string
): AnnotationAnchor {
  return {
    startOffset,
    endOffset,
    occurrenceIndex: countOccurrencesBefore(fullText, selectedText, startOffset),
    prefixText: fullText.slice(Math.max(0, startOffset - CONTEXT_WINDOW), startOffset),
    suffixText: fullText.slice(endOffset, endOffset + CONTEXT_WINDOW)
  }
}

function getBoundaryOffset(container: HTMLElement, node: Node, offset: number): number {
  const prefixRange = document.createRange()
  prefixRange.selectNodeContents(container)
  prefixRange.setEnd(node, offset)
  return prefixRange.cloneContents().textContent?.length ?? 0
}

function getContainerText(container: HTMLElement): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  let result = ''

  while (node) {
    result += node.textContent ?? ''
    node = walker.nextNode()
  }

  return result
}

function findMatchCandidates(fullText: string, query: string): Array<AnnotationMatch & { occurrenceIndex: number }> {
  const candidates: Array<AnnotationMatch & { occurrenceIndex: number }> = []
  let searchStart = 0
  let occurrenceIndex = 0

  while (searchStart <= fullText.length) {
    const matchIndex = fullText.indexOf(query, searchStart)

    if (matchIndex < 0) {
      break
    }

    candidates.push({
      startOffset: matchIndex,
      endOffset: matchIndex + query.length,
      occurrenceIndex
    })

    occurrenceIndex += 1
    searchStart = matchIndex + Math.max(query.length, 1)
  }

  return candidates
}

function scoreCandidate(
  fullText: string,
  candidate: AnnotationMatch & { occurrenceIndex: number },
  anchor: AnnotationAnchor | undefined
): number {
  if (!anchor) {
    return 0
  }

  const occurrenceDistance = Math.abs(candidate.occurrenceIndex - anchor.occurrenceIndex)
  const actualPrefix = fullText.slice(
    Math.max(0, candidate.startOffset - anchor.prefixText.length),
    candidate.startOffset
  )
  const actualSuffix = fullText.slice(
    candidate.endOffset,
    candidate.endOffset + anchor.suffixText.length
  )
  const prefixScore = countSharedSuffix(
    anchor.prefixText,
    actualPrefix
  )
  const suffixScore = countSharedPrefix(
    anchor.suffixText,
    actualSuffix
  )

  return prefixScore + suffixScore - occurrenceDistance * 16
}

function countOccurrencesBefore(fullText: string, query: string, targetOffset: number): number {
  let searchStart = 0
  let count = 0

  while (searchStart < targetOffset) {
    const matchIndex = fullText.indexOf(query, searchStart)

    if (matchIndex < 0 || matchIndex >= targetOffset) {
      break
    }

    count += 1
    searchStart = matchIndex + Math.max(query.length, 1)
  }

  return count
}

function countSharedSuffix(expected: string, actual: string): number {
  let score = 0

  for (let index = 1; index <= Math.min(expected.length, actual.length); index += 1) {
    if (expected.at(-index) !== actual.at(-index)) {
      break
    }

    score += 1
  }

  return score
}

function countSharedPrefix(expected: string, actual: string): number {
  let score = 0

  for (let index = 0; index < Math.min(expected.length, actual.length); index += 1) {
    if (expected[index] !== actual[index]) {
      break
    }

    score += 1
  }

  return score
}

function toRangeKey(startOffset: number, endOffset: number): string {
  return `${startOffset}:${endOffset}`
}
