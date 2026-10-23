// Flujo real en Chromium de las correcciones 2.7.1: salir del río clásico sin morir, personajes visibles y
// pesca completa (aproximarse, parar, pescar, vender al pescador). No forma parte de visual-smoke. Uso:
//   NODE_PATH=<ruta con playwright> node tests/e2e-fixes.cjs [carpeta-de-capturas]
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
    boat: () => ({ x: seaBoat.x, y: seaBoat.y, vx: seaBoat.vx, vy: seaBoat.vy }), state: () => state, mode: () => mode,
    docks: () => seaWorld.docks.map(d => ({ id: d.id, x: d.x, y: d.y })), zones: () => seaWorld.fishing.map(z => ({ id: z.id, x: z.x, y: z.y, r: z.radius })),
    phase: () => (seaFishing ? seaFishing.phase : ''), bag: () => ({ ...seaBag }), coins: () => currentView().coins, sold: () => currentView().fishSold,
    place: (x, y, h) => { seaBoat.x = x; seaBoat.y = y; seaBoat.vx = 0; seaBoat.vy = 0; seaBoat.heading = h || 0; seaFollow(0, true); },
    npcs: () => seaView.stats.npcs, lives: () => lives, distance: () => runDistance
  };
`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
  const get = (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const T = 40;
  const size = async selector => page.locator(selector).boundingBox();
  const bigEnough = async selector => { const b = await size(selector); assert(b.width >= 44 && b.height >= 44, `${selector}: ${b.width}×${b.height}`); };

  // ---- 1) Río clásico: pausa → guardar y salir → continuar, sin morir ----
  await page.goto(url);
  await wait(500);
  await page.click('#play', { force: true });
  await wait(2500);
  await bigEnough('#pause');
  await page.click('#pause');
  await wait(300);
  assert.equal(await get(() => window.__e2e.state()), 'paused');
  for (const sel of ['#play', '#saveExit', '#endTrip']) { assert(await page.isVisible(sel), `${sel} visible`); await bigEnough(sel); }
  assert.equal(await page.textContent('#play'), 'Reanudar');
  await shot('f1-pausa-clasico');
  const distBefore = await get(() => window.__e2e.distance());
  await page.click('#saveExit');
  await wait(200);
  assert(await page.isVisible('#confirmPanel'));
  await bigEnough('#confirmYes'); await bigEnough('#confirmNo');
  await shot('f2-confirmar');
  await page.click('#confirmNo');
  assert(!(await page.isVisible('#confirmPanel')));
  await page.click('#saveExit'); await page.click('#confirmYes');
  await wait(300);
  assert.equal(await get(() => window.__e2e.state()), 'ready', 'salió al menú sin morir');
  assert.match(await page.textContent('#title'), /Viaje\s*guardado/);
  assert.equal(await page.textContent('#play'), 'Continuar viaje');
  await shot('f3-guardado-menu');
  await page.reload();
  await wait(600);
  assert.match(await page.textContent('#title'), /Viaje\s*interrumpido/, 'tras cerrar la app el viaje sigue guardado');
  await page.click('#play', { force: true });
  await wait(500);
  assert.equal(await get(() => window.__e2e.state()), 'playing');
  assert((await get(() => window.__e2e.distance())) >= distBefore - 5, 'continúa el mismo viaje');
  // Botón Atrás de Android: pausa y luego pregunta.
  assert.equal(await get(() => window.rioAventuraBack()), true);
  assert.equal(await get(() => window.__e2e.state()), 'paused');
  assert.equal(await get(() => window.rioAventuraBack()), true);
  assert(await page.isVisible('#confirmPanel'));
  assert.equal(await get(() => window.rioAventuraBack()), true);
  assert(!(await page.isVisible('#confirmPanel')));
  await page.click('#endTrip'); await page.click('#confirmYes');
  await wait(400);
  assert.equal(await get(() => window.__e2e.state()), 'over', 'terminar y cobrar desde la pausa');
  await shot('f4-viaje-terminado');
  await page.click('#play', { force: true });
  await wait(300);
  await page.click('#pause'); await page.click('#saveExit'); await page.click('#confirmYes');
  await wait(300);
  await page.click('#finishTrip');
  await wait(300);

  // ---- 2) Mundo libre: salir desde la pausa ----
  await page.reload();
  await wait(500);
  await page.click('#exploreSea', { force: true });
  await wait(600);
  await page.click('#pause');
  assert(await page.isVisible('#saveExit') && !(await page.isVisible('#endTrip')));
  await shot('f5-pausa-mundo');
  await page.click('#saveExit'); await page.click('#confirmYes');
  await wait(300);
  assert.equal(await get(() => window.__e2e.mode()), 'classic');
  await page.click('#exploreSea', { force: true });
  await wait(600);

  // ---- 3) Personajes visibles en los muelles ----
  const docks = await get(() => window.__e2e.docks());
  for (const id of ['puerto', 'aldea', 'cascada']) {
    const dock = docks.find(d => d.id === id);
    await get(([x, y]) => window.__e2e.place(x, y + 230, 0), [dock.x, dock.y]);
    await wait(500);
    assert((await get(() => window.__e2e.npcs())) >= 1, `${id}: se dibuja al personaje`);
    await shot(`f6-personaje-${id}`);
  }

  // ---- 4) Pesca: ir al caladero con el joystick, parar, pescar 3 veces y vender al pescador ----
  await get(() => window.__e2e.place(50.5 * 40, 87.5 * 40, 0));
  await wait(300);
  const zone = (await get(() => window.__e2e.zones())).find(z => z.id === 'bahia');
  const origin = { x: 206, y: 700 };
  let pressed = false;
  const release = async () => { if (pressed) { await page.mouse.up(); pressed = false; } };
  async function steer(tx, ty, tolerance = 60) {
    const end = Date.now() + 40000;
    for (;;) {
      const b = await get(() => window.__e2e.boat());
      const d = Math.hypot(tx - b.x, ty - b.y);
      if (d < tolerance) return;
      if (Date.now() > end) throw new Error(`no llega a ${tx},${ty}`);
      if ((await get(() => window.__e2e.state())) !== 'playing') return;
      if (!pressed) { await page.mouse.move(origin.x, origin.y); await page.mouse.down(); pressed = true; }
      await page.mouse.move(origin.x + (tx - b.x) / d * 58, origin.y + (ty - b.y) / d * 58);
      await wait(40);
    }
  }
  await steer(zone.x, zone.y, 30);
  await release();
  await page.keyboard.down(' ');
  await wait(1200);
  await page.keyboard.up(' ');
  assert(await page.isVisible('#fishButton'), 'el botón de pescar aparece dentro del caladero y parado');
  await bigEnough('#fishButton');
  await shot('f7-caladero');
  let caught = 0;
  for (let attempt = 0; attempt < 12 && caught < 3; attempt++) {
    await page.click('#fishButton', { force: true });
    // Espera la picada y recoge enseguida.
    const end = Date.now() + 8000;
    while (Date.now() < end && (await get(() => window.__e2e.phase())) !== 'bite') await wait(30);
    if ((await get(() => window.__e2e.phase())) !== 'bite') continue;
    if (attempt === 0) await shot('f8-pica');
    await page.click('#fishButton', { force: true });
    await wait(150);
    const bag = await get(() => window.__e2e.bag());
    const total = Object.values(bag).reduce((a, b) => a + b, 0);
    if (total > caught) caught = total;
    if (attempt === 0) await shot('f9-captura');
    await wait(1000);
  }
  assert(caught >= 3, `se pescaron ${caught} peces`);
  const bag = await get(() => window.__e2e.bag());
  const coinsBefore = await get(() => window.__e2e.coins());
  // Llevar la hielera al pescador: aldea, a la derecha.
  for (const [wx, wy] of [[55, 88], [63, 88], [70, 85]]) await steer((wx + 0.5) * T, (wy + 0.5) * T, 70);
  const dock = docks.find(d => d.id === 'aldea');
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
  assert.equal(await get(() => window.__e2e.state()), 'arrived', 'atracó en la aldea');
  await page.click('#talk');
  await wait(300);
  assert(await page.isVisible('#dialogSell'), 'el pescador compra');
  await bigEnough('#sellFish');
  await shot('f10-venta');
  const afterTrip = await get(() => window.__e2e.coins());
  await page.click('#sellFish');
  await wait(300);
  const afterSale = await get(() => window.__e2e.coins());
  const prices = { sardina: 2, caballa: 3, pargo: 6, dorada: 9, 'pez-luna': 20 };
  const expected = Object.entries(bag).reduce((sum, [k, n]) => sum + n * prices[k], 0);
  assert.equal(afterSale - afterTrip, expected, `venta exacta (${expected})`);
  assert.equal(await get(() => window.__e2e.sold()), Object.values(bag).reduce((a, b) => a + b, 0));
  await page.click('#sellFish', { force: true }).catch(() => {});
  assert.equal(await get(() => window.__e2e.coins()), afterSale, 'no se cobra dos veces');
  await shot('f11-vendido');
  // Reabrir: la hielera está vacía y no hay nada más que cobrar.
  await page.reload();
  await wait(600);
  await page.click('#exploreSea', { force: true });
  await wait(500);
  assert.equal(Object.values(await get(() => window.__e2e.bag())).reduce((a, b) => a + b, 0), 0);
  assert.equal(await get(() => window.__e2e.coins()), afterSale);
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`);
  console.log(`E2E de correcciones correcto (pesca ${caught} peces; venta ${expected} monedas; monedas ${coinsBefore} → ${afterSale})`);
  await context.close();
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
