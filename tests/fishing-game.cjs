// La pesca dentro del juego completo: acercarse al caladero, parar, lanzar, recoger a tiempo, guardar la captura y venderla.
const assert = require('node:assert/strict');
const { launch, makeStore, keys } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}
const press = (game, key, down = true) => game.emit(down ? 'window:keydown' : 'window:keyup', { key });
const seaKey = 'rio-aventura-sea-v1';
const zoneOf = (game, id) => game.api().seaWorld().fishing.find(z => z.id === id);
const saleEvents = store => store.json(keys.economy).events.filter(e => e.sale);

// Abre el mundo libre con un generador fijo (la captura sale siempre igual: una caballa en la bahía).
function fishingGame(options = {}) {
  const game = launch({ random: () => 0.5, ...options });
  game.click('exploreSea');
  return game;
}
const goTo = (game, id) => { const z = zoneOf(game, id); game.api().seaPlace(z.x, z.y, 0); game.tick(3, 16); return z; };
// Lanza la caña y espera la picada (2,75 s con el generador fijo).
function cast(game) {
  game.click('fishButton');
  assert.equal(game.api().fishingState().phase, 'wait');
  for (let i = 0; i < 400 && game.api().fishingState() && game.api().fishingState().phase === 'wait'; i++) game.tick(1, 16);
  assert.equal(game.api().fishingState().phase, 'bite', 'pica');
}
function dockAldea(game) {
  const dock = game.api().seaWorld().docks.find(d => d.id === 'aldea');
  game.api().seaTrip().dist = Math.max(game.api().seaTrip().dist, 400);
  game.api().seaPlace(dock.x, dock.y + 250, 0);
  game.tick(3, 16);
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  return dock;
}

test('el botón de pescar solo aparece dentro de un caladero y con la lancha casi parada', () => {
  const game = fishingGame();
  assert(game.elements.get('fishButton').classList.contains('hidden'), 'oculto en el puerto');
  const zone = zoneOf(game, 'bahia');
  game.api().seaPlace(zone.x + zone.radius + 60, zone.y, 0);
  game.tick(3, 16);
  assert(game.elements.get('fishButton').classList.contains('hidden'), 'oculto fuera del círculo');
  assert.match(game.api().seaHintText(), /Caladero de la Bahía: entra en el círculo y frena/);
  goTo(game, 'bahia');
  assert(!game.elements.get('fishButton').classList.contains('hidden'), 'visible dentro y parado');
  assert.match(game.text('fishButton'), /Pescar aquí/);
  game.api().seaBoat().vx = 150;
  game.tick(1, 16);
  assert(game.elements.get('fishButton').classList.contains('hidden'), 'oculto si va rápido');
});

test('lanzar la caña deja la lancha quieta, espera la picada y avisa con claridad', () => {
  const game = fishingGame();
  const zone = goTo(game, 'bahia');
  const boat = game.api().seaBoat();
  game.click('fishButton');
  assert.match(game.text('fishButton'), /Esperando/);
  press(game, 'ArrowUp');
  game.tick(30, 16);
  press(game, 'ArrowUp', false);
  assert.equal(game.api().fishingState(), null, 'mover la lancha cancela la pesca');
  assert.match(game.text('stageToast'), /Dejaste de pescar/);
  goTo(game, 'bahia');
  boat.vy = -25;
  game.click('fishButton');
  const y0 = boat.y;
  game.tick(60, 16);
  assert(Math.abs(boat.y - y0) < 10, `el freno automático la detiene en seco (${(boat.y - y0).toFixed(1)})`);
  assert(Math.hypot(boat.vx, boat.vy) < 1, 'queda parada');
  for (let i = 0; i < 300 && game.api().fishingState().phase === 'wait'; i++) game.tick(1, 16);
  assert.equal(game.api().fishingState().phase, 'bite');
  assert.equal(game.text('fishButton'), '¡RECOGER!');
  assert(game.elements.get('fishButton').classList.contains('bite'));
  assert.match(game.text('stageToast'), /PICA/);
  assert(zone);
});

test('recoger a tiempo pone el pez en la hielera y lo muestra en el marcador', () => {
  const game = fishingGame();
  goTo(game, 'bahia');
  cast(game);
  game.tick(10, 16);
  game.click('fishButton');
  assert.equal(game.api().bag().caballa, 1, 'con el generador fijo sale una caballa');
  assert.match(game.text('stageToast'), /Caballa/);
  assert.match(game.text('lives'), /🐟1/);
  assert.equal(game.api().fishingState().phase, 'result');
  game.tick(70, 16);
  assert.equal(game.api().fishingState(), null);
  assert.match(game.text('fishButton'), /Pescar aquí/, 'se puede lanzar otra vez');
});

