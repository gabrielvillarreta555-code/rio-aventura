// Datos y reglas puras de la pesca (fishing.js) y su geografía (caladeros en sea.js).
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '../app/src/main/assets');
const sandbox = { window: {} };
for (const name of ['fishing.js', 'sea.js']) vm.runInNewContext(fs.readFileSync(path.join(dir, name), 'utf8'), sandbox);
const F = sandbox.window.RioFishing;
const sea = sandbox.window.RioSea;
const world = sea.build();

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}

test('hay cinco especies con precio creciente y la hielera tiene un tope que cabe en un evento de venta', () => {
  assert.equal(F.species.length, 5);
  const prices = F.species.map(s => s.price);
  assert.equal(prices.join(), [...prices].sort((a, b) => a - b).join());
  assert(F.capacity * Math.max(...prices) <= F.maxSale, 'una hielera llena nunca supera el tope de venta');
  assert.equal(F.maxSale, 200);
  for (const s of F.species) assert(s.name && s.icon && /^#[0-9a-f]{6}$/i.test(s.color));
});

test('los caladeros están en agua alcanzable, lejos de los muelles y de la zona de aparición', () => {
  assert.equal(world.fishing.length, 2);
  for (const zone of world.fishing) {
    assert(zone.radius >= 80);
    for (const [dx, dy] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
      assert(!world.isLand(Math.floor((zone.x + dx * zone.radius) / sea.TILE), Math.floor((zone.y + dy * zone.radius) / sea.TILE)), `${zone.id}: agua en el círculo`);
    }
    assert(!sea.contacts(world, zone.x, zone.y, sea.BOAT_RADIUS, []).length, `${zone.id}: la lancha cabe en el centro`);
    assert(sea.pathExists(world, world.spawn, zone, 1), `${zone.id}: alcanzable navegando`);
    for (const dock of world.docks) assert(Math.hypot(dock.x - zone.x, dock.y - zone.y) > zone.radius + dock.radius + 40, `${zone.id}: no se solapa con el muelle ${dock.id}`);
    for (const rock of world.rocks) assert(Math.hypot(rock.x - zone.x, rock.y - zone.y) > zone.radius + rock.r - 20, `${zone.id}: sin rocas dentro`);
    assert(Math.hypot(world.spawn.x - zone.x, world.spawn.y - zone.y) > zone.radius, 'no se nace dentro');
  }
  const bay = world.fishing[0];
  assert.equal(sea.fishingZoneAt(world, { x: bay.x, y: bay.y }).id, 'bahia');
  assert.equal(sea.fishingZoneAt(world, { x: bay.x + bay.radius + 5, y: bay.y }), null);
});

test('las capturas siguen los pesos del caladero y los reflejos rápidos mejoran el pez', () => {
  const bay = F.zoneSpecs[0];
  const lake = F.zoneSpecs[1];
  let seed = 7;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const tally = (zone, quick) => {
    const counts = Object.fromEntries(F.species.map(s => [s.id, 0]));
    for (let i = 0; i < 6000; i++) counts[F.roll(zone, random, quick).id]++;
    return counts;
  };
  const bayCounts = tally(bay, false);
  assert.equal(bayCounts['pez-luna'], 0, 'la bahía no da peces luna');
  assert(bayCounts.sardina > bayCounts.pargo * 2);
  const lakeCounts = tally(lake, false);
  assert(lakeCounts['pez-luna'] > 200 && lakeCounts.dorada > bayCounts.dorada * 3, 'el lago da mejores peces');
  const value = counts => F.species.reduce((sum, s) => sum + counts[s.id] * s.price, 0);
  assert(value(tally(bay, true)) > value(bayCounts), 'recoger rápido mejora el valor');
  assert.equal(F.roll(bay, () => 0.9999999, false).id !== undefined, true);
});

test('la espera hasta la picada y el margen para recoger son razonables', () => {
  assert(F.waitTime(() => 0) >= 1.5 && F.waitTime(() => 0.999) <= 4.1);
  assert(F.timing.window >= 0.8 && F.timing.window <= 1.5, 'margen cómodo en pantalla táctil');
  assert(F.timing.quick < F.timing.window);
});

test('la bolsa solo acepta especies conocidas, enteros y la capacidad máxima', () => {
  const ok = { sardina: 3, 'pez-luna': 1 };
  assert.equal(F.count(F.cleanBag(ok)), 4);
  assert.equal(F.value(F.cleanBag(ok)), 3 * 2 + 20);
  for (const bad of [null, [], 'x', { tiburon: 1 }, { sardina: -1 }, { sardina: 1.5 }, { sardina: 11 }, { sardina: 6, caballa: 5 }, { sardina: '2' }]) {
    assert.equal(F.cleanBag(bad), null, JSON.stringify(bad));
  }
  assert.equal(F.count(F.emptyBag()), 0);
});

console.log(`Fishing data tests passed (${passed})`);
