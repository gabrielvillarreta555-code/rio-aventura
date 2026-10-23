// Flujo real en Chromium: abrir el mapa, elegir destino, navegar, llegar, desbloquear y recargar.
// No forma parte de visual-smoke (CI no instala navegadores). Uso:
//   NODE_PATH=<ruta con playwright> node tests/e2e-world.cjs [carpeta-de-capturas]
// Para llegar sin esperar minutos, solo se inyecta un gancho que adelanta la distancia y mantiene
// las vidas; todo lo demás (botones, mapa, motor, guardado) es el código real de la app.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

let chromium;
try { ({ chromium } = require('playwright')); } catch (error) {
  console.log('E2E omitido: playwright no está disponible');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'app/src/main/assets');
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const anchor = '  requestAnimationFrame(frame);\n})();';
const hooks = `
  window.__e2e = {
    state: () => state, route: () => (activeRoute ? activeRoute.id : null), distance: d => { runDistance = d; },
    keepAlive: () => { lives = 3; obstacles = []; updateHud(); }, score: n => { score = n; updateHud(); },
    remaining: () => remainingMeters()
  };
`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/game.js', async route => {
    const source = fs.readFileSync(path.join(assets, 'game.js'), 'utf8');
    assert(source.includes(anchor), 'game.js conserva el ancla del gancho');
    await route.fulfill({ contentType: 'text/javascript', body: source.replace(anchor, () => hooks + anchor) });
  });
  const url = `file://${assets}/index.html`;
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const text = selector => page.textContent(selector);
  const visible = selector => page.isVisible(selector);
  const open = async () => { await page.goto(url); await page.waitForTimeout(500); };
  const mapText = () => page.evaluate(() => ({ name: document.getElementById('mapName').textContent,
    lock: document.getElementById('mapLock').textContent, progress: document.getElementById('mapProgress').textContent,
    sail: document.getElementById('sail').textContent, sailDisabled: document.getElementById('sail').disabled }));
  const wait = ms => page.waitForTimeout(ms);
  const distances = { aldea: 1200, manglar: 1800, cascada: 2600, ruinas: 3200, laguna: 4200 };

  // Mantiene la partida viva mientras se navega (sin tocar nada más).
  const keepAlive = () => page.evaluate(() => window.__e2e.keepAlive());
  async function sailTo(id, { screenshotName, dodged = 0 } = {}) {
    await page.click('#openMap');
    await page.click(`#node-${id}`);
    const info = await mapText();
    assert.equal(info.sailDisabled, false, `${id} debe poder zarparse`);
    await page.click('#sail');
    await wait(400);
    assert.equal(await page.evaluate(() => window.__e2e.route()), id);
    assert.equal(await page.evaluate(() => window.__e2e.state()), 'playing');
    await keepAlive();
    assert.match(await text('#stageLabel'), new RegExp(`Hacia ${await page.evaluate(i => window.RioWorld.nodeById(i).name, id)}`));
    if (screenshotName) await shot(`${screenshotName}-inicio`);
    await page.evaluate(([i, d]) => { window.__e2e.score(d); window.__e2e.distance(window.RioWorld.routeFor(i).distance - 170); window.__e2e.keepAlive(); }, [id, dodged]);
    // Pasa el aviso del tramo (3 s) y se ve el hito del destino sin pasar de la meta.
    for (let i = 0; i < 17; i++) { await keepAlive(); await wait(200); }
    if (screenshotName) await shot(`${screenshotName}-hito`);
    await page.evaluate(i => window.__e2e.distance(window.RioWorld.routeFor(i).distance - 1), id);
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__e2e.state())) === 'playing'; i++) { await keepAlive(); await wait(50); }
    assert.equal(await page.evaluate(() => window.__e2e.state()), 'arrived', `${id}: se llega al destino`);
    await wait(500);
    if (screenshotName) await shot(`${screenshotName}-llegada`);
  }

  await open();
  assert(await visible('#openMap'), 'el título ofrece el mapa');
  await shot('01-titulo');
  await page.click('#openMap');
  await wait(900);
  let info = await mapText();
  assert.match(info.progress, /0\/5/);
  assert.match(info.name, /Aldea Coral/, 'al empezar se propone la aldea');
  assert(await visible('#mapHint'), 'la primera vez sale la pista');
  await shot('02-mapa-inicial');
  await page.click('#node-ruinas');
  info = await mapText();
  assert.equal(info.sailDisabled, true);
  assert.match(info.lock, /Descubre Manglar Sombrío/);
  assert(!(await visible('#mapHint')), 'la pista se va al tocar un lugar');
  await shot('03-mapa-bloqueado');
  await page.click('#node-puerto');
  await shot('03b-mapa-puerto');
  await page.click('#closeMap');
  assert(await visible('#overlay') && !(await visible('#mapPanel')));

  await sailTo('aldea', { screenshotName: '04-aldea' });
  assert(await visible('#arrivalCard'), 'sale la tarjeta de descubrimiento');
  assert.match(await text('#arrivalText'), /\+20/);
  const coinsAfter = await text('#coinHud');

  await open();
  assert.match(await text('#coinHud'), /🪙 \d+/);
  await page.click('#openMap');
  await wait(600);
  info = await mapText();
  assert.match(info.progress, /1\/5/, 'el descubrimiento sobrevive a recargar');
  assert.match(info.name, /Manglar|Cascada/);
  assert(!(await visible('#mapHint')), 'la pista ya no vuelve a salir');
  await shot('05-mapa-aldea-descubierta');
  await page.click('#closeMap');

  await sailTo('manglar', { screenshotName: '06-manglar' });
  await sailTo('cascada', { screenshotName: '07-cascada' });
  await sailTo('ruinas', { screenshotName: '08-ruinas' });
  await page.click('#openMap');
  await page.click('#node-laguna');
  info = await mapText();
  assert.equal(info.sailDisabled, true, 'la laguna pide rango Navegante');
  assert.match(info.lock, /Navegante/);
  await shot('09-mapa-laguna-bloqueada');
  await page.click('#closeMap');
  await sailTo('ruinas', { dodged: 20 });
  await sailTo('laguna', { screenshotName: '10-laguna' });
  await page.click('#openMap');
  await wait(600);
  info = await mapText();
  assert.match(info.progress, /5\/5/);
  await shot('11-mapa-completo');
  await page.click('#closeMap');
  await page.click('#openingSettings');
  await page.evaluate(() => document.getElementById('passport-aldea').scrollIntoView());
  await wait(300);
  assert.match(await text('#passport-aldea'), /Descubierto/);
  assert.equal(await text('#achievement-cartographer'), 'Desbloqueado');
  await shot('12-pasaporte');
  await page.click('#closeSettings');

  // Navegación libre intacta.
  await page.click('#openMap');
  await page.click('#freeSail');
  await wait(300);
  assert.equal(await page.evaluate(() => window.__e2e.route()), null);
  assert.equal(await page.evaluate(() => window.__e2e.state()), 'playing');
  assert.match(await text('#stageLabel'), /Tramo 1/);

  // Atrás de Android: pausa el viaje y no hace nada en el título.
  assert.equal(await page.evaluate(() => window.rioAventuraBack()), true);
  assert.equal(await page.evaluate(() => window.__e2e.state()), 'paused');
  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`);
  console.log(`E2E del mundo 2.5 correcto (monedas tras la aldea: ${coinsAfter})`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
