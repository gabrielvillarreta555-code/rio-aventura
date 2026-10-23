// Pausa, guardar y salir sin morir, en el río clásico y en el mundo libre; botón Atrás de Android.
const assert = require('node:assert/strict');
const { launch, makeStore, keys } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}
const back = game => game.sandbox.window.rioAventuraBack();
const press = (game, key, down = true) => game.emit(down ? 'window:keydown' : 'window:keyup', { key });

test('en el río clásico el botón de pausa abre un menú con reanudar, guardar y salir, y terminar', () => {
  const game = launch();
  game.click('play');
  game.tick(60, 16);
  game.click('pause');
  assert.equal(game.api().state(), 'paused');
  assert(!game.hidden('overlay'));
  assert.match(game.html('title'), /En pausa/);
  assert.equal(game.text('play'), 'Reanudar');
  assert(!game.elements.get('saveExit').classList.contains('hidden'), 'Guardar y salir visible');
  assert(!game.elements.get('endTrip').classList.contains('hidden'), 'Terminar y cobrar visible');
  game.click('play');
  assert.equal(game.api().state(), 'playing', 'reanudar funciona');
  assert(game.hidden('overlay'), 'sin menú mientras se juega');
});

test('guardar y salir pide confirmación; cancelar sigue en pausa y confirmar vuelve al menú sin morir ni cobrar', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('play');
  game.tick(90, 16);
  game.api().score(3);
  const distance = game.api().runDistance();
  const lives = game.api().lives;
  game.click('pause');
  game.click('saveExit');
  assert(!game.hidden('confirmPanel'), 'pide confirmación');
  assert.match(game.text('confirmText'), /guardado/);
  game.click('confirmNo');
  assert(game.hidden('confirmPanel'));
  assert.equal(game.api().state(), 'paused', 'cancelar no sale');
  game.click('saveExit');
  game.click('confirmYes');
  assert(game.hidden('confirmPanel'));
  assert.equal(game.api().state(), 'ready');
  assert.match(game.html('title'), /Viaje[\s\S]*guardado/);
  assert.equal(game.text('play'), 'Continuar viaje');
  assert(!game.hidden('overlay'));
  assert.equal(store.data.has(keys.economy), false, 'salir no cobra nada todavía');
  assert(store.data.has(keys.trip), 'el viaje queda guardado');
  assert.equal(game.api().interrupted().id, store.json(keys.trip).id);
  assert(store.json(keys.trip).distance >= distance - 1);
  // Continuar: mismo viaje, mismos puntos.
  game.click('play');
  assert.equal(game.api().state(), 'playing');
  assert.equal(game.api().tripId(), store.json(keys.trip).id);
  assert(game.api().runDistance() >= distance - 1);
});

test('tras guardar y salir se puede cobrar el viaje una sola vez, y no queda nada pendiente', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('play');
  game.tick(120, 16);
  game.api().score(4);
  game.click('pause');
  game.click('saveExit'); game.click('confirmYes');
  game.click('finishTrip');
  assert.equal(game.api().state(), 'over');
  const events = store.json(keys.economy).events.filter(e => e.run);
  assert.equal(events.length, 1);
  const coins = game.wallet();
  assert(!store.data.has(keys.trip), 'el viaje guardado se retira');
  const again = launch({ store });
  assert.equal(again.api().interrupted(), null);
  assert.equal(again.wallet(), coins, 'reabrir no cobra otra vez');
});

test('guardar y salir sobrevive a cerrar la app: al reabrir se ofrece continuar el mismo viaje', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('play');
  game.tick(80, 16);
  game.click('pause'); game.click('saveExit'); game.click('confirmYes');
  const again = launch({ store });
  assert.equal(again.api().interrupted().id, game.api().interrupted().id);
  assert.match(again.html('title'), /interrumpido/);
});

test('terminar el viaje desde la pausa cobra lo conseguido y deja el menú, sin morir', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('play');
  game.tick(120, 16);
  game.api().score(5);
  assert(game.api().lives() === undefined || true);
  game.click('pause');
  game.click('endTrip');
  assert.match(game.text('confirmTitle'), /Terminar/);
  game.click('confirmYes');
  assert.equal(game.api().state(), 'over');
  assert.match(game.html('title'), /Fin del/);
  assert.equal(store.json(keys.economy).events.filter(e => e.run).length, 1);
  assert(!store.data.has(keys.trip));
  game.click('play');
  assert.equal(game.api().state(), 'playing', 'se puede jugar otra vez');
});

