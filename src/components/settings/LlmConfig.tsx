import { useEffect, useRef, useState } from 'react'

import { useToast } from '../shared/Toast'
import type { LlmProviderConfig } from '../../types/config'

interface LlmConfigProps {
  readonly providers: readonly LlmProviderConfig[]
  readonly onProvidersChanged: (providers: readonly LlmProviderConfig[]) => void
}

interface ProviderFormState {
  readonly name: string
  readonly endpoint: string
  readonly apiKey: string
  readonly model: string
  readonly maxTokens: string
}

interface ConnectionFeedback {
  readonly tone: 'success' | 'error'
  readonly message: string
}

interface ProviderRowProps {
  readonly provider: LlmProviderConfig
  readonly feedback?: ConnectionFeedback
  readonly status?: 'connected' | 'failed'
  readonly disabled: boolean
  readonly isRemoving: boolean
  readonly isTesting: boolean
  readonly onRemove: (id: string) => void
  readonly onTest: (provider: LlmProviderConfig) => void
}

interface ProviderFormProps {
  readonly form: ProviderFormState
  readonly isSaving: boolean
  readonly isApiKeyVisible: boolean
  readonly onApplyPreset: (preset: PresetConfig) => void
  readonly onChange: (field: keyof ProviderFormState, value: string) => void
  readonly onCancel: () => void
  readonly onSave: () => void
  readonly onToggleApiKeyVisibility: () => void
}

interface TextFieldProps {
  readonly label: string
  readonly value: string
  readonly placeholder?: string
  readonly type?: 'text' | 'password' | 'number'
  readonly min?: number
  readonly onChange: (value: string) => void
  readonly trailing?: React.JSX.Element
}

interface PresetConfig {
  readonly label: string
  readonly endpoint: string
  readonly model: string
}

const PRESETS: readonly PresetConfig[] = [
  {
    label: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode',
    model: 'qwen-plus'
  },
  {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-chat'
  },
  {
    label: 'Moonshot',
    endpoint: 'https://api.moonshot.cn',
    model: 'moonshot-v1-8k'
  },
  {
    label: 'Ollama 本地',
    endpoint: 'http://localhost:11434',
    model: 'qwen2.5:14b'
  }
]

const INPUT_FRAME_CLASS =
  'flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 transition-colors duration-150 focus-within:border-accent'
const INPUT_CLASS =
  'h-9 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted'

export function LlmConfig({
  providers,
  onProvidersChanged
}: LlmConfigProps): React.JSX.Element {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProviderFormState>(createInitialForm())
  const [feedbackById, setFeedbackById] = useState<Record<string, ConnectionFeedback>>({})
  const [statusById, setStatusById] = useState<Record<string, 'connected' | 'failed'>>({})
  const feedbackTimers = useRef<Record<string, number>>({})
  const { showToast } = useToast()

  useEffect(() => () => clearFeedbackTimers(feedbackTimers.current), [])

  const handleCancel = (): void => {
    setIsFormOpen(false)
    setIsApiKeyVisible(false)
    setForm(createInitialForm())
  }

  const handleSave = (): void => {
    void saveProvider({
      form,
      isSaving,
      onProvidersChanged,
      onReset: handleCancel,
      setIsSaving,
      showToast
    })
  }

  const handleRemove = (id: string): void => {
    void removeProvider({
      id,
      isBusy: isSaving || removingId !== null || testingId !== null,
      onProvidersChanged,
      setFeedbackById,
      setRemovingId,
      showToast,
      timers: feedbackTimers.current
    })
  }

  const handleTest = (provider: LlmProviderConfig): void => {
    void testProvider({
      provider,
      isBusy: isSaving || removingId !== null || testingId !== null,
      setFeedbackById,
      setStatusById,
      setTestingId,
      timers: feedbackTimers.current
    })
  }

  return (
    <div>
      <ProvidersList
        providers={providers}
        feedbackById={feedbackById}
        statusById={statusById}
        isBusy={isSaving || removingId !== null || testingId !== null}
        removingId={removingId}
        testingId={testingId}
        onRemove={handleRemove}
        onTest={handleTest}
      />
      <div className="mt-3">
        {isFormOpen ? (
          <ProviderForm
            form={form}
            isSaving={isSaving}
            isApiKeyVisible={isApiKeyVisible}
            onApplyPreset={(preset) => {
              setForm(toPresetForm(preset))
            }}
            onChange={(field, value) => {
              setForm((current) => ({ ...current, [field]: value }))
            }}
            onCancel={handleCancel}
            onSave={handleSave}
            onToggleApiKeyVisibility={() => {
              setIsApiKeyVisible((current) => !current)
            }}
          />
        ) : (
          <AddButton
            onClick={() => {
              setIsFormOpen(true)
            }}
          />
        )}
      </div>
    </div>
  )
}

