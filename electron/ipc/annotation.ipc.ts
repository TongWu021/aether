import { ipcMain } from 'electron'

import type { Annotation } from '../../src/types/annotation'
import { exportAnnotations } from '../services/annotation-exporter'
import {
  addAnnotation,
  deleteAllAnnotations,
  deleteAnnotation,
  getAnnotations,
  updateAnnotation
} from '../services/annotation-store'

export function registerAnnotationIpc(): void {
  ipcMain.handle('annotation:list', (_event, filePath: string) => getAnnotations(filePath))
  ipcMain.handle(
    'annotation:add',
    (
      _event,
      filePath: string,
      data: {
        selectedText: string
        comment: string
        lineStart: number
        lineEnd: number
        anchor?: Annotation['anchor']
      }
    ) => addAnnotation(filePath, data)
  )
  ipcMain.handle(
    'annotation:update',
    (_event, filePath: string, id: string, updates: { comment: string }) =>
      updateAnnotation(filePath, id, updates)
  )
  ipcMain.handle('annotation:delete', (_event, filePath: string, id: string) =>
    deleteAnnotation(filePath, id)
  )
  ipcMain.handle('annotation:delete-all', (_event, filePath: string) =>
    deleteAllAnnotations(filePath)
  )
  ipcMain.handle('annotation:export', (_event, filePath: string, annotations: Annotation[]) =>
    exportAnnotations(filePath, annotations)
  )
}
