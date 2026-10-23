// Flujo real en Chromium del mundo libre: mover la lancha en las cuatro direcciones con teclado y
// joystick (ratón), rodear la isla central por los dos canales y atracar físicamente en un muelle.
// No forma parte de visual-smoke (la CI no instala navegadores). Uso:
//   NODE_PATH=<ruta con playwright> node tests/e2e-sea.cjs [carpeta-de-capturas]
// Solo se añade un gancho de lectura/colocación; los controles, la física y el guardado son los reales.
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
    boat: () => ({ x: seaBoat.x, y: seaBoat.y, vx: seaBoat.vx, vy: seaBoat.vy, h: seaBoat.heading }),
    cam: () => ({ x: seaCam.x, y: seaCam.y }), state: () => state, mode: () => mode, status: () => seaDockStatus,
    trip: () => ({ dist: seaTrip.dist, pickups: seaTrip.pickups, score: seaTrip.score }), hint: () => seaHintText,
    place: (x, y, h) => { seaBoat.x = x; seaBoat.y = y; seaBoat.vx = 0; seaBoat.vy = 0; seaBoat.heading = h || 0; seaFollow(0, true); },
    world: () => ({ docks: seaWorld.docks.map(d => ({ id: d.id, x: d.x, y: d.y })) }),
    fps: () => measuredFps, tier: () => gfxTier, chunks: () => seaView.stats
  };