function ProvidersList({
  providers,
  feedbackById,
  statusById,
  isBusy,
  removingId,
  testingId,
  onRemove,
  onTest
}: {
  readonly providers: readonly LlmProviderConfig[]
  readonly feedbackById: Record<string, ConnectionFeedback>
  readonly statusById: Record<string, 'connected' | 'failed'>
  readonly isBusy: boolean
  readonly removingId: string | null
  readonly testingId: string | null
  readonly onRemove: (id: string) => void
  readonly onTest: (provider: LlmProviderConfig) => void
}): React.JSX.Element {
  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center">
        <div className="text-sm text-text-muted">还没有添加 AI 模型</div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="divide-y divide-border">
        {providers.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            feedback={feedbackById[provider.id]}
            status={statusById[provider.id]}
            disabled={isBusy}
            isRemoving={removingId === provider.id}
            isTesting={testingId === provider.id}
            onRemove={onRemove}
            onTest={onTest}
          />
        ))}
      </div>
    </div>
  )
}

function ProviderRow({
  provider,
  feedback,
  status,
  disabled,
  isRemoving,
  isTesting,
  onRemove,
  onTest
}: ProviderRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusDot status={status} />
          <div className="text-sm font-medium text-text-primary">{provider.name}</div>
          <span className="inline-flex h-6 items-center rounded-full border border-border bg-canvas px-2.5 text-[11px] font-medium text-text-secondary">
            {provider.model}
          </span>
        </div>
        <div className="mt-1 max-w-[420px] truncate text-xs text-text-muted" title={provider.endpoint}>
          {provider.endpoint}
        </div>
        <div className="mt-2 text-xs text-text-secondary">
          API Key：{provider.apiKey.trim() ? '已配置' : '未配置'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onTest(provider)
          }}
          className="inline-flex h-9 items-center rounded-full border border-border bg-canvas px-4 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-hover focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isTesting ? '测试中...' : '测试连通'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onRemove(provider.id)
          }}
          className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-error focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRemoving ? '删除中...' : '删除'}
        </button>
        {feedback ? <ConnectionHint feedback={feedback} /> : null}
      </div>
    </div>
  )
}

function ProviderForm({
  form,
  isSaving,
  isApiKeyVisible,
  onApplyPreset,
  onChange,
  onCancel,
  onSave,
  onToggleApiKeyVisibility
}: ProviderFormProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              onApplyPreset(preset)
            }}
            className="rounded-full border border-border bg-canvas px-3 py-1 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <TextField
          label="名称"
          value={form.name}
          placeholder='如 "千问"'
          onChange={(value) => {
            onChange('name', value)
          }}
        />
        <TextField
          label="模型名"
          value={form.model}
          placeholder='如 "qwen-plus"'
          onChange={(value) => {
            onChange('model', value)
          }}
        />
        <div className="md:col-span-2">
          <TextField
            label="Endpoint URL"
            value={form.endpoint}
            placeholder="https://api.example.com"
            onChange={(value) => {
              onChange('endpoint', value)
            }}
          />
        </div>
        <div className="md:col-span-2">
          <TextField
            label="API Key"
            value={form.apiKey}
            type={isApiKeyVisible ? 'text' : 'password'}
            placeholder={isApiKeyOptional(form.endpoint) ? '本地模型可留空' : '请输入 API Key'}
            trailing={
              <button
                type="button"
                onClick={onToggleApiKeyVisibility}
                className="shrink-0 rounded-md px-2 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
              >
                {isApiKeyVisible ? '隐藏' : '显示'}
              </button>
            }
            onChange={(value) => {
              onChange('apiKey', value)
            }}
          />
        </div>
        <TextField
          label="最大 Token"
          value={form.maxTokens}
          type="number"
          min={1}
          onChange={(value) => {
            onChange('maxTokens', value)
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-text-muted">
          OpenAI 兼容接口默认走 `/v1/chat/completions`，Ollama 本地可不填 API Key。
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="inline-flex h-9 items-center rounded-full border border-accent bg-accent px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  type = 'text',
  min,
  onChange,
  trailing
}: TextFieldProps): React.JSX.Element {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-text-secondary">{label}</div>
      <div className={INPUT_FRAME_CLASS}>
        <input
          type={type}
          min={min}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          className={INPUT_CLASS}
        />
        {trailing}
      </div>
    </label>
  )
}

