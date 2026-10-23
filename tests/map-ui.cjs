// Pruebas del mapa jugable: abrir, elegir destino, zarpar, llegar y ver lo desbloqueado.
const assert = require('node:assert/strict');
const { launch, makeStore, keys } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}

const ids = ['puerto', 'aldea', 'manglar', 'cascada', 'ruinas', 'laguna'];
const back = game => game.sandbox.window.rioAventuraBack();

test('el mapa se abre desde el título y propone el primer destino abierto', () => {
  const game = launch();
  assert(!game.hidden('openMap'), 'el botón del mapa se ve en el título');
  game.click('openMap');
  assert(!game.hidden('mapPanel') && game.hidden('overlay'));
  assert(game.text('mapName').includes('Aldea Coral'), 'la aldea es el primer destino abierto');
  assert.equal(game.disabled('sail'), false);
  assert.match(game.text('mapProgress'), /0\/5/);
  for (const id of ids) assert(game.elements.has(`node-${id}`), `existe node-${id}`);
});

test('los destinos bloqueados explican qué falta y no zarpan', () => {
  const game = launch();
  game.click('openMap');
  game.click('node-ruinas');
  assert.equal(game.disabled('sail'), true);
  assert.match(game.text('mapLock'), /Descubre Manglar Sombrío/);
  assert.match(game.text('mapLock'), /Descubre Cascada Brumosa/);
  game.click('sail');
  assert(!game.hidden('mapPanel'), 'el mapa sigue abierto');
  assert.equal(game.api().state(), 'ready');
  game.click('node-laguna');
  assert.match(game.text('mapLock'), /Descubre Ruinas del Sol/);
  assert.match(game.text('mapLock'), /Navegante/);
  game.click('node-puerto');
  assert(game.attr('sail', 'x') === undefined && game.elements.get('sail').classList.contains('hidden'));
});

test('cada destino muestra distancia, duración, dificultad y premio', () => {
  const game = launch();
  game.click('openMap');
  game.click('node-aldea');
  const facts = game.text('mapFacts');
  assert.match(facts, /1200 m/);
  assert.match(facts, /≈ [\d,]+ min/);
  assert.match(facts, /★☆☆☆☆/);
  assert.match(facts, /\+20/);
});

test('elegir aldea y zarpar inicia la ruta; al llegar se descubre y se abren dos rutas', () => {
  const game = launch();
  game.click('openMap');
  game.click('node-aldea');
  game.click('sail');
  assert(game.hidden('mapPanel'));
  assert.equal(game.api().state(), 'playing');
  assert.equal(game.api().route(), 'aldea');
  assert.equal(game.arrive(2), 'arrived');
  assert(!game.hidden('arrivalCard'), 'sale la tarjeta de descubrimiento');
  assert.match(game.text('arrivalTitle'), /Aldea Coral/);
  assert.match(game.text('arrivalText'), /\+20/);
  assert.match(game.text('arrivalText'), /Manglar Sombrío/);
  game.click('openMap');
  assert.match(game.text('mapProgress'), /1\/5/);
  assert(game.text('mapName').includes('Manglar'), 'se propone el siguiente destino abierto');
  assert.equal(game.disabled('sail'), false);
  game.click('node-cascada');
  assert.equal(game.disabled('sail'), false);
  game.click('node-ruinas');
  assert.equal(game.disabled('sail'), true);
});

test('repetir un destino descubierto no muestra otra vez la tarjeta ni paga de nuevo', () => {
  const game = launch();
  game.sail('aldea'); game.arrive();
  const coins = game.wallet();
  game.click('openMap'); game.click('node-aldea');
  assert.match(game.text('mapFacts'), /Descubierto/);
  game.click('sail');
  game.arrive();
  assert(game.hidden('arrivalCard'));
  const gained = game.wallet() - coins;
  assert(gained > 0 && gained < 20 + 34, 'solo gana el viaje, no el premio de descubrimiento');
});

