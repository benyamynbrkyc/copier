const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff',
    title: 'Copier'
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    // Focus the window on first launch
    if (isDev) {
      mainWindow.focus()
    }
  })

  // Set window title after load
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.setTitle('Copier')
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.filecopier.llm')
  }
  
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
