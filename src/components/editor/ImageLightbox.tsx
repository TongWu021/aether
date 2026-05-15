import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ImageLightboxProps {
  readonly src: string
  readonly alt: string
  readonly onClose: () => void
}

export function ImageLightbox({
  src,
  alt,
  onClose
}: ImageLightboxProps): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const imageFrameRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 })
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const suppressCloseRef = useRef(false)

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const animationFrameId = window.requestAnimationFrame(() => {
      setIsVisible(true)
      closeButtonRef.current?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        closeButtonRef.current?.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [onClose])

  useEffect(() => {
    const frame = imageFrameRef.current

    if (!frame) {
      return
    }

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()

      if (event.ctrlKey) {
        setScale((currentScale) => {
          const newScale = clampScale(currentScale - event.deltaY * 0.01)
          setTranslate((currentTranslate) =>
            clampTranslate(currentTranslate.x, currentTranslate.y, newScale, imgRef.current)
          )
          return newScale
        })
        return
      }

      setScale((currentScale) => {
        if (currentScale <= 1) {
          return currentScale
        }

        setTranslate((currentTranslate) => {
          const newX = currentTranslate.x - event.deltaX / currentScale
          const newY = currentTranslate.y - event.deltaY / currentScale
          return clampTranslate(newX, newY, currentScale, imgRef.current)
        })

        return currentScale
      })
    }

    frame.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      frame.removeEventListener('wheel', handleWheel)
    }
  }, [src])

  useEffect(() => {
    if (!dragging) {
      return
    }

    const handleMouseMove = (event: MouseEvent): void => {
      const newX = dragStartRef.current.translateX + (event.clientX - dragStartRef.current.x) / scale
      const newY = dragStartRef.current.translateY + (event.clientY - dragStartRef.current.y) / scale
      setTranslate(clampTranslate(newX, newY, scale, imgRef.current))
    }

    const handleMouseUp = (): void => {
      suppressCloseRef.current = true
      setDragging(false)
      window.setTimeout(() => {
        suppressCloseRef.current = false
      }, 0)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, scale])

  useEffect(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setDragging(false)
    suppressCloseRef.current = false
  }, [src])

  const cursorClassName = getCursorClassName(scale, dragging)
  const frameClassName = getFrameClassName(src, cursorClassName)
  const imageClassName = getImageClassName(src)
  const imageStyle = getImageStyle(src, scale, translate)

  return createPortal(
    <div
      className={[
        'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'opacity-0'
      ].join(' ')}
      onClick={() => {
        if (dragging || suppressCloseRef.current) {
          return
        }

        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={alt || '图片预览'}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="absolute top-4 right-4 text-3xl leading-none text-white transition-opacity hover:opacity-70"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
        aria-label="关闭图片预览"
      >
        ×
      </button>
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-12">
        <div
          ref={imageFrameRef}
          className={frameClassName}
          onClick={(event) => event.stopPropagation()}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            className={imageClassName}
            style={imageStyle}
            onDoubleClick={() => {
              setScale(1)
              setTranslate({ x: 0, y: 0 })
            }}
            onMouseDown={(event) => {
              if (scale <= 1) {
                return
              }

              event.preventDefault()
              dragStartRef.current = {
                x: event.clientX,
                y: event.clientY,
                translateX: translate.x,
                translateY: translate.y
              }
              setDragging(true)
            }}
          />
          {scale !== 1 ? (
            <div className="absolute left-3 bottom-3 rounded bg-black/40 px-1.5 py-0.5 text-xs text-white/60">
              {Math.round(scale * 100)}%
            </div>
          ) : null}
        </div>
        {alt ? (
          <div
            className="max-w-[90vw] text-center text-sm text-white/70"
            onClick={(event) => event.stopPropagation()}
          >
            {alt}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}

function clampScale(value: number): number {
  return Math.min(5, Math.max(0.5, value))
}

function clampTranslate(
  tx: number,
  ty: number,
  currentScale: number,
  imgEl: HTMLImageElement | null
): { x: number; y: number } {
  if (!imgEl || currentScale <= 1) {
    return { x: 0, y: 0 }
  }

  const width = imgEl.clientWidth
  const height = imgEl.clientHeight
  const maxX = (width * (currentScale - 1)) / (2 * currentScale)
  const maxY = (height * (currentScale - 1)) / (2 * currentScale)

  return {
    x: Math.max(-maxX, Math.min(maxX, tx)),
    y: Math.max(-maxY, Math.min(maxY, ty))
  }
}

function getCursorClassName(scale: number, dragging: boolean): string {
  if (dragging) {
    return 'cursor-grabbing'
  }

  if (scale > 1) {
    return 'cursor-grab'
  }

  return 'cursor-default'
}

function getFrameClassName(src: string, cursorClassName: string): string {
  return [
    'relative overflow-hidden rounded-lg shadow-2xl',
    cursorClassName,
    isSvgSource(src) ? 'w-[90vw] h-[90vh] max-w-[90vw] max-h-[90vh] bg-white p-3' : 'w-[96vw] h-[84vh] max-w-[96vw] max-h-[84vh]'
  ]
    .filter(Boolean)
    .join(' ')
}

function getImageClassName(src: string): string {
  return [
    'rounded-lg object-contain',
    'w-full h-full',
    isSvgSource(src) ? 'bg-white' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

function getImageStyle(
  src: string,
  scale: number,
  translate: { x: number; y: number }
): React.CSSProperties {
  const transform = `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`

  if (isSvgSource(src)) {
    return {
      width: '100%',
      height: '100%',
      transform
    }
  }

  return { transform }
}

function isSvgSource(src: string): boolean {
  return src.startsWith('data:image/svg+xml') || src.toLowerCase().includes('.svg')
}