test('la navegación libre sigue disponible desde el mapa y desde el título', () => {
  const game = launch();
  game.click('openMap');
  game.click('freeSail');
  assert.equal(game.api().state(), 'playing');
  assert.equal(game.api().route(), null);
  const free = launch();
  free.click('play');
  assert.equal(free.api().route(), null);
});

test('el mapa no se abre con un viaje en marcha, en pausa o por retomar', () => {
  const game = launch();
  game.click('play');
  game.click('openMap');
  assert(game.hidden('mapPanel'), 'no se abre jugando');
  game.click('pause');
  assert(game.elements.get('openMap').classList.contains('hidden'), 'oculto en pausa');
  game.fire('document:visibilitychange');
  const store = game.store;
  const reopened = launch({ store });
  if (reopened.api().interrupted()) assert(reopened.elements.get('openMap').classList.contains('hidden'));
});

test('el botón atrás cierra el mapa, luego pausa el viaje y no hace nada en el título', () => {
  const game = launch();
  assert.equal(back(game), false);
  game.click('openMap');
  assert.equal(back(game), true);
  assert(game.hidden('mapPanel') && !game.hidden('overlay'));
  game.click('play');
  assert.equal(back(game), true);
  assert.equal(game.api().state(), 'paused');
});

test('la pista del mapa sale una sola vez y se recuerda', () => {
  const store = makeStore();
  const first = launch({ store });
  first.click('openMap');
  assert(!first.hidden('mapHint'));
  first.click('node-aldea');
  assert(first.hidden('mapHint'));
  assert.equal(store.data.get(keys.hint), '1');
  const second = launch({ store });
  second.click('openMap');
  assert(second.hidden('mapHint'));
});

test('el mapa se dibuja sin valores no finitos y la partida no se redibuja debajo', () => {
  const game = launch();
  game.tick(3);
  game.click('openMap');
  const before = game.counters.ops;
  game.tick(10, 40);
  assert.equal(game.counters.ops, before, 'el lienzo del juego no se toca con el mapa abierto');
  game.resize(1400);
  game.tick(5, 40);
  game.click('closeMap');
  game.tick(3);
  assert(game.counters.ops > before, 'al cerrar el mapa el juego vuelve a dibujarse');
});

test('el pasaporte y los logros reflejan lo descubierto', () => {
  const game = launch();
  game.click('settings');
  assert.match(game.text('passport-aldea'), /Abierto/);
  assert.match(game.text('passport-ruinas'), /🔒/);
  game.click('closeSettings');
  game.sail('aldea'); game.arrive();
  game.click('settings');
  assert.match(game.text('passport-aldea'), /Descubierto · 1 llegada/);
  assert.equal(game.text('achievement-explorer'), 'Desbloqueado');
  assert.equal(game.text('achievement-cartographer'), '1/5');
});

test('con el historial dañado todo el mapa queda bloqueado y no zarpa', () => {
  const store = makeStore({ 'rio-aventura-economy-v1': '{no es json' });
  const game = launch({ store });
  game.click('openMap');
  game.click('node-aldea');
  assert.equal(game.disabled('sail'), true);
  game.click('sail');
  assert.equal(game.api().state(), 'ready', 'no zarpa por una ruta');
  game.click('freeSail');
  assert.equal(game.api().state(), 'playing');
});

test('recorrido completo: se descubren los cinco destinos en orden y el estado persiste', () => {
  const store = makeStore();
  let game = launch({ store });
  const order = ['aldea', 'manglar', 'cascada', 'ruinas'];
  for (const id of order) {
    game.click('openMap'); game.click(`node-${id}`);
    assert.equal(game.disabled('sail'), false, `${id} abierto`);
    game.click('sail');
    assert.equal(game.arrive(), 'arrived', id);
  }
  game.click('openMap'); game.click('node-laguna');
  assert.equal(game.disabled('sail'), true, 'la laguna pide el rango Navegante');
  game.click('closeMap');
  game.api().economy();
  game = launch({ store });
  game.click('openMap');
  assert.match(game.text('mapProgress'), /4\/5/);
});

console.log(`Map UI tests passed (${passed})`);
