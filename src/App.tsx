import { useCallback, useEffect, useRef, useState } from 'react'

import { FileViewer } from './components/editor/FileViewer'
import type { SheetViewerHandle } from './components/editor/SheetViewer'
import { FileSearch } from './components/file-tree/FileSearch'
import { FileTree } from './components/file-tree/FileTree'
import { MemoryPanel } from './components/memory/MemoryPanel'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { DetailPanel } from './components/sidebar/DetailPanel'
import { Icon } from './components/shared/Icon'
import { Sidebar, type AppModule } from './components/sidebar/Sidebar'
import { ToastProvider, useToast } from './components/shared/Toast'
import { UpdateBanner } from './components/shared/UpdateBanner'
import { useAnnotations } from './hooks/useAnnotations'
import { useFileMemo } from './hooks/useMemo'
import { useFileTree } from './hooks/useFileTree'
import { useSheet } from './hooks/useSheet'
import { useWorkspace } from './hooks/useWorkspace'
import { CockpitLayout } from './layouts/CockpitLayout'
import type { Annotation, FileNode, SheetDocument } from './types'
import {
  countTreeStats,
  type FileKind,
  getFileKind,
  getModulePlaceholder,
  toCopyErrorMessage,
  toReadErrorMessage,
  toSaveErrorMessage
} from './utils/file'
import { truncatePath } from './utils/format'
import { findAncestorPaths, getAncestorDirectoryPaths, mergeExpandedPaths } from './utils/path'

interface TabCache {
  readonly fileContent: string
  readonly editContent: string
  readonly editorMode: 'preview' | 'edit'
}

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

