const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const events = new Map();
const operations = [];
const gradient = { addColorStop() {} };
const context = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient }, {
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
nextFrame(16);
events.get('play:click')();
events.get('game:pointerdown')({ pointerId: 1, clientX: 350 });
for (let time = 32; time < 2500; time += 16) nextFrame(time);
assert(operations.includes('scale'), 'the depth projection must draw scaled objects');
assert(operations.includes('translate'), 'the boat and obstacles must be drawn');
console.log('Visual smoke test passed');
