// Pruebas de seguridad del progreso: historial de monedas, fallos de guardado, viajes
// interrumpidos, recompensas únicas, compatibilidad con datos anteriores, HUD y rendimiento.
// Se ejecuta desde tests/visual-smoke.cjs (node tests/visual-smoke.cjs).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const { libs: artSource, game: gameSource } = require('./sources.cjs');
const anchor = '  requestAnimationFrame(frame);\n})();';
const countReplays = '  function replayEconomy(events, base = null) {';
const hooks = `
  window.__run = () => ({ state, score, lives, collectedCoins, runDistance, elapsed, stageIndex, shieldTimer, tripId, hudReward });
  window.__setRun = (distance, dodged, pickups) => { runDistance = distance; score = dodged; collectedCoins = pickups; updateHud(); };
  window.__finish = finish;
  window.__addCoin = () => { collectibles.push({ x: boat.x, y: boat.y, phase: 0 }); };
`;
assert(gameSource.includes(anchor) && gameSource.includes(countReplays), 'the test hooks need their anchors in game.js');
const hookedSource = gameSource
  .replace(countReplays, () => `${countReplays}\n    window.__replayCount += 1;`)
  .replace(anchor, () => `${hooks}${anchor}`);

const keys = {
  best: 'rio-aventura-best-v1', economy: 'rio-aventura-economy-v1', stats: 'rio-aventura-stats-v2',
  trip: 'rio-aventura-trip-v1', settle: 'rio-aventura-settle-v1'
};

function makeStore(initial = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  const failing = new Set();
  return {
    data, failing,
    json(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    api: {
      getItem(key) { return data.get(key) ?? null; },
      setItem(key, value) {
        if (failing.has(key)) throw new Error('storage full');
        data.set(key, String(value));
      },
      removeItem(key) { data.delete(key); }
    }
  };
}

// Equivale a abrir la app: ejecuta game.js con el almacenamiento dado.
function launch(store) {
  const handlers = new Map();
  const elements = new Map();
  const classes = id => new Set(id === 'settingsPanel' || id === 'finishTrip' ? ['hidden'] : []);
  const element = id => {
    const set = classes(id);
    return {
      id, textContent: '', value: '', style: {}, attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      select() {},
      classList: { add: name => set.add(name), remove: name => set.delete(name), contains: name => set.has(name) },
      addEventListener(name, callback) { handlers.set(`${id}:${name}`, callback); }
    };
  };
  const gradient = { addColorStop() {} };
  const context = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient }, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set(target, key, value) { target[key] = value; return true; }
  });
  const canvas = element('game');
  canvas.width = 450;
  canvas.height = 800;
  canvas.getContext = () => context;
  canvas.getBoundingClientRect = () => ({ width: 450, height: 1000, left: 0 });
  canvas.setPointerCapture = () => {};
  elements.set('game', canvas);
  let nextFrame;
  const math = Object.create(Math);
  math.random = () => 0.5;
  const sandbox = {
    document: {
      hidden: false,
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element(id));
        return elements.get(id);
      },
      addEventListener(name, callback) { handlers.set(`document:${name}`, callback); }
    },
    window: { __replayCount: 0, addEventListener(name, callback) { handlers.set(`window:${name}`, callback); } },
    localStorage: store.api,
    requestAnimationFrame(callback) { nextFrame = callback; },
    Math: math
  };
  vm.runInNewContext(`${artSource}\n${hookedSource}`, sandbox);
  let clock = 1000;
  const game = {
    sandbox, handlers, elements,
    text: id => elements.get(id).textContent,
    hidden: id => elements.get(id).classList.contains('hidden'),
    click: id => handlers.get(`${id}:click`)(),
    fire: name => handlers.get(name)(),
    run: () => sandbox.window.__run(),
    tick(frames = 1, step = 16) { for (let i = 0; i < frames; i++) { clock += step; nextFrame(clock); } },
    play() { game.click('play'); },
    // Termina un viaje con el resultado dado y devuelve el texto del cierre.
    finishRun(distance = 0, dodged = 0, pickups = 0) {
      game.play();
      sandbox.window.__setRun(distance, dodged, pickups);
      sandbox.window.__finish();
      return game.text('message');
    },
    walletText: () => game.text('coinHud')
  };
  return game;
}

