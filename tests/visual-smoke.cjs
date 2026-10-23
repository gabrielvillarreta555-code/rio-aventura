const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const events = new Map();
const operations = [];
let mainGradients = 0;
let blockEconomyWrites = false;
const gradientColors = [];
// Un contexto 2D de pruebas: comprueba que ningún número dibujado sea NaN o infinito y cuenta
// las operaciones del lienzo principal. Los sprites se pintan en lienzos ocultos como en Android.
function makeContext(isMain) {
  const gradient = () => ({ addColorStop(_position, color) { gradientColors.push(color); } });
  return new Proxy({
    createLinearGradient() { if (isMain) mainGradients++; return gradient(); },
    createRadialGradient() { if (isMain) mainGradients++; return gradient(); },
    createPattern: () => ({})
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        for (const value of args) {
          if (typeof value === 'number') assert(Number.isFinite(value), `${String(key)} received a non-finite value`);
        }
        if (isMain) operations.push(key);
      };
    },
    set(target, key, value) { target[key] = value; return true; }
  });
}
const context = makeContext(true);
const element = id => {
  const classes = new Set(id === 'settingsPanel' ? ['hidden'] : []);
  return {
    id,
    textContent: '',
    value: '',
    style: {},
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    select() { this.selected = true; },
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }
    },
    addEventListener(name, callback) { events.set(`${id}:${name}`, callback); }
  };
};
const canvas = element('game');
canvas.width = 450;
canvas.height = 800;
canvas.getContext = () => context;
let stageHeight = 1000;
canvas.getBoundingClientRect = () => ({ width: 450, height: stageHeight, left: 0 });
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
    createElement() { return { width: 0, height: 0, getContext: () => makeContext(false) }; },
    addEventListener(name, callback) { events.set(`document:${name}`, callback); }
  },
  window: { addEventListener(name, callback) { events.set(`window:${name}`, callback); } },
  localStorage: {
    getItem(key) { return storage.get(key) ?? null; },
    removeItem(key) { storage.delete(key); },
    setItem(key, value) {
      if (blockEconomyWrites && key === 'rio-aventura-economy-v1') throw new Error('storage full');
      storage.set(key, String(value));
    }
  },
  requestAnimationFrame(callback) { nextFrame = callback; },
  Math: sandboxMath
};

