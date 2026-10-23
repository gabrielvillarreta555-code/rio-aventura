// Datos y reglas puras de los encargos (quests.js): personajes, plantillas, recompensas y reputación.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '../app/src/main/assets');
const sandbox = { window: {} };
for (const name of ['world.js', 'quests.js']) vm.runInNewContext(fs.readFileSync(path.join(dir, name), 'utf8'), sandbox);
const Q = sandbox.window.RioQuests;
const world = sandbox.window.RioWorld;

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}

const docks = ['puerto', 'aldea', 'manglar', 'cascada', 'ruinas', 'laguna'];

test('hay un personaje con nombre, rol y diálogos en cada uno de los seis muelles', () => {
  assert.equal(Q.npcs.length, 6);
  for (const id of docks) {
    const npc = Q.npc(id);
    assert(npc, id);
    assert(npc.name.length > 3 && npc.role.length > 3 && npc.icon);
    assert.equal(npc.greet.length, 3, 'saludo según la reputación');
    assert(npc.chat.length >= 3 && npc.chat.every(line => line.length > 20));
    assert(npc.none.length > 10);
    for (const color of [npc.look.skin, npc.look.shirt, npc.look.hatColor]) assert.match(color, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(new Set(Q.npcs.map(n => n.name)).size, 6, 'nombres distintos');
  assert.equal(Q.npc('inventado'), null);
});

test('hay 18 encargos coherentes: tres por muelle, origen distinto del destino y los tres tipos', () => {
  assert.equal(Q.templates.length, 18);
  const ids = new Set();
  for (const t of Q.templates) {
    assert(!ids.has(t.id) && Q.validTemplateId(t.id), t.id);
    ids.add(t.id);
    assert(docks.includes(t.giver) && docks.includes(t.to) && t.giver !== t.to, `${t.id}: origen y destino`);
    assert(Q.kinds[t.kind], t.id);
    assert(Number.isInteger(t.reward) && t.reward >= 10 && t.reward <= 60, `${t.id}: premio ${t.reward}`);
    assert([0, 3].includes(t.minRep));
    assert(t.ask.length > 20 && t.thanks.length > 15 && t.title.length > 5);
  }
  for (const id of docks) {
    const offers = Q.offersFor(id);
    assert.equal(offers.length, 3, id);
    assert.equal(offers.filter(t => t.minRep === 0).length >= 2, true, `${id}: al menos dos disponibles desde el principio`);
  }
  for (const kind of Object.keys(Q.kinds)) assert(Q.templates.filter(t => t.kind === kind).length >= 5, `variedad de ${kind}`);
  assert(Q.templates.every(t => world.nodeById(t.to) || t.to === 'puerto'), 'los destinos existen en el mundo');
});

test('la reputación sube por niveles y cada nivel da una prima', () => {
  assert.equal(Q.levels.map(l => l.stars).join(), '0,1,2,3');
  assert.equal(Q.level(0).name, 'Desconocido');
  assert.equal(Q.level(2).stars, 0);
  assert.equal(Q.level(3).name, 'Conocido');
  assert.equal(Q.level(8).stars, 2);
  assert.equal(Q.level(99).stars, 3);
  assert(Q.repGain(true) > Q.repGain(false));
});

test('las recompensas siguen reglas claras: repetir paga la mitad y cada tipo tiene su bonificación', () => {
  const food = Q.template('pescado-aldea');
  const tools = Q.template('redes-manglar');
  const passenger = Q.template('turista-cascada');
  assert.equal(Q.reward(food, { done: 0, rep: 0, elapsed: 5, par: 20, bumps: 0 }).amount, Math.round(14 * 1.25), 'fresco');
  assert.equal(Q.reward(food, { done: 0, rep: 0, elapsed: 30, par: 20, bumps: 0 }).amount, 14, 'a tiempo normal');
  assert.equal(Q.reward(food, { done: 0, rep: 0, elapsed: 60, par: 20, bumps: 0 }).amount, Math.round(14 * 0.8), 'pasado');
  assert.equal(Q.reward(tools, { done: 0, rep: 0, elapsed: 999, par: 20, bumps: 9 }).amount, 28, 'las herramientas no dependen de nada');
  assert.equal(Q.reward(passenger, { done: 0, rep: 0, elapsed: 50, par: 20, bumps: 0 }).amount, Math.round(36 * 1.2), 'viaje suave');
  assert.equal(Q.reward(passenger, { done: 0, rep: 0, elapsed: 50, par: 20, bumps: 1 }).amount, 36);
  assert.equal(Q.reward(passenger, { done: 0, rep: 0, elapsed: 50, par: 20, bumps: 5 }).amount, Math.round(36 * 0.7), 'incómodo');
  assert.equal(Q.reward(tools, { done: 1, rep: 0, elapsed: 1, par: 20, bumps: 0 }).amount, 14, 'repetir paga la mitad');
  assert(Q.reward(tools, { done: 0, rep: 15, elapsed: 1, par: 20, bumps: 0 }).amount > 28, 'la reputación da prima');
  const explain = Q.reward(passenger, { done: 2, rep: 8, elapsed: 1, par: 20, bumps: 4 });
  assert(explain.parts.some(p => /Repetición/.test(p)) && explain.parts.some(p => /incómodo/.test(p)) && explain.parts.some(p => /confianza/.test(p)));
  for (const t of Q.templates) for (const rep of [0, 3, 8, 15, 99]) {
    const r = Q.reward(t, { done: 0, rep, elapsed: 0, par: 99, bumps: 0 });
    assert(r.amount >= 1 && r.amount <= 200 && Number.isInteger(r.amount));
  }
});

test('no se puede aceptar un encargo bloqueado, ya activo o con la bodega llena, y se explica por qué', () => {
  const t = Q.template('turista-cascada');
  const base = { rep: 0, done: 0, active: false, activeCount: 0, destinationOpen: true, destinationName: 'Cascada Brumosa' };
  assert.equal(Q.status(t, base).canAccept, false);
  assert.match(Q.status(t, base).reason, /3 puntos de reputación con Capitana Marisol/);
  assert.equal(Q.status(t, { ...base, rep: 3 }).canAccept, true);
  assert.equal(Q.status(t, { ...base, rep: 3, destinationOpen: false }).canAccept, false);
  assert.match(Q.status(t, { ...base, rep: 3, destinationOpen: false }).reason, /Cascada Brumosa/);
  assert.equal(Q.status(t, { ...base, rep: 3, active: true }).reason, 'En curso');
  assert.match(Q.status(t, { ...base, rep: 3, activeCount: Q.maxActive }).reason, /Bodega llena/);
  assert.match(Q.status(Q.template('pescado-aldea'), { ...base, done: 2 }).reason, /mitad/);
  assert.equal(Q.maxActive, 2);
});

test('la comida fresca premia ir rápido: el tiempo de referencia crece con la distancia', () => {
  assert(Q.parSeconds(1600) < Q.parSeconds(3200));
  assert(Q.parSeconds(0) >= 10);
});

console.log(`Quest data tests passed (${passed})`);
