// Pruebas del mundo explorable 2.5: rutas con dificultad propia, llegada, descubrimiento único,
// desbloqueos, persistencia, reanudación, cierres pendientes y migración de datos de 2.4.
// Se ejecuta desde tests/visual-smoke.cjs (node tests/visual-smoke.cjs).
const assert = require('node:assert/strict');
const { launch, makeStore, keys } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; }
  catch (error) { error.message = `[${name}] ${error.message}`; throw error; }
}

const savedEvents = store => store.json(keys.economy).events;
const discoveries = store => savedEvents(store).filter(event => event.discover);
const runs = store => savedEvents(store).filter(event => event.run);

// Datos reales de la versión 2.4 (formato 1 y sin ningún dato del mundo).
function economy24(coins = 30) {
  const events = [];
  for (let i = 1; i <= coins; i++) events.push({ id: `dvieja-${i}`, type: 'earn', amount: 1, run: { id: `rv${i}`, day: '2020-05-01', distance: 1, dodged: 0, pickups: 0 } });
  return { version: 1, deviceId: 'dvieja', nextEvent: coins + 1, events, selected: 'classic', appliedRuns: [] };
}
const stats24 = { version: 2, runs: 12, dodged: 6, distance: 600, legacyDodged: 0, appliedRuns: [] };

test('cada ruta tiene su propia dificultad y la navegación libre no cambia', () => {
  const game = launch();
  game.sail(null);
  assert.equal(game.api().route(), null);
  assert.equal(game.text('stageLabel'), 'Tramo 1 · Orillas tranquilas');
  assert.equal(game.api().speed(), 140, 'la navegación libre conserva su velocidad inicial');
  assert.equal(game.api().tune().speedCap, 390);
  game.sail('aldea');
  assert.equal(game.api().route(), 'aldea');
  assert.equal(game.text('stageLabel'), 'Hacia Aldea Coral · 1/3');
  assert.equal(game.text('stageDistance'), '0 / 1200 m');
  assert.equal(game.api().speed(), 130, 'la ruta de la aldea arranca más despacio');
  assert.equal(game.api().scene().theme, 'aldea', 'la capa visual recibe el tema de la ruta');
  game.api().elapsed(900);
  game.tick(400);
  assert(game.api().speed() <= 270 + 1, 'la corriente de la aldea nunca pasa de su tope');
  game.api().lives(3);
  game.api().startRoute('aldea');
});

test('una ruta bloqueada no arranca: se vuelve a la navegación libre', () => {
  const game = launch();
  for (const id of ['manglar', 'cascada', 'ruinas', 'laguna']) {
    game.sail(id);
    assert.equal(game.api().route(), null, `${id} está bloqueada al principio`);
    assert.equal(game.api().open(id), false);
  }
  game.sail('aldea');
  assert.equal(game.api().route(), 'aldea', 'la aldea está abierta desde el principio');
  game.sail('inventada');
  assert.equal(game.api().route(), null, 'una ruta desconocida no existe');
});

test('llegar al destino termina el viaje, descubre el lugar y paga una sola vez', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea');
  assert.equal(game.arrive(), 'arrived');
  const view = game.api().view();
  assert(view.discovered.has('aldea'), 'la aldea queda descubierta');
  assert.equal(discoveries(store).length, 1);
  assert.equal(discoveries(store)[0].amount, 20, 'la primera visita paga lo definido para la aldea');
  const run = runs(store)[0].run;
  assert.equal(run.route, 'aldea');
  assert.equal(run.arrived, true);
  assert.equal(run.distance, 1200);
  assert.equal(runs(store)[0].amount, 34, '1200 m dan 34 monedas de viaje');
  assert.equal(store.json(keys.economy).version, 3, 'al descubrir algo el historial pasa al formato 3');
  const message = game.text('message');
  assert(message.includes('Lugar descubierto') && message.includes('+20'), 'el mensaje anuncia la primera visita');
  assert(message.includes('Manglar Sombrío') && message.includes('Cascada Brumosa'), 'el mensaje anuncia las rutas que se abren');
  assert(game.html('title').includes('Aldea Coral'));
  assert.equal(game.text('play'), 'Navegar otra vez');
  assert(!store.data.has(keys.trip) && !store.data.has(keys.settle), 'el viaje terminado no deja restos');
  assert.equal(game.api().open('manglar') && game.api().open('cascada'), true, 'se abrieron dos rutas nuevas');
  assert.equal(game.api().open('ruinas'), false, 'las ruinas piden descubrir las dos');
});

