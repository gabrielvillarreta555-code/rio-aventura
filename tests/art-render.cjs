// Pruebas de la capa visual 2.4: sprites en caché, presupuesto de dibujo, cambios de tramo,
// calidad adaptativa, calidad reducida, resolución y respaldo sin lienzos ocultos.
// Se ejecuta desde tests/visual-smoke.cjs (node tests/visual-smoke.cjs).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const { libs: artSource, game: gameSource } = require('./sources.cjs');
const anchor = '  requestAnimationFrame(frame);\n})();';
const hooks = `
  window.__game = {
    tier: () => gfxTier, ceiling: () => gfxCeiling, scale: () => renderScale,
    lives: n => { lives = n; updateHud(); }, shield: n => { shieldTimer = n; },
    distance: d => { runDistance = d; }, state: () => state, stage: () => stageIndex,
    coinAtBoat: () => { collectibles.push({ x: boat.x, y: boat.y, phase: 0 }); },
    rockAtBoat: () => { obstacles.push({ x: boat.x, y: boat.y - 20, radius: 24, kind: 'rock', vx: 0, counted: false, hit: false, phase: 1 }); },
    obstacle: (kind, x, y) => { obstacles.push({ x, y, radius: kind === 'rock' ? 24 : 26, kind, vx: kind === 'drift' ? 60 : 0, counted: false, hit: false, phase: 2 }); }
  };
`;
assert(gameSource.includes(anchor), 'the art tests need their hook anchor in game.js');
const hookedSource = gameSource.replace(anchor, () => `${hooks}${anchor}`);

function makeStore(initial = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return { data, api: { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, String(value)); }, removeItem: key => { data.delete(key); } } };
}

// Abre el juego con un lienzo de pruebas. `sprites: false` simula un WebView sin lienzos ocultos.
function launch({ store = makeStore(), pixelRatio, sprites = true, quality } = {}) {
  if (quality) store.data.set('rio-aventura-profile-v1', JSON.stringify({ name: 'Prueba', avatar: 0, quality }));
  const handlers = new Map();
  const elements = new Map();
  const counters = { ops: 0, gradients: 0, drawImage: 0 };
  const stops = [];
  const hiddenCanvases = [];
  const makeContext = isMain => {
    const gradient = () => ({ addColorStop(_p, color) { stops.push(color); } });
    return new Proxy({
      createLinearGradient() { if (isMain) counters.gradients++; return gradient(); },
      createRadialGradient() { if (isMain) counters.gradients++; return gradient(); },
      createPattern: () => ({})
    }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), `${String(key)} received a non-finite value`);
          if (isMain) { counters.ops++; if (key === 'drawImage') counters.drawImage++; }
        };
      },
      set(target, key, value) { target[key] = value; return true; }
    });
  };
  const element = id => {
    const classes = new Set(id === 'settingsPanel' || id === 'finishTrip' ? ['hidden'] : []);
    return {
      id, textContent: '', value: '', style: {}, attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; }, select() {},
      classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n),
        toggle: (n, force) => { if (force === undefined ? !classes.has(n) : force) classes.add(n); else classes.delete(n); } },
      addEventListener(name, callback) { handlers.set(`${id}:${name}`, callback); }
    };
  };
  const canvas = element('game');
  canvas.width = 450;
  canvas.height = 800;
  const context = makeContext(true);
  canvas.getContext = () => context;
  let viewHeight = 1000;
  canvas.getBoundingClientRect = () => ({ width: 450, height: viewHeight, left: 0 });
  canvas.setPointerCapture = () => {};
  elements.set('game', canvas);
  let nextFrame;
  const math = Object.create(Math);
  math.random = () => 0.5;
  const document = {
    hidden: false,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
    addEventListener(name, callback) { handlers.set(`document:${name}`, callback); }
  };
  if (sprites) document.createElement = () => { const item = { width: 0, height: 0, getContext: () => makeContext(false) }; hiddenCanvases.push(item); return item; };
  const sandbox = {
    document,
    window: { devicePixelRatio: pixelRatio, addEventListener(name, callback) { handlers.set(`window:${name}`, callback); } },
    localStorage: store.api,
    requestAnimationFrame(callback) { nextFrame = callback; },
    Math: math
  };
  vm.runInNewContext(`${artSource}\n${hookedSource}`, sandbox);
  let clock = 1000;
  const game = {
    sandbox, store, counters, stops, canvas, hiddenCanvases, handlers,
    art: () => sandbox.window.RioArt.instance,
    api: () => sandbox.window.__game,
    play() { handlers.get('play:click')(); game.api().lives(3); },
    tick(frames = 1, step = 16) { for (let i = 0; i < frames; i++) { clock += step; nextFrame(clock); } },
    resize(height) { viewHeight = height; handlers.get('window:resize')(); },
    frameCost(step = 16) {
      const before = { ...counters };
      const drawn = game.art().debug.frames;
      game.tick(1, step);
      assert.equal(game.art().debug.frames, drawn + 1, 'a frame should have been drawn');
      return { ops: counters.ops - before.ops, gradients: counters.gradients - before.gradients, drawImage: counters.drawImage - before.drawImage, sprites: game.art().debug.drawnLast };
    }
  };
  return game;
}

