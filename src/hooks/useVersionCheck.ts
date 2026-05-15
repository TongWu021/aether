import { useEffect, useState } from 'react'

interface VersionState {
  readonly latestVersion: string | null
  readonly currentVersion: string | null
  readonly releaseUrl: string | null
  readonly hasUpdate: boolean
}

const INITIAL_DELAY_MS = 3000
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export function useVersionCheck(): VersionState {
  const [state, setState] = useState<VersionState>({
    latestVersion: null,
    currentVersion: null,
    releaseUrl: null,
    hasUpdate: false
  })

  useEffect(() => {
    let cancelled = false

    const runCheck = async (): Promise<void> => {
      try {
        const result = await window.electronAPI.version.checkLatest()
        if (cancelled || !result.success) return
        setState({
          latestVersion: result.data.latestVersion,
          currentVersion: result.data.currentVersion,
          releaseUrl: result.data.releaseUrl,
          hasUpdate: result.data.hasUpdate
        })
      } catch {
        // Silently swallow — banner just stays hidden if check fails
      }
    }

    const initialTimer = setTimeout(runCheck, INITIAL_DELAY_MS)
    const intervalTimer = setInterval(runCheck, RECHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      clearTimeout(initialTimer)
      clearInterval(intervalTimer)
    }
  }, [])

  return state
}
