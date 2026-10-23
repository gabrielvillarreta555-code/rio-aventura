// Flujo real en Chromium de un encargo: hablar en el puerto, aceptar, cerrar la app, reabrirla, conducir
// por el mundo libre hasta la aldea, atracar, cobrar una sola vez. No forma parte de visual-smoke. Uso:
//   NODE_PATH=<ruta con playwright> node tests/e2e-quests.cjs [carpeta-de-capturas]
// Solo hay un gancho de lectura/colocación; clics, joystick, física, guardado y economía son los reales.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

let chromium;
try { ({ chromium } = require('playwright')); } catch (error) {
  console.log('E2E omitido: playwright no está disponible');
  process.exit(0);
}

const assets = path.resolve(__dirname, '../app/src/main/assets');
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const anchor = '  requestAnimationFrame(frame);\n})();';
const hooks = `
  window.__e2e = {
    boat: () => ({ x: seaBoat.x, y: seaBoat.y, vx: seaBoat.vx, vy: seaBoat.vy }), state: () => state,
    quests: () => seaQuests.map(q => ({ tpl: q.tpl, t: q.t, bumps: q.bumps })), docks: () => seaWorld.docks.map(d => ({ id: d.id, x: d.x, y: d.y })),
    place: (x, y, h) => { seaBoat.x = x; seaBoat.y = y; seaBoat.vx = 0; seaBoat.vy = 0; seaBoat.heading = h || 0; seaFollow(0, true); },
    rep: id => repOf(id), done: id => doneOf(id), coins: () => currentView().coins
  };
`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // RECORD_DIR=<carpeta> graba un vídeo del recorrido.
  const record = process.env.RECORD_DIR ? { recordVideo: { dir: process.env.RECORD_DIR, size: { width: 412, height: 892 } } } : {};
  const context = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: record.recordVideo ? 1 : 2, isMobile: true, hasTouch: true, ...record });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/game.js', async route => {
    const source = fs.readFileSync(path.join(assets, 'game.js'), 'utf8');
    assert(source.includes(anchor));
    await route.fulfill({ contentType: 'text/javascript', body: source.replace(anchor, () => hooks + anchor) });
  });
  const url = `file://${assets}/index.html`;
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const get = fn => page.evaluate(fn);
  const wait = ms => page.waitForTimeout(ms);
  const T = 40;
  const touchSize = async selector => (await page.locator(selector).boundingBox());
  async function enter() {
    await page.goto(url);
    await wait(500);
    await page.click('#exploreSea', { force: true });
    await wait(500);
  }

  // Autopiloto con el joystick (ratón) hacia un punto, con aproximación lenta opcional.
  const origin = { x: 206, y: 700 };
  let pressed = false;
  async function steer(tx, ty, { tolerance = 70, limitMs = 60000 } = {}) {
    const end = Date.now() + limitMs;
    for (;;) {
      const b = await get(() => window.__e2e.boat());
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy);
      if (d < tolerance) return;
      if (Date.now() > end) throw new Error(`no llega a ${tx},${ty} (está en ${b.x.toFixed(0)},${b.y.toFixed(0)})`);
      if ((await get(() => window.__e2e.state())) !== 'playing') return;
      if (!pressed) { await page.mouse.move(origin.x, origin.y); await page.mouse.down(); pressed = true; }
      await page.mouse.move(origin.x + dx / d * 58, origin.y + dy / d * 58);
      await wait(40);
    }
  }
  const release = async () => { if (pressed) { await page.mouse.up(); pressed = false; } };
  async function approachDock(id) {
    const dock = (await get(() => window.__e2e.docks())).find(d => d.id === id);
    const end = Date.now() + 40000;
    while (Date.now() < end && (await get(() => window.__e2e.state())) === 'playing') {
      const b = await get(() => window.__e2e.boat());
      const d = Math.hypot(dock.x - b.x, dock.y - b.y);
      const speed = Math.hypot(b.vx, b.vy);
      await page.keyboard[speed > 105 && d < 150 ? 'down' : 'up'](' ');
      const mag = Math.max(0.25, Math.min(1, d / 260));
      if (!pressed) { await page.mouse.move(origin.x, origin.y); await page.mouse.down(); pressed = true; }
      await page.mouse.move(origin.x + (dock.x - b.x) / d * 58 * mag, origin.y + (dock.y - b.y) / d * 58 * mag);
      await wait(40);
    }
    await release();
    await page.keyboard.up(' ');
    assert.equal(await get(() => window.__e2e.state()), 'arrived', `se atracó en ${id}`);
  }

  await enter();
  // Navegar de verdad hasta el muelle del puerto (a la izquierda de la lancha) y atracar.
  await steer(41 * T, 88.5 * T, { tolerance: 150 });
  await approachDock('puerto');
  await wait(300);
  assert(await page.isVisible('#talk'), 'botón para hablar con el personaje');
  for (const sel of ['#talk']) {
    const box = await touchSize(sel);
    assert(box.height >= 44 && box.width >= 44, `${sel}: objetivo táctil ${box.width}×${box.height}`);
  }
  await shot('q1-muelle-puerto');
  await page.click('#talk');
  await wait(300);
  assert.match(await page.textContent('#dialogName'), /Capitana Marisol/);
  for (const sel of ['#offerAccept-0', '#offerDecline-0', '#closeDialog', '#dialogChat']) {
    const box = await touchSize(sel);
    assert(box.height >= 44 && box.width >= 44, `${sel}: objetivo táctil ${box.width}×${box.height}`);
  }
  assert(await page.isDisabled('#offerAccept-1') && await page.isDisabled('#offerAccept-2'), 'las ofertas bloqueadas no se aceptan');
  await shot('q2-dialogo');
  await page.click('#dialogChat'); await wait(150);
  await page.click('#offerAccept-0'); await wait(300);
  assert.deepEqual((await get(() => window.__e2e.quests())).map(q => q.tpl), ['pescado-aldea']);
  await shot('q3-aceptado');
  await page.click('#closeDialog');
  await page.click('#play', { force: true });
  await wait(600);
  assert(await page.isVisible('#questHud'));
  await shot('q4-en-ruta');

  // Cerrar y reabrir la app con el encargo en curso: sigue activo (misma lancha, mismo encargo).
  const pos = await get(() => window.__e2e.boat());
  await page.click('#pause');
  await page.reload();
  await wait(600);
  await page.click('#exploreSea', { force: true });
  await wait(500);
  assert.deepEqual((await get(() => window.__e2e.quests())).map(q => q.tpl), ['pescado-aldea'], 'el encargo sobrevive al reinicio');
  const back = await get(() => window.__e2e.boat());
  assert(Math.hypot(back.x - pos.x, back.y - pos.y) < 2);
  await wait(300);
  assert(await page.isVisible('#questHud'));
  const coinsBefore = await get(() => window.__e2e.coins());

  // Conducir por el mundo libre hasta la aldea y atracar: el encargo se entrega allí y no antes.
  await steer(52 * T, 82 * T);
  assert.equal((await get(() => window.__e2e.quests())).length, 1, 'aún sin entregar a medio camino');
  await steer(56 * T, 87 * T);
  await steer(63 * T, 88 * T);
  await steer(70 * T, 85 * T);
  await approachDock('aldea');
  await wait(400);
  assert(await page.isVisible('#deliveryCard'), 'pantalla de entrega');
  assert.match(await page.textContent('#deliveryText'), /Tomás el Pescador/);
  await shot('q5-entrega');
  const after = await get(() => window.__e2e.coins());
  assert(after >= coinsBefore + 10, `monedas ${coinsBefore} → ${after}`);
  assert.equal(await get(() => window.__e2e.rep('puerto')), 2);
  assert.equal(await get(() => window.__e2e.done('pescado-aldea')), 1);
  assert.equal((await get(() => window.__e2e.quests())).length, 0);

  // Tras reiniciar no se vuelve a cobrar ni a ofrecer como activo.
  await page.reload();
  await wait(600);
  await page.click('#exploreSea', { force: true });
  await wait(500);
  assert.equal((await get(() => window.__e2e.quests())).length, 0);
  assert.equal(await get(() => window.__e2e.done('pescado-aldea')), 1);
  assert.equal(await get(() => window.__e2e.coins()), after, 'las monedas no cambian al reabrir');
  await page.click('#pause');
  await page.click('#openingSettings').catch(() => {});
  await page.click('#settings', { force: true }).catch(() => {});
  await wait(300);
  const book = await page.textContent('#rep-puerto');
  assert.match(book, /Desconocido · 2 puntos/);
  await page.evaluate(() => document.getElementById('quest-total').scrollIntoView());
  await shot('q6-libreta');
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`);
  console.log(`E2E de encargos correcto (monedas ${coinsBefore} → ${after}, reputación con la capitana 2)`);
  await context.close();
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
