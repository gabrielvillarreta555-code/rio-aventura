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
const element = id => {
  const classes = new Set(id === 'settingsPanel' ? ['hidden'] : []);
  return {
    id,
    textContent: '',
    value: '',
    select() { this.selected = true; },
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    addEventListener(name, callback) { events.set(`${id}:${name}`, callback); }
  };
};
const canvas = element('game');
canvas.width = 450;
canvas.height = 800;
canvas.getContext = () => context;
canvas.getBoundingClientRect = () => ({ width: 450, height: 1000, left: 0 });
canvas.setPointerCapture = () => {};
const elements = new Map([['game', canvas]]);
let nextFrame;
const storage = new Map([
  ['rio-aventura-best-v1', '42'],
  ['rio-aventura-profile-v1', '{malformed'],
  ['rio-aventura-stats-v1', '{malformed']
]);
const sandboxMath = Object.create(Math);
sandboxMath.random = () => 0.5;
const sandbox = {
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    },
    addEventListener(name, callback) { events.set(`document:${name}`, callback); }
  },
  window: { addEventListener(name, callback) { events.set(`window:${name}`, callback); } },
  localStorage: {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  requestAnimationFrame(callback) { nextFrame = callback; },
  Math: sandboxMath
};

vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
storage.delete('rio-aventura-stats-v1');
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
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
for (const id of ['settings', 'openingSettings', 'settingsPanel', 'profileName', 'avatar', 'quality', 'bestScore', 'totalRuns', 'totalDodged', 'legacyDodged', 'playerTag', 'backupText', 'exportProgress', 'importProgress']) {
  assert(html.includes(`id="${id}"`), `the settings screen needs ${id}`);
}
events.get('settings:click')();
assert(!elements.get('settingsPanel').classList.contains('hidden'), 'settings should open');
assert.equal(elements.get('profileName').value, 'Invitado', 'a new player starts as a guest');
assert.equal(elements.get('bestScore').textContent, '42', 'the existing record should remain visible');
elements.get('profileName').value = 'Gabriel';
events.get('saveProfile:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-profile-v1')).name, 'Gabriel', 'guest name should persist');
assert(elements.get('playerTag').textContent.includes('Gabriel'), 'the player name should appear on the game overlay');
events.get('avatar:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-profile-v1')).avatar, 1, 'avatar should persist');
elements.get('quality').value = 'low';
events.get('quality:change')();
assert.equal(JSON.parse(storage.get('rio-aventura-profile-v1')).quality, 'low', 'quality choice should persist');
operations.length = 0;
nextFrame(2512);
assert(!operations.includes('bezierCurveTo'), 'reduced quality should omit water shimmer');
events.get('closeSettings:click')();
assert(elements.get('settingsPanel').classList.contains('hidden'), 'settings should close');
assert.equal(elements.get('pause').textContent, 'Ⅱ', 'closing settings should resume play');
events.get('game:pointerdown')({ pointerId: 3, clientX: 350 });
for (let time = 2528; time <= 4500; time += 16) nextFrame(time);
events.get('game:pointerup')({ pointerId: 3 });
for (let time = 4550; time <= 7000; time += 50) nextFrame(time);
assert(Number.parseInt(elements.get('score').textContent, 10) > 0, 'a safely passed obstacle should score');
events.get('play:click')();
for (let time = 7050; time < 40000 && !storage.has('rio-aventura-stats-v2'); time += 50) nextFrame(time);
const stats = JSON.parse(storage.get('rio-aventura-stats-v2') || 'null');
assert(stats && stats.runs === 1, 'finishing a trip should save one completed run');
assert(stats.distance > 0, 'finished trips should save distance');
assert.equal(stats.version, 2, 'accurate dodges need the new statistics format');
assert.equal(stats.dodged, 0, 'obstacles that hit the boat must not count as dodged');
assert.equal(storage.get('rio-aventura-best-v1'), '42', 'new statistics must not erase the old record');
events.get('openingSettings:click')();
assert.equal(elements.get('totalRuns').textContent, '1', 'settings should show saved trips');
assert.equal(elements.get('totalDistance').textContent, `${stats.distance} m`, 'settings should show saved distance');
assert.equal(elements.get('totalDodged').textContent, '0', 'settings should show confirmed dodges only');
events.get('exportProgress:click')();
const backup = elements.get('backupText').value;
const decodedBackup = JSON.parse(backup);
assert.equal(decodedBackup.format, 'rio-aventura-progress-v1', 'manual backup needs a versioned format');
assert.equal(decodedBackup.profile.name, 'Gabriel', 'manual backup should include the guest name');
assert.equal(decodedBackup.best, 42, 'manual backup should include the original record');
assert.equal(decodedBackup.stats.runs, 1, 'manual backup should include completed trips');
assert(elements.get('backupText').selected, 'backup text should be selected for copying');
elements.get('backupText').value = '{invalid';
events.get('importProgress:click')();
assert.equal(storage.get('rio-aventura-stats-v2'), JSON.stringify(stats), 'invalid backup must not modify progress');
elements.get('backupText').value = backup;
events.get('importProgress:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-stats-v2')).runs, 1, 'restoring twice must not duplicate trips');
events.get('closeSettings:click')();
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
events.get('openingSettings:click')();
assert.equal(elements.get('profileName').value, 'Gabriel', 'guest name should survive a fresh game launch');
assert.equal(elements.get('avatar').textContent, '🧒', 'avatar should survive a fresh game launch');
assert.equal(elements.get('quality').value, 'low', 'graphics quality should survive a fresh game launch');
assert.equal(elements.get('bestScore').textContent, '42', 'record should survive a fresh game launch');
assert.equal(elements.get('totalRuns').textContent, '1', 'trips should survive a fresh game launch');
const higherBackup = JSON.parse(backup);
higherBackup.best = 48;
higherBackup.stats.runs = 3;
higherBackup.stats.dodged = 4;
higherBackup.stats.distance += 250;
elements.get('backupText').value = JSON.stringify(higherBackup);
events.get('importProgress:click')();
assert.equal(elements.get('bestScore').textContent, '48', 'restore should accept a higher record');
assert.equal(elements.get('totalRuns').textContent, '3', 'restore should accept higher trip totals');
elements.get('backupText').value = backup;
events.get('importProgress:click')();
assert.equal(elements.get('totalRuns').textContent, '3', 'an older backup must not decrease or duplicate totals');
events.get('closeSettings:click')();
storage.set('rio-aventura-stats-v1', JSON.stringify({ runs: 5, dodged: 17, distance: 520 }));
storage.delete('rio-aventura-stats-v2');
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
events.get('openingSettings:click')();
assert.equal(elements.get('totalRuns').textContent, '5', 'legacy trip count should migrate');
assert.equal(elements.get('totalDodged').textContent, '0', 'old points must not be presented as verified dodges');
assert.equal(elements.get('legacyDodged').textContent, '17', 'old estimated points should remain visible');
console.log('Visual smoke test passed');
