const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Una sola instancia — necesario para recibir URLs del protocolo cuando ya está abierta
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

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
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    }
  }));
  browserWin.webContents.on('did-create-window', childWin => {
    applyWindowOpenHandler(childWin);
  });
}

// Abre una ventana de cliente a partir de elmiarma://open?file=...&lic=...
function abrirDesdeProtocolo(url) {
  try {
    const parsed = new URL(url);
    const file = parsed.searchParams.get('file');
    const lic  = parsed.searchParams.get('lic');
    if (!file) return;
    const clientWin = new BrowserWindow({
      width: 1280, height: 800, minWidth: 900, minHeight: 600,
      title: 'El Miarma',
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    clientWin.loadFile(file, lic ? { query: { lic } } : {});
    applyWindowOpenHandler(clientWin);
  } catch (e) {}
}

// Registrar el protocolo elmiarma://
app.setAsDefaultProtocolClient('elmiarma');

// Si el usuario lanza desde Chrome con elmiarma:// y la app ya está abierta
app.on('second-instance', (event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('elmiarma://'));
  if (url) abrirDesdeProtocolo(url);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

function createWindow() {
  const esTienda = process.execPath.toLowerCase().includes('tienda');
  const htmlFile = esTienda ? 'inventario-tienda.html' : 'inventario-fresco.html';
  const titulo   = esTienda ? 'El Miarma — Tienda' : 'El Miarma — Inventario';

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: titulo,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  win.loadFile(htmlFile);
  applyWindowOpenHandler(win);

  // Si se lanzó directamente via protocolo (app no estaba abierta)
  const protocolUrl = process.argv.find(arg => arg.startsWith('elmiarma://'));
  if (protocolUrl) abrirDesdeProtocolo(protocolUrl);

  const menu = Menu.buildFromTemplate([
    {
      label: 'Inventario',
      submenu: [
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