function StatusDot({ status }: { readonly status?: 'connected' | 'failed' }): React.JSX.Element {
  if (status === 'connected') {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
      </span>
    )
  }

  if (status === 'failed') {
    return <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-error" />
  }

  return <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-border" />
}

function ConnectionHint({ feedback }: { readonly feedback: ConnectionFeedback }): React.JSX.Element {
  const className =
    feedback.tone === 'success'
      ? 'inline-flex items-center gap-1 text-sm text-success'
      : 'text-sm text-error'

  return <span className={className}>{feedback.tone === 'success' ? '✓ ' : ''}{feedback.message}</span>
}

function AddButton({ onClick }: { readonly onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-dashed border-border py-3 text-center text-sm text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
    >
      + 添加 AI 模型
    </button>
  )
}

async function saveProvider({
  form,
  isSaving,
  onProvidersChanged,
  onReset,
  setIsSaving,
  showToast
}: {
  readonly form: ProviderFormState
  readonly isSaving: boolean
  readonly onProvidersChanged: (providers: readonly LlmProviderConfig[]) => void
  readonly onReset: () => void
  readonly setIsSaving: React.Dispatch<React.SetStateAction<boolean>>
  readonly showToast: (message: string, tone: 'success' | 'error') => void
}): Promise<void> {
  const errorMessage = validateForm(form)

  if (isSaving || errorMessage) {
    if (errorMessage) {
      showToast(errorMessage, 'error')
    }

    return
  }

  try {
    setIsSaving(true)
    const nextConfig = await window.electronAPI.config.addLlmProvider(toProviderInput(form))
    onProvidersChanged(nextConfig.llm)
    onReset()
    showToast('AI 模型已添加', 'success')
  } catch (error) {
    showToast(toErrorMessage(error, '保存供应商失败'), 'error')
  } finally {
    setIsSaving(false)
  }
}

async function removeProvider({
  id,
  isBusy,
  onProvidersChanged,
  setFeedbackById,
  setRemovingId,
  showToast,
  timers
}: {
  readonly id: string
  readonly isBusy: boolean
  readonly onProvidersChanged: (providers: readonly LlmProviderConfig[]) => void
  readonly setFeedbackById: React.Dispatch<
    React.SetStateAction<Record<string, ConnectionFeedback>>
  >
  readonly setRemovingId: React.Dispatch<React.SetStateAction<string | null>>
  readonly showToast: (message: string, tone: 'success' | 'error') => void
  readonly timers: Record<string, number>
}): Promise<void> {
  if (isBusy) {
    return
  }

  try {
    setRemovingId(id)
    const nextConfig = await window.electronAPI.config.removeLlmProvider(id)
    clearFeedbackTimer(timers, id)
    setFeedbackById((current) => omitFeedback(current, id))
    onProvidersChanged(nextConfig.llm)
    showToast('AI 模型已删除', 'success')
  } catch (error) {
    showToast(toErrorMessage(error, '删除供应商失败'), 'error')
  } finally {
    setRemovingId(null)
  }
}