test('recoger demasiado pronto o demasiado tarde pierde el pez, sin penalizar nada más', () => {
  const game = fishingGame();
  goTo(game, 'bahia');
  game.click('fishButton');
  game.tick(20, 16);
  game.click('fishButton');
  assert.match(game.text('stageToast'), /demasiado pronto/);
  assert.equal(game.api().fishingState().phase, 'result');
  game.tick(70, 16);
  cast(game);
  game.tick(90, 16);
  assert.match(game.text('stageToast'), /Se escapó/);
  game.tick(70, 16);
  assert.equal(game.api().fishingState(), null);
  assert.equal(game.api().bag().caballa + game.api().bag().sardina, 0, 'sin pez');
});

test('los reflejos rápidos mejoran la captura y el lago da mejores peces que la bahía', () => {
  const bay = fishingGame({ random: () => 0.9 });
  goTo(bay, 'bahia');
  cast(bay);
  bay.click('fishButton');
  assert.match(bay.text('stageToast'), /reflejos rápidos/);
  const lake = fishingGame({ random: () => 0.93 });
  goTo(lake, 'lago');
  cast(lake);
  lake.click('fishButton');
  assert(lake.api().bag().dorada + lake.api().bag()['pez-luna'] === 1, 'en el lago salen peces de más valor');
});

test('salir del caladero o ir demasiado rápido cancela el lance', () => {
  const game = fishingGame();
  goTo(game, 'bahia');
  game.click('fishButton');
  game.api().seaPlace(game.api().seaWorld().spawn.x, game.api().seaWorld().spawn.y, 0);
  game.tick(3, 16);
  assert.equal(game.api().fishingState(), null);
  assert.match(game.text('stageToast'), /Saliste del caladero/);
});

test('con la hielera llena no se puede pescar y se indica dónde vender', () => {
  const game = fishingGame();
  goTo(game, 'bahia');
  Object.assign(game.api().bag(), { sardina: 10 });
  game.tick(2, 16);
  assert.match(game.text('fishButton'), /Hielera llena/);
  assert.equal(game.disabled('fishButton'), true);
  assert.match(game.api().seaHintText(), /Tomás/);
  game.click('fishButton');
  assert.equal(game.api().fishingState(), null);
});

test('pausar, atracar o abrir el menú no deja una pesca a medias', () => {
  const game = fishingGame();
  goTo(game, 'bahia');
  game.click('fishButton');
  game.click('pause');
  assert.equal(game.api().fishingState(), null);
  assert(game.elements.get('fishButton').classList.contains('hidden'));
});

test('vender al pescador: el pago es exacto, único y deja la hielera vacía', () => {
  const store = makeStore();
  const game = fishingGame({ store });
  Object.assign(game.api().bag(), { sardina: 3, pargo: 2, 'pez-luna': 1 });
  dockAldea(game);
  game.click('talk');
  assert(!game.hidden('dialogSell'), 'Tomás compra pescado');
  assert.match(game.text('sellList'), /Sardina ×3 = 6/);
  assert.match(game.text('sellList'), /Pez luna ×1 = 20/);
  const expected = 3 * 2 + 2 * 6 + 20;
  assert.match(game.text('sellFish'), new RegExp(`\\+${expected} 🪙`));
  const before = game.wallet();
  game.click('sellFish');
  assert.equal(game.wallet(), before + expected, 'cobra exactamente el valor');
  const events = saleEvents(store);
  assert.equal(events.length, 1);
  assert.equal(events[0].amount, expected);
  assert.equal(events[0].sale.n, 6);
  assert.equal(store.json(keys.economy).version, 4);
  assert.equal(game.api().bag().sardina + game.api().bag().pargo + game.api().bag()['pez-luna'], 0);
  assert.match(game.text('dialogText'), /Te pago 38/);
  assert.equal(game.disabled('sellFish'), true);
  game.click('sellFish');
  assert.equal(game.wallet(), before + expected, 'no vende dos veces');
  assert.equal(saleEvents(store).length, 1);
  assert.equal(game.api().view().fishSold, 6);
  game.click('closeDialog');
  game.click('pause');
  game.click('settings');
  assert.equal(game.text('fish-total'), '6');
});

test('solo el pescador compra: en los demás muelles no hay venta', () => {
  const game = fishingGame();
  Object.assign(game.api().bag(), { sardina: 4 });
  const dock = game.api().seaWorld().docks.find(d => d.id === 'puerto');
  game.api().seaTrip().dist = 400;
  game.api().seaPlace(dock.x, dock.y + 250, 0); game.tick(3, 16);
  game.api().seaPlace(dock.x, dock.y, 0); game.tick(60, 16);
  game.click('talk');
  assert(game.hidden('dialogSell'));
  assert.equal(game.api().sellNow(), false);
});

test('la captura se guarda: al cerrar y reabrir la hielera sigue igual', () => {
  const store = makeStore();
  const game = fishingGame({ store });
  goTo(game, 'bahia');
  cast(game);
  game.click('fishButton');
  game.click('pause');
  assert.equal(store.json(seaKey).fish.bag.caballa, 1);
  assert(store.json(seaKey).fish.sellId);
  const again = launch({ store, random: () => 0.5 });
  again.click('exploreSea');
  assert.equal(again.api().bag().caballa, 1);
  assert.equal(again.api().sellId(), game.api().sellId());
  assert.match(again.text('lives'), /🐟1/);
});

