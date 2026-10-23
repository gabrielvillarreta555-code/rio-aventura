// Carga los scripts de la app en el mismo orden que index.html. Las pruebas ejecutan
// `libs + game` en un único contexto, como lo hace el navegador.
const fs = require('node:fs');

const dir = 'app/src/main/assets';
const libraries = ['world.js', 'art.js', 'map.js'];

module.exports = {
  libs: libraries.map(name => fs.readFileSync(`${dir}/${name}`, 'utf8')).join('\n'),
  game: fs.readFileSync(`${dir}/game.js`, 'utf8'),
  html: fs.readFileSync(`${dir}/index.html`, 'utf8'),
  dir, libraries
};
