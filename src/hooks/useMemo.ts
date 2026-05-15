import { useCallback, useEffect, useRef, useState } from 'react'

interface UseMemoReturn {
  readonly content: string
  readonly loading: boolean
  readonly setContent: (html: string) => void
  readonly exportMemo: () => Promise<string | null>
}

export function useFileMemo(filePath: string | null): UseMemoReturn {
  const [content, setContentState] = useState('')
  const [loading, setLoading] = useState(false)
  const contentRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!filePath) {
      setContentState('')
      contentRef.current = ''
      return
    }

    let cancelled = false
    setLoading(true)

    void window.electronAPI.memo
      .get(filePath)
      .then((saved) => {
        if (!cancelled) {
          setContentState(saved)
          contentRef.current = saved
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContentState('')
          contentRef.current = ''
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  const setContent = useCallback(
    (html: string): void => {
      setContentState(html)
      contentRef.current = html

      if (!filePath) {
        return
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        void window.electronAPI.memo.save(filePath, html)
      }, 800)
    },
    [filePath]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      if (filePath && contentRef.current) {
        void window.electronAPI.memo.save(filePath, contentRef.current)
      }
    }
  }, [filePath])

  const exportMemo = useCallback(async (): Promise<string | null> => {
    if (!filePath || !contentRef.current) {
      return null
    }

    return window.electronAPI.memo.export(filePath, contentRef.current)
  }, [filePath])

  return { content, loading, setContent, exportMemo }
}
