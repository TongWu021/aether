import { useEffect, useMemo, useState } from 'react'

const COLLAPSED_STRIP_HEIGHT = 272
const COLLAPSED_MARKER_COUNT = 28
const BAR_HEIGHT = 3
const ACTIVE_BAR_HEIGHT = 4
const ACTIVE_BAR_WIDTH = 16

interface OutlineBarProps {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly content: string
}

interface HeadingItem {
  readonly level: number
  readonly text: string
  readonly id: string
}

interface HeadingTarget extends HeadingItem {
  readonly element: HTMLHeadingElement
  readonly ratio: number
}

interface CollapsedMarker {
  readonly id: string
  readonly level: number
  readonly displayRatio: number
}

export function OutlineBar({ containerRef, content }: OutlineBarProps): React.JSX.Element | null {
  const fallbackHeadings = useMemo(() => parseHeadings(content), [content])
  const [headingTargets, setHeadingTargets] = useState<readonly HeadingTarget[]>([])
  const [activeId, setActiveId] = useState('')
  const [hovered, setHovered] = useState(false)
  const [progressRatio, setProgressRatio] = useState(0)
  const headings = useMemo(
    () => (headingTargets.length > 0 ? headingTargets.map(toHeadingItem) : fallbackHeadings),
    [fallbackHeadings, headingTargets]
  )
  const collapsedMarkers = useMemo(
    () => condenseMarkers(headingTargets.length > 0 ? headingTargets : createFallbackTargets(fallbackHeadings)),
    [fallbackHeadings, headingTargets]
  )
  const activeCollapsedMarker = useMemo(
    () => findActiveCollapsedMarker(collapsedMarkers, activeId, progressRatio),
    [activeId, collapsedMarkers, progressRatio]
  )
  const activeMarkerTop = getMarkerTop(activeCollapsedMarker?.displayRatio ?? progressRatio, ACTIVE_BAR_HEIGHT)

  useEffect(() => {
    setActiveId(headings[0]?.id ?? '')
  }, [headings])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      setHeadingTargets([])
      setProgressRatio(0)
      return
    }

    const targets = getHeadingTargets(container)

    if (targets.length === 0) {
      setHeadingTargets([])
      setProgressRatio(getScrollRatio(container))
      return
    }

    setHeadingTargets(targets)

    const updateOutlineState = (): void => {
      setActiveId(resolveActiveHeadingId(container, targets))
      setProgressRatio(getScrollRatio(container))
    }

    updateOutlineState()

    const observer = new IntersectionObserver(updateOutlineState, {
      root: container,
      threshold: 0,
      rootMargin: '-20% 0px -70% 0px'
    })

    for (const target of targets) {
      observer.observe(target.element)
    }

    container.addEventListener('scroll', updateOutlineState, { passive: true })

    return () => {
      container.removeEventListener('scroll', updateOutlineState)
      observer.disconnect()
    }
  }, [containerRef, fallbackHeadings])

  if (headings.length === 0) {
    return null
  }

  return (
    <div
      onMouseEnter={() => {
        setHovered(true)
      }}
      onMouseLeave={() => {
        setHovered(false)
      }}
      className="absolute right-8 top-1/2 z-10 -translate-y-1/2 overflow-visible transition-[width] duration-200"
      style={{ width: hovered ? 208 : 24 }}
    >
      <div className="relative flex items-center justify-end" style={{ maxHeight: '60vh' }}>
        <div
          className={`relative z-10 w-full overflow-hidden transition-opacity duration-150 ${
            hovered ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          style={{ height: COLLAPSED_STRIP_HEIGHT }}
        >
          {collapsedMarkers
            .filter((heading) => heading.id !== activeCollapsedMarker?.id)
            .map((heading) => (
            <div
              key={heading.id}
              className="absolute rounded-full"
              style={{
                top: getMarkerTop(heading.displayRatio, BAR_HEIGHT),
                right: 2,
                width: getBarWidth(heading.level),
                height: 3,
                transform: 'translateY(-50%)',
                backgroundColor: 'var(--color-text-muted)'
              }}
            />
          ))}
          <div
            className="absolute rounded-full"
            style={{
              top: activeMarkerTop,
              right: 0,
              width: ACTIVE_BAR_WIDTH,
              height: ACTIVE_BAR_HEIGHT,
              transform: 'translateY(-50%)',
              backgroundColor: 'var(--color-text-primary)',
              boxShadow: '0 0 6px var(--color-border)'
            }}
          />
        </div>

        <div
          className={`absolute right-0 top-1/2 w-56 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl backdrop-blur-md transition-all duration-200 ${
            hovered ? 'translate-x-0 opacity-100 scale-100' : 'pointer-events-none translate-x-2 opacity-0 scale-95'
          }`}
          style={{ boxShadow: '0 18px 40px color-mix(in srgb, var(--color-text-primary) 8%, transparent)' }}
        >
          <div className="aether-scrollbar flex flex-col gap-1 overflow-y-auto px-2 py-3" style={{ maxHeight: '60vh' }}>
            {headings.map((heading) => (
              <button
                key={heading.id}
                onClick={() => {
                  scrollToHeading(containerRef.current, heading.id)
                }}
                className={`block w-full rounded-xl px-3 py-0.5 text-left text-caption leading-snug transition-[background-color,color,box-shadow] ${
                  heading.id === activeId
                    ? 'bg-hover font-medium text-accent shadow-[inset_0_0_0_1px_var(--color-border)]'
                    : 'text-text-secondary hover:bg-hover'
                }`}
                style={{ paddingLeft: 16 + (heading.level - 1) * 12 }}
              >
                {heading.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function parseHeadings(content: string): readonly HeadingItem[] {
  const matches = content.matchAll(/^(#{1,6})\s+(.+)$/gm)
  const slugCounts = new Map<string, number>()
  const headings: HeadingItem[] = []

  for (const match of matches) {
    const level = match[1].length
    const text = match[2].trim()
    const baseId = slugify(text)
    const count = slugCounts.get(baseId) ?? 0
    slugCounts.set(baseId, count + 1)
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`
    headings.push({ level, text, id })
  }

  return headings
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

  return slug || 'section'
}

