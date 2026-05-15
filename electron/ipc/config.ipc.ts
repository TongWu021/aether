import { app, ipcMain, safeStorage } from 'electron'

import type { CockpitConfig, LlmProviderConfig, WorkspaceConfig } from '../../src/types/config'
import { chatWithDocument } from '../services/ai-chat'
import { ConfigStore } from '../services/config-store'

let configStore: ConfigStore | null = null

function getConfigStore(): ConfigStore {
  if (!configStore) {
    configStore = new ConfigStore({
      dataDir: app.getPath('userData'),
      encrypt: (plainText: string) => {
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.encryptString(plainText).toString('base64')
        }

        return plainText
      },
      decrypt: (encrypted: string) => {
        if (safeStorage.isEncryptionAvailable()) {
          try {
            return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
          } catch {
            return encrypted
          }
        }

        return encrypted
      }
    })
  }

  return configStore
}

export function registerConfigIpc(): void {
  ipcMain.handle('config:load', async () => {
    return getConfigStore().load()
  })

  ipcMain.handle('config:get', () => {
    return getConfigStore().get()
  })

  ipcMain.handle('config:save', async (_event, config: CockpitConfig) => {
    await getConfigStore().save(config)
    return true
  })

  ipcMain.handle('config:add-workspace', async (_event, workspace: Omit<WorkspaceConfig, 'id'>) => {
    return getConfigStore().addWorkspace(workspace)
  })

  ipcMain.handle('config:remove-workspace', async (_event, id: string) => {
    return getConfigStore().removeWorkspace(id)
  })

  ipcMain.handle('config:add-llm-provider', async (_event, provider: Omit<LlmProviderConfig, 'id'>) => {
    return getConfigStore().addLlmProvider(provider)
  })

  ipcMain.handle('config:remove-llm-provider', async (_event, id: string) => {
    return getConfigStore().removeLlmProvider(id)
  })

  ipcMain.handle('config:get-api-key', async (_event, providerId: string) => {
    return getConfigStore().getDecryptedApiKey(providerId)
  })

  ipcMain.handle('llm:test-connection', async (_event, providerId: string) => {
    const store = getConfigStore()
    const config = await store.load()
    const providerConfig = config.llm.find((provider) => provider.id === providerId)

    if (!providerConfig) {
      return {
        success: false,
        data: false,
        error: '找不到该供应商配置'
      }
    }

    const decryptedKey = store.getDecryptedApiKey(providerId)
    const adapterConfig: LlmProviderConfig = {
      ...providerConfig,
      apiKey: decryptedKey ?? ''
    }
    const { createLlmAdapter } = await import('../services/llm-adapter')
    const adapter = createLlmAdapter(adapterConfig)

    return adapter.testConnection()
  })

  ipcMain.handle(
    'ai:chat',
    async (
      _event,
      documentContent: string,
      question: string,
      history: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[]
    ) => {
      const store = getConfigStore()
      const config = await store.load()
      const provider = config.llm[0]

      if (!provider) {
        return {
          success: false,
          answer: '',
          error: '未配置 AI 模型，请先在设置中添加'
        }
      }

      const decryptedKey = store.getDecryptedApiKey(provider.id) ?? ''
      return chatWithDocument(documentContent, question, history, provider, decryptedKey)
    }
  )
}

export { getConfigStore }
