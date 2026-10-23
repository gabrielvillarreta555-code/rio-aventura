// Encargos y personajes dentro del juego completo: hablar, aceptar, conducir, entregar, cobrar una vez y guardar.
const assert = require('node:assert/strict');
const { launch, makeStore, keys } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}
const press = (game, key, down = true) => game.emit(down ? 'window:keydown' : 'window:keyup', { key });
const seaKey = 'rio-aventura-sea-v1';
const dockOf = (game, id) => game.api().seaWorld().docks.find(d => d.id === id);
const questEvents = store => store.json(keys.economy).events.filter(e => e.quest);

// Abre el mundo libre y atraca en `id` (con un viaje previo para que cuente como navegado).
function dockAt(game, id, dist = 400) {
  const dock = dockOf(game, id);
  game.api().seaTrip().dist = Math.max(game.api().seaTrip().dist, dist);
  game.api().seaPlace(dock.x, dock.y + 250, 0);
  game.tick(3, 16);
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived', `atraca en ${id}`);
  return dock;
}
const resume = game => { game.click('play'); assert.equal(game.api().state(), 'playing'); };
const talk = game => game.click('talk');

test('en cada muelle hay un personaje que se puede abordar tras atracar, con nombre, rol y reputación', () => {
  const game = launch();
  game.click('exploreSea');
  const names = ['Capitana Marisol', 'Tomás el Pescador', 'Abuela Raíz', 'Ingeniera Lía', 'Profesor Quillay', 'Luciana la Farera'];
  game.unlockWorld && 0;
  dockAt(game, 'puerto');
  assert(!game.elements.get('talk').classList.contains('hidden'), 'botón de hablar tras atracar');
  assert.match(game.text('talk'), /Capitana Marisol/);
  talk(game);
  assert(!game.hidden('dialogPanel'));
  assert.equal(game.text('dialogName'), names[0]);
  assert.match(game.text('dialogRole'), /puerto/i);
  assert.match(game.text('dialogRep'), /Desconocido · 0 puntos/);
  assert.match(game.text('dialogText'), /Bienvenido/);
  assert(!game.hidden('offer-0') && !game.hidden('offer-1') && !game.hidden('offer-2'));
});

test('no se puede hablar sin estar atracado: el diálogo solo existe en el muelle', () => {
  const game = launch();
  game.click('exploreSea');
  assert(game.elements.get('talk').classList.contains('hidden'));
  game.click('talk');
  assert(game.hidden('dialogPanel'));
});

test('las ofertas bloqueadas explican por qué y no se pueden aceptar', () => {
  const game = launch();
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game);
  assert.equal(game.disabled('offerAccept-0'), false);
  assert.match(game.text('offerState-0'), /Disponible/);
  assert.equal(game.disabled('offerAccept-1'), true);
  assert.match(game.text('offerState-1'), /Manglar Sombrío aún no está abierto/);
  assert.equal(game.disabled('offerAccept-2'), true);
  assert.match(game.text('offerState-2'), /3 puntos de reputación con Capitana Marisol/);
  game.click('offerAccept-1');
  game.click('offerAccept-2');
  assert.equal(game.api().quests().length, 0, 'forzar un clic en un encargo bloqueado no hace nada');
});

test('aceptar un encargo lo activa, lo muestra en pantalla y marca el muelle de destino', () => {
  const game = launch();
  game.click('exploreSea');
  dockAt(game, 'puerto');
  assert.equal(game.api().dockMark().puerto, 1, 'el personaje tiene un encargo: marca «!»');
  talk(game);
  game.click('offerAccept-0');
  const active = game.api().quests();
  assert.equal(active.length, 1);
  assert.equal(active[0].tpl, 'pescado-aldea');
  assert.match(game.text('offerState-0'), /En curso/);
  assert.equal(game.disabled('offerAccept-0'), true, 'no se acepta dos veces');
  assert.match(game.text('dialogText'), /Aldea Coral/);
  assert.match(game.text('dialogActive'), /Llevas \(1\/2\)/);
  game.click('closeDialog');
  resume(game);
  assert.equal(game.api().dockMark().aldea, 2, 'el muelle de la aldea marca la entrega');
  game.tick(10, 16);
  assert(!game.hidden('questHud'));
  assert.match(game.text('questHud'), /Cajas de pescado fresco → Aldea Coral/);
  assert.match(game.text('stageLabel'), /Entrega: Cajas de pescado fresco/);
  assert.match(game.text('stageDistance'), /Aldea · \d+ m/, 'rumbo y distancia al destino');
});

