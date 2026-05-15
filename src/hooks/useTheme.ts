import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'aether:theme'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readStoredTheme(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isThemeMode(raw) ? raw : 'system'
  } catch {
    return 'system'
  }
}

function writeStoredTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // storage unavailable — ignore
  }
}

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement

  if (mode === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = mode
  }
}

/**
 * Apply the user's stored theme before React mounts to prevent a flash
 * of the wrong color scheme. Called from main.tsx at module load.
 */
export function applyStoredTheme(): void {
  applyTheme(readStoredTheme())
}

interface UseThemeResult {
  readonly theme: ThemeMode
  readonly setTheme: (mode: ThemeMode) => void
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    writeStoredTheme(theme)
  }, [theme])

  const setTheme = useCallback((mode: ThemeMode): void => {
    setThemeState(mode)
  }, [])

  return { theme, setTheme }
}