test('un guardado antiguo con una bolsa ya vendida no resucita los peces', () => {
  const store = makeStore();
  const game = fishingGame({ store });
  Object.assign(game.api().bag(), { sardina: 2 });
  dockAldea(game);
  game.api().seaSave();
  const stale = store.data.get(seaKey);
  game.click('talk');
  game.click('sellFish');
  assert.equal(saleEvents(store).length, 1);
  store.data.set(seaKey, stale);
  const again = launch({ store });
  again.click('exploreSea');
  assert.equal(again.api().bag().sardina, 0, 'la bolsa vendida no vuelve');
  assert.equal(saleEvents(store).length, 1);
});

test('si falla el guardado de la venta, no se pierde el pescado y se cobra una sola vez al reintentar', () => {
  const store = makeStore();
  const game = fishingGame({ store });
  Object.assign(game.api().bag(), { caballa: 4 });
  dockAldea(game);
  game.click('talk');
  store.failing.add(keys.economy);
  game.click('sellFish');
  assert.equal(game.api().bag().caballa, 4, 'la hielera sigue llena');
  assert.match(game.text('dialogText'), /No he podido/);
  store.failing.delete(keys.economy);
  const before = game.wallet();
  game.click('sellFish');
  assert.equal(game.wallet(), before + 12);
  assert.equal(saleEvents(store).length, 1);
});

test('el historial rechaza ventas falsificadas: repetidas, de más de 200, sin cantidad o mezcladas', () => {
  const store = makeStore();
  const game = fishingGame({ store });
  Object.assign(game.api().bag(), { sardina: 2 });
  dockAldea(game);
  game.click('talk');
  game.click('sellFish');
  const saved = store.json(keys.economy);
  const bad = copy => launch({ store: makeStore({ [keys.economy]: copy }) }).text('coinHud').includes('!');
  const forge = mutate => { const c = JSON.parse(JSON.stringify(saved)); mutate(c); return c; };
  const sale = c => c.events.find(e => e.sale);
  assert.equal(bad(saved), false);
  assert(bad(forge(c => c.events.push({ ...sale(c), id: 'dupe1' }))), 'identificador repetido');
  assert(bad(forge(c => { sale(c).amount = 201; })), 'más de 200');
  assert(bad(forge(c => { sale(c).sale.n = 11; })), 'más peces que la hielera');
  assert(bad(forge(c => { sale(c).sale.n = 0; })), 'ninguno');
  assert(bad(forge(c => { sale(c).sale.id = '¡mal!'; })), 'identificador inválido');
  assert(bad(forge(c => { sale(c).quest = { id: 'qx', tpl: 'a', giver: 'puerto', to: 'aldea' }; })), 'mezclada con un encargo');
});

test('la compactación conserva las ventas y la copia manual v5 las restaura sin duplicar', () => {
  const store = makeStore();
  const game = fishingGame({ store });
  Object.assign(game.api().bag(), { sardina: 1 });
  dockAldea(game);
  game.click('talk');
  for (let i = 0; i < 330; i++) {
    Object.assign(game.api().bag(), { sardina: 1 });
    assert.equal(game.api().sellNow(), true, `venta ${i}`);
  }
  const economy = store.json(keys.economy);
  assert(economy.base && economy.version === 4, 'compactado en formato 4');
  const again = launch({ store });
  assert.equal(again.api().view().fishSold, 330);
  assert(!again.text('coinHud').includes('!'));
  game.click('closeDialog');
  game.click('pause'); game.click('settings');
  game.click('exportProgress');
  const code = game.elements.get('backupText').value;
  assert.equal(JSON.parse(code).format, 'rio-aventura-progress-v5');
  const coins = game.wallet();
  game.elements.get('backupText').value = code;
  game.click('importProgress');
  assert.equal(game.wallet(), coins);
  assert.equal(game.api().view().fishSold, 330);
});

test('datos anteriores intactos: sin ventas ni entregas el historial sigue en formato 3', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea'); game.arrive();
  assert.equal(store.json(keys.economy).version, 3);
  game.click('exploreSea');
  goTo(game, 'bahia');
  cast(game);
  game.click('fishButton');
  game.click('pause');
  assert.equal(store.json(keys.economy).version, 3, 'pescar no toca el historial: solo vender lo hace');
});

test('el rendimiento no empeora: los caladeros no añaden sprites nuevos ni degradados por fotograma', () => {
  const game = fishingGame({ pixelRatio: 2 });
  goTo(game, 'bahia');
  game.tick(30, 16);
  const built = game.art().debug.spritesBuilt;
  game.counters.gradients = 0;
  let worst = 0;
  game.click('fishButton');
  for (let i = 0; i < 300; i++) {
    game.counters.drawImage = 0;
    game.tick(1, 16);
    worst = Math.max(worst, game.counters.drawImage);
  }
  assert.equal(game.art().debug.spritesBuilt, built);
  assert.equal(game.counters.gradients, 0);
  assert(worst < 160, `drawImage por fotograma: ${worst}`);
});

console.log(`Fishing game tests passed (${passed})`);