test('repetir una ruta no repite la recompensa de primera visita', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea');
  game.arrive();
  const coinsAfterFirst = game.wallet();
  game.click('play');
  game.api().lives(3);
  assert.equal(game.api().route(), 'aldea', 'Navegar otra vez repite la misma ruta');
  assert.equal(game.arrive(), 'arrived');
  assert.equal(discoveries(store).length, 1, 'sigue habiendo un único descubrimiento');
  assert.equal(runs(store).length, 2);
  assert(game.wallet() > coinsAfterFirst, 'el viaje repetido paga sus monedas normales');
  assert(!game.text('message').includes('Lugar descubierto'));
  assert.equal(game.api().view().arrivals.get('aldea'), 2, 'se cuentan las llegadas');
  assert(!/pendientes/.test(game.text('message')));
});

test('las rutas se abren en cadena y la laguna pide además el rango Navegante', () => {
  const store = makeStore();
  const game = launch({ store });
  for (const id of ['aldea', 'manglar', 'cascada', 'ruinas']) {
    game.sail(id);
    assert.equal(game.api().route(), id, `${id} debe estar abierta en su turno`);
    assert.equal(game.arrive(), 'arrived');
  }
  assert.equal(game.api().view().discovered.size, 4);
  assert.equal(game.api().view().earnedRanks.has('navigator'), false, 'sin esquivas confirmadas no hay rango');
  game.sail('laguna');
  assert.equal(game.api().route(), null, 'la laguna sigue cerrada sin el rango');
  // Con esquivas confirmadas se consigue el rango y la laguna se abre.
  game.sail('ruinas');
  game.arrive(20);
  assert(game.api().view().earnedRanks.has('navigator'), 'esquivar 20 obstáculos da el rango Navegante');
  game.sail('laguna');
  assert.equal(game.api().route(), 'laguna');
  assert.equal(game.arrive(), 'arrived');
  assert.equal(game.api().view().discovered.size, 5);
  assert.equal(discoveries(store).length, 5, 'cada destino se descubre exactamente una vez');
});

test('lo descubierto y las rutas abiertas se conservan al cerrar y abrir', () => {
  const store = makeStore();
  let game = launch({ store });
  game.sail('aldea');
  game.arrive();
  game.sail('cascada');
  game.arrive();
  const coins = game.wallet();
  game = launch({ store });
  assert.equal(game.wallet(), coins, 'las monedas se conservan');
  const view = game.api().view();
  assert.deepEqual([...view.discovered].sort(), ['aldea', 'cascada']);
  assert.equal(game.api().open('manglar'), true);
  assert.equal(game.api().open('ruinas'), false, 'las ruinas siguen esperando al manglar');
  game.sail('manglar');
  assert.equal(game.api().route(), 'manglar');
});

test('un viaje interrumpido por una ruta se retoma y descubre el lugar una sola vez', () => {
  const store = makeStore();
  let game = launch({ store });
  game.sail('manglar'.replace('manglar', 'aldea'));
  game.api().distance(700);
  game.api().score(5);
  game.fire('window:pagehide');
  assert.equal(store.json(keys.trip).route, 'aldea', 'el viaje guardado recuerda su ruta');
  game = launch({ store });
  assert(game.text('message').includes('Aldea Coral'), 'al abrir se ofrece retomar el viaje a la aldea');
  assert.equal(game.text('play'), 'Continuar viaje');
  game.click('play');
  assert.equal(game.api().route(), 'aldea');
  assert.equal(game.api().stage(), 1, 'el tramo se recupera de la distancia guardada');
  assert.equal(game.text('stageLabel'), 'Hacia Aldea Coral · 2/3');
  game.api().lives(3);
  assert.equal(game.arrive(), 'arrived');
  assert.equal(discoveries(store).length, 1);
  assert(!store.data.has(keys.trip));
  game = launch({ store });
  assert.notEqual(game.text('play'), 'Continuar viaje', 'un viaje ya terminado no se ofrece otra vez');
  assert.equal(discoveries(store).length, 1);
});

