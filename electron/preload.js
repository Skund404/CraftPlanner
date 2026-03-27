/**
 * CraftPlanner — Electron preload script.
 *
 * Exposes a minimal API to the renderer process via contextBridge.
 * The renderer (React app) can use window.craftplanner to detect
 * the Electron environment and access platform info.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('craftplanner', {
  isElectron: true,
  platform: process.platform,
  version: require('./package.json').version,
  arch: process.arch,
})