function AppContent(): React.JSX.Element {
  const [activeModule, setActiveModule] = useState<AppModule>('files')
  const [detailCollapsed, setDetailCollapsed] = useState(false)
  const [detailPanelWidth, setDetailPanelWidth] = useState(280)
  const [viewMode, setViewMode] = useState<'tree' | 'viewer'>('tree')
  const [editorMode, setEditorMode] = useState<'preview' | 'edit'>('preview')
  const [openTabs, setOpenTabs] = useState<readonly FileNode[]>([])
  const [fileContent, setFileContent] = useState('')
  const [editContent, setEditContent] = useState('')
  const [markdownLoading, setMarkdownLoading] = useState(false)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)
  const [sheetDirtyState, setSheetDirtyState] = useState({ path: null as string | null, dirty: false })
  const [chatMessages, setChatMessages] = useState<readonly ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const tabCacheRef = useRef<Map<string, TabCache>>(new Map())
  const activeAnnotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedFilePathRef = useRef<string | null>(null)
  const watcherRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watcherRefreshInFlightRef = useRef(false)
  const watcherRefreshQueuedRef = useRef(false)
  const pendingChangedPathsRef = useRef<Set<string>>(new Set())
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const sheetViewerRef = useRef<SheetViewerHandle>(null)
  const {
    tree,
    loading,
    error,
    scanDirectory,
    loadDirectory,
    resetTree,
    selectedFile,
    selectFile
  } = useFileTree()
  const { showToast } = useToast()
  const {
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
  } = useWorkspace({
    scanDirectory,
    loadDirectory,
    resetTree,
    selectFile,
    showToast,
    setActiveModule,
    setViewMode,
    setEditorMode
  })

  const activeFile = selectedFile && getFileKind(selectedFile) !== 'unsupported' ? selectedFile : null
  const activeTextFile = activeFile && getFileKind(activeFile) === 'text' ? activeFile : null
  const activeSheetFile = activeFile && getFileKind(activeFile) === 'sheet' ? activeFile : null
  const previewingFilePath = viewMode === 'viewer' && activeTextFile ? activeTextFile.path : null
  const { annotations, addAnnotation, deleteAnnotation } = useAnnotations(previewingFilePath)
  const {
    content: memoContent,
    loading: memoLoading,
    setContent: setMemoContent,
    exportMemo: handleExportMemo
  } = useFileMemo(previewingFilePath)
  const sheetState = useSheet(viewMode === 'viewer' ? (activeSheetFile?.path ?? null) : null)
  const sheetDirty = activeSheetFile !== null && sheetDirtyState.path === activeSheetFile.path && sheetDirtyState.dirty
  const hasUnsavedChanges = (activeTextFile !== null && editContent !== fileContent) || (activeSheetFile !== null && sheetDirty)

  const saveCurrentTabToCache = useCallback((): void => {
    if (!activeTextFile) {
      return
    }

    tabCacheRef.current.set(activeTextFile.path, {
      fileContent,
      editContent,
      editorMode
    })
  }, [activeTextFile, editContent, editorMode, fileContent])

  const clearMarkdownState = useCallback((): void => {
    setFileContent('')
    setEditContent('')
    setMarkdownError(null)
    setMarkdownLoading(false)
  }, [])

  const prepareViewerFile = useCallback(
    (fileKind: FileKind, cached: TabCache | undefined): void => {
      if (cached) {
        setFileContent(cached.fileContent)
        setEditContent(cached.editContent)
        setEditorMode(cached.editorMode)
        setMarkdownLoading(false)
        setMarkdownError(null)
        return
      }

      setEditorMode('preview')
      if (fileKind === 'sheet') clearMarkdownState()
    },
    [clearMarkdownState]
  )

  useEffect(() => {
    selectedFilePathRef.current = selectedFile?.path ?? null
  }, [selectedFile?.path])

  useEffect(() => {
    setOpenTabs([])
    tabCacheRef.current.clear()
  }, [activeWorkspaceId])

  useEffect(() => {
    setActiveAnnotationId(null)
  }, [previewingFilePath])

  useEffect(() => {
    setChatMessages([])
    setChatLoading(false)
  }, [activeTextFile?.path])

  useEffect(() => {
    return () => {
      if (activeAnnotationTimerRef.current) {
        clearTimeout(activeAnnotationTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (viewMode !== 'viewer') {
      return
    }

    if (!activeFile) {
      setViewMode('tree')
      clearMarkdownState()
      return
    }

    if (!activeTextFile) {
      clearMarkdownState()
      return
    }

    if (tabCacheRef.current.has(activeTextFile.path)) {
      return
    }

    let cancelled = false

    const loadMarkdown = async (): Promise<void> => {
      setMarkdownLoading(true)
      setMarkdownError(null)

      try {
        const content = await window.electronAPI.file.readFile(activeTextFile.path)

        if (!cancelled) {
          setFileContent(content)
          setEditContent(content)
        }
      } catch (readError) {
        if (!cancelled) {
          setFileContent('')
          setEditContent('')
          setMarkdownError(toReadErrorMessage(readError))
        }
      } finally {
        if (!cancelled) {
          setMarkdownLoading(false)
        }
      }
    }

    void loadMarkdown()

    return () => {
      cancelled = true
    }
  }, [activeFile, activeTextFile, clearMarkdownState, viewMode])

  const handleCopyPath = useCallback(
    async (path: string): Promise<void> => {
      try {
        await window.electronAPI.file.copyPath(path)
        showToast(`已复制: ${truncatePath(path)}`, 'success')
      } catch (copyError) {
        showToast(toCopyErrorMessage(copyError), 'error')
      }
    },
    [showToast]
  )

  const handleBuildContext = useCallback(
    async (folderPath: string): Promise<void> => {
      try {
        const outputPath = await window.electronAPI.context.build(folderPath)
        showToast(`已生成: ${outputPath.split('/').pop()}`, 'success')
      } catch {
        showToast('生成上下文失败', 'error')
      }
    },
    [showToast]
  )

  const handleBuildFileContext = useCallback(async (): Promise<void> => {
    if (!activeTextFile) return
    try {
      const outputPath = await window.electronAPI.context.buildFile(activeTextFile.path)
      showToast(`已生成: ${outputPath.split('/').pop()}`, 'success')
    } catch {
      showToast('打包上下文失败', 'error')
    }
  }, [activeTextFile, showToast])

  const handleSave = useCallback(async (): Promise<void> => {
    if (activeSheetFile && sheetDirty) {
      const snapshot = sheetViewerRef.current?.getSnapshot()
      if (!snapshot) {
        showToast('当前表格未就绪', 'error')
        return
      }

      try {
        const result = await window.electronAPI.excel.save(activeSheetFile.path, snapshot)
        if (result.success) {
          setSheetDirtyState({ path: activeSheetFile.path, dirty: false })
          showToast('已保存', 'success')
        } else {
          showToast(result.error, 'error')
        }
      } catch (saveError) {
        showToast(toSaveErrorMessage(saveError), 'error')
      }
      return
    }

    if (!activeTextFile || !hasUnsavedChanges) {
      return
    }

    try {
      await window.electronAPI.file.writeFile(activeTextFile.path, editContent)
      setFileContent(editContent)
      tabCacheRef.current.set(activeTextFile.path, {
        fileContent: editContent,
        editContent,
        editorMode
      })
      showToast('已保存', 'success')
    } catch (saveError) {
      showToast(toSaveErrorMessage(saveError), 'error')
    }
  }, [
    activeSheetFile,
    activeTextFile,
    editContent,
    editorMode,
    hasUnsavedChanges,
    sheetDirty,
    showToast
  ])

  const handleSheetDirty = useCallback((): void => {
    setSheetDirtyState({ path: activeSheetFile?.path ?? null, dirty: true })
  }, [activeSheetFile?.path])

  const handleSheetFitWidth = useCallback((): void => {
    sheetViewerRef.current?.zoomToFit()
  }, [])

  const handleChatSend = useCallback(
    async (question: string): Promise<void> => {
      if (!activeTextFile || chatLoading) {
        return
      }

      const userMsg: ChatMessage = { role: 'user', content: question }
      const nextMessages = [...chatMessages, userMsg]

      setChatMessages(nextMessages)
      setChatLoading(true)

      try {
        const result = await window.electronAPI.llm.chat(editContent, question, chatMessages)
        setChatMessages(
          result.success
            ? [...nextMessages, { role: 'assistant', content: result.answer }]
            : [...nextMessages, { role: 'assistant', content: `❌ ${result.error ?? '回答失败'}` }]
        )
      } catch {
        setChatMessages([...nextMessages, { role: 'assistant', content: '❌ 请求失败' }])
      } finally {
        setChatLoading(false)
      }
    },
    [activeTextFile, chatLoading, chatMessages, editContent]
  )

  const handleSelectNode = useCallback(
    (node: FileNode): void => {
      const ancestors =
        tree && tree.path === activeWorkspace?.path
          ? findAncestorPaths(tree, node.path)
          : getAncestorDirectoryPaths(activeWorkspace?.path ?? null, node.path)

      if (ancestors.length > 0) {
        setExpandedPaths((previousPaths) => mergeExpandedPaths(previousPaths, ancestors))
      }

      const fileKind = getFileKind(node)

      if (fileKind !== 'unsupported') {
        saveCurrentTabToCache()
        setOpenTabs((previousTabs) => {
          if (previousTabs.some((tab) => tab.path === node.path)) {
            return previousTabs
          }

          return [...previousTabs, node]
        })

        const cached = fileKind === 'text' ? tabCacheRef.current.get(node.path) : undefined

        prepareViewerFile(fileKind, cached)

        selectFile(node)
        setViewMode('viewer')

        return
      }

      selectFile(node)
      setViewMode('tree')
      setEditorMode('preview')
    },
    [activeWorkspace?.path, prepareViewerFile, saveCurrentTabToCache, selectFile, setExpandedPaths, tree]
  )

  const handleSwitchTab = useCallback(
    (targetTab: FileNode): void => {
      if (targetTab.path === selectedFile?.path) {
        return
      }

      saveCurrentTabToCache()
      const fileKind = getFileKind(targetTab)

      if (fileKind === 'unsupported') {
        return
      }

      const cached = fileKind === 'text' ? tabCacheRef.current.get(targetTab.path) : undefined

      prepareViewerFile(fileKind, cached)

      selectFile(targetTab)
      setViewMode('viewer')
    },
    [prepareViewerFile, saveCurrentTabToCache, selectFile, selectedFile?.path]
  )

  const handleCloseTab = useCallback(
    (closingTab: FileNode): void => {
      tabCacheRef.current.delete(closingTab.path)

      setOpenTabs((previousTabs) => {
        const nextTabs = previousTabs.filter((tab) => tab.path !== closingTab.path)

        if (closingTab.path === selectedFile?.path) {
          if (nextTabs.length === 0) {
            selectFile(null)
            setViewMode('tree')
            setEditorMode('preview')
            clearMarkdownState()
          } else {
            const closedIndex = previousTabs.findIndex((tab) => tab.path === closingTab.path)
            const nextIndex = Math.min(closedIndex, nextTabs.length - 1)
            const nextTab = nextTabs[nextIndex]
            const nextKind = getFileKind(nextTab)
            const cached = nextKind === 'text' ? tabCacheRef.current.get(nextTab.path) : undefined

            prepareViewerFile(nextKind, cached)

            selectFile(nextTab)
            setViewMode('viewer')
          }
        }

        return nextTabs
      })
    },
    [clearMarkdownState, prepareViewerFile, selectFile, selectedFile?.path]
  )

  const handleBackToTree = useCallback((): void => {
    saveCurrentTabToCache()
    const revealTask = selectedFile ? revealNodeInTree(selectedFile.path) : Promise.resolve()

    void revealTask.finally(() => {
      setViewMode('tree')
      setEditorMode('preview')
    })
  }, [revealNodeInTree, saveCurrentTabToCache, selectedFile])

  const handleScrollToAnnotation = useCallback((annotation: Annotation): void => {
    if (activeAnnotationTimerRef.current) {
      clearTimeout(activeAnnotationTimerRef.current)
    }

    setActiveAnnotationId(annotation.id)
    activeAnnotationTimerRef.current = setTimeout(() => {
      setActiveAnnotationId(null)
      activeAnnotationTimerRef.current = null
    }, 3000)
  }, [])

  const handleCopyAnnotation = useCallback(
    async (annotation: Annotation): Promise<void> => {
      const fileName = activeTextFile?.name ?? '未知文件'
      const lineRange =
        annotation.lineStart === annotation.lineEnd
          ? `第 ${annotation.lineStart} 行`
          : `第 ${annotation.lineStart}-${annotation.lineEnd} 行`
      const text = `文件: ${fileName} (${lineRange})\n原文: ${annotation.selectedText}\n批注: ${annotation.comment}`

      await navigator.clipboard.writeText(text)
      showToast('已复制批注', 'success')
    },
    [activeTextFile?.name, showToast]
  )

  const handleExportAnnotations = useCallback(async (): Promise<void> => {
    if (!activeTextFile || annotations.length === 0) {
      return
    }

    try {
      const exportPath = await window.electronAPI.annotation.export(
        activeTextFile.path,
        annotations
      )
      showToast(`批注已导出: ${exportPath.split('/').pop()}`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导出失败', 'error')
    }
  }, [activeTextFile, annotations, showToast])

  const handleMemoExport = useCallback(async (): Promise<void> => {
    try {
      const exportPath = await handleExportMemo()

      if (exportPath) {
        showToast(`备忘已导出: ${exportPath.split('/').pop()}`, 'success')
      }
    } catch {
      showToast('导出失败', 'error')
    }
  }, [handleExportMemo, showToast])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()

        if (viewMode === 'viewer' && hasUnsavedChanges) {
          void handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleSave, hasUnsavedChanges, viewMode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        if (
          viewMode === 'viewer' &&
          editorMode === 'preview' &&
          !markdownLoading &&
          !markdownError &&
          activeTextFile
        ) {
          event.preventDefault()
          setSearchVisible(true)
        }
      }

      if (event.key === 'Escape') {
        setSearchVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTextFile, editorMode, markdownError, markdownLoading, viewMode])

  useEffect(() => {
    if (
      viewMode !== 'viewer' ||
      editorMode !== 'preview' ||
      markdownLoading ||
      markdownError ||
      !activeTextFile
    ) {
      setSearchVisible(false)
    }
  }, [activeTextFile, editorMode, markdownError, markdownLoading, viewMode])

  useEffect(() => {
    setSearchVisible(false)
  }, [activeTextFile?.path])

  useEffect(() => {
    if (!tree?.path || !activeWorkspace) {
      return
    }

    // Watch only the directories currently loaded into the tree to avoid
    // exhausting macOS file-descriptor limits on large workspaces.
    void window.electronAPI.file.watch(collectLoadedDirectoryPaths(tree))

    const unsubscribe = window.electronAPI.file.onFileChanges((events) => {
      for (const event of events) {
        if (event.type === 'change' || event.type === 'unlink') {
          pendingChangedPathsRef.current.add(event.path)
        }
      }

      if (watcherRefreshTimerRef.current) {
        clearTimeout(watcherRefreshTimerRef.current)
      }

      watcherRefreshTimerRef.current = setTimeout(() => {
        const runRefresh = async (): Promise<void> => {
          if (watcherRefreshInFlightRef.current) {
            watcherRefreshQueuedRef.current = true
            return
          }

          watcherRefreshInFlightRef.current = true
          const changedPaths = new Set(pendingChangedPathsRef.current)
          pendingChangedPathsRef.current = new Set()

          try {
            await refreshWorkspace(activeWorkspace, {
              preserveSelectedPath: selectedFilePathRef.current
            })

            // Invalidate tab cache for externally changed files (only if no unsaved edits)
            for (const changedPath of changedPaths) {
              const cached = tabCacheRef.current.get(changedPath)
              if (cached && cached.fileContent === cached.editContent) {
                tabCacheRef.current.delete(changedPath)
              }
            }

            // Re-read the currently active file if it was invalidated
            const currentPath = selectedFilePathRef.current
            if (
              currentPath &&
              changedPaths.has(currentPath) &&
              !tabCacheRef.current.has(currentPath)
            ) {
              try {
                const content = await window.electronAPI.file.readFile(currentPath)
                setFileContent(content)
                setEditContent(content)
              } catch {
                // File may have been deleted
              }
            }
          } finally {
            watcherRefreshInFlightRef.current = false

            if (watcherRefreshQueuedRef.current) {
              watcherRefreshQueuedRef.current = false
              await runRefresh()
            }
          }
        }

        void runRefresh()
      }, 250)
    })

    return () => {
      if (watcherRefreshTimerRef.current) {
        clearTimeout(watcherRefreshTimerRef.current)
        watcherRefreshTimerRef.current = null
      }

      watcherRefreshQueuedRef.current = false
      watcherRefreshInFlightRef.current = false
      unsubscribe()
      void window.electronAPI.file.unwatch()
    }
  }, [activeWorkspace, refreshWorkspace, tree])

  const stats = countTreeStats(tree)

  return (
    <CockpitLayout
      banner={<UpdateBanner />}
      topBar={
        <div className="grid h-full grid-cols-[168px_minmax(0,1fr)_168px] items-center gap-4 px-4">
          <BrandWordmark />

          <div className="flex justify-center">
            <FileSearch
              files={searchFiles}
              onSelect={(node) => {
                setActiveModule('files')
                handleSelectNode(node)
                void revealNodeInTree(node.path)
              }}
            />
          </div>

          <div aria-hidden="true" />
        </div>
      }
      sidebar={
        <Sidebar
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={handleSwitchWorkspace}
          onAddWorkspace={handleAddWorkspace}
        />
      }
      main={
        <div className="h-full">
          {renderMainContent({
            activeModule,
            tree,
            loading,
            error,
            selectedFile,
            openTabs,
            viewMode,
            editorMode,
            editContent,
            annotations,
            activeAnnotationId,
            hasUnsavedChanges,
            expandedPaths,
            markdownLoading,
            markdownError,
            searchVisible,
            sheetFile: activeSheetFile,
            sheetDocument: sheetState.document,
            sheetLoading: sheetState.loading,
            sheetError: sheetState.error,
            sheetViewerRef,
            viewerContainerRef,
            memoryDir,
            workspaceName: activeWorkspace?.name ?? null,
            onSelect: handleSelectNode,
            onBackToTree: handleBackToTree,
            onEditorModeChange: setEditorMode,
            onEditContentChange: setEditContent,
            onSwitchTab: handleSwitchTab,
            onCloseTab: handleCloseTab,
            onAddAnnotation: addAnnotation,
            onSave: handleSave,
            onCloseSearch: () => setSearchVisible(false),
            onCopyPath: handleCopyPath,
            onSheetDirty: handleSheetDirty,
            onSheetFitWidth: handleSheetFitWidth,
            onBuildContext: handleBuildContext,
            onBuildFileContext: handleBuildFileContext,
            onToggleExpand: handleToggleExpand,
            onSettingsWorkspaceChanged: handleWorkspaceChanged,
            onOpenSettings: () => setActiveModule('settings')
          })}
        </div>
      }
      detail={
        activeModule === 'files' ? (
          <DetailPanel
            selectedFile={selectedFile}
            annotations={annotations}
            onScrollToAnnotation={handleScrollToAnnotation}
            onDeleteAnnotation={(id) => {
              void deleteAnnotation(id)
            }}
            onCopyAnnotation={(annotation) => {
              void handleCopyAnnotation(annotation)
            }}
            onExportAll={() => {
              void handleExportAnnotations()
            }}
            memoContent={memoContent}
            memoLoading={memoLoading}
            onMemoChange={setMemoContent}
            onMemoExport={() => {
              void handleMemoExport()
            }}
            chatMessages={chatMessages}
            chatLoading={chatLoading}
            onChatSend={handleChatSend}
            isPreviewMode={viewMode === 'viewer' && editorMode === 'preview'}
            onCopyPath={handleCopyPath}
            panelWidth={detailPanelWidth}
            onPanelWidthChange={(width) => {
              setDetailPanelWidth(width)
            }}
            collapsed={detailCollapsed}
            onToggleCollapse={() => setDetailCollapsed((current) => !current)}
          />
        ) : null
      }
      statusBar={
        <div className="flex h-full items-center px-4 text-xs text-text-muted">
          文件: {stats.files} 个 | 文件夹: {stats.directories} 个
        </div>
      }
    />
  )
}

function App(): React.JSX.Element {
  return <ToastProvider><AppContent /></ToastProvider>
}

function BrandWordmark(): React.JSX.Element {
  return (
    <div className="flex items-end gap-0" aria-label="Aether">
      <span className="inline-flex items-center justify-center text-text-primary">
        <Icon name="brand-aether" size={18} className="translate-y-[1px]" />
      </span>
      <div
        className="select-none text-[21px] font-semibold leading-none tracking-[-0.018em] text-text-primary"
        style={{
          fontFamily: 'var(--font-serif)',
          fontKerning: 'normal',
          fontFeatureSettings: '"kern" 1, "liga" 1, "clig" 1'
        }}
      >
        ether
      </div>
    </div>
  )
}

interface MainContentProps {
  readonly activeModule: AppModule
  readonly tree: FileNode | null
  readonly loading: boolean
  readonly error: string | null
  readonly selectedFile: FileNode | null
  readonly openTabs: readonly FileNode[]
  readonly viewMode: 'tree' | 'viewer'
  readonly editorMode: 'preview' | 'edit'
  readonly editContent: string
  readonly annotations: readonly Annotation[]
  readonly activeAnnotationId: string | null
  readonly hasUnsavedChanges: boolean
  readonly expandedPaths: ReadonlySet<string>
  readonly markdownLoading: boolean
  readonly markdownError: string | null
  readonly searchVisible: boolean
  readonly sheetFile: FileNode | null
  readonly sheetDocument: SheetDocument | null
  readonly sheetLoading: boolean
  readonly sheetError: string | null
  readonly sheetViewerRef: React.RefObject<SheetViewerHandle | null>
  readonly viewerContainerRef: React.RefObject<HTMLDivElement | null>
  readonly memoryDir: string | null
  readonly workspaceName: string | null
  readonly onSelect: (node: FileNode) => void
  readonly onBackToTree: () => void
  readonly onEditorModeChange: (mode: 'preview' | 'edit') => void
  readonly onEditContentChange: (value: string) => void
  readonly onSwitchTab: (file: FileNode) => void
  readonly onCloseTab: (file: FileNode) => void
  readonly onAddAnnotation: (data: {
    selectedText: string
    comment: string
    lineStart: number
    lineEnd: number
  }) => Promise<void>
  readonly onSave: () => Promise<void>
  readonly onCloseSearch: () => void
  readonly onCopyPath: (path: string) => Promise<void>
  readonly onSheetDirty: () => void
  readonly onSheetFitWidth: () => void
  readonly onBuildContext: (folderPath: string) => Promise<void>
  readonly onBuildFileContext: () => Promise<void>
  readonly onToggleExpand: (node: FileNode, expanded: boolean) => void
  readonly onSettingsWorkspaceChanged: () => void
  readonly onOpenSettings: () => void
}

function renderMainContent({
  activeModule,
  tree,
  loading,
  error,
  selectedFile,
  openTabs,
  viewMode,
  editorMode,
  editContent,
  annotations,
  activeAnnotationId,
  hasUnsavedChanges,
  expandedPaths,
  markdownLoading,
  markdownError,
  searchVisible,
  sheetFile,
  sheetDocument,
  sheetLoading,
  sheetError,
  sheetViewerRef,
  viewerContainerRef,
  memoryDir,
  workspaceName,
  onSelect,
  onBackToTree,
  onEditorModeChange,
  onEditContentChange,
  onSwitchTab,
  onCloseTab,
  onAddAnnotation,
  onSave,
  onCloseSearch,
  onCopyPath,
  onSheetDirty,
  onSheetFitWidth,
  onBuildContext,
  onBuildFileContext,
  onToggleExpand,
  onSettingsWorkspaceChanged,
  onOpenSettings
}: MainContentProps): React.JSX.Element {
  if (activeModule === 'files') {
    const activeFile =
      selectedFile && getFileKind(selectedFile) !== 'unsupported' ? selectedFile : null

    if (viewMode === 'viewer' && activeFile) {
      return (
        <FileViewer
          file={activeFile}
          openTabs={openTabs}
          editorMode={editorMode}
          editContent={editContent}
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          hasUnsavedChanges={hasUnsavedChanges}
          markdownLoading={markdownLoading}
          markdownError={markdownError}
          searchVisible={searchVisible}
          sheetFile={sheetFile}
          sheetDocument={sheetDocument}
          sheetLoading={sheetLoading}
          sheetError={sheetError}
          sheetViewerRef={sheetViewerRef}
          viewerContainerRef={viewerContainerRef}
          onEditorModeChange={onEditorModeChange}
          onEditContentChange={onEditContentChange}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onAddAnnotation={onAddAnnotation}
          onSave={onSave}
          onCloseSearch={onCloseSearch}
          onBack={onBackToTree}
          onCopyPath={onCopyPath}
          onSheetDirty={onSheetDirty}
          onSheetFitWidth={onSheetFitWidth}
          onBuildFileContext={onBuildFileContext}
        />
      )
    }

    return (
      <div className="aether-glass flex h-full flex-col overflow-hidden rounded-[24px]">
        <div className="px-5 pb-2 pt-4">
          <div className="min-w-0">{renderBreadcrumb(workspaceName, selectedFile)}</div>
        </div>

        <div className="min-h-0 flex-1">
          <FileTree
            tree={tree}
            loading={loading}
            error={error}
            selectedPath={selectedFile?.path ?? null}
            expandedPaths={expandedPaths}
            onSelect={onSelect}
            onCopyPath={onCopyPath}
            onBuildContext={onBuildContext}
            onToggleExpand={onToggleExpand}
          />
        </div>
      </div>
    )
  }

  if (activeModule === 'settings') {
    return (
      <div className="aether-glass aether-scrollbar h-full overflow-y-auto rounded-[24px]">
        <SettingsPanel onWorkspaceChanged={onSettingsWorkspaceChanged} />
      </div>
    )
  }

  if (activeModule === 'memory') {
    return (
      <div className="aether-glass flex h-full flex-col overflow-hidden rounded-[24px]">
        {memoryDir ? (
          <MemoryPanel memoryDir={memoryDir} />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <div className="text-base font-semibold text-text-primary">尚未配置记忆目录</div>
              <div className="mt-2 text-sm text-text-secondary">
                请先在设置中配置短期记忆目录，指向你的对话记录文件夹。
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-5 inline-flex h-10 items-center rounded-full border border-border bg-canvas px-5 text-sm font-medium text-text-primary transition-colors duration-150 hover:border-accent/35 hover:bg-hover"
              >
                去设置短期记忆目录
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="aether-glass grid h-full place-items-center overflow-hidden rounded-[24px]">
      <div className="text-center">
        <div className="mb-2 text-base font-semibold text-text-primary">敬请期待</div>
        <div className="text-sm text-text-secondary">{getModulePlaceholder(activeModule)}</div>
      </div>
    </div>
  )
}

function renderBreadcrumb(
  workspaceName: string | null,
  selectedFile: FileNode | null
): React.JSX.Element {
  const rootLabel = workspaceName ?? '未选择工作区'

  if (!selectedFile) {
    return (
      <div className="truncate text-sm font-medium text-text-primary" title={rootLabel}>
        {rootLabel}
      </div>
    )
  }

  const segments = [rootLabel, ...selectedFile.relativePath.split('/').filter(Boolean)]

  return (
    <div className="flex min-w-0 items-center text-sm text-text-secondary">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1

        return (
          <div key={`${segment}-${index}`} className="flex min-w-0 items-center">
            {index > 0 ? <span className="mx-1 shrink-0 text-text-muted">›</span> : null}
            <span
              className={[
                'truncate',
                isLast ? 'font-medium text-text-primary' : 'text-text-secondary'
              ].join(' ')}
              title={segment}
            >
              {segment}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function collectLoadedDirectoryPaths(root: FileNode): string[] {
  if (root.type !== 'directory') {
    return []
  }

  const paths: string[] = []
  const queue: FileNode[] = [root]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || current.type !== 'directory') {
      continue
    }

    paths.push(current.path)

    if (!current.children || current.children.length === 0) {
      continue
    }

    for (const child of current.children) {
      if (child.type === 'directory') {
        queue.push(child)
      }
    }
  }

  return paths
}

export default App
