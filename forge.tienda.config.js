module.exports = {
  packagerConfig: {
    name: 'El Miarma Tienda',
    executableName: 'El Miarma Tienda'
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
