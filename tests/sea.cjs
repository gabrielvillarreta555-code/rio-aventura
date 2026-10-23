// Pruebas del núcleo del mundo libre (sea.js): mapa, física en todas las direcciones, colisiones y muelles.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/src/main/assets/sea.js'), 'utf8'), sandbox);
const sea = sandbox.window.RioSea;
const world = sea.build();

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}
const tile = v => Math.floor(v / sea.TILE);
const scratch = [];
const inside = (boat, factor = 1) => sea.contacts(world, boat.x, boat.y, sea.BOAT_RADIUS * factor, scratch).length > 0;
function sail(boat, input, seconds, dt = 1 / 60) {
  let moved = 0;
  for (let t = 0; t < seconds; t += dt) moved += sea.stepBoat(world, boat, input, dt).moved;
  return moved;
}
const at = (x, y, heading = 0) => sea.createBoat(x * sea.TILE, y * sea.TILE, heading);

test('el mapa es mayor que la pantalla y está rodeado de costa', () => {
  assert.equal(world.size, 4000);
  assert(world.size > 450 * 4 && world.size > 800 * 4, 'unas 9 pantallas de ancho');
  for (let i = 0; i < sea.N; i++) {
    for (const [x, y] of [[i, 0], [i, sea.N - 1], [0, i], [sea.N - 1, i], [i, 2], [2, i]]) assert(world.isLand(x, y), `borde ${x},${y}`);
  }
  assert(world.isLand(-5, 10) && world.isLand(10, 500), 'fuera del mapa cuenta como tierra');
});

test('la lancha nace en agua y cada muelle, roca y moneda está en agua', () => {
  assert(!inside(sea.createBoat(world.spawn.x, world.spawn.y, 0)));
  assert.equal(world.docks.length, 6);
  for (const dock of world.docks) {
    assert(!world.isLand(tile(dock.x), tile(dock.y)), `${dock.id}: amarre en agua`);
    assert(!sea.contacts(world, dock.x, dock.y, sea.BOAT_RADIUS, []).length, `${dock.id}: la lancha cabe en el amarre`);
    assert(dock.pier.w > 0 && dock.pier.h > 0);
  }
  for (const rock of world.rocks) assert(!world.isLand(tile(rock.x), tile(rock.y)), `roca ${rock.id}`);
  for (const coin of world.coins) assert(!sea.contacts(world, coin.x, coin.y, 10, []).some(hit => hit.rock === undefined), `moneda ${coin.id}`);
  assert(world.coins.length >= 20);
});

test('todos los muelles son alcanzables por agua desde el puerto', () => {
  for (const dock of world.docks) assert(sea.pathExists(world, world.spawn, dock, 1), `${dock.id} alcanzable`);
});

test('hay una bifurcación real: dos rutas distintas llevan al mismo destino', () => {
  const ruinas = world.docks.find(d => d.id === 'ruinas');
  const blockWest = (x, y) => Math.hypot(x - 28, y - 42) < 7;
  const blockEast = (x, y) => Math.hypot(x - 72, y - 42) < 7;
  assert(sea.pathExists(world, world.spawn, ruinas, 1), 'sin bloqueos se llega');
  assert(sea.pathExists(world, world.spawn, ruinas, 1, blockWest), 'cerrando el canal oeste se llega por el este');
  assert(sea.pathExists(world, world.spawn, ruinas, 1, blockEast), 'cerrando el canal este se llega por el oeste');
  assert(!sea.pathExists(world, world.spawn, ruinas, 1, (x, y) => blockWest(x, y) || blockEast(x, y)), 'cerrando los dos ya no se llega');
});

test('la isla central se puede rodear por completo', () => {
  const west = { x: 28.5 * sea.TILE, y: 42.5 * sea.TILE };
  const east = { x: 72.5 * sea.TILE, y: 42.5 * sea.TILE };
  const closeNorth = (x, y) => y < 34 && x > 30 && x < 70;
  const closeSouth = (x, y) => y > 60 && x > 36 && x < 64;
  assert(sea.pathExists(world, west, east, 1, closeNorth), 'por el sur de la isla');
  assert(sea.pathExists(world, west, east, 1, closeSouth), 'por el norte de la isla');
  assert(!sea.pathExists(world, west, east, 1, (x, y) => closeNorth(x, y) || closeSouth(x, y)), 'la isla es tierra sólida entre los dos canales');
  assert(world.isLand(50, 45), 'el centro de la isla es tierra');
});