test('cobrar un viaje de ruta interrumpido no cuenta como llegada', () => {
  const store = makeStore();
  let game = launch({ store });
  game.sail('aldea');
  game.api().distance(1100);
  game.fire('window:pagehide');
  game = launch({ store });
  game.click('finishTrip');
  assert.equal(game.api().view().discovered.size, 0, 'sin llegar no se descubre nada');
  assert.equal(runs(store).length, 1);
  assert.equal(runs(store)[0].run.arrived, undefined);
  assert.equal(runs(store)[0].run.route, 'aldea');
});

test('si no se pueden guardar las monedas la llegada queda pendiente y se completa una vez', () => {
  const store = makeStore();
  let game = launch({ store });
  store.failing.add(keys.economy);
  game.sail('aldea');
  game.arrive();
  assert(/pendientes/.test(game.text('message')) || game.text('message').includes('No se pudo guardar'));
  assert(store.data.has(keys.settle), 'la llegada queda anotada como cierre pendiente');
  assert.equal(JSON.parse(store.data.get(keys.settle)).runs[0].arrived, true);
  store.failing.clear();
  game = launch({ store });
  assert.equal(discoveries(store).length, 1, 'al reabrir se descubre el lugar');
  assert.deepEqual([...game.api().view().discovered], ['aldea']);
  assert(!store.data.has(keys.settle));
  game = launch({ store });
  assert.equal(discoveries(store).length, 1, 'reabrir otra vez no lo repite');
  assert.equal(runs(store).length, 1);
});

test('los datos de la versión 2.4 se leen igual y el mundo empieza vacío', () => {
  const store = makeStore({ [keys.economy]: economy24(40), [keys.stats]: stats24, [keys.best]: '55' });
  const game = launch({ store });
  assert.equal(game.wallet(), 40, 'el saldo anterior no cambia');
  assert.equal(game.api().view().discovered.size, 0);
  assert.equal(store.json(keys.economy).version, 1, 'abrir el mapa no transforma los datos');
  game.sail(null);
  game.api().lives(3);
  assert.equal(game.api().route(), null, 'la navegación libre sigue funcionando');
  game.sail('aldea');
  game.arrive();
  assert.equal(store.json(keys.economy).version, 3, 'la primera llegada pasa al formato nuevo');
  assert.equal(savedEvents(store).filter(event => event.run && event.run.id.startsWith('rv')).length, 40, 'ningún evento anterior se pierde');
  assert.equal(game.wallet(), 40 + 34 + 20 + 5 + 10, 'saldo anterior + viaje + primera visita + misión diaria + rango Explorador que ya correspondía');
  assert.equal(store.json(keys.stats).runs, 13);
});

test('un historial con destinos descubiertos sobrevive a la compactación', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea');
  game.arrive();
  game.sail('cascada');
  game.arrive();
  for (let i = 0; i < 330; i++) { game.sail('aldea'); game.arrive(); }
  const saved = store.json(keys.economy);
  assert(saved.base, 'el historial se compactó');
  assert.deepEqual(saved.base.discovered.sort(), ['aldea', 'cascada']);
  assert(saved.base.arrivals.aldea > 100, 'las llegadas se cuentan en el resumen');
  const again = launch({ store });
  assert.deepEqual([...again.api().view().discovered].sort(), ['aldea', 'cascada']);
  assert.equal(again.api().open('manglar'), true);
  assert.equal(again.wallet(), game.wallet());
  again.sail('aldea');
  again.arrive();
  assert.equal(discoveries(store).length, 0, 'tras compactar, los eventos recientes no repiten un destino ya descubierto');
  assert.equal(store.json(keys.economy).version, 3);
});