// Relanzamiento con cierre limpio: las pruebas anteriores abandonan viajes sin terminar y,
// como un teléfono real, el juego ofrecería retomarlos. Los casos de viaje interrumpido
// usan vm.runInNewContext directamente.
const artSource = require('./sources.cjs').libs;
function launch(code, context) {
  storage.delete('rio-aventura-trip-v1');
  vm.runInNewContext(`${artSource}\n${code}`, context);
}
launch(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
storage.delete('rio-aventura-stats-v1');
assert.equal(canvas.height, 1000, 'the playfield should fit a tall phone');
const art = () => sandbox.window.RioArt.instance;
function boatXAt(time) {
  nextFrame(time);
  const { boatX, boatY } = art().debug;
  assert(boatY > 840 && boatY < 860, 'the boat should be visible near the bottom of the screen');
  return boatX;
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
assert(operations.includes('drawImage'), 'cached sprites (boat, palms, rocks) must be copied onto the canvas');
assert(operations.includes('rotate'), 'the boat must tilt when steering');
assert(art().debug.spritesBuilt > 20, 'the tropical scenery should be prepared once as sprites');
const gradientsAfterWarmup = mainGradients;
for (let time = 2512; time < 3500; time += 16) nextFrame(time);
assert.equal(mainGradients, gradientsAfterWarmup, 'no gradient may be created while playing in the same stage');
assert(art().debug.drawnLast < 160, 'a frame should stay within its sprite budget');
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
for (const id of ['settings', 'openingSettings', 'settingsPanel', 'profileName', 'avatar', 'quality', 'performanceInfo', 'bestScore', 'totalRuns', 'totalDodged', 'legacyDodged', 'playerTag', 'backupText', 'exportProgress', 'importProgress', 'stageLabel', 'stageDistance', 'stageProgress', 'stageToast', 'rankToast', 'coinHud', 'garageCoins', 'boat-classic', 'boat-coral', 'boat-storm', 'boat-breeze', 'boat-aurora', 'rank-explorer', 'rank-navigator', 'rank-captain', 'rankProgressText', 'rankProgressTrack', 'rankProgressFill', 'dailyDate', 'daily-distance', 'daily-dodged', 'daily-pickups', 'achievement-first', 'achievement-regular', 'achievement-dodger', 'achievement-traveler']) {
  assert(html.includes(`id="${id}"`), `the settings screen needs ${id}`);
}
assert(html.includes('prefers-reduced-motion: reduce') && html.includes('id="rankToast" class="hidden" role="status" aria-live="polite"'),
  'rank celebration should be announced accessibly and respect reduced motion');
events.get('settings:click')();
assert(!elements.get('settingsPanel').classList.contains('hidden'), 'settings should open');
assert(/FPS dibujados/.test(elements.get('performanceInfo').textContent), 'settings should show a gameplay FPS sample');
assert.equal(elements.get('profileName').value, 'Invitado', 'a new player starts as a guest');
assert.equal(elements.get('bestScore').textContent, '42', 'the existing record should remain visible');
assert.equal(elements.get('rankProgressFill').style.width, '0%', 'new players should see empty rank progress');
assert.equal(elements.get('rankProgressTrack').attributes['aria-valuenow'], '0', 'rank progress should expose its value accessibly');
assert.equal(elements.get('boat-breeze').disabled, true, 'special boats should start locked');
events.get('boat-breeze:click')();
assert(elements.get('garageNotice').textContent.includes('Desbloquea'), 'locked special boats cannot be equipped by direct clicks');
events.get('boat-coral:click')();
assert(elements.get('garageNotice').textContent.includes('Faltan'), 'boats should not be purchasable without coins');
elements.get('profileName').value = 'Gabriel';
events.get('saveProfile:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-profile-v1')).name, 'Gabriel', 'guest name should persist');
assert(elements.get('playerTag').textContent.includes('Gabriel'), 'the player name should appear on the game overlay');
events.get('avatar:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-profile-v1')).avatar, 1, 'avatar should persist');
elements.get('quality').value = 'low';
events.get('quality:change')();
assert.equal(JSON.parse(storage.get('rio-aventura-profile-v1')).quality, 'low', 'quality choice should persist');
const framesBeforeLow = art().debug.frames;
nextFrame(3612);
nextFrame(3644);
assert(art().debug.frames > framesBeforeLow, 'reduced quality should still draw the game');
assert.equal(art().debug.detail, 0, 'reduced quality should use the minimum detail level');
events.get('closeSettings:click')();
assert(elements.get('settingsPanel').classList.contains('hidden'), 'settings should close');
assert.equal(elements.get('pause').textContent, 'Ⅱ', 'closing settings should resume play');
events.get('game:pointerdown')({ pointerId: 3, clientX: 350 });
for (let time = 3660; time <= 5600; time += 16) nextFrame(time);
events.get('game:pointerup')({ pointerId: 3 });
let foregroundOrderSeen = false;
for (let time = 5650; time <= 8100; time += 50) {
  nextFrame(time);
  if (art().debug.foreground > 0) foregroundOrderSeen = true;
}
assert(foregroundOrderSeen, 'the test should observe a foreground obstacle');
assert(Number.parseInt(elements.get('score').textContent, 10) > 0, 'a safely passed obstacle should score');
events.get('play:click')();
for (let time = 8150; time < 40000 && !storage.has('rio-aventura-stats-v2'); time += 50) nextFrame(time);
const stats = JSON.parse(storage.get('rio-aventura-stats-v2') || 'null');
assert(stats && stats.runs === 1, 'finishing a trip should save one completed run');
assert(stats.distance > 0, 'finished trips should save distance');
assert.equal(stats.version, 2, 'accurate dodges need the new statistics format');
assert.equal(stats.dodged, 0, 'obstacles that hit the boat must not count as dodged');
assert.equal(storage.get('rio-aventura-best-v1'), '42', 'new statistics must not erase the old record');
const firstEconomy = JSON.parse(storage.get('rio-aventura-economy-v1') || 'null');
assert(firstEconomy && firstEconomy.events.filter(event => event.run).length === 1,
  'one finished run should grant one coin award');