function legacyEconomy(count, deviceId = 'dlegacy') {
  const list = [];
  let id = 0;
  let coins = 0;
  const push = event => list.push({ id: `${deviceId}-${++id}`, ...event });
  const earn = () => { push({ type: 'earn', amount: 1, run: { day: '2020-12-31', distance: 1, dodged: 0, pickups: 0 } }); coins += 1; };
  for (let i = 0; i < 20; i++) earn();
  push({ type: 'buy', boat: 'coral', amount: 15 });
  coins -= 15;
  push({ type: 'earn', amount: 10, rank: 'explorer' });
  coins += 10;
  while (list.length < count) earn();
  return { coins, economy: { version: 1, deviceId, nextEvent: id + 1, events: list, selected: 'coral' } };
}

const legacyStats = { version: 2, runs: 50, dodged: 10, distance: 400, legacyDodged: 0 };
const coinsOf = game => Number(/🪙 (\d+)/.exec(game.walletText())[1]);
const runEvents = store => store.json(keys.economy).events.filter(event => event.run);
let passed = 0;
function test(name, body) {
  try { body(); passed++; }
  catch (error) { error.message = `[${name}] ${error.message}`; throw error; }
}

test('más de 10.000 eventos se compactan sin perder saldo, compras ni rangos', () => {
  const { coins, economy } = legacyEconomy(10500);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  let game = launch(store);
  assert.equal(game.walletText(), `🪙 ${coins}`, 'el saldo anterior debe leerse completo, no marcarse como ilegible');
  const saved = store.json(keys.economy);
  assert.equal(saved.version, 2, 'el historial compactado usa el formato 2');
  assert.equal(saved.events.length, 60, 'solo se conservan los eventos recientes');
  assert.equal(saved.base.count + saved.events.length, 10500, 'ningún evento se pierde al compactar');
  assert(saved.base.owned.includes('coral'), 'las compras se conservan');
  assert(saved.base.ranks.includes('explorer'), 'los rangos se conservan');
  game.click('openingSettings');
  assert.equal(game.text('garageCoins'), `${coins} monedas`);
  assert(game.text('rank-explorer').includes('Desbloqueado'), 'el rango Explorador sigue desbloqueado');
  assert.equal(game.elements.get('boat-breeze').disabled, false, 'la lancha del rango sigue disponible');
  assert.equal(game.text('boat-coral'), 'Equipada', 'la lancha elegida sigue equipada');
  game = launch(store);
  assert.equal(game.walletText(), `🪙 ${coins}`, 'el saldo compactado debe sobrevivir a un nuevo arranque');
});

test('seguir jugando más allá de 10.000 eventos nunca bloquea la economía', () => {
  const { coins, economy } = legacyEconomy(10500);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  const game = launch(store);
  for (let run = 1; run <= 700; run++) {
    game.finishRun();
    assert(store.json(keys.economy).events.length <= 301, `el historial reciente debe seguir acotado (viaje ${run})`);
  }
  const saved = store.json(keys.economy);
  assert.equal(saved.base.count + saved.events.length, 10500 + 700, 'cada viaje debe quedar registrado una vez');
  assert(saved.base.marks.length <= 40, 'las marcas de comparación están acotadas');
  assert.equal(game.walletText(), `🪙 ${coins + 700}`);
  assert.equal(launch(store).walletText(), `🪙 ${coins + 700}`, 'el saldo debe leerse bien tras compactar varias veces');
});

test('comprar después de compactar descuenta una sola vez y se conserva', () => {
  const { coins, economy } = legacyEconomy(1000);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  let game = launch(store);
  game.click('openingSettings');
  game.click('boat-storm');
  assert.equal(game.text('garageCoins'), `${coins - 45} monedas`);
  game.click('boat-storm');
  game = launch(store);
  game.click('openingSettings');
  assert.equal(game.text('garageCoins'), `${coins - 45} monedas`, 'no se cobra dos veces');
  assert.equal(game.text('boat-storm'), 'Equipada');
  assert.equal(game.text('boat-coral'), 'Elegir', 'la compra anterior sigue siendo propia');
});

