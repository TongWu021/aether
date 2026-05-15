import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/jetbrains-mono'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'
import { applyStoredTheme } from './hooks/useTheme'

// Apply stored theme before React mounts to prevent a flash of the wrong color scheme.
applyStoredTheme()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