assert(firstEconomy.events.find(event => event.run).amount > 0, 'the run award must be positive');
for (let time = 40000; time < 40500; time += 50) nextFrame(time);
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.length, firstEconomy.events.length,
  'a finished run must not grant coins twice');
events.get('openingSettings:click')();
assert.equal(elements.get('totalRuns').textContent, '1', 'settings should show saved trips');
assert.equal(elements.get('totalDistance').textContent, `${stats.distance} m`, 'settings should show saved distance');
assert.equal(elements.get('totalDodged').textContent, '0', 'settings should show confirmed dodges only');
assert.equal(elements.get('achievement-first').textContent, 'Desbloqueado', 'first finished trip unlocks a permanent achievement');
events.get('exportProgress:click')();
const backup = elements.get('backupText').value;
const decodedBackup = JSON.parse(backup);
assert.equal(decodedBackup.format, 'rio-aventura-progress-v2', 'manual backup needs the new versioned format');
assert.equal(decodedBackup.profile.name, 'Gabriel', 'manual backup should include the guest name');
assert.equal(decodedBackup.best, 42, 'manual backup should include the original record');
assert.equal(decodedBackup.stats.runs, 1, 'manual backup should include completed trips');
assert.equal(decodedBackup.economy.events.length, firstEconomy.events.length, 'manual backup should include coin awards');
assert(elements.get('backupText').selected, 'backup text should be selected for copying');
elements.get('backupText').value = '{invalid';
events.get('importProgress:click')();
assert.equal(storage.get('rio-aventura-stats-v2'), JSON.stringify(stats), 'invalid backup must not modify progress');
elements.get('backupText').value = backup;
events.get('importProgress:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-stats-v2')).runs, 1, 'restoring twice must not duplicate trips');
events.get('closeSettings:click')();
launch(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
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
higherBackup.economy.events.push({ id: 'bonus-50', type: 'earn', amount: 50 });
higherBackup.economy.events.push({ id: 'bonus-50b', type: 'earn', amount: 50 });
elements.get('backupText').value = JSON.stringify(higherBackup);
events.get('importProgress:click')();
assert.equal(elements.get('bestScore').textContent, '48', 'restore should accept a higher record');
assert.equal(elements.get('totalRuns').textContent, '3', 'restore should accept higher trip totals');
const coinsBeforePurchase = Number.parseInt(elements.get('garageCoins').textContent, 10);
assert(coinsBeforePurchase >= 50, 'a valid newer backup should restore its coins');
blockEconomyWrites = true;
events.get('boat-coral:click')();
assert.equal(Number.parseInt(elements.get('garageCoins').textContent, 10), coinsBeforePurchase, 'failed storage writes must not spend coins');
assert.notEqual(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'coral', 'failed purchases must not equip a boat');
blockEconomyWrites = false;
events.get('boat-coral:click')();
assert.equal(Number.parseInt(elements.get('garageCoins').textContent, 10), coinsBeforePurchase - 15, 'a purchase should deduct its price exactly once');
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'coral', 'a purchased boat should be equipped');
events.get('boat-coral:click')();
assert.equal(Number.parseInt(elements.get('garageCoins').textContent, 10), coinsBeforePurchase - 15, 'repeating a purchase must not deduct twice');
events.get('boat-storm:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'storm', 'the second boat should be purchasable');
const coinsAfterPurchase = Number.parseInt(elements.get('garageCoins').textContent, 10);
events.get('boat-classic:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'classic', 'owned boats should remain selectable');
events.get('boat-storm:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'storm', 'garage selection should not require buying twice');
elements.get('backupText').value = backup;
events.get('importProgress:click')();
assert.equal(elements.get('totalRuns').textContent, '3', 'an older backup must not decrease or duplicate totals');
assert.equal(Number.parseInt(elements.get('garageCoins').textContent, 10), coinsAfterPurchase, 'an older backup must not refund spent coins');
const divergentBackup = JSON.parse(backup);
divergentBackup.economy.events.push({ id: 'fork-10', type: 'earn', amount: 10 });
elements.get('backupText').value = JSON.stringify(divergentBackup);
events.get('importProgress:click')();
assert(elements.get('backupNotice').textContent.includes('No se mezclaron'), 'divergent coin histories should be rejected');
assert.equal(Number.parseInt(elements.get('garageCoins').textContent, 10), coinsAfterPurchase, 'a rejected backup must not alter coins');
const legacyBackup = { ...decodedBackup, format: 'rio-aventura-progress-v1' };
delete legacyBackup.economy;
elements.get('backupText').value = JSON.stringify(legacyBackup);
events.get('importProgress:click')();
assert.equal(Number.parseInt(elements.get('garageCoins').textContent, 10), coinsAfterPurchase, 'old backups must not change the wallet');
events.get('closeSettings:click')();
gradientColors.length = 0;
for (let time = 40500; time < 40600; time += 16) nextFrame(time);
assert.equal(art().debug.hull, 'storm', 'the selected boat should change the rendered hull color');
storage.set('rio-aventura-stats-v1', JSON.stringify({ runs: 5, dodged: 17, distance: 520 }));
storage.delete('rio-aventura-stats-v2');
launch(fs.readFileSync('app/src/main/assets/game.js', 'utf8'), sandbox);
events.get('openingSettings:click')();
assert.equal(elements.get('totalRuns').textContent, '5', 'legacy trip count should migrate');
assert.equal(elements.get('garageCoins').textContent, `${coinsAfterPurchase} monedas`, 'the wallet should survive a fresh launch');
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'storm', 'the selected boat should survive a fresh launch');
assert.equal(elements.get('totalDodged').textContent, '0', 'old points must not be presented as verified dodges');
assert.equal(elements.get('achievement-dodger').textContent, '0/25', 'legacy estimated points must not unlock verified-dodge achievements');
assert.equal(elements.get('legacyDodged').textContent, '17', 'old estimated points should remain visible');
elements.get('quality').value = 'high';
events.get('quality:change')();
events.get('closeSettings:click')();
let framesMark = art().debug.frames;
for (let time = 100000; time < 100960; time += 16) nextFrame(time);
const highQualityFills = art().debug.frames - framesMark;
assert(highQualityFills >= 58, 'high quality should render nearly every display frame');
const gradientsBeforeResize = mainGradients;
events.get('openingSettings:click')();
elements.get('quality').value = 'low';
events.get('quality:change')();
events.get('closeSettings:click')();
framesMark = art().debug.frames;
for (let time = 101000; time < 101960; time += 16) nextFrame(time);
assert(art().debug.frames - framesMark < highQualityFills * 0.7, 'reduced quality should draw substantially fewer frames');
assert.equal(mainGradients, gradientsBeforeResize, 'the water gradient should remain cached');
stageHeight = 1100;
events.get('window:resize')();
nextFrame(102000);
assert.equal(mainGradients, gradientsBeforeResize + 1, 'resizing should rebuild the water gradient');
framesMark = art().debug.frames;
for (let time = 103000; time < 104000; time += 1000 / 30) nextFrame(time);
assert(art().debug.frames - framesMark >= 29, 'reduced quality should not halve an actual 30 Hz display');
sandbox.document.hidden = true;
framesMark = art().debug.frames;
nextFrame(104050);
assert.equal(art().debug.frames, framesMark, 'hidden pages should not redraw the canvas');

// A long safe run should reach all four stages and draw the new lateral hazard.
sandbox.document.hidden = false;
sandboxMath.random = () => 0.2;
const source = fs.readFileSync('app/src/main/assets/game.js', 'utf8');
const inspectedSource = source.replace('  requestAnimationFrame(frame);\n})();',
  '  window.__inspectObstacles = () => obstacles;\n  window.__inspectGame = () => ({ lives, shieldTimer, stageIndex, runDistance });\n  window.__setLivesForTest = value => { lives = value; updateHud(); };\n  window.__setBoatCenterForTest = () => { boat.x = width / 2; boat.vx = 0; };\n  window.__addCoinAtBoatForTest = () => { collectibles.push({ x: boat.x, y: boat.y, phase: 0 }); };\n  window.__setStatsForTest = (distance, dodged, runs) => { stats.distance = distance; stats.dodged = dodged; if (runs !== undefined) stats.runs = runs; };\n  window.__setRunForTest = (distance, dodged, pickups) => { runDistance = distance; score = dodged; collectedCoins = pickups; updateHud(); };\n  window.__finishForTest = finish;\n  requestAnimationFrame(frame);\n})();');
assert.notEqual(inspectedSource, source, 'the smoke test should inspect the active obstacle list');
launch(inspectedSource, sandbox);
events.get('play:click')();
events.get('game:pointerdown')({ pointerId: 9, clientX: 440 });
const stagesSeen = new Set();
const driftPositions = new WeakMap();
let driftMoved = false;
let rewardedStages = 0;
let priorStage = 0;
let shieldExpired = false;
for (let time = 105000; time < 135000; time += 50) {
  nextFrame(time);
  stagesSeen.add(elements.get('stageLabel').textContent);
  const game = sandbox.window.__inspectGame();
  if (game.stageIndex > priorStage) {
    rewardedStages++;
    assert.equal(game.lives, 3, 'stage rewards cannot exceed three lives');
    assert(game.shieldTimer > 0, 'each new stage should grant a temporary shield');
    assert(elements.get('lives').textContent.includes('🛡'), 'the shield should be visible in the HUD');
    priorStage = game.stageIndex;
  }
  if (priorStage > 0 && game.shieldTimer === 0 && !elements.get('lives').textContent.includes('🛡')) shieldExpired = true;
  for (const item of sandbox.window.__inspectObstacles()) {
    if (item.kind !== 'drift') continue;
    assert(item.x >= 84 && item.x <= 366, 'drifting logs must stay within the river');
    if (driftPositions.has(item) && Math.abs(item.x - driftPositions.get(item)) > 0.1) driftMoved = true;
    driftPositions.set(item, item.x);
  }
}
assert.equal(stagesSeen.size, 4, 'a safe run should pass through four distinct stages');
assert.equal(rewardedStages, 3, 'each completed stage should grant one reward');
assert(shieldExpired, 'the shield indicator should disappear when protection ends');
assert(elements.get('stageLabel').textContent.includes('Río bravo'), 'the final stage should remain playable without a distance cap');
assert(elements.get('stageDistance').textContent.includes('sin fin'), 'the final stage should be endless');
assert.equal(elements.get('stageProgress').style.width, '100%', 'the final progress indicator should be full');
assert(art().debug.counts.drift > 0, 'later stages should render moving driftwood');
assert(driftMoved, 'drifting logs must move sideways during play');
assert(elements.get('stageToast').classList.contains('hidden'), 'stage announcements should disappear after a short time');

// Missing health is restored at a stage boundary and shielded contact causes no damage.
sandboxMath.random = () => 0.5;
launch(inspectedSource, sandbox);
events.get('play:click')();
events.get('game:pointerdown')({ pointerId: 10, clientX: 440 });
sandbox.window.__setLivesForTest(2);
let rewardSeen = false;
let shieldBlocked = false;
for (let time = 136000; time < 145000; time += 50) {
  nextFrame(time);
  const game = sandbox.window.__inspectGame();
  if (game.stageIndex === 1 && !rewardSeen) {
    rewardSeen = true;
    assert.equal(game.lives, 3, 'a completed stage should restore one missing life');
    assert(game.shieldTimer > 0, 'the reward should include shield time');
    assert(elements.get('stageToast').textContent.includes('Vida recuperada'), 'the reward should be announced');
    events.get('game:pointerup')({ pointerId: 10 });
    sandbox.window.__setBoatCenterForTest();
  }
  if (rewardSeen && game.shieldTimer > 0 && sandbox.window.__inspectObstacles().some(item => item.hit)) {
    assert.equal(game.lives, 3, 'shielded contact should not cost a life');
    shieldBlocked = true;
    break;
  }
}
assert(rewardSeen, 'the healing stage boundary should be reached');
assert(shieldBlocked, 'an obstacle should contact the shield in the test');

// Floating coins are optional pickups, paid once with the usual end-of-run event.
launch(inspectedSource, sandbox);
events.get('play:click')();
const eventsBeforePickupRun = JSON.parse(storage.get('rio-aventura-economy-v1')).events.length;
sandbox.window.__addCoinAtBoatForTest();
nextFrame(146000);
assert(elements.get('coinHud').textContent.includes('viaje +3'), 'a collected coin should show its run bonus');
nextFrame(146050);
assert(elements.get('coinHud').textContent.includes('viaje +3'), 'the same coin must not be collected twice');
sandbox.window.__finishForTest();
const pickupEconomy = JSON.parse(storage.get('rio-aventura-economy-v1'));
const pickupRunEvents = pickupEconomy.events.slice(eventsBeforePickupRun).filter(event => event.run);
assert.equal(pickupRunEvents.length, 1, 'pickup run should create one wallet run event');
assert.equal(pickupRunEvents[0].amount, 3, 'a collected coin should add three coins to the completed run');
nextFrame(146050);
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.length, pickupEconomy.events.length,
  'a finished pickup run must not grant the reward twice');

// All completed rank goals should award once, in the same wallet write as the trip.
launch(inspectedSource, sandbox);
events.get('play:click')();
const eventsBeforeRanks = JSON.parse(storage.get('rio-aventura-economy-v1')).events.length;
sandbox.window.__setStatsForTest(125, 1);
events.get('openingSettings:click')();
assert.equal(elements.get('rankProgressFill').style.width, '33%', 'rank progress should require both distance and dodges');
assert(elements.get('rankProgressText').textContent.includes('125/250 m'), 'rank progress should explain distance');
assert.equal(elements.get('rankProgressTrack').attributes['aria-valuenow'], '33', 'progressbar should expose the measured value');
events.get('closeSettings:click')();
sandbox.window.__setStatsForTest(2100, 45, 8);
blockEconomyWrites = true;
sandbox.window.__finishForTest();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.length, eventsBeforeRanks,
  'failed wallet storage must not claim rank prizes');
