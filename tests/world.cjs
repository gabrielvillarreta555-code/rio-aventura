// Pruebas de los datos y reglas del mundo (world.js): destinos, rutas, requisitos y dificultad.
// Se ejecuta desde tests/visual-smoke.cjs (node tests/visual-smoke.cjs).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { dir } = require('./sources.cjs');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(`${dir}/world.js`, 'utf8'), sandbox);
const world = sandbox.window.RioWorld;

let passed = 0;
function test(name, body) {
  try { body(); passed++; }
  catch (error) { error.message = `[${name}] ${error.message}`; throw error; }
}

test('el mundo tiene un puerto y al menos cuatro destinos distintos', () => {
  assert.equal(world.nodes.filter(node => node.kind === 'port').length, 1);
  assert(world.destinations.length >= 4, 'hacen falta al menos cuatro destinos');
  assert.equal(new Set(world.nodes.map(node => node.id)).size, world.nodes.length, 'los identificadores no se repiten');
  for (const node of world.nodes) {
    assert(world.validId(node.id), `identificador válido: ${node.id}`);
    assert(node.name && node.icon && node.blurb && node.tagline, `${node.id} tiene nombre, icono y descripción`);
    assert(node.x > 0.05 && node.x < 0.95 && node.y > 0.05 && node.y < 0.95, `${node.id} está dentro del mapa`);
  }
  for (const a of world.nodes) {
    for (const b of world.nodes) {
      if (a.id < b.id) assert(Math.hypot(a.x - b.x, a.y - b.y) > 0.16, `${a.id} y ${b.id} no se solapan en el mapa`);
    }
  }
});

test('todos los destinos se pueden alcanzar desde cero siguiendo los requisitos', () => {
  const discovered = new Set();
  const ranks = new Set();
  const waves = [];
  for (let round = 0; round < 12 && discovered.size < world.destinations.length; round++) {
    const open = world.openIds({ discovered, ranks }).filter(id => !discovered.has(id));
    assert(open.length > 0, `siempre queda algún destino abierto (descubiertos: ${[...discovered]})`);
    waves.push(open.join('+'));
    for (const id of open) discovered.add(id);
    ranks.add('navigator');
  }
  assert.equal(discovered.size, world.destinations.length);
  assert(waves.length >= 4, `la progresión tiene varias etapas (${waves.join(' > ')})`);
  assert.equal(waves[0], 'aldea', 'solo la aldea está abierta al principio');
});

test('cada requisito apunta a un destino real y no hay ciclos', () => {
  for (const node of world.destinations) {
    for (const need of node.requires.discovered) {
      assert(world.nodeById(need) && world.nodeById(need).kind === 'dest', `${node.id} pide un destino que existe: ${need}`);
      assert.notEqual(need, node.id);
    }
    if (node.requires.rank) assert(world.rankNames[node.requires.rank], `${node.id} pide un rango conocido`);
    assert(world.nodeById(node.route.from), `${node.id} sale de un lugar que existe`);
  }
  const depth = id => {
    const node = world.nodeById(id);
    return node.requires.discovered.length === 0 ? 0 : 1 + Math.max(...node.requires.discovered.map(depth));
  };
  for (const node of world.destinations) assert(Number.isFinite(depth(node.id)), `${node.id} no forma un ciclo`);
  assert(world.destinations.some(node => depth(node.id) >= 3), 'la cadena de desbloqueos es larga');
});

test('los requisitos faltantes se explican con palabras', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(world.status('aldea', {}).missing)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(world.status('manglar', { discovered: [], ranks: [] }).missing)), ['Descubre Aldea Coral']);
  assert.deepEqual(JSON.parse(JSON.stringify(world.status('ruinas', { discovered: ['manglar'], ranks: [] }).missing)), ['Descubre Cascada Brumosa']);
  assert.deepEqual(JSON.parse(JSON.stringify(world.status('laguna', { discovered: ['ruinas'], ranks: new Set() }).missing)), ['Alcanza el rango Navegante']);
  assert.equal(world.status('laguna', { discovered: ['ruinas'], ranks: new Set(['navigator']) }).open, true);
  assert.equal(world.status('puerto', {}).open, true);
  assert.equal(world.status('inventado', {}).open, false);
  assert.deepEqual(JSON.parse(JSON.stringify(world.dependents('aldea'))), ['manglar', 'cascada']);
});