`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // RECORD_DIR=<carpeta> graba un vídeo de todo el recorrido.
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

  await page.goto(url);
  await wait(500);
  await shot('01-titulo');
  await page.click('#exploreSea', { force: true });
  await wait(700);
  assert.equal(await get(() => window.__e2e.mode()), 'sea');
  await shot('02-puerto');

  // 1) Las cuatro direcciones con el teclado (en la bahía) y el freno.
  const dirs = [['ArrowUp', 'y', -1], ['ArrowDown', 'y', 1], ['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1]];
  for (const [key, axis, sign] of dirs) {
    await get(() => window.__e2e.place(50.5 * 40, 87.5 * 40, 0));
    await wait(150);
    const a = await get(() => window.__e2e.boat());
    await page.keyboard.down(key);
    await wait(1900); // incluye el giro de hasta 180° desde el rumbo norte
    await page.keyboard.up(key);
    const b = await get(() => window.__e2e.boat());
    assert((b[axis] - a[axis]) * sign > 60, `${key}: avanza ${(b[axis] - a[axis]).toFixed(0)}`);
    await page.keyboard.down(' ');
    await wait(1500);
    await page.keyboard.up(' ');
    const c = await get(() => window.__e2e.boat());
    assert(Math.hypot(c.vx, c.vy) < 8, `${key}: el freno la detiene`);
    if (key === 'ArrowLeft') await shot('03-oeste');
  }

  // 2) Joystick con el ratón/dedo: autopiloto que dirige hacia puntos de paso.
  const visited = { minY: 1e9, minX: 1e9, maxX: 0 };
  const origin = { x: 206, y: 700 };
  let pressed = false;
  async function steer(tx, ty, { slow = false, tolerance = 70, limitMs = 60000 } = {}) {
    const end = Date.now() + limitMs;
    for (;;) {
      const b = await get(() => window.__e2e.boat());
      visited.minY = Math.min(visited.minY, b.y); visited.minX = Math.min(visited.minX, b.x); visited.maxX = Math.max(visited.maxX, b.x);
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy);
      if (d < tolerance) return b;
      if (Date.now() > end) throw new Error(`no llega a ${tx},${ty} (está en ${b.x.toFixed(0)},${b.y.toFixed(0)})`);
      if (await get(() => window.__e2e.state()) !== 'playing') return b;
      const mag = slow ? Math.max(0.25, Math.min(1, d / 220)) : 1;
      if (!pressed) { await page.mouse.move(origin.x, origin.y); await page.mouse.down(); pressed = true; }
      await page.mouse.move(origin.x + dx / d * 58 * mag, origin.y + dy / d * 58 * mag);
      await wait(40);
    }
  }
  const release = async () => { if (pressed) { await page.mouse.up(); pressed = false; } };
  const route = async (points, label) => {
    for (const [wx, wy] of points) await steer((wx + 0.5) * T, (wy + 0.5) * T);
    if (label) await shot(label);
  };

  await get(() => window.__e2e.place(50.5 * 40, 84.5 * 40, 0));
  await wait(300);
  // Sube por el río hasta la bifurcación y rodea la isla: canal oeste, laguna norte, canal este.
  await route([[52, 76], [52, 68]], '04-rio-norte');
  await route([[44, 64], [33, 58]], '05-bifurcacion');
  await route([[27, 48]], '06-canal-oeste');
  await route([[29, 36], [37, 26], [44, 21]], null);
  await route([[50, 22], [56, 21]], '07-laguna-norte');
  await route([[63, 26], [71, 36]], '08-canal-este');
  await route([[73, 48], [67, 58], [57, 63]], null);
  await route([[50, 66]], '09-vuelta-completa');
  assert(visited.minY < 24 * T, 'pasó por el norte de la isla');
  assert(visited.minX < 31 * T && visited.maxX > 69 * T, 'tocó el canal oeste y el este: rodeó la isla');
  const trip = await get(() => window.__e2e.trip());
  assert(trip.dist > 400, `distancia del viaje: ${trip.dist.toFixed(0)} m`);

  // 3) Llegar físicamente a un muelle: la aldea, cerca del puerto.
  await route([[52, 72], [52, 80], [55, 87], [63, 88], [70, 85]], null);
  const dock = (await get(() => window.__e2e.world())).docks.find(d => d.id === 'aldea');
  // Aproximación lenta hacia el amarre; si hace falta, freno con la barra espaciadora.
  const endAt = Date.now() + 40000;
  while (Date.now() < endAt && (await get(() => window.__e2e.state())) === 'playing') {
    const b = await get(() => window.__e2e.boat());
    const d = Math.hypot(dock.x - b.x, dock.y - b.y);
    const speed = Math.hypot(b.vx, b.vy);
    const braking = speed > 105 && d < 150;
    await page.keyboard[braking ? 'down' : 'up'](' ');
    const mag = Math.max(0.25, Math.min(1, d / 260));
    if (!pressed) { await page.mouse.move(origin.x, origin.y); await page.mouse.down(); pressed = true; }
    await page.mouse.move(origin.x + (dock.x - b.x) / d * 58 * mag, origin.y + (dock.y - b.y) / d * 58 * mag);
    await wait(40);
  }
  await release();
  await page.keyboard.up(' ');
  assert.equal(await get(() => window.__e2e.state()), 'arrived', 'se atracó en el muelle de la aldea');
  assert(await page.isVisible('#arrivalCard'), 'tarjeta de descubrimiento');
  assert.match(await page.textContent('#title'), /Aldea Coral/);
  await wait(400);
  await shot('10-atraque-aldea');
  const status = await get(() => window.__e2e.status());
  assert.equal(status.aldea, 'visited');
  assert.equal(status.manglar, 'open');

  // 4) El mundo y la posición persisten al recargar.
  const docked = await get(() => window.__e2e.boat());
  await page.reload();
  await wait(600);
  await page.click('#exploreSea', { force: true });
  await wait(600);
  const back = await get(() => window.__e2e.boat());
  assert(Math.hypot(back.x - docked.x, back.y - docked.y) < 2, 'la lancha sigue en el muelle');
  assert.equal((await get(() => window.__e2e.status())).aldea, 'visited');
  await shot('11-recargado');

  // 5) La navegación clásica sigue siendo un modo separado que funciona.
  await page.click('#pause');
  await page.click('#exitSea');
  await page.click('#play', { force: true });
  await wait(1200);
  assert.equal(await get(() => window.__e2e.mode()), 'classic');
  await shot('12-clasico');
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`);
  console.log(`E2E del mundo libre correcto (ruta de ${trip.dist.toFixed(0)} m rodeando la isla; atraque en la aldea)`);
  await context.close();
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