events.get('openingSettings:click')();
assert(elements.get('rank-explorer').textContent.includes('Objetivo listo'),
  'an unpaid rank should remain ready to claim after a failed save');
blockEconomyWrites = false;
assert(storage.has('rio-aventura-settle-v1'), 'a trip whose wallet save failed must stay pending');
launch(inspectedSource, sandbox);
const recoveredEconomy = JSON.parse(storage.get('rio-aventura-economy-v1'));
assert.equal(recoveredEconomy.events.length, eventsBeforeRanks + 4,
  'the next launch should complete the unsaved trip and its three rank prizes exactly once');
assert(!storage.has('rio-aventura-settle-v1'), 'a completed settlement must leave no pending record');
assert.deepEqual(Array.from(recoveredEconomy.events.slice(-3), event => event.rank),
  ['explorer', 'navigator', 'captain'], 'all ranks should be unlocked in order');
assert(recoveredEconomy.events.slice(-3).every(event => event.type === 'earn' && event.amount <= 80),
  'rank prizes should remain readable as ordinary earnings by the previous version');
assert.equal(recoveredEconomy.events.slice(-3).reduce((sum, event) => sum + event.amount, 0), 70,
  'rank prizes should be credited once in the wallet');
assert(elements.get('playerTag').textContent.includes('Capitán del río'), 'the highest rank should appear beside the player');
assert(elements.get('playerTag').textContent.includes('🥇'), 'the highest rank should have its own badge');
assert(!elements.get('rankToast').classList.contains('hidden'), 'a rank-up should show a brief celebration');
assert(elements.get('rankToast').textContent.includes('Capitán del río'), 'celebration should name the new rank');
for (let time = 150000; time <= 153500; time += 50) nextFrame(time);
assert(elements.get('rankToast').classList.contains('hidden'), 'rank celebration should dismiss automatically');
events.get('play:click')();
sandbox.window.__finishForTest();
const rankedEconomy = JSON.parse(storage.get('rio-aventura-economy-v1'));
assert.equal(rankedEconomy.events.length, eventsBeforeRanks + 5, 'the recovered trip plus the new trip should add two trip events');
events.get('openingSettings:click')();
for (const id of ['rank-explorer', 'rank-navigator', 'rank-captain']) {
  assert(elements.get(id).textContent.includes('Desbloqueado'), `${id} should show its permanent state`);
}
assert.equal(elements.get('rankProgressFill').style.width, '100%', 'all ranks should fill the progress bar');
assert.equal(elements.get('achievement-dodger').textContent, 'Desbloqueado', 'verified dodges should unlock achievements');
assert.equal(elements.get('achievement-traveler').textContent, 'Desbloqueado', 'saved distance should unlock achievements');
assert.equal(elements.get('achievement-regular').textContent, 'Desbloqueado', 'ten saved trips should unlock the regular achievement');
assert.equal(elements.get('boat-breeze').disabled, false, 'Explorer should unlock Brisa');
assert.equal(elements.get('boat-aurora').disabled, false, 'Captain should unlock Aurora');
events.get('boat-breeze:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'breeze', 'the first rank boat should be equipable for free');
gradientColors.length = 0;
nextFrame(153550);
assert.equal(art().debug.hull, 'breeze', 'Brisa should have its own visible hull color');
events.get('boat-aurora:click')();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'aurora', 'the final rank boat should be equipable for free');
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.length, rankedEconomy.events.length,
  'equipping rank boats should not spend coins or add purchases');