let passed = 0;
function test(name, body) {
  try { body(); passed++; }
  catch (error) { error.message = `[${name}] ${error.message}`; throw error; }
}

test('el escenario se prepara una vez como sprites y se reutiliza', () => {
  const game = launch();
  assert(game.art().debug.spritesBuilt >= 40, 'todos los sprites se preparan al abrir el juego, antes del primer fotograma');
  game.play();
  game.tick(30);
  const built = game.art().debug.spritesBuilt;
  assert(built >= 40, 'palmeras, rocas, lancha y efectos deben prepararse como sprites');
  assert(game.hiddenCanvases.length >= built, 'cada sprite usa su propio lienzo oculto');
  game.tick(240);
  assert.equal(game.art().debug.spritesBuilt, built, 'no se crean sprites nuevos mientras se juega en el mismo tramo');
  assert(game.art().debug.immediate === false, 'con lienzos ocultos no se dibuja en modo directo');
});

test('un fotograma en estado estable no crea degradados y respeta el presupuesto', () => {
  const game = launch();
  game.play();
  game.tick(60);
  const costs = [];
  for (let i = 0; i < 90; i++) costs.push(game.frameCost());
  assert(costs.every(cost => cost.gradients === 0), 'en el mismo tramo no se crean degradados por fotograma');
  const worst = costs.reduce((a, b) => (b.ops > a.ops ? b : a));
  assert(worst.ops < 410, `un fotograma debe ser barato en operaciones de lienzo (${worst.ops})`);
  assert(worst.sprites < 175, `un fotograma debe respetar su presupuesto de sprites (${worst.sprites})`);
  assert(costs.every(cost => cost.drawImage > 20), 'la escena se compone copiando sprites');
});

test('los niveles de detalle bajan el coste de dibujo', () => {
  const high = launch();
  high.play();
  high.tick(40);
  const rich = high.frameCost();
  const low = launch({ quality: 'low' });
  low.play();
  low.tick(40);
  const lean = low.frameCost(34);
  assert.equal(low.art().debug.detail, 0);
  assert.equal(low.api().scale(), 1, 'la calidad reducida no aumenta la resolución');
  assert(lean.sprites < rich.sprites * 0.75, `detalle 0 (${lean.sprites}) debe dibujar bastante menos que detalle 2 (${rich.sprites})`);
  assert(lean.ops < rich.ops, 'la calidad reducida usa menos operaciones');
});

