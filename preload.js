const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  saveMenuJson:    (data)         => ipcRenderer.invoke('save-menu-json', data),
  abrirCajonRed:   (host, port)   => ipcRenderer.invoke('abrir-cajon-red', { host, port }),
});
