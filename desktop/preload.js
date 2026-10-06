// preload: özel başlık çubuğu butonlarının pencereyi kontrol etmesi için güvenli köprü
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mshd', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  quit: () => ipcRenderer.send('win:quit'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  isDesktop: true,
});
