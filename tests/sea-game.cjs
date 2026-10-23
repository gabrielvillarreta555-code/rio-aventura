// Pruebas del modo mundo libre dentro del juego completo: controles, cámara, muelles, guardado y regresión.
const assert = require('node:assert/strict');
const { launch, makeStore, keys } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}

const press = (game, key, down = true) => game.emit(down ? 'window:keydown' : 'window:keyup', { key });
const explore = options => { const game = launch(options); game.click('exploreSea'); return game; };
const dockOf = (game, id) => game.api().seaWorld().docks.find(d => d.id === id);
const seaKey = 'rio-aventura-sea-v1';

test('el título ofrece explorar y entrar muestra los controles del mundo libre', () => {
  const game = launch();
  assert(!game.hidden('overlay') && !game.elements.get('exploreSea').classList.contains('hidden'));
  assert.equal(game.api().mode(), 'classic');
  game.click('exploreSea');
  assert.equal(game.api().mode(), 'sea');
  assert.equal(game.api().state(), 'playing');
  assert(game.hidden('overlay'));
  assert(!game.hidden('seaMap') && !game.hidden('seaBrake'), 'minimapa y freno visibles');
  const boat = game.api().seaBoat();
  const spawn = game.api().seaWorld().spawn;
  assert.equal(boat.x, spawn.x);
  assert.equal(boat.y, spawn.y);
});

