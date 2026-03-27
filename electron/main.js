/**
 * CraftPlanner — Electron main process.
 *
 * Startup sequence:
 *   1. Ensure data directory exists (~/.craftplanner/)
 *   2. Spawn the Go core binary (headless catalogue engine)
 *   3. Spawn the Python shell backend (FastAPI + module)
 *   4. Wait for the shell HTTP server to be ready
 *   5. Open the BrowserWindow
 *
 * Shutdown:
 *   - SIGTERM child processes, wait up to 5s, then SIGKILL
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron')
const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const net = require('net')

let mainWindow = null
let coreProcess = null
let shellProcess = null
let tray = null
let isQuitting = false

const CORE_PORT = 8420
const SHELL_PORT = 3000

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function getCraftPlannerHome() {
  return process.env.CRAFTPLANNER_HOME ||
    path.join(app.getPath('home'), '.craftplanner')
}

function getDataDir() {
  return process.env.CRAFTPLANNER_DATA_DIR ||
    path.join(getCraftPlannerHome(), 'data')
}

function getCoreBinaryPath() {
  if (app.isPackaged) {
    const name = process.platform === 'win32' ? 'craftplanner-core.exe' : 'craftplanner-core'
    return path.join(process.resourcesPath, 'core', name)
  }
  return path.join(__dirname, '..', 'core', 'craftplanner-core')
}

function getShellDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'shell')
  }
  return path.join(__dirname, '..', 'shell')
}

// ---------------------------------------------------------------------------
// First-run setup
// ---------------------------------------------------------------------------

function ensureDirectories() {
  const home = getCraftPlannerHome()
  const dataDir = getDataDir()
  const dirs = [
    home,
    dataDir,
    path.join(home, 'logs'),
    path.join(home, 'backups'),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  // Init git repo in data dir if not already a repo
  const gitDir = path.join(dataDir, '.git')
  if (!fs.existsSync(gitDir)) {
    try {
      execSync('git init', { cwd: dataDir, stdio: 'ignore' })
      // Create initial directory structure
      const primitives = ['materials', 'tools', 'techniques', 'workflows', 'projects', 'events', 'templates']
      for (const p of primitives) {
        const dir = path.join(dataDir, p)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(path.join(dir, '.gitkeep'), '')
        }
      }
      execSync('git add -A && git commit -m "Initial CraftPlanner data repository"', {
        cwd: dataDir,
        stdio: 'ignore',
      })
      console.log('[init] Created data repository at', dataDir)
    } catch (err) {
      console.error('[init] Failed to initialize data repo:', err.message)
    }
  }
}

// ---------------------------------------------------------------------------
// Port checker
// ---------------------------------------------------------------------------

function waitForPort(port, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tryConnect = () => {
      const socket = new net.Socket()
      socket.setTimeout(500)
      socket.on('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.on('error', () => {
        socket.destroy()
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} not available after ${timeout}ms`))
        } else {
          setTimeout(tryConnect, 250)
        }
      })
      socket.on('timeout', () => {
        socket.destroy()
        setTimeout(tryConnect, 250)
      })
      socket.connect(port, '127.0.0.1')
    }
    tryConnect()
  })
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

function startCore() {
  const corePath = getCoreBinaryPath()
  const dataDir = getDataDir()
  const dbPath = path.join(getCraftPlannerHome(), 'index.sqlite')

  if (!fs.existsSync(corePath)) {
    console.warn('[core] Binary not found at', corePath, '— running without Core (degraded mode)')
    return
  }

  coreProcess = spawn(corePath, [
    '-data', dataDir,
    '-addr', `:${CORE_PORT}`,
    '-db', dbPath,
  ], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  coreProcess.stdout.on('data', (data) => {
    console.log(`[core] ${data.toString().trim()}`)
  })
  coreProcess.stderr.on('data', (data) => {
    console.error(`[core] ${data.toString().trim()}`)
  })
  coreProcess.on('exit', (code, signal) => {
    console.log(`[core] exited (code=${code}, signal=${signal})`)
    coreProcess = null
  })
}

function startShell() {
  const shellDir = getShellDir()
  const home = getCraftPlannerHome()

  shellProcess = spawn('python3', [
    '-m', 'uvicorn',
    'backend.app.main:app',
    '--port', String(SHELL_PORT),
    '--host', '127.0.0.1',
  ], {
    cwd: shellDir,
    env: {
      ...process.env,
      CRAFTPLANNER_CORE_URL: `http://localhost:${CORE_PORT}`,
      CRAFTPLANNER_PORT: String(SHELL_PORT),
      CRAFTPLANNER_DEV_MODE: 'false',
      CRAFTPLANNER_HOME: home,
      CRAFTPLANNER_USERDB_PATH: path.join(home, 'userdb.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  shellProcess.stdout.on('data', (data) => {
    console.log(`[shell] ${data.toString().trim()}`)
  })
  shellProcess.stderr.on('data', (data) => {
    console.error(`[shell] ${data.toString().trim()}`)
  })
  shellProcess.on('exit', (code, signal) => {
    console.log(`[shell] exited (code=${code}, signal=${signal})`)
    shellProcess = null
    // If the shell crashes unexpectedly, quit the app
    if (!isQuitting) {
      dialog.showErrorBox('CraftPlanner', 'The backend process has stopped unexpectedly. The application will close.')
      app.quit()
    }
  })
}

function killProcess(proc, label) {
  return new Promise((resolve) => {
    if (!proc || proc.killed) {
      resolve()
      return
    }

    const timeout = setTimeout(() => {
      console.log(`[${label}] Force killing...`)
      try { proc.kill('SIGKILL') } catch { /* ignore */ }
      resolve()
    }, 5000)

    proc.on('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    try {
      // SIGTERM for graceful shutdown
      proc.kill('SIGTERM')
    } catch {
      clearTimeout(timeout)
      resolve()
    }
  })
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'CraftPlanner',
    backgroundColor: '#1a1410',
    show: false, // Show after ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.loadURL(`http://localhost:${SHELL_PORT}`)

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  // Use a simple 16x16 tray icon (fallback to empty nativeImage if no icon file)
  const iconPath = path.join(__dirname, 'icon-tray.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('CraftPlanner')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show CraftPlanner',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  ensureDirectories()
  startCore()
  startShell()

  try {
    // Wait for the shell to be ready (core may still be starting — that's OK,
    // the shell runs in degraded mode without core)
    await waitForPort(SHELL_PORT, 25000)
    createWindow()
    createTray()
  } catch (err) {
    console.error('Failed to start:', err.message)
    dialog.showErrorBox(
      'CraftPlanner — Startup Failed',
      `Could not start the backend server.\n\n${err.message}\n\nMake sure Python 3 and uvicorn are installed.`
    )
    app.quit()
  }
})

app.on('activate', () => {
  // macOS: re-show window on dock click
  if (mainWindow) {
    mainWindow.show()
  }
})

app.on('window-all-closed', () => {
  // Don't quit on window close — tray keeps running
  // (except on non-macOS when isQuitting is set)
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

app.on('before-quit', async () => {
  isQuitting = true
  await Promise.all([
    killProcess(shellProcess, 'shell'),
    killProcess(coreProcess, 'core'),
  ])
})
