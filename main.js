const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');

// Habilitar Web Bluetooth en Electron
app.commandLine.appendSwitch('enable-features', 'WebBluetooth');

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
  const esTienda = process.execPath.toLowerCase().includes('tienda') || process.argv.includes('--tienda');
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

  // Selector de dispositivo Bluetooth para Web Bluetooth API
  let _btCallback = null;
  let _btDevices  = [];
  let _btTimer    = null;

  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    _btDevices  = deviceList;
    _btCallback = callback;
    if (_btTimer) clearTimeout(_btTimer);
    if (deviceList.length === 0) return; // espera a que aparezcan dispositivos
    _btTimer = setTimeout(() => {
      _btTimer = null;
      if (!_btCallback) return;
      const cb = _btCallback;
      _btCallback = null;
      const devs = _btDevices;
      const names = devs.map(d => d.deviceName || '(sin nombre)');
      dialog.showMessageBox(win, {
        type: 'question',
        title: 'Seleccionar impresora',
        message: 'Elige la impresora Bluetooth:',
        buttons: [...names, 'Cancelar'],
        cancelId: names.length,
        defaultId: 0
      }).then(({ response }) => {
        cb(response < devs.length ? devs[response].deviceId : '');
      });
    }, 1200); // espera 1.2 s para que aparezcan más dispositivos antes de mostrar el diálogo
  });

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
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Consola (F12)', accelerator: 'F12' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
