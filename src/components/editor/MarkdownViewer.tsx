import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import '../../styles/markdown-theme.css'
import { ImageLightbox } from './ImageLightbox'
import type { Annotation } from '../../types'
import { resolveAnnotationMatch } from './annotation-utils'
import { toLocalResourceUrl } from '../../utils/url'

interface MarkdownViewerProps {
  readonly content: string
  readonly filePath?: string
  readonly contentWidth?: 'standard' | 'medium' | 'full'
  readonly annotations?: readonly Annotation[]
  readonly activeAnnotationId?: string | null
  readonly className?: string
}

export function MarkdownViewer({
  content,
  filePath,
  contentWidth,
  annotations,
  activeAnnotationId,
  className
}: MarkdownViewerProps): React.JSX.Element {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState('')
  const markdownBodyRef = useRef<HTMLDivElement>(null)
  const maxWidth = contentWidth === 'full' ? 'calc(100% - 56px)' : contentWidth === 'medium' ? '90ch' : undefined

  useEffect(() => {
    const container = markdownBodyRef.current

    if (!container) {
      return
    }

    clearAnnotationHighlights(container)

    if (!annotations || annotations.length === 0) {
      return
    }

    const fullText = collectContainerText(container)
    const usedRanges = new Set<string>()

    for (const annotation of annotations) {
      const match = resolveAnnotationMatch(fullText, annotation, usedRanges)

      if (!match) {
        continue
      }

      highlightAnnotation(container, match, annotation)
    }

    return () => {
      clearAnnotationHighlights(container)
    }
  }, [annotations, content])

  useEffect(() => {
    if (!activeAnnotationId || !markdownBodyRef.current) {
      return
    }

    const mark = markdownBodyRef.current.querySelector<HTMLElement>(
      `[data-annotation-id="${activeAnnotationId}"]`
    )

    mark?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeAnnotationId])

  const openLightbox = (source: string, altText: string): void => {
    if (!source) {
      return
    }

    setLightboxSrc(source)
    setLightboxAlt(altText)
  }

  const closeLightbox = (): void => {
    setLightboxSrc(null)
    setLightboxAlt('')
  }

  return (
    <div>
      <div
        key={filePath ?? ''}
        ref={markdownBodyRef}
        className={['markdown-body', className ?? ''].join(' ').trim()}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            img: ({ src, alt, ...props }) => {
              const resolvedSource = resolveImageSource(src, filePath)
              const imageClassName = [props.className, 'cursor-pointer transition-opacity hover:opacity-90']
                .filter(Boolean)
                .join(' ')

              return (
                <img
                  src={resolvedSource}
                  alt={alt ?? ''}
                  loading="lazy"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    openLightbox(resolvedSource, alt ?? '')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openLightbox(resolvedSource, alt ?? '')
                    }
                  }}
                  {...props}
                  className={imageClassName}
                />
              )
            },
            svg: (props) => (
              <div
                className="inline-block cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  const dataUrl = serializeSvgElement(event.currentTarget.querySelector('svg'))

                  if (!dataUrl) {
                    return
                  }

                  openLightbox(dataUrl, 'SVG')
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  const dataUrl = serializeSvgElement(event.currentTarget.querySelector('svg'))

                  if (dataUrl) {
                    openLightbox(dataUrl, 'SVG')
                  }
                }}
              >
                <svg {...props} />
              </div>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {lightboxSrc ? (
        <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={closeLightbox} />
      ) : null}
    </div>
  )
}

function highlightAnnotation(
  container: HTMLElement,
  match: { startOffset: number; endOffset: number },
  annotation: Annotation
): void {
  const textNodes = collectTextNodes(container)
  const segments = getTextSegments(textNodes, match.startOffset, match.endOffset)

  for (const segment of segments.reverse()) {
    const text = segment.node.textContent ?? ''
    const fragment = document.createDocumentFragment()

    if (segment.start > 0) {
      fragment.append(text.slice(0, segment.start))
    }

    const highlight = document.createElement('span')
    highlight.dataset.annotationId = annotation.id
    highlight.dataset.annotationHighlight = 'true'
    highlight.className = 'annotation-highlight'
    highlight.title = annotation.comment
    highlight.textContent = text.slice(segment.start, segment.end)
    fragment.append(highlight)

    if (segment.end < text.length) {
      fragment.append(text.slice(segment.end))
    }

    segment.node.parentNode?.replaceChild(fragment, segment.node)
  }
}

