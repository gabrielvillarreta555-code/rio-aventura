// Arnés de pruebas para el juego completo: abre world.js + art.js + game.js (+ el mapa cuando
// existe) con un DOM y un lienzo simulados, y ofrece ganchos para forzar situaciones.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { libs, game: gameSource } = require('./sources.cjs');

const anchor = '  requestAnimationFrame(frame);\n})();';
const hooks = `
  window.__game = {
    state: () => state, lives: n => { lives = n; updateHud(); }, shield: n => { shieldTimer = n; },
    distance: d => { runDistance = d; }, elapsed: n => { elapsed = n; }, getElapsed: () => elapsed,
    speed: () => riverSpeed, score: n => { score = n; updateHud(); }, pickups: n => { collectedCoins = n; },
    stage: () => stageIndex, route: () => (activeRoute ? activeRoute.id : null), launch: () => launchRouteId,
    obstacles: () => obstacles, runDistance: () => runDistance, tune: () => tune,
    startRoute: id => { launchRouteId = id; begin(); },
    open: id => routeOpen(id), view: () => currentView(), economy: () => economy,
    coinAtBoat: () => { collectibles.push({ x: boat.x, y: boat.y, phase: 0 }); },
    scene: () => scene, tier: () => gfxTier, tripId: () => tripId, interrupted: () => interrupted,
    clearObstacles: () => { obstacles = []; }
  };
`;
if (!gameSource.includes(anchor)) throw new Error('El arnés necesita el ancla de game.js');
const hookedSource = gameSource.replace(anchor, () => `${hooks}${anchor}`);

function makeStore(initial = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  const failing = new Set();
  return {
    data, failing,
    json(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    api: {
      getItem: key => data.get(key) ?? null,
      setItem(key, value) { if (failing.has(key)) throw new Error('storage full'); data.set(key, String(value)); },
      removeItem: key => { data.delete(key); }
    }
  };
}

const keys = {
  best: 'rio-aventura-best-v1', economy: 'rio-aventura-economy-v1', stats: 'rio-aventura-stats-v2',
  trip: 'rio-aventura-trip-v1', settle: 'rio-aventura-settle-v1', hint: 'rio-aventura-map-hint-v1'
};

// Abre el juego sobre un almacenamiento dado (equivale a abrir la app).
function launch({ store = makeStore(), pixelRatio, sprites = true, random = () => 0.5, today } = {}) {
  const handlers = new Map();
  const elements = new Map();
  const counters = { ops: 0, gradients: 0, drawImage: 0 };
  const makeContext = isMain => {
    const gradient = () => ({ addColorStop() {} });
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
  const initiallyHidden = new Set(['settingsPanel', 'finishTrip', 'mapPanel', 'arrivalCard', 'mapHint', 'openMap']);
  const element = id => {
    const classes = new Set(initiallyHidden.has(id) ? ['hidden'] : []);
    const item = {
      id, textContent: '', innerHTML: '', value: '', style: {}, attributes: {}, dataset: {}, disabled: false,
      width: 450, height: 800,
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name]; },
      select() {}, focus() {}, setPointerCapture() {},
      getContext: () => mapContext,
      getBoundingClientRect: () => ({ width: 412, height: 700, left: 0, top: 0 }),
      classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n),
        toggle: (n, force) => { if (force === undefined ? !classes.has(n) : force) classes.add(n); else classes.delete(n); } },
      addEventListener(name, callback) { handlers.set(`${id}:${name}`, callback); }
    };
    return item;
  };
  const mapContext = makeContext(false);
  const canvas = element('game');
  canvas.width = 450;
  canvas.height = 800;
  const context = makeContext(true);
  canvas.getContext = () => context;
  let viewHeight = 1000;
  canvas.getBoundingClientRect = () => ({ width: 450, height: viewHeight, left: 0 });
  elements.set('game', canvas);
  let nextFrame;
  const math = Object.create(Math);
  math.random = random;
  const document = {
    hidden: false,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
    addEventListener(name, callback) { handlers.set(`document:${name}`, callback); }
  };
  if (sprites) document.createElement = () => ({ width: 0, height: 0, getContext: () => makeContext(false) });
  const sandbox = {
    document,
    window: { devicePixelRatio: pixelRatio, addEventListener(name, callback) { handlers.set(`window:${name}`, callback); } },
    localStorage: store.api,
    requestAnimationFrame(callback) { nextFrame = callback; },
    Math: math
  };
  if (today) {
    const NativeDate = Date;
    sandbox.Date = class extends NativeDate {
      constructor(...args) { if (args.length) super(...args); else super(today); }
      static now() { return NativeDate.parse(today); }
    };
  }
  vm.runInNewContext(`${libs}\n${hookedSource}`, sandbox);
  let clock = 1000;
  const game = {
    sandbox, store, counters, handlers, elements, canvas, math,
    api: () => sandbox.window.__game,
    art: () => sandbox.window.RioArt.instance,
    text: id => elements.get(id).textContent,
    html: id => elements.get(id).innerHTML,
    hidden: id => elements.get(id).classList.contains('hidden'),
    attr: (id, name) => elements.get(id).attributes[name],
    disabled: id => Boolean(elements.get(id).disabled),
    click: id => handlers.get(`${id}:click`)(),
    fire: name => handlers.get(name)(),
    tick(frames = 1, step = 16) { for (let i = 0; i < frames; i++) { clock += step; nextFrame(clock); } },
    resize(height) { viewHeight = height; handlers.get('window:resize')(); },
    // Empieza un viaje por una ruta (o navegación libre) y lo mantiene con vida para las pruebas.
    sail(id) { game.api().startRoute(id || null); game.api().lives(3); },
    // Navega hasta llegar al destino y devuelve el estado final.
    arrive(dodged = 0) {
      const api = game.api();
      const route = api.route();
      assert(route, 'arrive() necesita un viaje por una ruta');
      api.score(dodged);
      api.distance(sandbox.RioWorld.routeFor(route).distance - 1);
      for (let i = 0; i < 20 && api.state() === 'playing'; i++) { game.tick(1, 16); api.lives(3); }
      return api.state();
    },
    wallet: () => Number(/🪙 (\d+)/.exec(game.text('coinHud'))[1])
  };
  sandbox.RioWorld = sandbox.window.RioWorld;
  return game;
}

module.exports = { launch, makeStore, keys };
