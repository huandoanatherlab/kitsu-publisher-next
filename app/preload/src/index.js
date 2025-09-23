import { contextBridge, ipcRenderer } from 'electron'
import { readFileSync, existsSync, statSync, readdirSync } from 'fs'
import { join, basename } from 'path'
const io = require('socket.io-client')

import { store, config } from './../../main/src/store'

let socketio = null

const apiKey = 'electron'
/**
 * @see https://github.com/electron/electron/issues/21437#issuecomment-573522360
 */
const api = {
  store: {
    get: (key) => {
      return store.get(key)
    },
    set: (key, value) => {
      return store.set(key, value)
    },
    delete: (key) => {
      return store.delete(key)
    }
  },
  config: {
    get: (key) => {
      return config.get(key)
    },
    set: (key, value) => {
      return config.set(key, value)
    },
    delete: (key) => {
      return config.delete(key)
    }
  },
  file: {
    readFileSync: (filepath) => {
      return readFileSync(filepath)
    },
    existsSync: (filepath) => {
      return existsSync(filepath)
    },
    statSync: (filepath) => {
      return statSync(filepath)
    },
    waitForFile: async (filepath, maxRetries = 10, delay = 500) => {
      for (let i = 0; i < maxRetries; i++) {
        if (existsSync(filepath)) {
          const stats = statSync(filepath)
          // Check if file has content (size > 0)
          if (stats.size > 0) {
            return true
          }
        }
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      return false
    },
    findFileByName: (filename, searchPaths = []) => {
      const defaultSearchPaths = [
        join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Unreal Projects'),
        join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Unreal Projects', 'TestKitsu', 'Saved', 'Screenshots'),
        join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Unreal Projects', 'TestKitsu', 'Saved', 'Screenshots', 'WindowsEditor')
      ]
      
      const allSearchPaths = [...defaultSearchPaths, ...searchPaths]
      
      for (const searchPath of allSearchPaths) {
        try {
          if (existsSync(searchPath)) {
            const files = readdirSync(searchPath, { recursive: true })
            for (const file of files) {
              if (basename(file) === filename) {
                const fullPath = join(searchPath, file)
                if (existsSync(fullPath)) {
                  const stats = statSync(fullPath)
                  if (stats.size > 0) {
                    return fullPath
                  }
                }
              }
            }
          }
        } catch (error) {
          // Continue searching if this path fails
          continue
        }
      }
      return null
    }
  },
  openDialog: (options) => {
    return ipcRenderer.invoke('open-dialog:show', options)
  },
  launchCommandBeforeExport: (command, variables) => {
    return ipcRenderer.invoke('launch-command:post-exports', command, variables)
  },
  toggleDarkTheme: () => {
    return ipcRenderer.invoke('dark-theme:toggle')
  },
  socketio: {
    create: () => {
      socketio = io(`${store.get('login.server')}/events`, {
        transportOptions: {
          polling: {
            extraHeaders: {
              Authorization: `Bearer ${store.get('login.access_token')}`,
              'User-Agent': `Kitsu publisher ${config.get('appVersion')}`
            }
          }
        }
      })
    },
    destroy: () => {
      if (socketio !== null) {
        socketio.disconnect()
      }
      socketio = null
    },
    on: (event, fun) => {
      if (socketio !== null) {
        socketio.on(event, fun)
      }
    },
    off: (event, fun) => {
      if (socketio !== null) {
        socketio.off(event, fun)
      }
    },
    connect: () => {
      if (socketio !== null) {
        socketio.connect()
      }
    },
    disconnect: () => {
      if (socketio !== null) {
        socketio.disconnect()
      }
    }
  },
  ipcRenderer: {
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
    },
    removeListener: (channel, listener) => {
      ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel)
    }
  }
}

/**
 * The "Main World" is the JavaScript context that your main renderer code runs in.
 * By default, the page you load in your renderer executes code in this world.
 *
 * @see https://www.electronjs.org/docs/api/context-bridge
 */
contextBridge.exposeInMainWorld(apiKey, api)