test('un resumen manipulado se rechaza sin borrar los datos guardados', () => {
  const { economy } = legacyEconomy(1000);
  const store = makeStore({ [keys.economy]: economy });
  launch(store);
  const compact = store.json(keys.economy);
  const forged = JSON.parse(JSON.stringify(compact));
  forged.base.hash = 'zz';
  const forgedText = JSON.stringify(forged);
  const damaged = makeStore({ [keys.economy]: forgedText });
  const game = launch(damaged);
  assert.equal(game.walletText(), '🪙 !', 'un resumen inválido debe avisar en lugar de inventar un saldo');
  game.finishRun(100, 5, 1);
  assert.equal(damaged.data.get(keys.economy), forgedText, 'el dato dañado se conserva para recuperarlo');
});

test('un fallo al guardar estadísticas no pierde ni duplica el viaje', () => {
  const store = makeStore();
  let game = launch(store);
  store.failing.add(keys.stats);
  const message = game.finishRun(100, 5, 1);
  assert(message.includes('No se pudo guardar todo'), 'el jugador debe saber que el guardado quedó pendiente');
  assert.equal(runEvents(store).length, 1, 'las monedas del viaje sí se guardaron');
  assert(store.data.has(keys.settle), 'el cierre queda registrado como pendiente');
  assert(!store.data.has(keys.stats), 'las estadísticas todavía no se guardaron');
  const coins = coinsOf(game);
  store.failing.clear();
  game = launch(store);
  assert.equal(store.json(keys.stats).runs, 1, 'las estadísticas se completan al reabrir');
  assert.equal(runEvents(store).length, 1, 'las monedas no se cobran dos veces');
  assert.equal(coinsOf(game), coins);
  assert(!store.data.has(keys.settle), 'el registro pendiente se elimina al completarse');
  game = launch(store);
  assert.equal(store.json(keys.stats).runs, 1, 'reabrir otra vez no cambia nada');
  assert.equal(runEvents(store).length, 1);
});

test('varios viajes pendientes se aplican una sola vez y en orden', () => {
  const store = makeStore();
  let game = launch(store);
  store.failing.add(keys.stats);
  game.finishRun(100, 5, 1);
  game.finishRun(300, 20, 0);
  assert.equal(runEvents(store).length, 2);
  store.failing.clear();
  game = launch(store);
  const stats = store.json(keys.stats);
  assert.equal(stats.runs, 2, 'cada viaje cuenta una vez en las estadísticas');
  assert.equal(stats.distance, 400);
  assert.equal(stats.dodged, 25);
  assert.equal(runEvents(store).length, 2, 'las monedas no se duplican');
  assert.equal(new Set(stats.appliedRuns).size, 2);
});

test('sin poder guardar monedas ni estadísticas, ambos viajes se recuperan después', () => {
  const store = makeStore();
  let game = launch(store);
  store.failing.add(keys.economy);
  store.failing.add(keys.stats);
  game.finishRun(100, 5, 1);
  game.finishRun(0, 0, 0);
  assert.equal(JSON.parse(store.data.get(keys.settle)).runs.length, 2);
  store.failing.clear();
  game = launch(store);
  assert.equal(runEvents(store).length, 2);
  assert.equal(store.json(keys.stats).runs, 2);
  assert.equal(coinsOf(game), 15 + 6 + 1, 'viaje 1 (15) + misión de esquivar (6) + viaje 2 (1)');
});

test('restaurar una copia completa un viaje pendiente sin repetir estadísticas', () => {
  const store = makeStore({ [keys.economy]: '{dañado' });
  const game = launch(store);
  assert.equal(game.walletText(), '🪙 !');
  game.finishRun(100, 5, 1);
  assert.equal(store.json(keys.stats).runs, 1, 'las estadísticas sí se guardan');
  assert.equal(store.data.get(keys.economy), '{dañado', 'el dato dañado no se sobrescribe');
  assert(store.data.has(keys.settle), 'las monedas quedan pendientes hasta restaurar');
  game.elements.get('backupText').value = JSON.stringify({
    format: 'rio-aventura-progress-v2', profile: { name: 'Gabriel', avatar: 0, quality: 'high' }, best: 0,
    stats: { runs: 0, dodged: 0, distance: 0, legacyDodged: 0 },
    economy: { version: 1, deviceId: 'dcopia', nextEvent: 1, events: [], selected: 'classic' }
  });
  game.click('importProgress');
  assert.equal(coinsOf(game), 21, 'viaje (15) + misión de esquivar (6), una sola vez');
  assert.equal(store.json(keys.stats).runs, 1, 'las estadísticas no se cuentan dos veces');
  assert(!store.data.has(keys.settle));
});