test('la lancha se mueve hacia el norte, sur, este y oeste y se detiene', () => {
  const heading = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  for (const [name, [ix, iy]] of Object.entries(heading)) {
    const boat = at(50, 87);
    const x0 = boat.x;
    const y0 = boat.y;
    sail(boat, { x: ix, y: iy }, 1.6);
    const dx = boat.x - x0;
    const dy = boat.y - y0;
    assert(Math.abs(ix ? dx : dy) > 60, `${name}: avanza (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
    assert(Math.sign(ix ? dx : dy) === Math.sign(ix || iy), `${name}: en el sentido correcto`);
    assert(Math.abs(ix ? dy : dx) < 0.55 * Math.abs(ix ? dx : dy), `${name}: sin desviarse`);
    sail(boat, { x: 0, y: 0, brake: true }, 2.5);
    assert(Math.hypot(boat.vx, boat.vy) < 6, `${name}: el freno la detiene`);
  }
});

test('el mundo no empuja la lancha: sin órdenes se queda donde está', () => {
  const boat = at(50, 87);
  const { x, y } = boat;
  sail(boat, { x: 0, y: 0 }, 10);
  assert.equal(boat.x, x);
  assert.equal(boat.y, y);
});

test('gira y tiene inercia: no cambia de sentido de golpe', () => {
  const boat = at(50, 87);
  sail(boat, { x: 0, y: -1 }, 1.5);
  const forward = boat.vy;
  assert(forward < -80);
  sail(boat, { x: 0, y: 1 }, 0.15);
  assert(boat.vy < 0, 'a los 0,15 s todavía avanza hacia el norte');
  assert(Math.abs(boat.heading) > 0.2, 'pero ya está girando');
  sail(boat, { x: 0, y: 1 }, 4);
  assert(boat.vy > 20, 'después acaba yendo al sur');
  // Coasting: soltar el mando la frena poco a poco, no en seco.
  const coast = at(50, 87);
  sail(coast, { x: 0, y: -1 }, 1.2);
  const v0 = Math.hypot(coast.vx, coast.vy);
  sail(coast, { x: 0, y: 0 }, 0.5);
  const v1 = Math.hypot(coast.vx, coast.vy);
  assert(v1 < v0 && v1 > v0 * 0.5, `inercia razonable (${v0.toFixed(0)} → ${v1.toFixed(0)})`);
});

test('la velocidad está acotada y nunca aparece NaN o Infinity', () => {
  const boat = at(50, 84);
  for (const input of [{ x: NaN, y: 1 }, { x: Infinity, y: -Infinity }, { x: undefined, y: undefined }, { x: 5, y: -9 }]) {
    sail(boat, input, 1);
    assert([boat.x, boat.y, boat.vx, boat.vy, boat.heading].every(Number.isFinite), JSON.stringify(input));
    assert(Math.hypot(boat.vx, boat.vy) <= sea.handling.maxSpeed + 1);
  }
});

test('la tierra es sólida: ni a máxima velocidad ni con fotogramas largos se atraviesa', () => {
  for (const [ix, iy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [0.7, -0.7], [-0.7, 0.7]]) {
    for (const dt of [1 / 60, 0.05]) {
      const boat = at(50, 87);
      for (let t = 0; t < 14; t += dt) {
        sea.stepBoat(world, boat, { x: ix, y: iy }, dt);
        assert(!inside(boat, 0.6), `dentro de tierra en ${boat.x.toFixed(0)},${boat.y.toFixed(0)} dir ${ix},${iy} dt ${dt}`);
      }
    }
  }
});

test('al chocar contra la costa rebota y desliza, sin quedarse atascada', () => {
  const boat = at(50, 87, -Math.PI / 2);
  const result = { impact: 0 };
  for (let t = 0; t < 8; t += 1 / 60) {
    const r = sea.stepBoat(world, boat, { x: -1, y: 0 }, 1 / 60);
    result.impact = Math.max(result.impact, r.impact);
  }
  assert(result.impact > 30, 'hubo un choque');
  // Con la proa contra la orilla puede girar y alejarse hacia el este.
  sail(boat, { x: 1, y: 0 }, 3);
  assert(boat.vx > 40, 'sale hacia el este tras el choque');
});

test('las rocas son sólidas y se pueden rodear', () => {
  const rock = world.rocks[0];
  const boat = sea.createBoat(rock.x - 80, rock.y, Math.PI / 2);
  let impact = 0;
  for (let t = 0; t < 3; t += 1 / 60) {
    impact = Math.max(impact, sea.stepBoat(world, boat, { x: 1, y: 0 }, 1 / 60).impact);
    assert(Math.hypot(boat.x - rock.x, boat.y - rock.y) >= rock.r + sea.BOAT_RADIUS - 0.5, 'no entra en la roca');
  }
  assert(impact > 20, 'choca con la roca');
});

test('los embarcaderos son sólidos', () => {
  for (const dock of world.docks) {
    const p = dock.pier;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    assert(sea.contacts(world, cx, cy, sea.BOAT_RADIUS, []).length > 0, `${dock.id}: el centro del muelle es sólido`);
    // Una lancha lanzada contra el embarcadero no lo atraviesa.
    const from = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[dock.dir];
    const boat = sea.createBoat(dock.x, dock.y, { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[dock.dir]);
    for (let t = 0; t < 4; t += 1 / 60) {
      sea.stepBoat(world, boat, { x: from[0], y: from[1] }, 1 / 60);
      assert(!inside(boat, 0.6), `${dock.id}: no atraviesa el muelle`);
    }
  }
});

test('un muelle se detecta por la zona de atraque', () => {
  for (const dock of world.docks) {
    assert.equal(sea.dockAt(world, { x: dock.x, y: dock.y }).id, dock.id);
    assert.equal(sea.dockAt(world, { x: dock.x + dock.radius + 5, y: dock.y }), null);
  }
  const near = sea.nearestDock(world, { x: world.spawn.x, y: world.spawn.y });
  assert.equal(near.dock.id, 'puerto');
});

test('rodear la isla navegando de verdad: la lancha da la vuelta y vuelve al punto de partida', () => {
  // Ruta con puntos de paso por el canal oeste, la laguna norte y el canal este.
  const waypoints = [[50, 80], [50, 66], [40, 63], [31, 57], [27, 48], [29, 36], [37, 26], [44, 21], [50, 22], [56, 21],
    [63, 26], [71, 36], [73, 48], [67, 58], [57, 63], [50, 66]];
  const boat = at(50, 84, 0);
  let t = 0;
  for (const [wx, wy] of waypoints) {
    const tx = (wx + 0.5) * sea.TILE;
    const ty = (wy + 0.5) * sea.TILE;
    let guard = 0;
    while (Math.hypot(tx - boat.x, ty - boat.y) > 60 && guard++ < 60 * 40) {
      const dx = tx - boat.x;
      const dy = ty - boat.y;
      const d = Math.hypot(dx, dy);
      sea.stepBoat(world, boat, { x: dx / d, y: dy / d }, 1 / 60);
      t += 1 / 60;
      assert(!inside(boat, 0.6));
    }
    assert(guard < 60 * 40, `llega al punto ${wx},${wy}`);
  }
  assert(t > 20, `el rodeo es una travesía de verdad (${t.toFixed(0)} s)`);
  // Pasó por el norte de la isla (y menor que 30 tiles) y volvió: dio la vuelta completa.
  assert(Math.hypot(boat.x - 50.5 * sea.TILE, boat.y - 66.5 * sea.TILE) < 160);
});

test('aleatorio: 20000 pasos con órdenes y fotogramas al azar nunca dejan la lancha en tierra', () => {
  let seed = 12345;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const boat = at(50, 70);
  let input = { x: 0, y: -1 };
  for (let i = 0; i < 20000; i++) {
    if (i % 40 === 0) input = { x: random() * 2 - 1, y: random() * 2 - 1, brake: random() < 0.1 };
    sea.stepBoat(world, boat, input, 0.001 + random() * 0.049);
    assert([boat.x, boat.y, boat.vx, boat.vy].every(Number.isFinite));
    assert(!inside(boat, 0.6), `paso ${i}`);
    assert(boat.x > 0 && boat.y > 0 && boat.x < world.size && boat.y < world.size);
  }
});

console.log(`Sea tests passed (${passed})`);
