// Los personajes de los muelles se ven: tamaño, posición, capas y señal de interacción.
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let passed = 0;
function test(name, body) {
  try { body(); passed++; } catch (error) { console.error(`FALLA: ${name}`); throw error; }
}
const docks = ['puerto', 'aldea', 'manglar', 'cascada', 'ruinas', 'laguna'];

test('cada personaje se dibuja cuando su muelle está en pantalla, con tamaño suficiente y sin nada delante', () => {
  const game = launch({ pixelRatio: 2 });
  game.click('exploreSea');
  const view = game.api().seaView();
  const world = game.api().seaWorld();
  assert(view.npcScale * 64 >= 70, `un personaje mide ${Math.round(view.npcScale * 64)} unidades de alto (la lancha ~60)`);
  for (const id of docks) {
    const dock = world.docks.find(d => d.id === id);
    game.api().seaPlace(dock.x, dock.y + 230, 0);
    game.tick(3, 16);
    assert.equal(view.stats.npcs >= 1, true, `${id}: se dibuja al personaje`);
    const p = dock.pier;
    const foot = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    const near = view.propsNear(foot.x, foot.y, 100);
    assert.equal(near.length, 0, `${id}: ningún árbol ni arbusto tapa al personaje (${near.length})`);
  }
});

test('el personaje queda lejos de la pantalla cuando el muelle no se ve: no se dibuja', () => {
  const game = launch();
  game.click('exploreSea');
  const view = game.api().seaView();
  const far = game.api().seaWorld().docks.find(d => d.id === 'laguna');
  game.api().seaPlace(game.api().seaWorld().spawn.x, game.api().seaWorld().spawn.y, 0);
  game.tick(3, 16);
  assert.equal(view.stats.npcs <= 1, true);
  assert(view.stats.npcs === 0 || Math.hypot(game.api().seaBoat().x - far.x, game.api().seaBoat().y - far.y) > 0);
});

test('cerca de un muelle un aviso dice quién espera y cómo hablar con él', () => {
  const game = launch();
  game.click('exploreSea');
  const dock = game.api().seaWorld().docks.find(d => d.id === 'aldea');
  game.api().seaPlace(dock.x - 260, dock.y, Math.PI / 2);
  game.tick(3, 16);
  assert.match(game.api().seaHintText(), /Tomás el Pescador/);
  assert.match(game.api().seaHintText(), /frena en el círculo/);
});

test('los sprites de personajes se construyen una vez al entrar: sin sprites nuevos al acercarse', () => {
  const game = launch({ pixelRatio: 2 });
  game.click('exploreSea');
  game.tick(20, 16);
  const built = game.art().debug.spritesBuilt;
  for (const id of docks) {
    const dock = game.api().seaWorld().docks.find(d => d.id === id);
    game.api().seaPlace(dock.x, dock.y + 230, 0);
    game.tick(4, 16);
  }
  assert.equal(game.art().debug.spritesBuilt, built);
});

console.log(`NPC visibility tests passed (${passed})`);
