import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { AppModule } from '../components/sidebar/Sidebar'
import type { FileNode, WorkspaceConfig } from '../types'
import { getWorkspaceNameFromPath } from '../utils/format'
import {
  collectHydratePaths,
  getAncestorDirectoryPaths,
  getMemoryDirectory,
  mergeExpandedPaths,
  toggleExpandedPath
} from '../utils/path'

interface UseWorkspaceOptions {
  readonly scanDirectory: (
    dirPath: string,
    options?: { hydratePaths?: readonly string[]; preserveSelectedPath?: string | null }
  ) => Promise<void>
  readonly loadDirectory: (dirPath: string) => Promise<void>
  readonly resetTree: () => void
  readonly selectFile: (node: FileNode | null) => void
  readonly showToast: (message: string, type: 'success' | 'error') => void
  readonly setActiveModule: (module: AppModule) => void
  readonly setViewMode: (mode: 'tree' | 'viewer') => void
  readonly setEditorMode: (mode: 'preview' | 'edit') => void
}

interface UseWorkspaceReturn {
  readonly workspaces: readonly WorkspaceConfig[]
  readonly activeWorkspaceId: string | null
  readonly activeWorkspace: WorkspaceConfig | null
  readonly expandedPaths: ReadonlySet<string>
  readonly searchFiles: readonly FileNode[]
  readonly memoryDir: string | null
  readonly refreshWorkspace: (
    workspace: WorkspaceConfig,
    options?: { preserveSelectedPath?: string | null }
  ) => Promise<void>
  readonly handleSwitchWorkspace: (workspace: WorkspaceConfig) => Promise<void>
  readonly handleAddWorkspace: () => Promise<void>
  readonly handleWorkspaceChanged: () => Promise<void>
  readonly handleToggleExpand: (node: FileNode, expanded: boolean) => void
  readonly revealNodeInTree: (targetPath: string) => Promise<void>
  readonly setExpandedPaths: Dispatch<SetStateAction<ReadonlySet<string>>>
}

