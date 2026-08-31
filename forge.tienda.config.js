module.exports = {
  packagerConfig: {
    name: 'El Miarma Tienda',
    executableName: 'El Miarma Tienda',
    entryPoint: 'main-tienda.js'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ElMiarmaTienda'
      }
    }
  ]
};