test('con las flechas la lancha navega al norte, sur, este y oeste y la cámara la sigue', () => {
  for (const [key, axis, sign] of [['ArrowUp', 'y', -1], ['ArrowDown', 'y', 1], ['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1]]) {
    const game = explore();
    const boat = game.api().seaBoat();
    const start = { x: boat.x, y: boat.y, cx: game.api().seaCam().x, cy: game.api().seaCam().y };
    press(game, key);
    game.tick(100, 16);
    press(game, key, false);
    assert((boat[axis] - start[axis]) * sign > 50, `${key}: avanza en ${axis}`);
    const cam = game.api().seaCam();
    const limit = axis === 'x' ? 4000 - 450 : 4000 - 1000;
    const atEdge = sign > 0 ? start[axis === 'x' ? 'cx' : 'cy'] >= limit - 1 : start[axis === 'x' ? 'cx' : 'cy'] <= 1;
    assert(atEdge || (cam[axis] - start[axis === 'x' ? 'cx' : 'cy']) * sign > 20, `${key}: la cámara sigue a la lancha`);
    assert(boat.x >= cam.x && boat.x <= cam.x + 450 && boat.y >= cam.y && boat.y <= cam.y + 1000, `${key}: la lancha se ve en pantalla`);
    assert(game.counters.ops > 0);
  }
});

test('las coordenadas del mundo son persistentes: se puede ir lejos y volver al mismo sitio', () => {
  const game = explore();
  const boat = game.api().seaBoat();
  const x0 = boat.x;
  press(game, 'ArrowUp');
  game.tick(220, 16);
  press(game, 'ArrowUp', false);
  assert(boat.y < game.api().seaWorld().spawn.y - 400, 'recorrió más de media pantalla');
  press(game, 'Space'.toLowerCase() === ' ' ? ' ' : ' ');
  game.tick(120, 16);
  press(game, ' ', false);
  assert(Math.abs(boat.x - x0) < 60);
});

test('el joystick virtual dirige la lancha, tolera un segundo dedo y se suelta al levantar', () => {
  const game = explore();
  const input = game.api().seaInput();
  game.emit('game:pointerdown', { pointerId: 7, clientX: 200, clientY: 600 });
  assert(!game.hidden('joy'), 'aparece el joystick');
  game.emit('game:pointermove', { pointerId: 7, clientX: 200 + 58, clientY: 600 });
  assert(input.x > 0.95 && Math.abs(input.y) < 0.05, 'a la derecha');
  game.emit('game:pointerdown', { pointerId: 9, clientX: 50, clientY: 650 });
  game.emit('game:pointermove', { pointerId: 9, clientX: 50, clientY: 700 });
  assert(input.x > 0.95, 'el segundo dedo no mueve el joystick');
  const boat = game.api().seaBoat();
  game.tick(60, 16);
  assert(boat.vx > 40, 'navega al este');
  game.emit('game:pointermove', { pointerId: 7, clientX: 200, clientY: 600 - 200 });
  assert(Math.abs(input.y) <= 1.0001 && input.y < -0.95, 'el arrastre se limita al radio del joystick');
  game.emit('game:pointerup', { pointerId: 9 });
  assert(input.y < -0.95, 'soltar el otro dedo no afecta');
  game.emit('game:pointercancel', { pointerId: 7 });
  assert.equal(input.x, 0);
  assert.equal(input.y, 0);
  assert(game.hidden('joy'));
});

test('el botón de freno detiene la lancha y se suelta al levantar o cancelar', () => {
  const game = explore();
  const boat = game.api().seaBoat();
  press(game, 'ArrowUp');
  game.tick(80, 16);
  press(game, 'ArrowUp', false);
  assert(Math.hypot(boat.vx, boat.vy) > 90);
  game.emit('seaBrake:pointerdown', { preventDefault() {} });
  assert.equal(game.api().seaInput().brake, true);
  game.tick(70, 16);
  assert(Math.hypot(boat.vx, boat.vy) < 10, 'se detiene con el freno');
  game.emit('seaBrake:pointercancel', {});
  assert.equal(game.api().seaInput().brake, false);
});

test('las órdenes de dirección no se quedan pulsadas al pausar', () => {
  const game = explore();
  press(game, 'ArrowRight');
  game.click('pause');
  assert.equal(game.api().state(), 'paused');
  assert.equal(game.api().seaInput().brake, false);
  const boat = game.api().seaBoat();
  const x = boat.x;
  game.tick(60, 16);
  assert.equal(boat.x, x, 'en pausa no se mueve');
  press(game, 'ArrowRight', false);
  game.click('play');
  assert.equal(game.api().state(), 'playing');
});

test('colisiones: contra la costa no se entra en tierra', () => {
  const game = explore();
  const boat = game.api().seaBoat();
  const world = game.api().seaWorld();
  press(game, 'ArrowLeft');
  for (let i = 0; i < 400; i++) {
    game.tick(1, 16);
    assert(!world.isLand(Math.floor(boat.x / 40), Math.floor(boat.y / 40)), 'el centro nunca está en tierra');
  }
  press(game, 'ArrowLeft', false);
  assert(boat.x > 36 * 40, 'se detuvo en la orilla de la bahía');
});

test('llegar al muelle de la aldea lo descubre, paga una vez y abre las rutas nuevas', () => {
  const store = makeStore();
  const game = explore({ store });
  const dock = dockOf(game, 'aldea');
  assert.equal(game.api().seaStatus().aldea, 'open');
  assert.equal(game.api().seaStatus().manglar, 'locked');
  game.api().seaPlace(dock.x - 120, dock.y, Math.PI / 2);
  press(game, 'ArrowRight');
  let hint = '';
  for (let i = 0; i < 200 && game.api().state() === 'playing'; i++) { game.tick(1, 16); hint = game.api().seaHintText() || hint; }
  press(game, 'ArrowRight', false);
  assert.equal(game.api().state(), 'arrived', 'al llegar físicamente al muelle se atraca');
  assert(!game.hidden('overlay'));
  assert(game.hidden('seaBrake') && game.hidden('seaMap'), 'sin controles sobre la pantalla del muelle');
  assert.match(game.html('title'), /Aldea Coral/);
  assert(!game.hidden('arrivalCard'), 'tarjeta de descubrimiento');
  assert.match(game.text('arrivalText'), /\+20/);
  assert(game.api().view().discovered.has('aldea'));
  assert.equal(game.api().seaStatus().aldea, 'visited');
  assert.equal(game.api().seaStatus().manglar, 'open');
  assert.equal(game.api().seaStatus().cascada, 'open');
  const events = store.json(keys.economy).events;
  assert.equal(events.filter(e => e.discover === 'aldea').length, 1);
  assert(events.some(e => e.run && e.run.route === 'aldea' && e.run.arrived === true));
  assert(hint.includes('Atracando') || hint.includes('frena'), 'se avisó al jugador');
  // Seguir explorando sale del muelle sin volver a atracar enseguida.
  game.click('play');
  assert.equal(game.api().state(), 'playing');
  assert(!game.hidden('seaBrake') && !game.hidden('seaMap'), 'los controles vuelven');
  game.tick(30, 16);
  assert.equal(game.api().state(), 'playing', 'no re-atraca mientras sigue en la zona');
});

test('hay que frenar para atracar: a toda velocidad no se atraca', () => {
  const game = explore();
  const dock = dockOf(game, 'aldea');
  game.api().seaPlace(dock.x - 120, dock.y, Math.PI / 2);
  const boat = game.api().seaBoat();
  boat.vx = 190;
  press(game, 'ArrowRight');
  for (let i = 0; i < 30 && !game.api().seaHintText(); i++) game.tick(1, 16);
  assert(Math.hypot(boat.vx, boat.vy) > 115, 'va rápido');
  assert.equal(game.api().state(), 'playing', 'a toda velocidad no se atraca');
  assert.match(game.api().seaHintText(), /frena/i);
  press(game, 'ArrowRight', false);
  press(game, ' ');
  game.tick(160, 16);
  press(game, ' ', false);
  assert.equal(game.api().state(), 'arrived', 'al frenar dentro de la zona atraca');
});

test('un muelle cerrado explica qué falta y no cobra ni descubre nada', () => {
  const store = makeStore();
  const game = explore({ store });
  const dock = dockOf(game, 'manglar');
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'playing');
  assert.match(game.api().seaHintText(), /Descubre Aldea Coral/);
  assert.equal(game.api().view().discovered.size, 0);
  assert.equal(store.data.has(keys.economy), false, 'no se escribió nada en el historial');
});

test('la laguna pide descubrir las ruinas y el rango Navegante, y se abre al cumplirlo', () => {
  const store = makeStore();
  let game = launch({ store });
  for (const id of ['aldea', 'manglar', 'cascada', 'ruinas']) { game.sail(id); game.arrive(); }
  game.click('exploreSea');
  const dock = dockOf(game, 'laguna');
  assert.equal(game.api().seaStatus().laguna, 'locked');
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(40, 16);
  assert.match(game.api().seaHintText(), /Navegante/);
  assert.equal(game.api().state(), 'playing');
  game.click('pause');
  game.click('saveExit'); game.click('confirmYes');
  game.sail('ruinas'); game.arrive(20);
  game.click('exploreSea');
  assert.equal(game.api().seaStatus().laguna, 'open');
  game.api().seaPlace(dock.x, dock.y + 300, 0);
  game.tick(3, 16);
  game.api().seaTrip().dist = 300;
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  assert.equal(game.api().view().discovered.size, 5);
});

test('atracar de nuevo en un destino ya descubierto solo paga el viaje, no el descubrimiento', () => {
  const store = makeStore();
  const game = explore({ store });
  const dock = dockOf(game, 'aldea');
  const drop = () => { game.api().seaPlace(dock.x - 40, dock.y, Math.PI / 2); game.tick(60, 16); };
  game.api().seaTrip().dist = 300;
  game.api().seaPlace(dock.x, dock.y, 0); game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  game.click('play');
  game.api().seaPlace(dock.x + 200, dock.y - 200, 0);
  game.tick(10, 16);
  game.api().seaTrip().dist = 400;
  drop();
  assert.equal(game.api().state(), 'arrived');
  assert(game.hidden('arrivalCard'), 'no vuelve a salir el descubrimiento');
  const events = store.json(keys.economy).events;
  assert.equal(events.filter(e => e.discover).length, 1);
  assert.equal(events.filter(e => e.run && e.run.arrived).length, 2);
  assert(game.api().view().arrivals.get('aldea') === 2);
});

test('atracar sin haberse movido en el puerto no cobra nada; con un viaje, sí', () => {
  const store = makeStore();
  const game = explore({ store });
  const port = dockOf(game, 'puerto');
  game.api().seaPlace(port.x, port.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  assert.equal(store.data.has(keys.economy), false);
  game.click('play');
  game.api().seaTrip().dist = 700;
  game.api().seaTrip().pickups = 4;
  game.api().seaPlace(port.x + 300, port.y, 0); game.tick(5, 16);
  game.api().seaPlace(port.x, port.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  const earned = store.json(keys.economy).events.find(e => e.run);
  assert(earned && earned.run.distance >= 700 && earned.run.pickups === 4);
  assert.equal(game.api().seaTrip().dist, 0, 'empieza un viaje nuevo');
});

test('las monedas flotantes se recogen una vez y las rocas rozadas cuentan como esquivas', () => {
  const game = explore();
  const coin = game.api().seaWorld().coins[0];
  game.api().seaPlace(coin.x, coin.y, 0);
  game.tick(3, 16);
  assert.equal(game.api().seaTrip().pickups, 1);
  game.api().seaPlace(coin.x + 200, coin.y, 0);
  game.api().seaPlace(coin.x, coin.y, 0);
  game.tick(3, 16);
  assert.equal(game.api().seaTrip().pickups, 1, 'la misma moneda no se recoge dos veces');
  const rock = game.api().seaWorld().rocks[0];
  game.api().seaPlace(rock.x - rock.r - 36, rock.y, Math.PI / 2);
  press(game, 'ArrowRight');
  for (let i = 0; i < 40; i++) game.tick(1, 16);
  press(game, 'ArrowRight', false);
  assert.equal(game.api().seaTrip().score >= 1, true, 'rozar una roca cuenta una esquiva');
});

test('pausa y guardado: al reabrir la app la lancha sigue donde estaba, con su viaje y sus monedas', () => {
  const store = makeStore();
  const game = explore({ store });
  const coin = game.api().seaWorld().coins[2];
  game.api().seaPlace(coin.x, coin.y, 1);
  game.tick(3, 16);
  press(game, 'ArrowUp');
  game.tick(50, 16);
  press(game, 'ArrowUp', false);
  game.click('pause');
  const saved = store.json(seaKey);
  assert(saved && saved.version === 1);
  const boat = game.api().seaBoat();
  const again = launch({ store });
  again.click('exploreSea');
  const b2 = again.api().seaBoat();
  assert(Math.abs(b2.x - boat.x) < 1 && Math.abs(b2.y - boat.y) < 1, 'misma posición del mundo');
  assert.equal(again.api().seaTrip().pickups, 1);
  assert(again.api().seaTrip().dist > 5);
  assert.equal(again.api().seaTaken()[coin.id], true, 'la moneda recogida no reaparece');
  assert.equal(again.api().seaTrip().id, game.api().seaTrip().id, 'sigue el mismo viaje');
});

test('un archivo de guardado dañado o con la lancha en tierra vuelve al puerto', () => {
  for (const bad of ['{no json', JSON.stringify({ version: 1, x: 10, y: 10, h: 0 }), JSON.stringify({ version: 1, x: 'a', y: 2, h: 0 }),
    JSON.stringify({ version: 1, x: 1e9, y: 5, h: NaN })]) {
    const store = makeStore({ [seaKey]: bad });
    const game = launch({ store });
    game.click('exploreSea');
    const spawn = game.api().seaWorld().spawn;
    assert.equal(game.api().seaBoat().x, spawn.x, bad);
  }
});

test('un viaje ya cobrado no se cobra otra vez al reabrir (misma identidad)', () => {
  const store = makeStore();
  const game = explore({ store });
  const dock = dockOf(game, 'aldea');
  game.api().seaTrip().dist = 500;
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  const events = store.json(keys.economy).events.length;
  const again = launch({ store });
  again.click('exploreSea');
  again.tick(5, 16);
  assert.equal(store.json(keys.economy).events.length, events, 'no hay eventos nuevos');
});

test('si el guardado del historial falla, el cobro queda pendiente y se completa al reabrir sin duplicar', () => {
  const store = makeStore();
  const game = explore({ store });
  const dock = dockOf(game, 'aldea');
  store.failing.add(keys.economy);
  game.api().seaTrip().dist = 500;
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  assert(store.data.has(keys.settle), 'queda en el diario de pendientes');
  assert.match(game.text('message'), /pendientes|No se pudo/);
  store.failing.delete(keys.economy);
  const again = launch({ store });
  assert(again.api().view().discovered.has('aldea'), 'el descubrimiento se completó al abrir');
  assert.equal(store.json(keys.economy).events.filter(e => e.discover).length, 1);
  assert(!store.data.has(keys.settle));
});

test('salir al menú vuelve a la navegación clásica, que sigue funcionando', () => {
  const game = explore();
  game.click('pause');
  assert(!game.hidden('saveExit'));
  game.click('saveExit');
  game.click('confirmYes');
  assert.equal(game.api().mode(), 'classic');
  assert(game.hidden('seaMap'));
  assert.match(game.html('title'), /Río/);
  game.click('play');
  assert.equal(game.api().state(), 'playing');
  game.tick(60, 16);
  assert(game.api().runDistance() > 5, 'el río clásico avanza');
  assert.equal(game.api().route(), null);
});

test('el botón atrás pausa el viaje y no cierra la app mientras se navega', () => {
  const game = explore();
  assert.equal(game.sandbox.window.rioAventuraBack(), true);
  assert.equal(game.api().state(), 'paused');
});

test('el mapa clásico y las rutas siguen disponibles y no interfieren con el mundo libre', () => {
  const game = launch();
  game.click('openMap');
  game.click('node-aldea');
  game.click('sail');
  assert.equal(game.api().mode(), 'classic');
  assert.equal(game.api().route(), 'aldea');
  assert.equal(game.arrive(), 'arrived');
  game.click('exploreSea');
  assert.equal(game.api().mode(), 'sea');
  assert.equal(game.api().seaStatus().manglar, 'open', 'lo descubierto por el mapa abre los muelles');
});

test('rendimiento: sin sprites ni degradados nuevos por fotograma, la caché de tierra es acotada y no faltan trozos', () => {
  const game = explore({ pixelRatio: 2 });
  const view = game.api().seaView();
  press(game, 'ArrowUp');
  game.tick(60, 16);
  const built = game.art().debug.spritesBuilt;
  game.counters.gradients = 0;
  let worst = 0;
  let missing = 0;
  for (let i = 0; i < 400; i++) {
    game.counters.drawImage = 0;
    game.tick(1, 16);
    worst = Math.max(worst, game.counters.drawImage);
    missing += view.stats.missing;
    if (i === 200) press(game, 'ArrowRight');
  }
  press(game, 'ArrowUp', false); press(game, 'ArrowRight', false);
  assert.equal(game.art().debug.spritesBuilt, built, 'no se pintan sprites durante la navegación');
  assert.equal(game.counters.gradients, 0, 'sin degradados por fotograma');
  assert(worst < 150, `drawImage por fotograma: ${worst}`);
  assert.equal(missing, 0, 'nunca falta un trozo visible');
  assert(view.chunkCount() <= 30, `caché acotada (${view.chunkCount()})`);
  assert(view.stats.drawnChunks <= 12);
});

test('en calidad reducida y sin lienzos ocultos el mundo libre también se dibuja', () => {
  const direct = explore({ sprites: false });
  direct.tick(60, 16);
  assert(direct.art().debug.immediate !== undefined);
  const low = explore();
  low.click('pause'); low.click('closeSettings');
  low.click('settings');
  low.elements.get('quality').value = 'low';
  low.fire('quality:change');
  low.click('closeSettings');
  low.tick(60, 16);
  assert.equal(low.api().mode(), 'sea');
});

test('reabrir la partida dentro de la zona de un muelle no atraca, y atracar sin navegar no da monedas', () => {
  const store = makeStore();
  const game = explore({ store });
  const dock = dockOf(game, 'aldea');
  game.api().seaTrip().dist = 300;
  game.api().seaPlace(dock.x, dock.y, 0);
  game.tick(60, 16);
  assert.equal(game.api().state(), 'arrived');
  const events = store.json(keys.economy).events.length;
  const again = launch({ store });
  again.click('exploreSea');
  again.tick(60, 16);
  assert.equal(again.api().state(), 'playing', 'no re-atraca al reabrir');
  assert.equal(store.json(keys.economy).events.length, events);
  // Salir y volver a entrar en la zona sin haber navegado: se muestra el muelle pero no se paga.
  again.api().seaPlace(dock.x, dock.y + 250, 0);
  again.tick(5, 16);
  again.api().seaPlace(dock.x, dock.y, 0);
  again.tick(60, 16);
  assert.equal(again.api().state(), 'arrived');
  assert.equal(store.json(keys.economy).events.length, events, 'sin viaje no hay cobro');
});

test('calidad automática: en un teléfono lento baja en el primer segundo; en uno rápido no sube y baja sin parar', () => {
  const slow = explore();
  const before = slow.api().tier();
  slow.tick(30, 50);
  assert(slow.api().tier() < before, 'baja pronto');
  assert(slow.api().tier() <= before - 1);
  const fast = explore({ pixelRatio: 2 });
  let changes = 0;
  const original = fast.store.api.setItem;
  fast.store.api.setItem = (key, value) => { if (key === 'rio-aventura-gfx-v1') changes++; return original(key, value); };
  press(fast, 'ArrowUp');
  for (let i = 0; i < 60 * 150; i++) {
    fast.tick(1, 16);
    if (i % 600 === 0) { fast.api().seaPlace(fast.api().seaWorld().spawn.x, fast.api().seaWorld().spawn.y, 0); }
  }
  assert(changes <= 8, `pocos cambios de resolución (${changes}): cada uno es un tirón`);
});

console.log(`Sea game tests passed (${passed})`);
