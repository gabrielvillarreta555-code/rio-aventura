// Pruebas de los temas visuales de las rutas: nombres válidos, presupuestos y modo sin sprites.
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}

const ids = ['aldea', 'manglar', 'cascada', 'ruinas', 'laguna'];

test('cada destino tiene tema, 3 paletas y todos los nombres de sprite existen', () => {
  const game = launch();
  const { themes, palettes } = game.sandbox.window.RioArt;
  const base = new Set(['bush0', 'bush1', 'fern', 'bankRocks', 'reeds', 'palm0', 'palm1', 'palm2', 'jungle0', 'jungle1',
    'rock0', 'rock1', 'rock2', 'log0', 'log1', 'backdrop', 'glow']);
  for (const id of ids) {
    const theme = themes[id];
    assert(theme, `tema ${id}`);
    assert.equal(theme.palettes.length, 3);
    for (const p of theme.palettes) {
      assert.equal(p.water.length, 3);
      assert(p.sand.length === 2 && p.tint.length === 4);
    }
    const used = [...theme.vegetation.trees, ...theme.vegetation.under, theme.landmark, theme.backdrop,
      ...(theme.rocks || []), ...(theme.logs || []), ...(theme.ambient ? [theme.ambient.sprite] : []), theme.vegetation.reeds].filter(Boolean);
    for (const name of used) assert(theme.sprites[name] || base.has(name), `${id}: sprite ${name}`);
    for (const [name, spec] of Object.entries(theme.sprites)) {
      assert(name.startsWith(`${id}:`), `${name} lleva el prefijo de su tema`);
      assert(spec.base ? base.has(spec.base) : spec.w > 0 && spec.h > 0, name);
    }
  }
  assert(Object.keys(themes).length === 5 && palettes.length === 4, 'las paletas de la navegación libre no cambian');
});

// Máximo de drawImage por fotograma navegando una ruta (sin obstáculos) al nivel gráfico más alto.
function worstDrawImages(id) {
  const game = launch({ pixelRatio: 2 });
  game.unlockWorld();
  game.tick(3);
  game.sail(id);
  if (id) assert.equal(game.art().debug.theme, id);
  // Deja pasar el fundido entre tramos (2,2 s) que ya existía en 2.4 y recrea el degradado del agua.
  for (let i = 0; i < 160; i++) { game.tick(1, 16); game.api().lives(3); game.api().clearObstacles(); }
  const built = game.art().debug.spritesBuilt;
  game.counters.gradients = 0;
  let worst = 0;
  for (let i = 0; i < 90; i++) {
    game.counters.drawImage = 0;
    game.tick(1, 16);
    game.api().lives(3);
    game.api().clearObstacles();
    worst = Math.max(worst, game.counters.drawImage);
  }
  assert.equal(game.art().debug.spritesBuilt, built, `${id}: no se pintan sprites nuevos durante el viaje`);
  assert.equal(game.counters.gradients, 0, `${id}: sin degradados por fotograma`);
  return worst;
}

test('cada ruta dibuja su tema con los sprites listos, sin degradados por fotograma y sin pasar el presupuesto de la navegación libre', () => {
  const free = worstDrawImages(null);
  for (const id of ids) {
    const worst = worstDrawImages(id);
    assert(worst <= free + 12, `${id}: ${worst} drawImage por fotograma frente a ${free} en navegación libre`);
  }
});

test('el hito del destino aparece solo en los últimos metros y no rompe el dibujo', () => {
  for (const id of ids) {
    const game = launch();
    game.unlockWorld();
    game.sail(id);
    const route = game.sandbox.RioWorld.routeFor(id);
    const api = game.api();
    game.tick(2);
    const far = game.art().debug.drawn;
    api.distance(route.distance - 60);
    game.tick(1);
    const near = game.art().debug.drawn;
    assert(near >= far, `${id}: el hito suma al menos un sprite`);
    api.clearObstacles();
    api.distance(route.distance - 1);
    game.tick(1);
    assert.equal(game.api().scene().theme, id);
  }
});

test('sin lienzos ocultos cada tema se dibuja en modo directo sin fallar', () => {
  for (const id of ids) {
    const game = launch({ sprites: false });
    game.unlockWorld();
    game.sail(id);
    const route = game.sandbox.RioWorld.routeFor(id);
    game.api().distance(route.distance - 40);
    game.tick(20, 16);
    game.api().lives(3);
    assert(game.art().debug.immediate);
  }
});

test('volver a la navegación libre restaura el aspecto de siempre', () => {
  const game = launch();
  game.unlockWorld();
  game.sail('laguna');
  assert.equal(game.art().debug.theme, 'laguna');
  game.sail(null);
  game.tick(2);
  assert.equal(game.art().debug.theme, 'free');
  assert.equal(game.api().scene().theme, 'free');
  assert.equal(game.api().scene().remaining, -1);
});

test('dibujar un tema no modifica la escena: obstáculos, radios ni posiciones lógicas', () => {
  for (const id of ids) {
    const game = launch({ random: () => 0.37 });
    game.unlockWorld();
    game.sail(id);
    game.tick(150, 16);
    game.api().lives(3);
    const scene = game.api().scene();
    const before = JSON.stringify({ o: scene.obstacles, c: scene.collectibles, b: scene.boat });
    assert(scene.obstacles.length > 0, `${id}: hay obstáculos que comprobar`);
    game.art().update(0, 100, scene);
    game.art().draw(scene);
    assert.equal(JSON.stringify({ o: scene.obstacles, c: scene.collectibles, b: scene.boat }), before);
  }
});

console.log(`Theme tests passed (${passed})`);