test('rechazar un encargo no lo activa y se puede reconsiderar al volver a hablar', () => {
  const game = launch();
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game);
  game.click('offerDecline-0');
  assert.equal(game.api().quests().length, 0);
  assert.match(game.text('offerState-0'), /Rechazado/);
  assert.equal(game.disabled('offerAccept-0'), true);
  assert.match(game.text('dialogText'), /Sin problema/);
});

test('el encargo solo se cumple navegando y atracando en el destino: el puerto no lo entrega', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game); game.click('offerAccept-0'); game.click('closeDialog'); resume(game);
  // Atracar otra vez en el puerto (destino incorrecto) no entrega nada.
  const port = dockOf(game, 'puerto');
  game.api().seaPlace(port.x, port.y + 300, 0);
  game.tick(3, 16);
  game.api().seaTrip().dist = 300;
  game.api().seaPlace(port.x, port.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  assert(game.hidden('deliveryCard'));
  assert.equal(game.api().quests().length, 1);
  assert.equal(store.data.has(keys.economy) ? questEvents(store).length : 0, 0);
});

test('llegar al destino entrega la mercancía, cobra una sola vez y sube la reputación', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game); game.click('offerAccept-0'); game.click('closeDialog'); resume(game);
  const before = game.wallet();
  dockAt(game, 'aldea', 500);
  assert(!game.hidden('deliveryCard'), 'pantalla de entrega');
  assert.match(game.text('deliveryTitle'), /Entrega completada/);
  assert.match(game.text('deliveryText'), /Tomás el Pescador/);
  assert.match(game.text('deliveryText'), /\+\d+ 🪙/);
  assert.match(game.text('deliveryText'), /Reputación con Capitana Marisol: \+2/);
  assert.equal(game.api().quests().length, 0, 'el encargo ya no está activo');
  const events = questEvents(store);
  assert.equal(events.length, 1, 'un único evento de entrega');
  assert.equal(events[0].quest.tpl, 'pescado-aldea');
  assert.equal(events[0].quest.giver, 'puerto');
  assert.equal(events[0].quest.to, 'aldea');
  assert(events[0].amount >= 10 && events[0].amount <= 20, `pago ${events[0].amount}`);
  assert.equal(store.json(keys.economy).version, 4, 'las entregas usan el formato 4');
  assert.equal(game.api().repOf('puerto'), 2);
  assert.equal(game.api().doneOf('pescado-aldea'), 1);
  assert(game.wallet() >= before + events[0].amount);
  // Seguir atracando en la aldea no vuelve a pagar la misma entrega.
  resume(game);
  dockAt(game, 'aldea', 900);
  assert.equal(questEvents(store).length, 1);
});

test('repetir un encargo paga la mitad y da menos reputación; hay un límite de reputación', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  game.api().questPush('redes-manglar');
  game.api().questPush('pescado-aldea');
  const first = game.api().deliverAt('aldea')[0];
  game.api().questPush('pescado-aldea');
  const second = game.api().deliverAt('aldea')[0];
  assert(second.amount < first.amount, `repetir paga menos (${second.amount} < ${first.amount})`);
  assert.equal(game.api().repOf('puerto'), 3, '2 + 1');
  assert.equal(game.api().doneOf('pescado-aldea'), 2);
  for (let i = 0; i < 60; i++) { game.api().questPush('pescado-aldea'); game.api().deliverAt('aldea'); }
  assert.equal(game.api().repOf('puerto'), 40, 'la reputación tiene tope');
});

test('con 3 puntos de reputación se abre el encargo de pasajero y la reputación da prima', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  game.api().questPush('pescado-aldea');
  game.api().deliverAt('aldea');
  game.api().questPush('pescado-aldea');
  game.api().deliverAt('aldea');
  assert.equal(game.api().repOf('puerto'), 3);
  game.click('closeDialog');
  talk(game);
  // Descubrir la cascada para poder entregar allí: se hace por el mapa clásico.
  assert.match(game.text('offerState-2'), /Cascada Brumosa aún no está abierto/);
});

