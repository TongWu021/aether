import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ShortTermMemoryCard } from '../../types'
import { EditorToolbar } from '../editor/EditorToolbar'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { MarkdownViewer } from '../editor/MarkdownViewer'
import { useToast } from '../shared/Toast'
import { LongTermMemory } from './LongTermMemory'
import { ShortTermMemory } from './ShortTermMemory'
import { ShortTermMemoryDashboard } from './ShortTermMemoryDashboard'

interface MemoryPanelProps {
  readonly memoryDir: string
}

interface ViewingFile {
  readonly fileId: string
  readonly path: string
  readonly title: string
}

type MemoryTab = 'long-term' | 'short-term'
type MemoryViewMode = 'preview' | 'edit'
type ShortTermView = 'dashboard' | 'list'

export function MemoryPanel({ memoryDir }: MemoryPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<MemoryTab>('short-term')
  const [shortTermView, setShortTermView] = useState<ShortTermView>('dashboard')
  const [cards, setCards] = useState<readonly ShortTermMemoryCard[]>([])
  const [loading, setLoading] = useState(true)
  const [longTermFilePath, setLongTermFilePath] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [hideEmpty, setHideEmpty] = useState(true)
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [viewingFile, setViewingFile] = useState<ViewingFile | null>(null)
  const [viewMode, setViewMode] = useState<MemoryViewMode>('preview')
  const [viewContent, setViewContent] = useState('')
  const [editContent, setEditContent] = useState('')
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)
  const { showToast } = useToast()

  const refreshMemoryDashboard = useCallback(async (): Promise<void> => {
    const [config, dashboardCards] = await Promise.all([
      window.electronAPI.config.get(),
      window.electronAPI.memory.dashboard(memoryDir)
    ])

    setLongTermFilePath(config.memory.longTermFile || null)
    setCards(dashboardCards)
  }, [memoryDir])

  const categories = useMemo(() => {
    const values = new Set(cards.map((card) => card.category))
    return [...values].sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }, [cards])

  const filteredCards = useMemo(() => {
    const normalizedKeyword = normalizeSearchKeyword(searchKeyword)
    const keywordTokens = normalizedKeyword ? normalizedKeyword.split(' ').filter(Boolean) : []

    return cards.filter((card) => {
      if (hideEmpty && card.isEmpty) {
        return false
      }

      if (selectedCategory && card.category !== selectedCategory) {
        return false
      }

      if (keywordTokens.length === 0) {
        return true
      }

      return keywordTokens.every((token) => card.searchText.includes(token))
    })
  }, [cards, hideEmpty, searchKeyword, selectedCategory])

  const hasUnsavedChanges = viewingFile !== null && editContent !== viewContent

  useEffect(() => {
    let cancelled = false

    const loadMemory = async (): Promise<void> => {
      setLoading(true)

      try {
        await refreshMemoryDashboard()
      } catch (error) {
        if (!cancelled) {
          setCards([])
          showToast(toMemoryErrorMessage(error), 'error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMemory()

    return () => {
      cancelled = true
    }
  }, [refreshMemoryDashboard, showToast])

  useEffect(() => {
    if (selectedCategory && !categories.includes(selectedCategory)) {
      setSelectedCategory(null)
    }
  }, [categories, selectedCategory])

  useEffect(() => {
    if (!viewingFile) {
      setViewMode('preview')
      setViewContent('')
      setEditContent('')
      setViewError(null)
      setViewLoading(false)
      return
    }

    let cancelled = false

    const loadViewingFile = async (): Promise<void> => {
      setViewLoading(true)
      setViewError(null)

      try {
        const content = await window.electronAPI.file.readFile(viewingFile.path)

        if (!cancelled) {
          setViewContent(content)
          setEditContent(content)
        }
      } catch (error) {
        if (!cancelled) {
          setViewContent('')
          setEditContent('')
          setViewError(toViewingErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setViewLoading(false)
        }
      }
    }

    void loadViewingFile()

    return () => {
      cancelled = true
    }
  }, [viewingFile])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()

        if (viewingFile && viewMode === 'edit' && hasUnsavedChanges) {
          void handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasUnsavedChanges, viewMode, viewingFile, editContent, viewContent])

  const handleOpenRecord = useCallback((card: ShortTermMemoryCard): void => {
    setActiveFileId(card.fileId)
    setViewingFile({
      fileId: card.fileId,
      path: card.filePath,
      title: card.title
    })
    setViewMode('preview')
  }, [])

  const handleRenameCard = useCallback(
    async (card: ShortTermMemoryCard, nextTitle: string) => {
      const result = await window.electronAPI.memory.renameEntry(memoryDir, card.filePath, nextTitle)
      await refreshMemoryDashboard()

      setViewingFile((current) =>
        current && current.path === result.oldFilePath
          ? { ...current, path: result.newFilePath, title: result.title }
          : current
      )

      return result
    },
    [memoryDir, refreshMemoryDashboard]
  )

  async function handleSave(): Promise<void> {
    if (!viewingFile || !hasUnsavedChanges) {
      return
    }

    try {
      await window.electronAPI.file.writeFile(viewingFile.path, editContent)
      setViewContent(editContent)
      showToast('对话记录已保存', 'success')
      await refreshMemoryDashboard()
    } catch (error) {
      showToast(toViewingSaveErrorMessage(error), 'error')
    }
  }

  if (viewingFile) {
    return (
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-6 py-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-border bg-surface">
          <EditorToolbar
            fileName={viewingFile.title}
            filePath={viewingFile.path}
            mode={viewMode}
            hasUnsavedChanges={hasUnsavedChanges}
            onModeChange={setViewMode}
            onBack={() => {
              setViewingFile(null)
            }}
            onSave={() => {
              void handleSave()
            }}
            onCopyPath={(path) => {
              void window.electronAPI.file.copyPath(path)
            }}
          />

          <div className="aether-scrollbar min-h-0 flex-1 overflow-y-auto">
            {viewLoading ? (
              <div className="grid min-h-[480px] place-items-center text-sm text-text-muted">
                正在读取对话记录...
              </div>
            ) : viewError ? (
              <div className="grid min-h-[480px] place-items-center px-6 text-sm text-error">
                {viewError}
              </div>
            ) : viewMode === 'edit' ? (
              <MarkdownEditor
                content={editContent}
                onChange={setEditContent}
                className="h-[calc(100vh-220px)] min-h-[480px]"
              />
            ) : (
              <div className="px-6 py-6">
                <MarkdownViewer content={editContent} filePath={viewingFile.path} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div
            className="text-[30px] font-semibold tracking-[-0.035em] text-text-primary"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Memory Center
          </div>
          <div className="mt-2 text-sm leading-6 text-text-secondary">
            用卡片管理你正在发生的上下文，让每一段对话都有名字、有摘要、可回溯。
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-1 py-1">
          <NavChip
            active={activeTab === 'long-term'}
            label="Long Memory"
            onClick={() => {
              setActiveTab('long-term')
            }}
          />
          <NavChip
            active={activeTab === 'short-term'}
            label={`Temporary Memory ${cards.length}`}
            onClick={() => {
              setActiveTab('short-term')
            }}
          />
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 pr-3">
        <div className="memory-scroll-shell h-full overflow-y-auto">
          <div className="memory-scroll-content flex min-h-full flex-col pb-6">
            {activeTab === 'long-term' ? (
              <LongTermMemory filePath={longTermFilePath} />
            ) : (
              <div className="flex min-h-full flex-1 flex-col">
                <div className="rounded-[28px] border border-border bg-surface px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-[16px] font-semibold text-text-primary">短期记忆总览</div>
                      <div className="mt-1 text-sm text-text-secondary">
                        {hideEmpty ? `${filteredCards.length} 张可用卡片` : `${cards.length} 张卡片`}
                      </div>
                    </div>

                    <div className="inline-flex items-center rounded-full border border-border bg-canvas p-0.5">
                      <SubViewButton
                        active={shortTermView === 'dashboard'}
                        label="Dashboard"
                        onClick={() => {
                          setShortTermView('dashboard')
                        }}
                      />
                      <SubViewButton
                        active={shortTermView === 'list'}
                        label="列表"
                        onClick={() => {
                          setShortTermView('list')
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[260px] flex-1">
                      <input
                        type="text"
                        aria-label="搜索短期记忆"
                        value={searchKeyword}
                        onChange={(event) => {
                          setSearchKeyword(event.target.value)
                        }}
                        placeholder="搜索标题、摘要、分类..."
                        className="h-10 w-full rounded-full border border-border bg-canvas px-4 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-accent/45"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setHideEmpty((current) => !current)
                      }}
                      className={[
                        'inline-flex h-10 items-center rounded-full border px-4 text-[12px] font-medium transition-colors duration-150',
                        hideEmpty
                          ? 'border-accent/35 bg-accent-subtle text-accent'
                          : 'border-border bg-canvas text-text-secondary hover:text-text-primary'
                      ].join(' ')}
                    >
                      {hideEmpty ? '已隐藏空记录' : '显示空记录'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <FilterPill
                      active={selectedCategory === null}
                      label={`全部 ${cards.length}`}
                      onClick={() => {
                        setSelectedCategory(null)
                      }}
                    />
                    {categories.map((category) => (
                      <FilterPill
                        key={category}
                        active={selectedCategory === category}
                        label={`${category} ${countCategoryCards(cards, category)}`}
                        onClick={() => {
                          setSelectedCategory(category)
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-6 min-h-0 flex-1">
                  {shortTermView === 'dashboard' ? (
                    <ShortTermMemoryDashboard
                      cards={filteredCards}
                      loading={loading}
                      onOpenRecord={handleOpenRecord}
                      onRename={handleRenameCard}
                    />
                  ) : (
                    <ShortTermMemory
                      entries={filteredCards}
                      loading={loading}
                      activeFileId={activeFileId}
                      onSelect={handleOpenRecord}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface NavChipProps {
  readonly active: boolean
  readonly label: string
  readonly onClick: () => void
}

function NavChip({ active, label, onClick }: NavChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-8 items-center rounded-full px-4 text-[12px] font-medium transition-colors duration-150',
        active ? 'bg-canvas text-text-primary' : 'text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >
      {label}
    </button>
  )
}

interface SubViewButtonProps {
  readonly active: boolean
  readonly label: string
  readonly onClick: () => void
}

function SubViewButton({ active, label, onClick }: SubViewButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-8 items-center rounded-full px-4 text-[12px] font-medium transition-colors duration-150',
        active
          ? 'bg-surface text-text-primary shadow-[0_1px_2px_rgba(10,10,10,0.06)]'
          : 'text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >
      {label}
    </button>
  )
}

interface FilterPillProps {
  readonly active: boolean
  readonly label: string
  readonly onClick: () => void
}

function FilterPill({ active, label, onClick }: FilterPillProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors duration-150',
        active
          ? 'border-accent/35 bg-accent-subtle text-accent'
          : 'border-border bg-canvas text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function countCategoryCards(cards: readonly ShortTermMemoryCard[], category: string): number {
  return cards.filter((card) => card.category === category).length
}

function toMemoryErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '扫描对话记录失败'
  return `记忆加载失败: ${detail}`
}

function toViewingErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '读取对话记录失败'
  return `无法读取对话记录: ${detail}`
}

function toViewingSaveErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '保存对话记录失败'
  return `保存失败: ${detail}`
}

function normalizeSearchKeyword(value: string): string {
  return value
    .toLowerCase()
    .replace(/[，。、“”‘’：；！？,.!?:;()[\]{}\\/|'"`~@#$%^&*=+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
