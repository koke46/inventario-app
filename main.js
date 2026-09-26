const { app, BrowserWindow, Menu, MenuItem, dialog, clipboard, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const net  = require('net');

// Habilitar Web Bluetooth en Electron
app.commandLine.appendSwitch('enable-features', 'WebBluetooth');

// Una sola instancia — necesario para recibir URLs del protocolo cuando ya está abierta
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let win;

function applyWindowOpenHandler(browserWin) {
  browserWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('elmiarma://')) {
      abrirDesdeProtocolo(url);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'El Miarma',
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
      }
    };
  });
  browserWin.webContents.on('did-create-window', childWin => {
    applyWindowOpenHandler(childWin);
  });
}

// Abre una ventana de cliente a partir de elmiarma://open?file=...&lic=...&u=...&p=...
function abrirDesdeProtocolo(url) {
  try {
    const parsed = new URL(url);
    const file = parsed.searchParams.get('file');
    const lic  = parsed.searchParams.get('lic');
    const u    = parsed.searchParams.get('u');
    const p    = parsed.searchParams.get('p');
    if (!file) return;
    const clientWin = new BrowserWindow({
      width: 1280, height: 800, minWidth: 900, minHeight: 600,
      title: 'El Miarma',
      webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
    });
    const query = {};
    if (lic) query.lic = lic;
    if (u)   query.u   = u;
    if (p)   query.p   = p;
    clientWin.loadFile(path.join(__dirname, file), Object.keys(query).length ? { query } : {});
    applyWindowOpenHandler(clientWin);
  } catch (e) {}
}

// Registrar el protocolo elmiarma://
// En desarrollo (electron .) hay que incluir la ruta de la app como argumento extra,
// si no Windows lanza "electron.exe elmiarma://..." y lo toma como ruta de la app
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('elmiarma', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('elmiarma');
}

// Si el usuario lanza desde Chrome con elmiarma:// y la app ya está abierta
app.on('second-instance', (event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('elmiarma://'));
  if (url) abrirDesdeProtocolo(url);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

function createWindow() {
  const esPanel  = process.argv.includes('--panel');
  const esTienda = !esPanel && (process.execPath.toLowerCase().includes('tienda') || process.argv.includes('--tienda'));
  const htmlFile = esPanel ? 'panel-control.html' : esTienda ? 'tpv-tienda.html' : 'inventario-fresco.html';
  const titulo   = esPanel ? 'El Miarma — Panel de control' : esTienda ? 'El Miarma — Tienda' : 'El Miarma — Inventario';

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: titulo,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });

  win.loadFile(htmlFile);
  applyWindowOpenHandler(win);
  if (!esPanel) win.webContents.on('did-finish-load', () => win.setFullScreen(true));

  // Web Serial — selector de puerto y permisos para cajón por USB/COM
  win.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (!portList.length) { callback(''); return; }
    if (portList.length === 1) { callback(portList[0].portId); return; }
    dialog.showMessageBox(win, {
      type: 'question',
      title: 'Puerto del cajón',
      message: 'Elige el puerto al que está conectado el cajón / impresora:',
      buttons: [...portList.map(p => p.displayName || p.portName || p.portId), 'Cancelar'],
      cancelId: portList.length, defaultId: 0
    }).then(({ response }) => callback(response < portList.length ? portList[response].portId : ''));
  });
  win.webContents.session.setDevicePermissionHandler(details =>
    details.deviceType === 'serial' || details.deviceType === 'bluetooth'
  );

  // Menú contextual (clic derecho) con Cortar / Copiar / Pegar
  win.webContents.on('context-menu', (e, params) => {
    const menu = new Menu();
    if (params.isEditable) {
      if (params.selectionText) {
        menu.append(new MenuItem({ label: 'Cortar',  role: 'cut' }));
        menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
      }
      menu.append(new MenuItem({ label: 'Pegar', role: 'paste', enabled: clipboard.readText().length > 0 }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Seleccionar todo', role: 'selectAll' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
    }
    if (menu.items.length > 0) menu.popup({ window: win });
  });

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
      label: 'Editar',
      submenu: [
        { role: 'cut',       label: 'Cortar' },
        { role: 'copy',      label: 'Copiar' },
        { role: 'paste',     label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
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

// Cajón por red — TCP raw socket (puerto ESC/POS, típicamente 9100)
ipcMain.handle('abrir-cajon-red', (event, { host, port }) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(3000);
    client.connect(port, host, () => {
      client.write(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]), () => {
        client.destroy();
        resolve();
      });
    });
    client.on('timeout', () => { client.destroy(); reject(new Error('Sin respuesta (timeout)')); });
    client.on('error',   (e) => reject(new Error(e.message)));
  });
});

ipcMain.handle('save-menu-json', (event, data) => {
  try {
    const dest = path.join(os.homedir(), 'Desktop', 'netlify-deploy', 'menu.json');
    fs.writeFileSync(dest, JSON.stringify(data), 'utf8');
    return dest;
  } catch (e) {
    throw new Error('No se pudo guardar: ' + e.message);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