function getHeadingElements(container: HTMLDivElement): HTMLHeadingElement[] {
  return Array.from(container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6'))
}

function getHeadingTargets(container: HTMLDivElement): readonly HeadingTarget[] {
  const slugCounts = new Map<string, number>()
  return getHeadingElements(container).map((element) => {
    const text = normalizeHeadingText(element.textContent ?? '')
    const baseId = slugify(text)
    const count = slugCounts.get(baseId) ?? 0
    slugCounts.set(baseId, count + 1)
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`
    return { level: Number(element.tagName.slice(1)), text, id, element, ratio: getElementRatio(container, element) }
  })
}

function resolveActiveHeadingId(container: HTMLDivElement, targets: readonly HeadingTarget[]): string {
  const targetLine = container.scrollTop + container.clientHeight * 0.2
  let activeIndex = 0

  for (const [index, target] of targets.entries()) {
    if (getElementTop(container, target.element) > targetLine) {
      break
    }

    activeIndex = index
  }

  return targets[activeIndex]?.id ?? targets[0]?.id ?? ''
}

function getElementTop(container: HTMLDivElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
}

function getElementRatio(container: HTMLDivElement, element: HTMLElement): number {
  const maxScrollTop = getMaxScrollTop(container)

  if (maxScrollTop <= 0) {
    return 0
  }

  return Math.min(getElementTop(container, element) / maxScrollTop, 1)
}

function getScrollRatio(container: HTMLDivElement): number {
  const maxScrollTop = getMaxScrollTop(container)

  if (maxScrollTop <= 0) {
    return 0
  }

  return container.scrollTop / maxScrollTop
}

function scrollToHeading(container: HTMLDivElement | null, id: string): void {
  if (!container) {
    return
  }

  const target = getHeadingTargets(container).find((heading) => heading.id === id)

  if (!target) {
    return
  }

  const targetTop = getElementTop(container, target.element)
  const maxScrollTop = container.scrollHeight - container.clientHeight
  container.scrollTo({ top: Math.min(targetTop, maxScrollTop), behavior: 'smooth' })
}

function getBarWidth(level: number): number {
  if (level === 1) {
    return 14
  }

  if (level === 2) {
    return 10
  }

  if (level === 3) {
    return 8
  }

  if (level === 4) {
    return 6
  }

  return 4
}

function getMarkerTop(ratio: number, markerHeight: number): number {
  return ratio * (COLLAPSED_STRIP_HEIGHT - markerHeight) + markerHeight / 2
}

function getMaxScrollTop(container: HTMLDivElement): number {
  return container.scrollHeight - container.clientHeight
}

function createFallbackTargets(headings: readonly HeadingItem[]): readonly HeadingTarget[] {
  if (headings.length === 0) {
    return []
  }

  const lastIndex = Math.max(headings.length - 1, 1)
  return headings.map((heading, index) => ({
    ...heading,
    element: document.createElement('h1'),
    ratio: index / lastIndex
  }))
}

function condenseMarkers(targets: readonly HeadingTarget[]): readonly CollapsedMarker[] {
  if (targets.length <= COLLAPSED_MARKER_COUNT) {
    return distributeCollapsedMarkers(targets.map(toCollapsedMarker))
  }

  const buckets = new Map<number, HeadingTarget>()

  for (const target of targets) {
    const bucketIndex = Math.min(
      Math.round(target.ratio * (COLLAPSED_MARKER_COUNT - 1)),
      COLLAPSED_MARKER_COUNT - 1
    )
    const current = buckets.get(bucketIndex)

    if (!current || target.level < current.level) {
      buckets.set(bucketIndex, target)
    }
  }

  return distributeCollapsedMarkers(
    Array.from(buckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, target], index, items) => ({
      id: target.id,
      level: target.level,
      displayRatio: items.length <= 1 ? 0 : index / (items.length - 1)
    }))
  )
}

function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function toHeadingItem(target: HeadingTarget): HeadingItem {
  return { level: target.level, text: target.text, id: target.id }
}

function toCollapsedMarker(target: HeadingTarget): CollapsedMarker {
  return { id: target.id, level: target.level, displayRatio: target.ratio }
}

function findActiveCollapsedMarker(
  markers: readonly CollapsedMarker[],
  activeId: string,
  progressRatio: number
): CollapsedMarker | null {
  if (markers.length === 0) {
    return null
  }

  const exactMatch = markers.find((marker) => marker.id === activeId)

  if (exactMatch) {
    return exactMatch
  }

  let closestMarker = markers[0]
  let closestDistance = Math.abs(markers[0].displayRatio - progressRatio)

  for (const marker of markers.slice(1)) {
    const distance = Math.abs(marker.displayRatio - progressRatio)

    if (distance < closestDistance) {
      closestMarker = marker
      closestDistance = distance
    }
  }

  return closestMarker
}

function distributeCollapsedMarkers(markers: readonly CollapsedMarker[]): readonly CollapsedMarker[] {
  if (markers.length <= 1) {
    return markers
  }

  return markers.map((marker, index) => ({
    ...marker,
    displayRatio: index / (markers.length - 1)
  }))
}