test('todos los tramos, estados y efectos dibujan números finitos', () => {
  const game = launch();
  game.play();
  game.api().lives(3);
  for (const distance of [0, 120, 260, 450]) {
    game.api().distance(distance);
    game.tick(190);
    game.api().lives(3);
  }
  assert.equal(game.api().stage(), 3, 'el viaje de prueba debe llegar al último tramo');
  game.api().shield(4);
  game.api().coinAtBoat();
  game.api().rockAtBoat();
  game.api().obstacle('log', 150, 400);
  game.api().obstacle('drift', 300, 500);
  game.tick(120);
  for (const height of [800, 1000, 1300, 1700]) {
    game.resize(height);
    game.tick(10);
  }
  assert(game.art().debug.counts.rock > 0 && game.art().debug.counts.log > 0 && game.art().debug.counts.drift > 0 && game.art().debug.counts.coin > 0,
    'rocas, troncos, troncos a la deriva y monedas deben dibujarse');
});

test('los cambios de tramo mezclan la paleta y después vuelven al degradado en caché', () => {
  const game = launch();
  game.play();
  game.tick(40);
  game.api().distance(100.2);
  game.tick(4);
  assert.equal(game.api().stage(), 1);
  const during = game.frameCost();
  assert(during.gradients >= 1, 'durante la transición el agua cambia gradualmente de color');
  game.tick(160);
  game.api().lives(3);
  const after = game.frameCost();
  assert.equal(after.gradients, 0, 'terminada la transición el degradado vuelve a estar en caché');
});

test('la resolución se aplica al lienzo y los sprites se rehacen nítidos', () => {
  const game = launch({ pixelRatio: 3 });
  game.play();
  game.tick(20);
  assert.equal(game.canvas.width, 450, 'el nivel inicial dibuja a resolución lógica');
  const built = game.art().debug.spritesBuilt;
  game.art().resize(1000, 2);
  game.tick(5);
  assert(game.art().debug.spritesBuilt > built, 'al cambiar de resolución los sprites se reconstruyen');
  assert(game.hiddenCanvases.some(item => item.width >= 216), 'a 2× el casco se prepara con el doble de píxeles');
});

test('la calidad automática baja si el teléfono se atasca y no oscila al subir', () => {
  const store = makeStore();
  const game = launch({ store, pixelRatio: 3 });
  game.play();
  game.tick(130);
  assert.equal(game.api().tier(), 3, 'sin datos guardados se empieza en un nivel seguro');
  // Un teléfono lento: 45 ms por fotograma durante 14 s.
  for (let i = 0; i < 320; i++) { game.tick(1, 45); game.api().lives(3); }
  assert.equal(game.api().tier(), 0, 'los fotogramas lentos bajan detalle y resolución');
  assert.equal(JSON.parse(store.data.get('rio-aventura-gfx-v1')).tier, 0, 'el nivel aprendido se recuerda');
  assert.equal(game.api().scale(), 0.85);
  assert.equal(game.canvas.width, Math.round(450 * 0.85), 'la resolución rebajada se aplica al lienzo');
  assert.equal(game.art().debug.detail, 0);
  // Se recupera: 60 FPS durante un buen rato sube de uno en uno.
  const lowest = game.api().tier();
  let guard = 0;
  while (game.api().tier() === lowest && guard++ < 2000) { game.tick(1, 16); game.api().lives(3); }
  assert(game.api().tier() > lowest, 'si va sobrado vuelve a subir');
  const peak = game.api().tier();
  // Justo después de subir se atasca otra vez: la subida se revierte y ese nivel queda como techo.
  for (let i = 0; i < 260; i++) { game.tick(1, 45); game.api().lives(3); }
  assert(game.api().tier() < peak, 'una subida que no se aguanta se revierte');
  assert(game.api().ceiling() < peak, 'el nivel que falló queda como techo');
  for (let i = 0; i < 2400; i++) { game.tick(1, 16); game.api().lives(3); }
  assert(game.api().tier() <= game.api().ceiling(), 'no vuelve a superar el techo aprendido');
});