async function testProvider({
  provider,
  isBusy,
  setFeedbackById,
  setStatusById,
  setTestingId,
  timers
}: {
  readonly provider: LlmProviderConfig
  readonly isBusy: boolean
  readonly setFeedbackById: React.Dispatch<
    React.SetStateAction<Record<string, ConnectionFeedback>>
  >
  readonly setStatusById: React.Dispatch<
    React.SetStateAction<Record<string, 'connected' | 'failed'>>
  >
  readonly setTestingId: React.Dispatch<React.SetStateAction<string | null>>
  readonly timers: Record<string, number>
}): Promise<void> {
  if (isBusy) {
    return
  }

  try {
    setTestingId(provider.id)
    clearFeedbackTimer(timers, provider.id)
    setFeedbackById((current) => omitFeedback(current, provider.id))

    const apiKey = await window.electronAPI.config.getApiKey(provider.id)
    if (!apiKey?.trim() && !isApiKeyOptional(provider.endpoint)) {
      setErrorFeedback(provider.id, '请先配置 API Key', setFeedbackById)
      return
    }

    const result = await window.electronAPI.llm.testConnection(provider.id)
    if (result.success) {
      setStatusById((prev) => ({ ...prev, [provider.id]: 'connected' }))
      setSuccessFeedback(provider.id, timers, setFeedbackById)
      return
    }

    setStatusById((prev) => ({ ...prev, [provider.id]: 'failed' }))
    setErrorFeedback(provider.id, result.error || '连接失败', setFeedbackById)
  } catch (error) {
    setStatusById((prev) => ({ ...prev, [provider.id]: 'failed' }))
    setErrorFeedback(provider.id, toErrorMessage(error, '连接失败'), setFeedbackById)
  } finally {
    setTestingId(null)
  }
}

function createInitialForm(): ProviderFormState {
  return {
    name: '',
    endpoint: '',
    apiKey: '',
    model: '',
    maxTokens: '2048'
  }
}

function toPresetForm(preset: PresetConfig): ProviderFormState {
  return {
    ...createInitialForm(),
    name: preset.label,
    endpoint: preset.endpoint,
    model: preset.model
  }
}

function toProviderInput(form: ProviderFormState): Omit<LlmProviderConfig, 'id'> {
  return {
    name: form.name.trim(),
    provider: 'openai-compatible',
    endpoint: form.endpoint.trim(),
    apiKey: form.apiKey.trim(),
    model: form.model.trim(),
    maxTokens: Number(form.maxTokens)
  }
}

function validateForm(form: ProviderFormState): string | null {
  if (!form.name.trim() || !form.endpoint.trim() || !form.model.trim()) {
    return '请填写名称、Endpoint 和模型名'
  }

  if (!/^\d+$/.test(form.maxTokens.trim()) || Number(form.maxTokens) <= 0) {
    return '最大 Token 需要是大于 0 的整数'
  }

  if (!form.apiKey.trim() && !isApiKeyOptional(form.endpoint)) {
    return '请填写 API Key，本地 Ollama 可留空'
  }

  return null
}

function isApiKeyOptional(endpoint: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(new URL(endpoint).hostname)
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(endpoint)
  }
}

function setSuccessFeedback(
  id: string,
  timers: Record<string, number>,
  setFeedbackById: React.Dispatch<React.SetStateAction<Record<string, ConnectionFeedback>>>
): void {
  setFeedbackById((current) => ({
    ...current,
    [id]: { tone: 'success', message: '连接成功' }
  }))

  timers[id] = window.setTimeout(() => {
    setFeedbackById((current) => omitFeedback(current, id))
    delete timers[id]
  }, 2000)
}

function setErrorFeedback(
  id: string,
  message: string,
  setFeedbackById: React.Dispatch<React.SetStateAction<Record<string, ConnectionFeedback>>>
): void {
  setFeedbackById((current) => ({
    ...current,
    [id]: { tone: 'error', message }
  }))
}

function clearFeedbackTimers(timers: Record<string, number>): void {
  Object.values(timers).forEach((timerId) => {
    window.clearTimeout(timerId)
  })
}

function clearFeedbackTimer(timers: Record<string, number>, id: string): void {
  const timerId = timers[id]

  if (timerId) {
    window.clearTimeout(timerId)
    delete timers[id]
  }
}

function omitFeedback(
  feedbackById: Record<string, ConnectionFeedback>,
  id: string
): Record<string, ConnectionFeedback> {
  const next = { ...feedbackById }
  delete next[id]
  return next
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