export function useWorkspace({
  scanDirectory,
  loadDirectory,
  resetTree,
  selectFile,
  showToast,
  setActiveModule,
  setViewMode,
  setEditorMode
}: UseWorkspaceOptions): UseWorkspaceReturn {
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceConfig[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [expandedPaths, setExpandedPathsState] = useState<ReadonlySet<string>>(new Set())
  const [searchFiles, setSearchFiles] = useState<readonly FileNode[]>([])
  const [memoryDir, setMemoryDir] = useState<string | null>(null)
  const expandedPathsMapRef = useRef<Map<string, Set<string>>>(new Map())
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null

  const setExpandedPaths = useCallback<Dispatch<SetStateAction<ReadonlySet<string>>>>(
    (value) => {
      setExpandedPathsState((current) => {
        const nextPaths = typeof value === 'function' ? value(current) : value

        if (activeWorkspaceId) {
          expandedPathsMapRef.current.set(activeWorkspaceId, new Set(nextPaths))
        }

        return nextPaths
      })
    },
    [activeWorkspaceId]
  )

  const refreshSearchIndex = useCallback(async (workspacePath: string): Promise<void> => {
    try {
      const nextFiles = await window.electronAPI.file.listFiles(workspacePath)
      setSearchFiles(nextFiles)
    } catch (error) {
      console.warn('Failed to build file search index:', error)
      setSearchFiles([])
    }
  }, [])

  const refreshWorkspace = useCallback(
    async (workspace: WorkspaceConfig, options?: { preserveSelectedPath?: string | null }): Promise<void> => {
      const expanded = expandedPathsMapRef.current.get(workspace.id) ?? new Set<string>()
      const hydratePaths = collectHydratePaths(
        workspace.path,
        expanded,
        options?.preserveSelectedPath ?? null
      )

      await Promise.all([
        scanDirectory(workspace.path, {
          hydratePaths,
          preserveSelectedPath: options?.preserveSelectedPath
        }),
        refreshSearchIndex(workspace.path)
      ])
    },
    [refreshSearchIndex, scanDirectory]
  )

  const revealNodeInTree = useCallback(
    async (targetPath: string): Promise<void> => {
      if (!activeWorkspace) {
        return
      }

      const ancestors = getAncestorDirectoryPaths(activeWorkspace.path, targetPath)

      if (ancestors.length === 0) {
        return
      }

      setExpandedPathsState((previousPaths) => mergeExpandedPaths(previousPaths, ancestors))
      expandedPathsMapRef.current.set(
        activeWorkspace.id,
        mergeExpandedPaths(expandedPathsMapRef.current.get(activeWorkspace.id), ancestors)
      )

      for (const path of ancestors) {
        await loadDirectory(path)
      }
    },
    [activeWorkspace, loadDirectory]
  )

  useEffect(() => {
    let cancelled = false

    const loadWorkspaces = async (): Promise<void> => {
      try {
        const config = await window.electronAPI.config.load()

        if (cancelled) {
          return
        }

        setMemoryDir(getMemoryDirectory(config))
        setWorkspaces(config.workspaces)

        if (config.workspaces.length === 0) {
          setActiveWorkspaceId(null)
          setExpandedPathsState(new Set())
          setSearchFiles([])
          resetTree()
          return
        }

        const firstWorkspace = config.workspaces[0]
        setActiveWorkspaceId(firstWorkspace.id)
        setExpandedPathsState(getSavedExpandedPaths(expandedPathsMapRef.current, firstWorkspace.id))
        await refreshWorkspace(firstWorkspace)
      } catch (error) {
        setMemoryDir(null)
        console.warn('Failed to load config:', error)
      }
    }

    void loadWorkspaces()

    return () => {
      cancelled = true
    }
  }, [refreshWorkspace, resetTree])

  const handleSwitchWorkspace = useCallback(
    async (workspace: WorkspaceConfig): Promise<void> => {
      setActiveModule('files')
      setActiveWorkspaceId(workspace.id)
      setViewMode('tree')
      setEditorMode('preview')
      setExpandedPathsState(getSavedExpandedPaths(expandedPathsMapRef.current, workspace.id))
      selectFile(null)
      await refreshWorkspace(workspace)
    },
    [refreshWorkspace, selectFile, setActiveModule, setEditorMode, setViewMode]
  )

  const handleAddWorkspace = useCallback(async (): Promise<void> => {
    const selectedPath = await window.electronAPI.file.selectDirectory()

    if (!selectedPath) {
      return
    }

    try {
      const updatedConfig = await window.electronAPI.config.addWorkspace({
        name: getWorkspaceNameFromPath(selectedPath),
        path: selectedPath
      })

      setWorkspaces(updatedConfig.workspaces)

      const newWorkspace = updatedConfig.workspaces.find((workspace) => workspace.path === selectedPath)

      if (newWorkspace) {
        setActiveWorkspaceId(newWorkspace.id)
        setActiveModule('files')
        setViewMode('tree')
        setEditorMode('preview')
        setExpandedPathsState(getSavedExpandedPaths(expandedPathsMapRef.current, newWorkspace.id))
        selectFile(null)
        await refreshWorkspace(newWorkspace)
      }

      showToast('工作区已添加', 'success')
    } catch {
      showToast('添加工作区失败', 'error')
    }
  }, [refreshWorkspace, selectFile, setActiveModule, setEditorMode, setViewMode, showToast])

  const handleWorkspaceChanged = useCallback(async (): Promise<void> => {
    const config = await window.electronAPI.config.load()
    setMemoryDir(getMemoryDirectory(config))
    setWorkspaces(config.workspaces)

    if (activeWorkspaceId && config.workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      return
    }

    if (config.workspaces.length > 0) {
      const firstWorkspace = config.workspaces[0]
      setActiveWorkspaceId(firstWorkspace.id)
      setViewMode('tree')
      setEditorMode('preview')
      setExpandedPathsState(getSavedExpandedPaths(expandedPathsMapRef.current, firstWorkspace.id))
      selectFile(null)
      await refreshWorkspace(firstWorkspace)
      return
    }

    setActiveWorkspaceId(null)
    setExpandedPathsState(new Set())
    setSearchFiles([])
    resetTree()
  }, [activeWorkspaceId, refreshWorkspace, resetTree, selectFile, setEditorMode, setViewMode])

  const handleToggleExpand = useCallback(
    (node: FileNode, expanded: boolean): void => {
      if (!activeWorkspaceId) {
        return
      }

      const nextPaths = toggleExpandedPath(
        expandedPathsMapRef.current.get(activeWorkspaceId),
        node.path,
        expanded
      )

      expandedPathsMapRef.current.set(activeWorkspaceId, nextPaths)
      setExpandedPathsState(nextPaths)

      if (expanded && node.type === 'directory' && !node.childrenLoaded) {
        void loadDirectory(node.path)
      }
    },
    [activeWorkspaceId, loadDirectory]
  )

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    expandedPaths,
    searchFiles,
    memoryDir,
    refreshWorkspace,
    handleSwitchWorkspace,
    handleAddWorkspace,
    handleWorkspaceChanged,
    handleToggleExpand,
    revealNodeInTree,
    setExpandedPaths
  }
}

function getSavedExpandedPaths(
  expandedPathsMap: ReadonlyMap<string, ReadonlySet<string>>,
  workspaceId: string
): ReadonlySet<string> {
  const savedPaths = expandedPathsMap.get(workspaceId)
  return savedPaths ? new Set(savedPaths) : new Set()
}