test('el nivel gráfico guardado se usa al abrir y los datos dañados se ignoran', () => {
  const saved = launch({ store: makeStore({ 'rio-aventura-gfx-v1': { tier: 5 } }), pixelRatio: 3 });
  assert.equal(saved.api().tier(), 5);
  assert.equal(saved.canvas.width, Math.round(450 * 1.5));
  for (const junk of ['{roto', { tier: 99 }, { tier: -1 }, { tier: 'x' }]) {
    const game = launch({ store: makeStore({ 'rio-aventura-gfx-v1': junk }), pixelRatio: 3 });
    assert.equal(game.api().tier(), 3, 'un dato dañado vuelve al nivel seguro');
  }
  const small = launch({ store: makeStore({ 'rio-aventura-gfx-v1': { tier: 6 } }), pixelRatio: 1 });
  assert.equal(small.api().tier(), 3, 'una pantalla de baja densidad nunca sube más resolución de la que puede mostrar');
});

test('sin lienzos ocultos el juego sigue dibujando en modo directo', () => {
  const game = launch({ sprites: false });
  game.play();
  game.tick(40);
  assert(game.art().debug.immediate, 'el arte se pinta directamente si el WebView no ofrece lienzos ocultos');
  assert(game.art().debug.boatY > 800, 'la lancha sigue visible');
  const rocksBefore = game.art().debug.counts.rock;
  game.api().obstacle('rock', 225, 400);
  game.tick(10);
  assert(game.art().debug.counts.rock > rocksBefore, 'los obstáculos se dibujan igualmente');
});

test('los efectos usan reservas fijas y no crecen sin límite', () => {
  const game = launch();
  game.play();
  game.tick(10);
  for (let i = 0; i < 200; i++) {
    game.api().coinAtBoat();
    game.api().rockAtBoat();
    game.api().lives(3);
    game.tick(2);
  }
  const spritesBefore = game.art().debug.spritesBuilt;
  game.tick(120);
  assert.equal(game.art().debug.spritesBuilt, spritesBefore, 'los efectos reutilizan sprites ya preparados');
  assert(game.counters.ops > 0);
});

test('la ventana se redimensiona y el lienzo conserva la proporción del escenario', () => {
  const game = launch();
  game.play();
  game.tick(5);
  assert.equal(game.canvas.height, 1000);
  game.resize(1200);
  game.tick(3);
  assert.equal(game.canvas.height, 1200);
  assert.equal(game.canvas.width, 450);
  assert(game.art().debug.boatY > 1000, 'la lancha sigue pegada al borde inferior tras redimensionar');
});

test('la página carga el arte antes que el juego y mantiene sus controles', () => {
  const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
  assert(html.indexOf('src="art.js"') > 0 && html.indexOf('src="art.js"') < html.indexOf('src="game.js"'), 'art.js debe cargarse antes que game.js');
  for (const id of ['game', 'pause', 'settings', 'play', 'finishTrip', 'coinHud', 'stageProgress']) assert(html.includes(`id="${id}"`), `falta #${id}`);
  assert(/prefers-reduced-motion[^}]*#play/.test(html), 'las animaciones del botón respetan la preferencia de movimiento reducido');
});

test('las paletas de los cuatro tramos son válidas', () => {
  const { palettes } = vm.runInNewContext(`${artSource}\nwindow.RioArt`, { window: {} });
  assert.equal(palettes.length, 4);
  for (const palette of palettes) {
    for (const color of [...palette.water, palette.shallow, palette.haze, ...palette.sand]) assert(/^#[0-9a-f]{6}$/i.test(color), `color inválido ${color}`);
    assert(palette.tint.length === 4 && palette.tint[3] <= 0.2, 'el tinte debe ser suave');
  }
});

console.log(`Art render tests passed (${passed})`);
