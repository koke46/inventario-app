const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let win;

function applyWindowOpenHandler(browserWin) {
  browserWin.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'El Miarma',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    }
  }));
  // Propaga el handler a ventanas hijas que se creen desde esta
  browserWin.webContents.on('did-create-window', childWin => {
    applyWindowOpenHandler(childWin);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'El Miarma — Inventario',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('inventario-fresco.html');
  applyWindowOpenHandler(win);

  const menu = Menu.buildFromTemplate([
    {
      label: 'Inventario',
      submenu: [
        {
          label: '🍺 Frescos y Bebidas',
          click: () => win.loadFile('inventario-fresco.html')
        },
        {
          label: '🛒 Tienda',
          click: () => win.loadFile('inventario-tienda.html')
        },
        { type: 'separator' },
        {
          label: '⚡ Panel de control',
          click: () => win.loadFile('panel-control.html')
        },
        { type: 'separator' },
        { label: 'Salir', role: 'quit' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