test('un historial con un destino descubierto dos veces se rechaza sin borrarse', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea');
  game.arrive();
  const forged = JSON.parse(store.data.get(keys.economy));
  forged.events.push({ ...discoveries(store)[0], id: 'duplicado-1' });
  const text = JSON.stringify(forged);
  const damaged = makeStore({ [keys.economy]: text });
  const again = launch({ store: damaged });
  assert.equal(again.text('coinHud'), '🪙 !', 'un historial inválido se señala en lugar de inventar saldo');
  assert.equal(damaged.data.get(keys.economy), text, 'el dato dañado se conserva');
});

test('las copias de seguridad llevan los destinos y se restauran en otro teléfono', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea');
  game.arrive();
  game.click('openingSettings');
  game.click('exportProgress');
  const backup = game.elements.get('backupText').value;
  assert.equal(JSON.parse(backup).format, 'rio-aventura-progress-v4', 'con datos del mundo la copia usa el formato 4');
  const fresh = launch({});
  fresh.elements.get('backupText').value = backup;
  fresh.click('importProgress');
  assert.deepEqual([...fresh.api().view().discovered], ['aldea']);
  assert.equal(fresh.api().open('manglar'), true, 'las rutas abiertas se restauran con la copia');
  // Una copia anterior (sin mundo) no borra lo descubierto.
  const old = launch({ store: makeStore({ [keys.economy]: economy24(5) }) });
  old.click('openingSettings');
  old.click('exportProgress');
  const oldBackup = old.elements.get('backupText').value;
  assert.equal(JSON.parse(oldBackup).format, 'rio-aventura-progress-v2', 'sin mundo la copia sigue siendo legible por la versión anterior');
});

test('los logros de exploración se desbloquean al descubrir', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('openingSettings');
  assert.equal(game.text('achievement-explorer'), '0/1');
  game.click('closeSettings');
  game.sail('aldea');
  game.arrive();
  assert(game.text('message').includes('Primer destino'), 'el cierre anuncia el logro nuevo');
  game.click('openingSettings');
  assert.equal(game.text('achievement-explorer'), 'Desbloqueado');
  assert.equal(game.text('achievement-cartographer'), '1/5');
});

test('cada ruta cambia el tipo de obstáculos, el tramo final está despejado y la cascada corre más', () => {
  const calm = launch({ random: () => 0.1 });
  calm.sail('aldea');
  calm.tick(240);
  calm.api().lives(3);
  assert(calm.api().obstacles().length > 0);
  assert(calm.api().obstacles().every(item => item.kind !== 'drift'), 'la aldea no tiene troncos a la deriva al principio');
  const store = makeStore({ [keys.economy]: { version: 3, deviceId: 'dtest', nextEvent: 3, selected: 'classic', events: [
    { id: 'dtest-1', type: 'earn', amount: 20, discover: 'aldea' }, { id: 'dtest-2', type: 'earn', amount: 35, discover: 'manglar' }] } });
  const swamp = launch({ store, random: () => 0.1 });
  swamp.sail('manglar');
  assert.equal(swamp.api().route(), 'manglar');
  swamp.tick(240);
  swamp.api().lives(3);
  assert(swamp.api().obstacles().some(item => item.kind === 'drift'), 'el manglar tiene troncos a la deriva desde el principio');
  // Tramo final despejado.
  swamp.api().clearObstacles();
  swamp.api().distance(1800 - 10);
  const before = swamp.api().obstacles().length;
  swamp.tick(5);
  assert.equal(swamp.api().obstacles().length, before, 'en los últimos metros no aparecen obstáculos nuevos');
  // Cascada: más rápida que la navegación libre.
  const falls = launch({ store: makeStore({ [keys.economy]: { version: 3, deviceId: 'dtest', nextEvent: 2, selected: 'classic', events: [
    { id: 'dtest-1', type: 'earn', amount: 20, discover: 'aldea' }] } }) });
  falls.sail('cascada');
  assert.equal(falls.api().route(), 'cascada');
  falls.api().elapsed(900);
  for (let i = 0; i < 600; i++) { falls.tick(1, 16); falls.api().lives(3); falls.api().distance(100); }
  assert(falls.api().speed() > 390, 'la cascada supera el tope de la navegación libre');
});

console.log(`Exploration tests passed (${passed})`);
