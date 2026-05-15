import { useState } from 'react'

import { useVersionCheck } from '../../hooks/useVersionCheck'
import { useToast } from './Toast'

const INSTALL_COMMAND =
  'bash <(curl -fsSL https://raw.githubusercontent.com/TongWu021/aether/main/install.sh)'

const DISMISSED_KEY = 'aether.updateBanner.dismissedVersion'

export function UpdateBanner(): React.JSX.Element | null {
  const { hasUpdate, latestVersion, releaseUrl } = useVersionCheck()
  const { showToast } = useToast()
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(DISMISSED_KEY)
    } catch {
      return null
    }
  })

  if (!hasUpdate || !latestVersion) return null
  if (dismissedVersion === latestVersion) return null

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND)
      showToast('安装命令已复制，粘贴给 Codex 让它跑一下', 'success')
    } catch {
      showToast('复制失败，请手动选中命令', 'error')
    }
  }

  const handleDismiss = (): void => {
    setDismissedVersion(latestVersion)
    try {
      window.localStorage.setItem(DISMISSED_KEY, latestVersion)
    } catch {
      // ignore storage failures
    }
  }

  const handleOpenRelease = (): void => {
    if (!releaseUrl) return
    window.open(releaseUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-accent-subtle/40 px-4 py-2 text-xs text-text-primary">
      <span className="font-medium">🚀 新版本 v{latestVersion} 可用</span>
      <span className="hidden text-text-secondary sm:inline">
        让 Codex 跑一下这条命令即可更新：
      </span>
      <code
        className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-text-secondary"
        title={INSTALL_COMMAND}
      >
        {INSTALL_COMMAND}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-primary transition hover:bg-accent-subtle"
      >
        复制命令
      </button>
      {releaseUrl ? (
        <button
          type="button"
          onClick={handleOpenRelease}
          className="rounded px-2 py-1 text-[11px] text-text-secondary transition hover:text-text-primary"
        >
          查看更新内容
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleDismiss}
        className="rounded px-2 py-1 text-[11px] text-text-secondary transition hover:text-text-primary"
        aria-label="忽略此版本"
      >
        ✕
      </button>
    </div>
  )
}