events.get('exportProgress:click')();
assert.equal(JSON.parse(elements.get('backupText').value).economy.events.length, rankedEconomy.events.length,
  'the manual backup should include earned ranks');
launch(inspectedSource, sandbox);
assert(elements.get('playerTag').textContent.includes('Capitán del río'), 'the rank should survive a fresh game launch');
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).selected, 'aurora', 'the chosen rank boat should survive a relaunch');
gradientColors.length = 0;
nextFrame(154000);
assert.equal(art().debug.hull, 'aurora', 'Aurora should have its own visible hull color');
events.get('play:click')();
sandbox.window.__finishForTest();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.length, rankedEconomy.events.length + 1,
  'a second trip must not award unlocked ranks again');

// Damaged stored economy is never silently replaced by an empty wallet.
const savedEconomy = storage.get('rio-aventura-economy-v1');
storage.set('rio-aventura-economy-v1', '{broken');
launch(source, sandbox);
events.get('openingSettings:click')();
assert(elements.get('garageNotice').textContent.includes('Restaura una copia'), 'corrupt progress should request recovery');
assert.equal(elements.get('coinHud').textContent, '🪙 !', 'corrupt progress should be visible outside the garage');
events.get('exportProgress:click')();
assert(elements.get('backupNotice').textContent.includes('No generes una copia'), 'a corrupt wallet must not be exported as zero coins');
events.get('boat-coral:click')();
assert.equal(storage.get('rio-aventura-economy-v1'), '{broken', 'a corrupt wallet should not be overwritten by a purchase');
const recovery = { ...decodedBackup, economy: JSON.parse(savedEconomy) };
elements.get('backupText').value = JSON.stringify(recovery);
events.get('importProgress:click')();
assert.equal(storage.get('rio-aventura-economy-v1'), savedEconomy, 'a valid backup should recover the wallet');
events.get('closeSettings:click')();