test('un viaje interrumpido se retoma con su progreso y se cobra una sola vez', () => {
  const store = makeStore();
  let game = launch(store);
  game.play();
  game.sandbox.window.__setRun(400, 7, 3);
  game.fire('window:pagehide');
  assert.equal(game.run().state, 'paused', 'al ocultarse la página el viaje se pausa');
  assert.equal(store.json(keys.trip).score, 7);
  game = launch(store);
  assert.equal(game.text('play'), 'Continuar viaje');
  assert(game.text('message').includes('7 puntos') && game.text('message').includes('400 m'));
  assert(!game.hidden('finishTrip'), 'se ofrece cobrar lo conseguido');
  game.play();
  const resumed = game.run();
  assert.equal(resumed.state, 'playing');
  assert.equal(resumed.score, 7);
  assert.equal(resumed.collectedCoins, 3);
  assert(Math.abs(resumed.runDistance - 400) < 1);
  assert.equal(resumed.stageIndex, 3, 'el tramo se calcula a partir de la distancia guardada');
  assert(resumed.shieldTimer > 0, 'al retomar hay un breve escudo');
  assert(game.hidden('finishTrip'));
  game.sandbox.window.__finish();
  const events = store.json(keys.economy).events;
  assert.equal(events.filter(event => event.run).length, 1);
  assert.equal(events.find(event => event.run).amount, 34, '11 por distancia + 14 por esquivas + 9 por monedas');
  assert.equal(coinsOf(game), 34 + 15 + 10, 'viaje + tres misiones diarias + rango Explorador');
  assert(!store.data.has(keys.trip), 'el viaje terminado ya no se ofrece');
  assert.equal(store.json(keys.stats).runs, 1);
  // Aunque un guardado antiguo del mismo viaje reaparezca, no se vuelve a cobrar.
  store.data.set(keys.trip, JSON.stringify({ version: 1, id: events.find(event => event.run).run.id, score: 7, lives: 2, pickups: 3, distance: 400, elapsed: 40 }));
  game = launch(store);
  assert.notEqual(game.text('play'), 'Continuar viaje', 'un viaje ya cobrado no se ofrece de nuevo');
  assert.equal(coinsOf(game), 34 + 15 + 10);
  assert.equal(store.json(keys.stats).runs, 1);
  assert(!store.data.has(keys.trip));
});

test('cobrar un viaje interrumpido paga igual que terminarlo', () => {
  const store = makeStore();
  let game = launch(store);
  game.play();
  game.sandbox.window.__setRun(100, 5, 1);
  game.fire('window:pagehide');
  game = launch(store);
  game.click('finishTrip');
  assert(game.elements.get('title').innerHTML.includes('Fin del'), 'se muestra el cierre del viaje');
  assert.equal(coinsOf(game), 21);
  assert.equal(game.text('play'), 'Jugar otra vez');
  game = launch(store);
  assert.notEqual(game.text('play'), 'Continuar viaje');
  assert.equal(runEvents(store).length, 1);
  assert.equal(store.json(keys.stats).runs, 1);
});

test('el viaje se guarda solo cada pocos segundos y al pausar o abrir ajustes', () => {
  const store = makeStore();
  const game = launch(store);
  game.play();
  assert(!store.data.has(keys.trip), 'un viaje recién empezado no guarda nada');
  game.tick(70, 50);
  const periodic = store.json(keys.trip);
  assert(periodic && periodic.elapsed >= 3, 'el guardado periódico ocurre durante el juego');
  store.data.delete(keys.trip);
  game.click('pause');
  assert(store.data.has(keys.trip), 'pausar guarda el viaje');
  store.data.delete(keys.trip);
  game.click('pause');
  game.play();
  game.click('settings');
  assert(store.data.has(keys.trip), 'abrir ajustes guarda el viaje');
  store.data.delete(keys.trip);
  game.click('closeSettings');
  game.sandbox.window.rioAventuraSave();
  assert.equal(game.run().state, 'paused', 'el gancho de Android pausa el juego');
  assert(store.data.has(keys.trip), 'el gancho de Android guarda el viaje');
});

