import { useEffect, useState } from 'react'

import { LlmConfig } from './LlmConfig'
import { ThemeToggle } from './ThemeToggle'
import { useToast } from '../shared/Toast'
import type { CockpitConfig, WorkspaceConfig } from '../../types/config'
import { getWorkspaceNameFromPath } from '../../utils/format'

interface SettingsPanelProps {
  readonly onWorkspaceChanged?: () => void
}

export function SettingsPanel({ onWorkspaceChanged }: SettingsPanelProps): React.JSX.Element {
  const [config, setConfig] = useState<CockpitConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false

    const loadConfig = async (): Promise<void> => {
      try {
        const config = await window.electronAPI.config.load()

        if (!cancelled) {
          setConfig(config)
          setWorkspaces(config.workspaces)
        }
      } catch (error) {
        if (!cancelled) {
          showToast(toConfigErrorMessage(error, '加载设置失败'), 'error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [showToast])

  const handleAddWorkspace = async (): Promise<void> => {
    if (submitting) {
      return
    }

    try {
      setSubmitting(true)

      const selectedPath = await window.electronAPI.file.selectDirectory()

      if (!selectedPath) {
        return
      }

      const nextConfig = await window.electronAPI.config.addWorkspace({
        name: getWorkspaceNameFromPath(selectedPath),
        path: selectedPath
      })

      setConfig(nextConfig)
      setWorkspaces(nextConfig.workspaces)
      onWorkspaceChanged?.()
      showToast('工作区已添加', 'success')
    } catch (error) {
      showToast(toConfigErrorMessage(error, '添加工作区失败'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveWorkspace = async (id: string): Promise<void> => {
    if (submitting) {
      return
    }

    try {
      setSubmitting(true)

      const nextConfig = await window.electronAPI.config.removeWorkspace(id)
      setConfig(nextConfig)
      setWorkspaces(nextConfig.workspaces)
      onWorkspaceChanged?.()
      showToast('工作区已删除', 'success')
    } catch (error) {
      showToast(toConfigErrorMessage(error, '删除工作区失败'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectShortTermMemoryDir = async (): Promise<void> => {
    if (submitting || !config) {
      return
    }

    try {
      setSubmitting(true)

      const selectedPath = await window.electronAPI.file.selectDirectory()

      if (!selectedPath) {
        return
      }

      const nextConfig: CockpitConfig = {
        ...config,
        memory: {
          ...config.memory,
          shortTermDir: selectedPath
        }
      }

      await window.electronAPI.config.save(nextConfig)
      setConfig(nextConfig)
      onWorkspaceChanged?.()
      showToast('短期记忆目录已更新', 'success')
    } catch (error) {
      showToast(toConfigErrorMessage(error, '更新短期记忆目录失败'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearShortTermMemoryDir = async (): Promise<void> => {
    if (submitting || !config) {
      return
    }

    try {
      setSubmitting(true)

      const nextConfig: CockpitConfig = {
        ...config,
        memory: {
          ...config.memory,
          shortTermDir: ''
        }
      }

      await window.electronAPI.config.save(nextConfig)
      setConfig(nextConfig)
      onWorkspaceChanged?.()
      showToast('短期记忆目录已清空', 'success')
    } catch (error) {
      showToast(toConfigErrorMessage(error, '清空短期记忆目录失败'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header>
        <div className="text-2xl font-semibold text-text-primary">设置</div>
      </header>

      <section className="mt-8">
        <div className="mb-2 text-base font-medium text-text-primary">工作区</div>
        <div className="mb-4 text-sm text-text-secondary">管理你的工作文件夹</div>

        {loading ? (
          <div className="grid min-h-32 place-items-center rounded-lg border border-border bg-surface px-4 py-6 text-sm text-text-muted">
            正在加载工作区...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center">
            <div className="text-sm text-text-muted">还没有添加工作区</div>
            <button
              type="button"
              onClick={() => {
                void handleAddWorkspace()
              }}
              disabled={submitting}
              className="mt-4 w-full rounded-lg border border-dashed border-border py-3 text-center text-sm text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              + 添加工作区
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="divide-y divide-border">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-base">📁</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary">
                          {workspace.name}
                        </div>
                        <div
                          className="max-w-[300px] truncate text-xs text-text-muted"
                          title={workspace.path}
                        >
                          {workspace.path}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveWorkspace(workspace.id)
                      }}
                      disabled={submitting}
                      className="shrink-0 rounded-lg p-1 text-text-muted transition-colors duration-150 hover:text-error focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`删除工作区 ${workspace.name}`}
                      title={`删除工作区 ${workspace.name}`}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleAddWorkspace()
              }}
              disabled={submitting}
              className="mt-3 w-full rounded-lg border border-dashed border-border py-3 text-center text-sm text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              + 添加工作区
            </button>
          </>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-2 text-base font-medium text-text-primary">记忆</div>
        <div className="mb-4 text-sm text-text-secondary">
          配置短期记忆目录后，记忆 Tab 会直接读取该文件夹里的对话记录和摘要。
        </div>

        <div className="rounded-[20px] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-primary">短期记忆目录</div>
              <div
                className="mt-2 break-all text-sm leading-6 text-text-secondary"
                title={config?.memory.shortTermDir || '未配置'}
              >
                {config?.memory.shortTermDir || '未配置'}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleSelectShortTermMemoryDir()
                }}
                disabled={submitting || loading}
                className="inline-flex h-9 items-center rounded-full border border-border bg-canvas px-4 text-sm font-medium text-text-primary transition-colors duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                选择目录
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleClearShortTermMemoryDir()
                }}
                disabled={submitting || loading || !config?.memory.shortTermDir}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                清空
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-2 text-base font-medium text-text-primary">AI 模型</div>
        <div className="mb-4 text-sm text-text-secondary">
          配置 LLM 供应商，用于 PRD 审查、自动标签等 AI 功能。支持通义千问、DeepSeek、Moonshot 等 OpenAI 兼容接口。
        </div>
        <LlmConfig
          providers={config?.llm ?? []}
          onProvidersChanged={(providers) => {
            if (config) {
              setConfig({ ...config, llm: providers })
            }
          }}
        />
      </section>

      <section className="mt-10 mb-4">
        <div className="mb-2 text-base font-medium text-text-primary">外观</div>
        <div className="mb-4 text-sm text-text-secondary">
          选择界面主题。跟随系统会自动匹配 macOS 的外观设置。
        </div>
        <ThemeToggle />
      </section>
    </div>
  )
}

function toConfigErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`
  }

  return fallback
}
