const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const events = new Map();
const operations = [];
const translations = [];
const gradient = { addColorStop() {} };
const context = new Proxy({
  createLinearGradient: () => gradient,
  createRadialGradient: () => gradient,
  translate(x, y) {
    assert(Number.isFinite(x) && Number.isFinite(y), 'translate received a non-finite value');
    translations.push([x, y]);
    operations.push('translate');
  }
}, {
  get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      for (const value of args) {
        if (typeof value === 'number') assert(Number.isFinite(value), `${String(key)} received a non-finite value`);
      }
      operations.push(key);
    };
  },
  set(target, key, value) { target[key] = value; return true; }
});
const element = id => ({
  id,
  textContent: '',
  classList: { add() {}, remove() {} },
  addEventListener(name, callback) { events.set(`${id}:${name}`, callback); }
});
const canvas = element('game');
canvas.width = 450;
canvas.height = 800;
canvas.getContext = () => context;
canvas.getBoundingClientRect = () => ({ width: 450, height: 1000, left: 0 });
canvas.setPointerCapture = () => {};
const elements = new Map([['game', canvas]]);
let nextFrame;
const sandbox = {
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    },
    addEventListener(name, callback) { events.set(`document:${name}`, callback); }
  },
  window: { addEventListener(name, callback) { events.set(`window:${name}`, callback); } },
  localStorage: { getItem: () => null, setItem() {} },
  requestAnimationFrame(callback) { nextFrame = callback; },
  Math
};

vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
assert.equal(canvas.height, 1000, 'the playfield should fit a tall phone');
function boatXAt(time) {
  translations.length = 0;
  nextFrame(time);
  const position = translations.filter(([, y]) => y > 840 && y < 860).at(-1);
  assert(position, 'the boat should be visible near the bottom of the screen');
  return position[0];
}
const startingX = boatXAt(16);
events.get('play:click')();
events.get('game:pointerdown')({ pointerId: 1, clientX: 350 });
const firstX = boatXAt(32);
const secondX = boatXAt(48);
assert(secondX - firstX > firstX - startingX, 'the boat should accelerate after steering starts');
events.get('game:pointerup')({ pointerId: 2 });
let heldX = secondX;
for (let time = 64; time <= 176; time += 16) heldX = boatXAt(time);
assert(heldX - startingX > 10, 'a second finger must not cancel the steering finger');
events.get('game:pointerup')({ pointerId: 1 });
const coastingX = boatXAt(192);
assert(coastingX > heldX, 'the boat should coast briefly after touch release');
for (let time = 208; time < 2500; time += 16) nextFrame(time);
assert(operations.includes('scale'), 'the depth projection must draw scaled objects');
assert(operations.includes('translate'), 'the boat and obstacles must be drawn');
assert(operations.includes('clip'), 'the perspective river must clip water to its banks');
assert(operations.filter(name => name === 'bezierCurveTo').length > 5, 'moving water shimmer should be drawn');
assert(operations.filter(name => name === 'arc').length > 20, 'layered riverside trees should be drawn');
console.log('Visual smoke test passed');
