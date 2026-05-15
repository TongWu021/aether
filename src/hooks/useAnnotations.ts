import { useCallback, useEffect, useState } from 'react'

import type { Annotation } from '../types'

interface UseAnnotationsReturn {
  readonly annotations: readonly Annotation[]
  readonly loading: boolean
  readonly addAnnotation: (data: {
    selectedText: string
    comment: string
    lineStart: number
    lineEnd: number
    anchor?: Annotation['anchor']
  }) => Promise<void>
  readonly updateAnnotation: (id: string, comment: string) => Promise<void>
  readonly deleteAnnotation: (id: string) => Promise<void>
  readonly refresh: () => Promise<void>
}

export function useAnnotations(filePath: string | null): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<readonly Annotation[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    if (!filePath) {
      setAnnotations([])
      return
    }

    setLoading(true)

    try {
      const result = await window.electronAPI.annotation.list(filePath)
      setAnnotations(result)
    } catch {
      setAnnotations([])
    } finally {
      setLoading(false)
    }
  }, [filePath])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addAnnotation = useCallback(
    async (data: {
      selectedText: string
      comment: string
      lineStart: number
      lineEnd: number
      anchor?: Annotation['anchor']
    }): Promise<void> => {
      if (!filePath) {
        throw new Error('No file path available for annotation')
      }

      const annotation = await window.electronAPI.annotation.add(filePath, data)
      setAnnotations((current) => [...current, annotation])
    },
    [filePath]
  )

  const updateAnnotation = useCallback(
    async (id: string, comment: string): Promise<void> => {
      if (!filePath) {
        return
      }

      const updatedAnnotation = await window.electronAPI.annotation.update(filePath, id, { comment })

      if (!updatedAnnotation) {
        return
      }

      setAnnotations((current) =>
        current.map((annotation) => (annotation.id === id ? updatedAnnotation : annotation))
      )
    },
    [filePath]
  )

  const deleteAnnotation = useCallback(
    async (id: string): Promise<void> => {
      if (!filePath) {
        return
      }

      const deleted = await window.electronAPI.annotation.delete(filePath, id)

      if (!deleted) {
        return
      }

      setAnnotations((current) => current.filter((annotation) => annotation.id !== id))
    },
    [filePath]
  )

  return { annotations, loading, addAnnotation, updateAnnotation, deleteAnnotation, refresh }
}