// Daily missions use completed-run ledger entries and can pay once per phone day.
const NativeDate = Date;
let simulatedNow = NativeDate.parse('2030-01-15T12:00:00Z');
sandbox.Date = class extends NativeDate {
  constructor(...args) { if (args.length) super(...args); else super(simulatedNow); }
  static now() { return simulatedNow; }
};
launch(inspectedSource, sandbox);
events.get('play:click')();
let dailyStart = JSON.parse(storage.get('rio-aventura-economy-v1')).events.length;
sandbox.window.__setRunForTest(150, 4, 2);
blockEconomyWrites = true;
sandbox.window.__finishForTest();
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.length, dailyStart,
  'a failed wallet write must not claim daily missions or store a partial trip');
blockEconomyWrites = false;
launch(inspectedSource, sandbox);
assert.equal(JSON.parse(storage.get('rio-aventura-economy-v1')).events.slice(dailyStart).filter(event => event.run).length, 1,
  'the next launch should record the trip whose wallet save failed, exactly once');
events.get('play:click')();
sandbox.window.__setRunForTest(150, 4, 2);
sandbox.window.__finishForTest();
let dailyEvents = JSON.parse(storage.get('rio-aventura-economy-v1')).events.slice(dailyStart);
assert.equal(dailyEvents.filter(event => event.run).length, 2, 'the recovered trip and the new trip should each be recorded once');
assert.deepEqual(Array.from(dailyEvents.filter(event => event.dailyMission), event => event.dailyMission),
  ['distance', 'dodged', 'pickups'], 'all three completed daily missions should pay automatically');