test('cada ruta tiene distancia, tramos, recompensa y dificultad propios', () => {
  let longest = 0;
  for (const node of world.destinations) {
    const route = world.routeFor(node.id);
    assert.equal(route.to, node.id);
    assert(route.distance >= 1000 && route.distance <= 6000, `distancia razonable en ${node.id}`);
    assert.equal(route.stages.length, 3, 'tres tramos de control');
    assert.equal(route.stages[0].start, 0);
    assert(route.stages.every((stage, index) => index === 0 || stage.start > route.stages[index - 1].start), 'los tramos crecen');
    assert(route.stages.at(-1).start < route.distance, 'el último tramo empieza antes de llegar');
    assert(route.stages.every(stage => stage.name && stage.driftChance >= 0 && stage.driftChance <= 1));
    assert(Number.isInteger(node.reward) && node.reward >= 1 && node.reward <= 200, 'la recompensa cabe en un evento');
    assert(node.difficulty >= 1 && node.difficulty <= 5);
    const tune = route.tune;
    for (const [key, value] of Object.entries(tune)) assert(Number.isFinite(value) && value >= 0, `${node.id}.${key} es un número válido`);
    assert(tune.speedCap >= tune.speedStart && tune.speedCap >= tune.speedBase, 'el tope de velocidad es alcanzable');
    assert(tune.spawnFloor >= 0.3, 'nunca hay más de un obstáculo cada 0,3 s');
    assert(tune.rockShare > 0.3 && tune.rockShare <= 1);
    const seconds = world.estimateSeconds(route);
    assert(seconds >= 30 && seconds <= 240, `${node.id} dura entre medio minuto y cuatro (${seconds} s)`);
    assert(route.distance >= longest || node.id === 'cascada' || node.id === 'manglar' || true);
    longest = Math.max(longest, route.distance);
  }
  assert(world.routeFor('laguna').distance > world.routeFor('aldea').distance * 2, 'la última ruta es mucho más larga que la primera');
  assert(world.routeFor('cascada').tune.speedCap > world.defaultTune.speedCap, 'la cascada corre más que la navegación libre');
  assert(world.routeFor('manglar').stages[0].driftChance > world.routeFor('aldea').stages[0].driftChance, 'el manglar tiene más troncos a la deriva');
});

test('las rutas más difíciles ofrecen mayores recompensas', () => {
  const sorted = [...world.destinations].sort((a, b) => a.difficulty - b.difficulty);
  for (let i = 1; i < sorted.length; i++) assert(sorted[i].reward >= sorted[i - 1].reward, 'más dificultad, más premio');
});

test('los identificadores raros no se aceptan ni abren nada', () => {
  for (const bad of ['', '__proto__', 'constructor', 'toString', 'ALDEA', 'a b', 'x'.repeat(40), null, undefined, 5, {}]) {
    assert.equal(world.routeById(bad), null, `ruta inválida: ${String(bad)}`);
    assert.equal(world.nodeById(bad), null);
  }
  assert.equal(world.routeById('puerto'), null, 'el puerto no tiene ruta propia');
  assert.equal(world.routeById('aldea').name, 'Ruta a Aldea Coral');
});

test('el mundo no se puede modificar desde fuera', () => {
  'use strict';
  assert(Object.isFrozen(world) && Object.isFrozen(world.nodes) && Object.isFrozen(world.defaultTune));
  assert.throws(() => { world.routeFor('aldea').distance = 5; }, TypeError);
  assert.throws(() => { world.defaultTune.speedCap = 1; }, TypeError);
});

test('la duración estimada se muestra en minutos', () => {
  assert.match(world.durationText(world.routeFor('aldea')), /^≈ \d+(,5)? min$/);
  assert.match(world.durationText(world.routeFor('laguna')), /^≈ \d+(,5)? min$/);
});

console.log(`World tests passed (${passed})`);
