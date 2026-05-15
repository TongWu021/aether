import { app, BrowserWindow, nativeImage, net, protocol } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { registerAnnotationIpc } from './ipc/annotation.ipc'
import { registerConfigIpc } from './ipc/config.ipc'
import { registerContextIpc } from './ipc/context.ipc'
import { registerExcelIpc } from './ipc/excel.ipc'
import { registerFileIpc } from './ipc/file.ipc'
import { registerMemoryIpc } from './ipc/memory.ipc'
import { registerMemoIpc } from './ipc/memo.ipc'
import { initAnnotationStore } from './services/annotation-store'
import { initMemoStore } from './services/memo-store'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-resource',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  window.once('ready-to-show', () => {
    window.show()
    window.focus()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('Renderer failed to load:', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })
    }
  )

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details)
  })

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  mainWindow = window
  return window
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

app.whenReady().then(() => {
  protocol.handle('local-resource', (request) => {
    let filePath: string

    try {
      const url = new URL(request.url)
      filePath = decodeURIComponent(url.pathname)
    } catch {
      filePath = decodeURIComponent(request.url.replace('local-resource://', ''))
    }

    return net.fetch(pathToFileURL(filePath).href)
  })

  const iconPath = join(__dirname, '../../resources/icon.png')
  if (process.platform === 'darwin') {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath))
  }

  initAnnotationStore(join(app.getPath('userData'), 'annotations'))
  initMemoStore(join(app.getPath('userData'), 'memos'))
  registerAnnotationIpc()
  registerFileIpc()
  registerConfigIpc()
  registerContextIpc()
  registerMemoryIpc()
  registerMemoIpc()
  registerExcelIpc()
  showMainWindow()

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