assert.equal(dailyEvents.filter(event => event.dailyMission).reduce((sum, event) => sum + event.amount, 0), 15,
  'daily rewards should be balanced and credited once');
events.get('openingSettings:click')();
for (const id of ['daily-distance', 'daily-dodged', 'daily-pickups']) {
  assert(elements.get(id).textContent.includes('Completada'), `${id} should show a claimed mission`);
}
events.get('exportProgress:click')();
assert.equal(JSON.parse(elements.get('backupText').value).economy.events.length,
  JSON.parse(storage.get('rio-aventura-economy-v1')).events.length,
  'the backup should include daily mission progress and rewards');
launch(inspectedSource, sandbox);
events.get('openingSettings:click')();
assert(elements.get('daily-distance').textContent.includes('Completada'), 'daily claims should survive a relaunch');
events.get('closeSettings:click')();
events.get('play:click')();
dailyStart = JSON.parse(storage.get('rio-aventura-economy-v1')).events.length;
sandbox.window.__setRunForTest(150, 4, 2);
sandbox.window.__finishForTest();
dailyEvents = JSON.parse(storage.get('rio-aventura-economy-v1')).events.slice(dailyStart);
assert.equal(dailyEvents.filter(event => event.dailyMission).length, 0,
  'repeating the mission on the same day must not pay again');