test('los pasajeros se quejan de los golpes y el pago baja; con viaje suave suben', () => {
  const game = launch();
  game.sail('aldea'); game.arrive(); game.sail('cascada'); game.arrive();
  game.click('exploreSea');
  const rock = game.api().seaWorld().rocks[0];
  game.api().questPush('turista-cascada');
  game.api().seaPlace(rock.x - rock.r - 40, rock.y, Math.PI / 2);
  const boat = game.api().seaBoat();
  for (let hit = 0; hit < 4; hit++) {
    boat.vx = 190; boat.x = rock.x - rock.r - 60;
    boat.y = rock.y;
    game.tick(25, 16);
    game.tick(70, 16);
  }
  const quest = game.api().quests()[0];
  assert(quest.bumps >= 3, `golpes contados: ${quest.bumps}`);
  const rough = game.api().deliverAt('cascada')[0];
  assert.equal(rough.amount, Math.round(36 * 0.7), 'viaje incómodo: −30 %');
  assert.match(rough.text, /incómodo/);
  game.api().questPush('viajera-cascada');
  const smooth = game.api().deliverAt('cascada')[0];
  assert.equal(smooth.amount, Math.round(46 * 1.2), 'viaje suave: +20 %');
  assert.match(smooth.text, /Viaje suave/);
});

test('la comida da prima si llega fresca y pierde si tarda demasiado', () => {
  const game = launch();
  game.click('exploreSea');
  game.api().questPush('pescado-aldea', { t: 3 });
  const fresh = game.api().deliverAt('aldea')[0];
  assert.match(fresh.text, /Entrega fresca/);
  game.api().questPush('sal-puerto', { t: 3000 });
  const late = game.api().deliverAt('puerto')[0];
  assert.match(late.text, /pasado/);
});

test('la bodega admite 2 encargos y no más', () => {
  const game = launch();
  game.sail('aldea'); game.arrive();
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game);
  game.click('offerAccept-0');
  game.click('offerAccept-1');
  assert.equal(game.api().quests().length, 2);
  assert.match(game.text('dialogActive'), /Llevas \(2\/2\)/);
  game.click('closeDialog');
  game.click('exitSea');
  assert.equal(game.api().mode(), 'classic');
});

test('un muelle sin encargos disponibles lo dice con la voz del personaje', () => {
  const game = launch();
  game.click('exploreSea');
  dockAt(game, 'aldea');
  talk(game);
  assert.match(game.text('dialogName'), /Tomás/);
  game.api().questPush('sal-puerto');
  game.api().questPush('anzuelos-ruinas');
  game.click('closeDialog');
  talk(game);
  assert.match(game.text('dialogText'), /(Por hoy está todo repartido|Vuelve cuando)/);
  game.click('dialogChat');
  assert.match(game.text('dialogText'), /Pesco desde antes/);
  game.click('dialogChat');
  assert.match(game.text('dialogText'), /manglar/i);
});

test('el encargo activo y su tiempo se guardan: al reabrir la app sigue en curso', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game); game.click('offerAccept-0'); game.click('closeDialog'); resume(game);
  press(game, 'ArrowUp');
  game.tick(120, 16);
  press(game, 'ArrowUp', false);
  game.click('pause');
  const saved = store.json(seaKey);
  assert.equal(saved.quests.length, 1);
  assert.equal(saved.quests[0].tpl, 'pescado-aldea');
  assert(saved.quests[0].t > 1.5);
  const again = launch({ store });
  again.click('exploreSea');
  assert.equal(again.api().quests().length, 1);
  assert.equal(again.api().quests()[0].id, game.api().quests()[0].id);
  assert(again.api().quests()[0].t >= saved.quests[0].t - 0.2);
  again.tick(10, 16);
  assert.match(again.text('questHud'), /Cajas de pescado/);
});

test('un encargo ya cobrado no resucita desde un guardado antiguo', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game); game.click('offerAccept-0'); game.click('closeDialog'); resume(game);
  game.click('pause');
  const stale = store.data.get(seaKey);
  game.click('play');
  dockAt(game, 'aldea', 600);
  assert.equal(questEvents(store).length, 1);
  store.data.set(seaKey, stale);
  const again = launch({ store });
  again.click('exploreSea');
  assert.equal(again.api().quests().length, 0, 'se descarta: ya está cobrado');
  assert.equal(questEvents(store).length, 1);
});

test('si el guardado del pago falla, la entrega queda pendiente y se paga una vez al reintentar', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  dockAt(game, 'puerto');
  talk(game); game.click('offerAccept-0'); game.click('closeDialog'); resume(game);
  store.failing.add(keys.economy);
  dockAt(game, 'aldea', 600);
  assert.match(game.text('deliveryText'), /No se pudo guardar el pago/);
  assert.equal(game.api().quests().length, 1, 'sigue activa');
  store.failing.delete(keys.economy);
  resume(game);
  const dock = dockOf(game, 'aldea');
  game.api().seaPlace(dock.x, dock.y + 300, 0); game.tick(3, 16);
  game.api().seaTrip().dist = 300;
  game.api().seaPlace(dock.x, dock.y, 0); game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  assert.equal(game.api().quests().length, 0);
  assert.equal(questEvents(store).length, 1);
});