test('guardados de viaje vacíos, dañados o sin espacio no rompen el juego', () => {
  for (const trip of [
    { version: 1, id: 'r1', score: 0, lives: 3, pickups: 0, distance: 5, elapsed: 1 },
    { version: 1, id: 'r2', score: -5, lives: 3, pickups: 0, distance: 50, elapsed: 5 },
    { version: 1, id: 'r3', score: 3, lives: 0, pickups: 0, distance: 50, elapsed: 5 },
    { version: 1, id: '../x', score: 3, lives: 3, pickups: 0, distance: 50, elapsed: 5 },
    { version: 1, id: 'r4', score: 3, lives: 3, pickups: 0, distance: 'mucho', elapsed: 5 },
    '{dañado'
  ]) {
    const game = launch(makeStore({ [keys.trip]: trip }));
    assert.notEqual(game.text('play'), 'Continuar viaje', 'un guardado inútil no se ofrece');
    game.play();
    assert.equal(game.run().state, 'playing');
  }
  const store = makeStore();
  const game = launch(store);
  store.failing.add(keys.trip);
  game.play();
  game.tick(80, 50);
  game.click('pause');
  assert.equal(game.run().state, 'paused', 'sin espacio para guardar el viaje el juego sigue funcionando');
});

test('el HUD muestra la misma recompensa y el mismo límite que el cierre del viaje', () => {
  for (const [distance, dodged, pickups] of [[0, 0, 0], [70.4, 0, 0], [120.2, 3, 1], [400.6, 9, 4], [900.3, 40, 30], [5000.1, 20, 30]]) {
    const store = makeStore();
    const game = launch(store);
    game.play();
    game.sandbox.window.__setRun(distance, dodged, pickups);
    game.tick(1);
    const shown = Number(/viaje \+(\d+)/.exec(game.walletText())[1]);
    game.sandbox.window.__finish();
    const paid = runEvents(store)[0].amount;
    assert.equal(shown, paid, `el HUD (${shown}) debe coincidir con lo pagado (${paid}) para ${distance} m, ${dodged} esquivas, ${pickups} monedas`);
    assert(paid >= 1 && paid <= 80, 'la recompensa del viaje se mantiene entre 1 y 80');
  }
  const game = launch(makeStore());
  game.play();
  game.sandbox.window.__setRun(5000, 20, 30);
  game.tick(1);
  assert(game.walletText().includes('(máx.)'), 'el HUD indica cuándo se alcanzó el límite');
});

test('recoger monedas no recorre el historial de eventos', () => {
  const { economy } = legacyEconomy(250);
  const game = launch(makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats }));
  game.play();
  game.tick(1);
  const before = game.sandbox.window.__replayCount;
  for (let i = 0; i < 30; i++) {
    game.sandbox.window.__addCoin();
    game.tick(1);
  }
  assert.equal(game.run().collectedCoins, 30, 'las monedas se recogieron');
  assert.equal(game.sandbox.window.__replayCount, before, 'recoger monedas debe usar el saldo en caché');
});

test('los datos de la versión 2.3 siguen leyéndose y sus copias se pueden restaurar', () => {
  const { coins, economy } = legacyEconomy(120);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  let game = launch(store);
  assert.equal(game.walletText(), `🪙 ${coins}`);
  assert.equal(store.json(keys.economy).version, 1, 'un historial pequeño no se transforma sin necesidad');
  game.click('openingSettings');
  game.click('exportProgress');
  const backup = JSON.parse(game.elements.get('backupText').value);
  assert.equal(backup.format, 'rio-aventura-progress-v2', 'mientras no se compacta, la copia sigue siendo legible por la versión anterior');
  const fresh = launch(makeStore());
  fresh.elements.get('backupText').value = JSON.stringify(backup);
  fresh.click('importProgress');
  assert.equal(coinsOf(fresh), coins, 'una copia de 2.3 se restaura en un teléfono nuevo');
  const legacy = launch(makeStore());
  legacy.elements.get('backupText').value = JSON.stringify({ format: 'rio-aventura-progress-v1',
    profile: { name: 'Ana', avatar: 1, quality: 'low' }, best: 9, stats: { runs: 3, dodged: 4, distance: 5, legacyDodged: 6 } });
  legacy.click('importProgress');
  assert.equal(legacy.text('totalRuns'), '3', 'las copias de la primera versión siguen aceptándose');
});