simulatedNow = NativeDate.parse('2030-01-16T12:00:00Z');
launch(inspectedSource, sandbox);
events.get('play:click')();
dailyStart = JSON.parse(storage.get('rio-aventura-economy-v1')).events.length;
sandbox.window.__setRunForTest(150, 4, 2);
sandbox.window.__finishForTest();
dailyEvents = JSON.parse(storage.get('rio-aventura-economy-v1')).events.slice(dailyStart);
assert.equal(dailyEvents.filter(event => event.dailyMission).length, 3,
  'a new phone day should make daily missions available again');
simulatedNow = NativeDate.parse('2030-01-15T12:00:00Z');
launch(inspectedSource, sandbox);
events.get('play:click')();
dailyStart = JSON.parse(storage.get('rio-aventura-economy-v1')).events.length;
sandbox.window.__setRunForTest(150, 4, 2);
sandbox.window.__finishForTest();
dailyEvents = JSON.parse(storage.get('rio-aventura-economy-v1')).events.slice(dailyStart);
assert.equal(dailyEvents.filter(event => event.dailyMission).length, 0,
  'moving the phone clock backwards must not reopen claimed missions');
assert.equal(dailyEvents.find(event => event.run).run.day, '2030-01-16',
  'clock rollback should preserve the latest recorded mission day');
events.get('openingSettings:click')();
assert(elements.get('dailyDate').textContent.includes('atrasado'), 'a rolled-back clock should be explained in settings');
events.get('exportProgress:click')();
const duplicateClaimBackup = JSON.parse(elements.get('backupText').value);
const earlierClaim = duplicateClaimBackup.economy.events.find(event => event.dailyDay === '2030-01-16');
duplicateClaimBackup.economy.events.push({ ...earlierClaim, id: 'duplicate-daily-claim' });
const walletBeforeBadImport = storage.get('rio-aventura-economy-v1');
elements.get('backupText').value = JSON.stringify(duplicateClaimBackup);
events.get('importProgress:click')();
assert(elements.get('backupNotice').textContent.includes('no es válida'), 'duplicated daily claims should fail backup validation');
assert.equal(storage.get('rio-aventura-economy-v1'), walletBeforeBadImport,
  'a duplicate-claim backup must not modify the wallet');
delete sandbox.Date;
console.log('Visual smoke test passed');
require('./progress-safety.cjs');
require('./art-render.cjs');
require('./world.cjs');
require('./exploration.cjs');
require('./map-ui.cjs');
require('./themes.cjs');
require('./sea.cjs');
require('./sea-game.cjs');
require('./quests.cjs');
require('./quest-game.cjs');
require('./pause.cjs');
require('./npc-visible.cjs');