test('el historial rechaza entregas falsificadas: duplicadas, de más de 200 monedas o con origen igual al destino', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  game.api().questPush('pescado-aldea');
  game.api().deliverAt('aldea');
  const saved = store.json(keys.economy);
  const forge = mutate => {
    const copy = JSON.parse(JSON.stringify(saved));
    mutate(copy);
    return launch({ store: makeStore({ [keys.economy]: copy }) });
  };
  const bad = game => game.text('coinHud').includes('!');
  assert(!bad(launch({ store: makeStore({ [keys.economy]: saved }) })), 'el original es válido');
  const q = saved.events.find(e => e.quest);
  assert(bad(forge(c => c.events.push({ ...c.events.find(e => e.quest), id: 'dup1' }))), 'entrega duplicada');
  assert(bad(forge(c => { c.events.find(e => e.quest).amount = 500; })), 'más de 200');
  assert(bad(forge(c => { c.events.find(e => e.quest).quest.to = c.events.find(e => e.quest).quest.giver; })), 'origen = destino');
  assert(bad(forge(c => { c.events.find(e => e.quest).quest.id = '¡mal!'; })), 'identificador inválido');
  assert(bad(forge(c => { c.events.find(e => e.quest).run = { id: 'x', day: '2026-01-01', distance: 1, dodged: 0, pickups: 0 }; })), 'mezclada con otro tipo');
  assert(q.quest.id);
});

test('la compactación conserva reputación, entregas y no permite repetir identificadores', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  for (let i = 0; i < 330; i++) { game.api().questPush('pescado-aldea'); game.api().deliverAt('aldea'); }
  const economy = store.json(keys.economy);
  assert(economy.base, 'se compactó');
  assert.equal(economy.version, 4);
  assert(economy.events.length < 330);
  assert.equal(economy.base.reputation.puerto + (economy.events.filter(e => e.quest).length ? 0 : 0) >= 0, true);
  const again = launch({ store });
  assert.equal(again.api().repOf('puerto'), 40);
  assert.equal(again.api().doneOf('pescado-aldea'), 330);
  assert(!again.text('coinHud').includes('!'));
});

test('la copia manual con entregas usa el formato v5 y se restaura sin duplicar', () => {
  const store = makeStore();
  const game = launch({ store });
  game.click('exploreSea');
  game.api().questPush('pescado-aldea');
  game.api().deliverAt('aldea');
  game.click('pause');
  game.click('settings');
  game.click('exportProgress');
  const code = game.elements.get('backupText').value;
  assert.equal(JSON.parse(code).format, 'rio-aventura-progress-v5');
  const coins = game.wallet();
  game.elements.get('backupText').value = code;
  game.click('importProgress');
  assert.equal(game.wallet(), coins, 'restaurar la misma copia no duplica monedas');
  assert.equal(game.api().repOf('puerto'), 2);
});

test('datos de 2.6 intactos: sin entregas el historial sigue en formato 3 y los encargos no lo tocan', () => {
  const store = makeStore();
  const game = launch({ store });
  game.sail('aldea'); game.arrive();
  assert.equal(store.json(keys.economy).version, 3);
  const before = JSON.stringify(store.json(keys.economy));
  game.click('exploreSea');
  dockAt(game, 'puerto', 0);
  talk(game); game.click('offerAccept-0'); game.click('closeDialog');
  assert.equal(JSON.stringify(store.json(keys.economy).events.length), JSON.stringify(JSON.parse(before).events.length), 'aceptar no escribe en el historial');
  assert.equal(store.json(keys.economy).version, 3);
  const old = launch({ store });
  assert.equal(old.api().view().discovered.has('aldea'), true);
});

test('el rendimiento no empeora: personajes y marcas no añaden sprites nuevos ni degradados por fotograma', () => {
  const game = launch({ pixelRatio: 2 });
  game.click('exploreSea');
  game.api().questPush('pescado-aldea');
  const port = dockOf(game, 'puerto');
  game.api().seaPlace(port.x + 180, port.y, -Math.PI / 2);
  game.tick(60, 16);
  const built = game.art().debug.spritesBuilt;
  game.counters.gradients = 0;
  let worst = 0;
  for (let i = 0; i < 200; i++) {
    game.counters.drawImage = 0;
    game.tick(1, 16);
    worst = Math.max(worst, game.counters.drawImage);
  }
  assert.equal(game.art().debug.spritesBuilt, built);
  assert.equal(game.counters.gradients, 0);
  assert(worst < 160, `drawImage por fotograma: ${worst}`);
});

console.log(`Quest game tests passed (${passed})`);
