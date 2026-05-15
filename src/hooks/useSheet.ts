import { useCallback, useEffect, useRef, useState } from 'react'

import type { SheetDocument } from '../types'

export interface UseSheetResult {
  readonly document: SheetDocument | null
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => Promise<void>
}

interface SheetState {
  readonly document: SheetDocument | null
  readonly loading: boolean
  readonly error: string | null
}

const EMPTY_STATE: SheetState = {
  document: null,
  loading: false,
  error: null
}

export function useSheet(filePath: string | null): UseSheetResult {
  const [state, setState] = useState<SheetState>(EMPTY_STATE)
  const activePathRef = useRef<string | null>(filePath)

  const reload = useCallback(async (): Promise<void> => {
    const targetPath = filePath

    if (!targetPath) {
      activePathRef.current = null
      setState(() => EMPTY_STATE)
      return
    }

    activePathRef.current = targetPath
    setState((current) => ({ ...current, loading: true, error: null }))

    try {
      const result = await window.electronAPI.excel.read(targetPath)

      if (activePathRef.current !== targetPath) return
      setState(() =>
        result.success
          ? { document: result.data, loading: false, error: null }
          : { document: null, loading: false, error: result.error }
      )
    } catch (error) {
      if (activePathRef.current !== targetPath) return
      setState(() => ({ document: null, loading: false, error: toErrorMessage(error) }))
    }
  }, [filePath])

  useEffect(() => {
    activePathRef.current = filePath

    if (!filePath) {
      setState(() => EMPTY_STATE)
      return undefined
    }

    void reload()
    return () => {
      activePathRef.current = null
    }
  }, [filePath, reload])

  return { ...state, reload }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