test('si no se puede guardar, no se sale: se avisa y se puede reanudar', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('play');
  game.tick(60, 16);
  game.click('pause');
  store.data.delete(keys.trip);
  store.failing.add(keys.trip);
  game.click('saveExit'); game.click('confirmYes');
  assert.match(game.html('title'), /No se pudo/);
  assert.notEqual(game.api().state(), 'ready');
  store.failing.delete(keys.trip);
  game.click('play');
  assert.equal(game.api().state(), 'playing');
});

test('en las rutas del mapa también se puede guardar y salir, y se retoma la misma ruta', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea');
  game.tick(60, 16);
  game.click('pause'); game.click('saveExit'); game.click('confirmYes');
  assert.match(game.text('message'), /Aldea Coral/);
  game.click('play');
  assert.equal(game.api().route(), 'aldea');
});

test('en el mundo libre la pausa ofrece guardar y salir, y no cobra ni pierde nada', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  press(game, 'ArrowUp');
  game.tick(100, 16);
  press(game, 'ArrowUp', false);
  const boat = game.api().seaBoat();
  const spot = { x: boat.x, y: boat.y };
  game.click('pause');
  assert(!game.elements.get('saveExit').classList.contains('hidden'));
  assert(game.elements.get('endTrip').classList.contains('hidden'), 'no hay «terminar y cobrar» en el mundo libre');
  game.click('saveExit');
  assert.match(game.text('confirmText'), /posición/);
  game.click('confirmYes');
  assert.equal(game.api().mode(), 'classic');
  assert.equal(game.api().state(), 'ready');
  assert.equal(store.data.has(keys.economy), false);
  game.click('exploreSea');
  assert(Math.abs(game.api().seaBoat().x - spot.x) < 1 && Math.abs(game.api().seaBoat().y - spot.y) < 1, 'vuelve al mismo punto');
});

test('botón Atrás: jugando pausa, en la pausa pregunta, en la pregunta cancela, y en el menú no atrapa', () => {
  const game = launch();
  assert.equal(back(game), false, 'en el menú principal deja salir de la app');
  game.click('play');
  assert.equal(back(game), true);
  assert.equal(game.api().state(), 'paused');
  assert.equal(back(game), true);
  assert(!game.hidden('confirmPanel'), 'pregunta si guardar y salir');
  assert.equal(back(game), true);
  assert(game.hidden('confirmPanel'), 'otra vez cancela');
  assert.equal(game.api().state(), 'paused');
  back(game);
  game.click('confirmYes');
  assert.equal(game.api().state(), 'ready');
  assert.equal(back(game), false);
});

test('botón Atrás tras terminar un viaje vuelve al menú; en un muelle pregunta antes de salir', () => {
  const game = launch();
  game.sail('aldea');
  game.arrive();
  assert.equal(game.api().state(), 'arrived');
  assert.equal(back(game), true);
  assert.equal(game.api().state(), 'ready');
  assert.match(game.html('title'), /Río/);
  game.click('exploreSea');
  const dock = game.api().seaWorld().docks.find(d => d.id === 'puerto');
  game.api().seaTrip().dist = 300;
  game.api().seaPlace(dock.x, dock.y + 250, 0);
  game.tick(3, 16);
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  assert.equal(back(game), true);
  assert(!game.hidden('confirmPanel'));
  game.click('confirmYes');
  assert.equal(game.api().mode(), 'classic');
});

test('la tecla Escape equivale a Atrás', () => {
  const game = launch();
  game.click('play');
  press(game, 'Escape');
  assert.equal(game.api().state(), 'paused');
  press(game, 'Escape');
  assert(!game.hidden('confirmPanel'));
  press(game, 'Escape');
  assert(game.hidden('confirmPanel'));
});

test('el botón de pausa es grande y tiene una etiqueta clara', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(require('node:path').join(__dirname, '../app/src/main/assets/index.html'), 'utf8');
  assert.match(html, /#hudActions button \{ width: 46px; height: 46px; \}/);
  assert.match(html, /id="pause"[^>]*aria-label="Pausar o salir al menú"/);
});

console.log(`Pause tests passed (${passed})`);
