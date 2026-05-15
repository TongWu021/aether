import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Annotation } from '../../src/types/annotation'

let dataDir = ''

export function initAnnotationStore(dir: string): void {
  dataDir = dir
}

export async function getAnnotations(filePath: string): Promise<readonly Annotation[]> {
  return readAnnotations(filePath)
}

export async function addAnnotation(
  filePath: string,
  data: {
    selectedText: string
    comment: string
    lineStart: number
    lineEnd: number
    anchor?: Annotation['anchor']
  }
): Promise<Annotation> {
  const annotations = await readAnnotations(filePath)
  const annotation: Annotation = {
    id: randomUUID(),
    filePath,
    selectedText: data.selectedText,
    comment: data.comment,
    lineStart: data.lineStart,
    lineEnd: data.lineEnd,
    anchor: data.anchor,
    createdAt: new Date().toISOString()
  }

  await writeAnnotations(filePath, [...annotations, annotation])
  return annotation
}

export async function updateAnnotation(
  filePath: string,
  annotationId: string,
  updates: { comment: string }
): Promise<Annotation | null> {
  const annotations = await readAnnotations(filePath)
  const nextAnnotations = annotations.map((annotation) =>
    annotation.id === annotationId ? { ...annotation, comment: updates.comment } : annotation
  )

  if (annotations.every((annotation, index) => annotation === nextAnnotations[index])) {
    return null
  }

  await writeAnnotations(filePath, nextAnnotations)
  return nextAnnotations.find((annotation) => annotation.id === annotationId) ?? null
}

export async function deleteAnnotation(filePath: string, annotationId: string): Promise<boolean> {
  const annotations = await readAnnotations(filePath)
  const nextAnnotations = annotations.filter((annotation) => annotation.id !== annotationId)

  if (nextAnnotations.length === annotations.length) {
    return false
  }

  await writeAnnotations(filePath, nextAnnotations)
  return true
}

export async function deleteAllAnnotations(filePath: string): Promise<boolean> {
  const targetPath = getDataPath(filePath)

  if (!(await pathExists(targetPath))) {
    return false
  }

  await unlink(targetPath)
  return true
}

async function readAnnotations(filePath: string): Promise<readonly Annotation[]> {
  const targetPath = getDataPath(filePath)

  if (!(await pathExists(targetPath))) {
    return []
  }

  const content = await readFile(targetPath, 'utf8')
  return JSON.parse(content) as readonly Annotation[]
}

async function writeAnnotations(filePath: string, annotations: readonly Annotation[]): Promise<void> {
  ensureDataDir()
  await mkdir(dataDir, { recursive: true })
  const targetPath = getDataPath(filePath)
  const tempPath = `${targetPath}.tmp`

  await writeFile(tempPath, JSON.stringify(annotations, null, 2), 'utf8')
  await rename(tempPath, targetPath)
}

function getDataPath(filePath: string): string {
  ensureDataDir()
  const hash = createHash('sha256').update(filePath).digest('hex')
  return join(dataDir, `${hash}.json`)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

function ensureDataDir(): void {
  if (!dataDir) {
    throw new Error('Annotation store is not initialized')
  }
}