test('las copias compactadas se restauran sin mezclar historiales distintos', () => {
  const { coins, economy } = legacyEconomy(1000);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  let game = launch(store);
  game.click('openingSettings');
  game.click('exportProgress');
  const snapshot = game.elements.get('backupText').value;
  assert.equal(JSON.parse(snapshot).format, 'rio-aventura-progress-v3', 'una copia compactada usa un formato nuevo que la versión anterior rechaza sin dañarse');
  game.click('closeSettings');
  for (let run = 0; run < 10; run++) game.finishRun();
  const wallet = store.data.get(keys.economy);
  // Una copia anterior del mismo historial no devuelve monedas ni borra viajes.
  game.click('openingSettings');
  game.elements.get('backupText').value = snapshot;
  game.click('importProgress');
  assert.equal(store.data.get(keys.economy), wallet, 'una copia anterior no cambia el saldo');
  assert.equal(coinsOf(game), coins + 10);
  // Una copia que contiene viajes que este teléfono no tiene sí los incorpora.
  const other = launch(makeStore({ [keys.economy]: JSON.parse(snapshot).economy, [keys.stats]: legacyStats }));
  for (let run = 0; run < 3; run++) other.finishRun();
  other.click('openingSettings');
  other.click('exportProgress');
  const ahead = other.elements.get('backupText').value;
  const catchUp = launch(makeStore({ [keys.economy]: JSON.parse(snapshot).economy, [keys.stats]: legacyStats }));
  catchUp.click('openingSettings');
  catchUp.elements.get('backupText').value = ahead;
  catchUp.click('importProgress');
  assert.equal(coinsOf(catchUp), coins + 3, 'una copia más reciente se adopta completa');
  // Dos historiales que se separaron después de compartir un origen no se mezclan.
  const left = launch(makeStore({ [keys.economy]: JSON.parse(snapshot).economy, [keys.stats]: legacyStats }));
  left.finishRun();
  left.click('openingSettings');
  left.elements.get('backupText').value = ahead;
  const leftWallet = left.walletText();
  left.click('importProgress');
  assert.equal(left.walletText(), leftWallet, 'historiales divergentes no se mezclan');
  assert(left.text('backupNotice').includes('No se'), 'se explica por qué no se restauró');
});

test('una copia anterior a la compactación se rechaza con una explicación', () => {
  const { economy } = legacyEconomy(120);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  const game = launch(store);
  game.click('openingSettings');
  game.click('exportProgress');
  const early = game.elements.get('backupText').value;
  game.click('closeSettings');
  for (let run = 0; run < 400; run++) game.finishRun();
  assert(store.json(keys.economy).version === 2, 'el historial se compactó');
  const wallet = store.data.get(keys.economy);
  game.click('openingSettings');
  game.elements.get('backupText').value = early;
  game.click('importProgress');
  assert(game.text('backupNotice').includes('compactación'), 'el aviso explica el motivo y cómo continuar');
  assert.equal(store.data.get(keys.economy), wallet, 'el saldo no cambia');
});

test('un almacenamiento lleno durante la compactación no pierde el saldo', () => {
  const { coins, economy } = legacyEconomy(10500);
  const store = makeStore({ [keys.economy]: economy, [keys.stats]: legacyStats });
  store.failing.add(keys.economy);
  const game = launch(store);
  assert.equal(game.walletText(), `🪙 ${coins}`, 'el saldo se lee aunque no se pueda reescribir');
  assert.equal(store.json(keys.economy).events.length, 10500, 'el dato original queda intacto');
  store.failing.clear();
  assert.equal(launch(store).walletText(), `🪙 ${coins}`);
  assert.equal(store.json(keys.economy).events.length, 60, 'se compacta en cuanto hay espacio');
});

console.log(`Progress safety tests passed (${passed})`);
