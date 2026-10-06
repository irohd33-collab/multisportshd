// MultiSportsHD Desktop — Electron main process
// Ledger Live benzeri: özel başlık çubuğu + sol kenar çubuğu + gömülü site + sistem tepsisi.
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');

const SITE_URL = process.env.MSHD_URL || 'https://multisportshd.com';
let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false, // özel başlık çubuğu (Ledger Live gibi)
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(SITE_URL);

  // dış linkler varsayılan tarayıcıda açılsın
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide(); // X → tepsiye küçült (Ledger Live davranışı)
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray.png');
  const img = nativeImage.createFromPath(iconPath);
  tray = new Tray(img.isEmpty() ? path.join(__dirname, 'icon.png') : iconPath);
  tray.setToolTip('MultiSportsHD — Canlı Spor');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Aç', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: 'Canlı Yayınlar', click: () => { showAndNavigate(SITE_URL); } },
    { label: 'Çıkış', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); });
}

function showAndNavigate(url) {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.loadURL(url); }
  else { createWindow(); mainWindow.loadURL(url); }
}

// ---- IPC: pencere kontrolleri (özel başlık çubuğu butonları) ----
ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('win:close', () => mainWindow?.hide());
ipcMain.on('win:quit', () => { isQuitting = true; app.quit(); });
ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);

// ---- otomatik güncelleme iskeleti (electron-updater hazır; yayın anahtarı eklenince aktif) ----
function initAutoUpdate() {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => { /* yayın anahtarı yoksa sessiz geç */ });
    setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 3600 * 1000);
  } catch { /* electron-updater kurulu değilse sessiz geç */ }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  initAutoUpdate();
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