function clearAnnotationHighlights(container: HTMLElement): void {
  const parents = new Set<HTMLElement>()

  for (const highlight of container.querySelectorAll<HTMLElement>('[data-annotation-highlight="true"]')) {
    const parent = highlight.parentElement

    while (highlight.firstChild) {
      parent?.insertBefore(highlight.firstChild, highlight)
    }

    highlight.remove()

    if (parent) {
      parents.add(parent)
    }
  }

  for (const parent of parents) {
    parent.normalize()
  }
}

function collectTextNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node = walker.nextNode()

  while (node) {
    textNodes.push(node as Text)
    node = walker.nextNode()
  }

  return textNodes.filter((textNode) => (textNode.textContent ?? '').length > 0)
}

function collectContainerText(container: HTMLElement): string {
  return collectTextNodes(container)
    .map((node) => node.textContent ?? '')
    .join('')
}

function getTextSegments(
  textNodes: readonly Text[],
  startOffset: number,
  endOffset: number
): Array<{ node: Text; start: number; end: number }> {
  const segments: Array<{ node: Text; start: number; end: number }> = []
  let cursor = 0

  for (const node of textNodes) {
    const length = node.textContent?.length ?? 0
    const nodeStart = cursor
    const nodeEnd = cursor + length
    const segmentStart = Math.max(startOffset, nodeStart)
    const segmentEnd = Math.min(endOffset, nodeEnd)

    if (segmentStart < segmentEnd) {
      segments.push({
        node,
        start: segmentStart - nodeStart,
        end: segmentEnd - nodeStart
      })
    }

    cursor += length
  }

  return segments
}

function resolveImageSource(source: string | undefined, markdownFilePath?: string): string {
  if (!source) {
    return ''
  }

  if (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('data:') ||
    source.startsWith('file://')
  ) {
    return source
  }

  const normalizedSource = normalizePath(source)
  const resolvedPath = normalizedSource.startsWith('/')
    ? normalizedSource
    : joinPaths(getDirectoryPath(markdownFilePath), normalizedSource)

  return toLocalResourceUrl(resolvedPath)
}

function getDirectoryPath(filePath: string | undefined): string {
  if (!filePath) {
    return ''
  }

  const normalizedPath = normalizePath(filePath)
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : normalizedPath
}

function joinPaths(basePath: string, relativePath: string): string {
  const segments = [...basePath.split('/'), ...relativePath.split('/')]
  const resolved: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue
    }

    if (segment === '..') {
      resolved.pop()
      continue
    }

    resolved.push(segment)
  }

  return `/${resolved.join('/')}`
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function serializeSvgElement(svgElement: SVGSVGElement | null): string | null {
  if (!svgElement) {
    return null
  }

  const clonedSvg = svgElement.cloneNode(true)

  if (!(clonedSvg instanceof SVGSVGElement)) {
    return null
  }

  const bounds = svgElement.getBoundingClientRect()
  ensureSvgAttribute(clonedSvg, 'xmlns', 'http://www.w3.org/2000/svg')
  ensureSvgAttribute(clonedSvg, 'xmlns:xlink', 'http://www.w3.org/1999/xlink')
  if (bounds.width > 0) {
    ensureSvgAttribute(clonedSvg, 'width', `${Math.round(bounds.width)}`)
  }

  if (bounds.height > 0) {
    ensureSvgAttribute(clonedSvg, 'height', `${Math.round(bounds.height)}`)
  }
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clonedSvg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
}

function ensureSvgAttribute(svgElement: SVGSVGElement, name: string, value: string): void {
  if (!svgElement.getAttribute(name)) {
    svgElement.setAttribute(name, value)
  }
}
