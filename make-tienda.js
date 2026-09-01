// Compilación de El Miarma Tienda.
// Inyecta la config de tienda en package.json (que es lo que electron-forge
// lee con máxima prioridad), compila, y restaura el original.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^﻿/, ''));
const originalForge = pkg.config.forge;
const tiendaCfg = require('./forge.tienda.config.js');

pkg.config.forge = {
  packagerConfig: tiendaCfg.packagerConfig,
  makers: tiendaCfg.makers
};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4));

try {
  execSync('npx electron-forge make', { stdio: 'inherit', cwd: __dirname });
} finally {
  pkg.config.forge = originalForge;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4));
}

execSync(
  'powershell -Command "Get-ChildItem out/make/squirrel.windows/x64/*.exe | Copy-Item -Destination \'C:/Users/jorge/Desktop/El Miarma Tienda Setup.exe\'"',
  { stdio: 'inherit', cwd: __dirname }
);
