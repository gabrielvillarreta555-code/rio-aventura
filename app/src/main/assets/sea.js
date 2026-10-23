// Mundo libre de Río Aventura 2.6: mapa de mosaicos más grande que la pantalla, física de la
// lancha en cualquier dirección, colisiones con tierra, muelles y rocas, y llegada a los muelles.
// Solo datos y funciones puras: no toca el DOM, el lienzo ni el almacenamiento, así que se
// prueba sin navegador. game.js decide qué pasa al atracar; sea-view.js dibuja.
//
// Unidades: 1 unidad de mundo = 1 píxel lógico. Un mosaico mide 40 unidades; el mapa tiene
// 100 × 100 mosaicos (4000 × 4000). Ángulo de rumbo: 0 = norte (arriba), π/2 = este.
(() => {
  'use strict';

  const TILE = 40;
  const N = 100;
  const SIZE = TILE * N;
  const BOAT_RADIUS = 16;
  const DOCK_RADIUS = 64;
  const DOCK_SPEED = 115;
  const METERS_PER_UNIT = 0.2;

  // Ajustes de manejo: giro rápido, empuje en la dirección del casco, poca deriva lateral e
  // inercia suficiente para notar el peso de la lancha.
  const handling = Object.freeze({
    maxSpeed: 205, thrust: 250, drag: 0.55, lateralGrip: 3.6, brakeDrag: 4.2, turnRate: 3.6, turnSlow: 1.3,
    deadzone: 0.12, bounce: 0.35
  });

  const BIOMES = Object.freeze(['tropical', 'aldea', 'manglar', 'cascada', 'ruinas', 'laguna']);

  // ---------- Construcción del mapa ----------
  function build() {
    const tiles = new Uint8Array(N * N).fill(1);

    function stamp(cx, cy, radius, value) {
      const x0 = Math.max(0, Math.floor(cx - radius - 1));
      const x1 = Math.min(N - 1, Math.ceil(cx + radius + 1));
      const y0 = Math.max(0, Math.floor(cy - radius - 1));
      const y1 = Math.min(N - 1, Math.ceil(cy + radius + 1));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= radius * radius) tiles[y * N + x] = value;
        }
      }
    }

    function lake(cx, cy, rx, ry) {
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) tiles[y * N + x] = 0;
        }
      }
    }

    function river(points, radius) {
      for (let i = 0; i + 1 < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
        for (let s = 0; s <= steps; s++) stamp(ax + (bx - ax) * s / steps, ay + (by - ay) * s / steps, radius, 0);
      }
    }

    // Puerto y tronco del río que sube hasta la bifurcación.
    lake(50, 88, 14, 7);
    river([[50, 84], [50, 72]], 3.2);
    lake(50, 66, 9, 5);
    // Bifurcación: el canal del oeste y el del este rodean una isla grande y se vuelven a unir.
    river([[45, 64], [33, 58], [27, 48], [29, 36], [37, 26], [44, 20]], 3);
    river([[55, 64], [67, 58], [73, 48], [71, 36], [63, 26], [56, 20]], 3);
    lake(50, 18, 14, 7);
    // Ramales hacia los muelles.
    river([[63, 88], [72, 84], [78, 80]], 2.2);
    lake(80, 79, 4.5, 3.4);
    river([[27, 46], [17, 44], [11, 41]], 2.2);
    lake(9, 38, 5.5, 4.5);
    river([[73, 46], [83, 44], [87, 38]], 2.2);
    lake(88, 32, 5.5, 5.5);
    river([[63, 18], [73, 15], [81, 12]], 2.2);
    lake(86, 12, 6.5, 5.5);
    // Islotes que se pueden rodear.
    stamp(50, 18, 1.8, 1);
    stamp(57, 91, 1.6, 1);
    stamp(40, 85, 1.3, 1);
    // Borde de costa: el mapa nunca se sale de la pantalla.
    for (let i = 0; i < N; i++) {
      for (let b = 0; b < 3; b++) {
        tiles[b * N + i] = 1; tiles[(N - 1 - b) * N + i] = 1; tiles[i * N + b] = 1; tiles[i * N + N - 1 - b] = 1;
      }
    }

    const isLand = (tx, ty) => tx < 0 || ty < 0 || tx >= N || ty >= N || tiles[ty * N + tx] === 1;

    // Muelles: `mx, my` es el mosaico de agua donde se amarra; `dir` apunta hacia la tierra donde
    // está el embarcadero. El embarcadero es un rectángulo sólido: la lancha no lo atraviesa.
    const dockSpecs = [
      { id: 'puerto', name: 'Puerto Palmar', mx: 39, my: 88, dir: 'W', kind: 'port', biome: 'tropical' },
      { id: 'aldea', name: 'Aldea Coral', mx: 79, my: 79, dir: 'E', kind: 'dest', biome: 'aldea' },
      { id: 'manglar', name: 'Manglar Sombrío', mx: 9, my: 41, dir: 'S', kind: 'dest', biome: 'manglar' },
      { id: 'cascada', name: 'Cascada Brumosa', mx: 88, my: 28, dir: 'N', kind: 'dest', biome: 'cascada' },
      { id: 'ruinas', name: 'Ruinas del Sol', mx: 50, my: 12, dir: 'N', kind: 'dest', biome: 'ruinas' },
      { id: 'laguna', name: 'Laguna de las Luciérnagas', mx: 86, my: 8, dir: 'N', kind: 'dest', biome: 'laguna' }
    ];
    const vectors = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const piers = [];
    const docks = dockSpecs.map(spec => {
      const [dx, dy] = vectors[spec.dir];
      let steps = 1;
      while (steps < 8 && !isLand(spec.mx + dx * steps, spec.my + dy * steps)) steps++;
      // Embarcadero desde el borde de la tierra hasta tocar el mosaico de amarre.
      const landEdge = [(spec.mx + 0.5 + dx * (steps - 0.5)) * TILE, (spec.my + 0.5 + dy * (steps - 0.5)) * TILE];
      const tip = [(spec.mx + 0.5 + dx * 0.5) * TILE, (spec.my + 0.5 + dy * 0.5) * TILE];
      const half = 8;
      const x0 = Math.min(landEdge[0], tip[0]) - (dx === 0 ? half : 0);
      const x1 = Math.max(landEdge[0], tip[0]) + (dx === 0 ? half : 0);
      const y0 = Math.min(landEdge[1], tip[1]) - (dy === 0 ? half : 0);
      const y1 = Math.max(landEdge[1], tip[1]) + (dy === 0 ? half : 0);
      const pier = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, dock: spec.id, dir: spec.dir };
      piers.push(pier);
      return { ...spec, x: (spec.mx + 0.5) * TILE, y: (spec.my + 0.5) * TILE, radius: DOCK_RADIUS, pier,
        heading: { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[spec.dir] };
    });

    // Rocas en los canales (radio en unidades). Dejan siempre paso libre a la lancha.
    const rockSpecs = [
      [50, 76, 20], [47, 69, 18], [53, 62, 16], [35, 56, 22], [27, 42, 20], [31, 31, 18], [40, 23, 16],
      [69, 55, 22], [73, 41, 18], [67, 29, 22], [58, 22, 16], [45, 14, 16], [55, 15, 14], [44, 91, 18],
      [58, 85, 16], [14, 43, 16], [84, 43, 18], [76, 14, 16], [86, 35, 16], [86, 12, 14]
    ];
    const rocks = rockSpecs.map(([x, y, r], index) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, r, id: index,
      variant: index % 3 }));

    const spawn = { x: 50.5 * TILE, y: 87.5 * TILE, heading: 0 };

    // Monedas flotantes a lo largo de los canales; ninguna cerca de una roca.
    const coinPaths = [
      [[50, 85], [50, 72]], [[45, 64], [33, 58], [27, 48], [29, 36], [37, 26], [44, 20]],
      [[55, 64], [67, 58], [73, 48], [71, 36], [63, 26], [56, 20]], [[63, 88], [72, 84], [77, 80]],
      [[27, 46], [17, 44], [11, 41]], [[73, 46], [83, 44], [87, 38]], [[63, 18], [73, 15], [81, 12]],
      [[40, 18], [50, 12], [60, 18]]
    ];
    const coins = [];
    for (const path of coinPaths) {
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, ay] = path[i];
        const [bx, by] = path[i + 1];
        const count = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / 4.5));
        for (let s = 0; s < count; s++) {
          const x = (ax + (bx - ax) * (s + 0.5) / count + 0.5) * TILE;
          const y = (ay + (by - ay) * (s + 0.5) / count + 0.5) * TILE;
          if (rocks.some(rock => Math.hypot(rock.x - x, rock.y - y) < rock.r + 36)) continue;
          if (isLand(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
          coins.push({ x, y, id: coins.length });
        }
      }
    }

    // Caladeros: círculos de agua donde se puede parar y pescar (los define fishing.js).
    const fishing = (window.RioFishing ? window.RioFishing.zoneSpecs : []).map(spec => ({
      id: spec.id, name: spec.name, x: spec.tx * TILE, y: spec.ty * TILE, radius: spec.radius }));
    const world = { size: SIZE, tile: TILE, n: N, tiles, docks, piers, rocks, coins, spawn, fishing, isLand, biomeAt: null };
    world.biomeAt = (tx, ty) => biomeAt(tx, ty);
    return world;
  }

  // Región para decorar: da identidad visual a cada zona del mapa.
  function biomeAt(tx, ty) {
    if (tx >= 71 && ty < 24) return 'laguna';
    if (ty < 29 && tx >= 28 && tx <= 70) return 'ruinas';
    if (tx >= 72 && ty >= 24 && ty < 60) return 'cascada';
    if (tx < 30 && ty >= 28 && ty < 60) return 'manglar';
    if (tx >= 62 && ty >= 62) return 'aldea';
    return 'tropical';
  }

  // ---------- Colisiones ----------
  // Empuje mínimo para sacar un círculo de un rectángulo; null si no se tocan.
  function pushFromRect(x, y, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(x, rx + rw));
    const ny = Math.max(ry, Math.min(y, ry + rh));
    let dx = x - nx;
    let dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return null;
    if (d2 === 0) {
      // El centro está dentro del rectángulo: sale por el lado más cercano.
      const left = x - rx;
      const right = rx + rw - x;
      const top = y - ry;
      const bottom = ry + rh - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { nx: -1, ny: 0, depth: left + r };
      if (m === right) return { nx: 1, ny: 0, depth: right + r };
      if (m === top) return { nx: 0, ny: -1, depth: top + r };
      return { nx: 0, ny: 1, depth: bottom + r };
    }
    const d = Math.sqrt(d2);
    dx /= d;
    dy /= d;
    return { nx: dx, ny: dy, depth: r - d };
  }

  // Todos los contactos de un círculo con tierra, embarcaderos y rocas.
  function contacts(world, x, y, r, out) {
    out.length = 0;
    const tx0 = Math.floor((x - r) / TILE);
    const tx1 = Math.floor((x + r) / TILE);
    const ty0 = Math.floor((y - r) / TILE);
    const ty1 = Math.floor((y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!world.isLand(tx, ty)) continue;
        const hit = pushFromRect(x, y, r, tx * TILE, ty * TILE, TILE, TILE);
        if (hit) out.push(hit);
      }
    }
    for (const pier of world.piers) {
      const hit = pushFromRect(x, y, r, pier.x, pier.y, pier.w, pier.h);
      if (hit) out.push(hit);
    }
    for (const rock of world.rocks) {
      const dx = x - rock.x;
      const dy = y - rock.y;
      const reach = r + rock.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach) continue;
      const d = Math.sqrt(d2) || 0.0001;
      out.push({ nx: dx / d, ny: dy / d, depth: reach - d, rock: rock.id });
    }
    return out;
  }

  // ---------- Lancha ----------
  function createBoat(x, y, heading) {
    return { x, y, vx: 0, vy: 0, heading: heading || 0, turn: 0, bump: 0, bumped: false };
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  const scratch = [];

  // Avanza la lancha `dt` segundos. `input`: { x, y, brake } con x e y entre -1 y 1 (y negativo =
  // norte). Devuelve la distancia recorrida (unidades) y los choques ocurridos.
  function stepBoat(world, boat, input, dt) {
    const result = { moved: 0, impact: 0, rock: -1 };
    const ix = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
    const iy = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
    const magnitude = Math.min(1, Math.hypot(ix, iy));
    const steering = magnitude > handling.deadzone;
    const speed = Math.hypot(boat.vx, boat.vy);
    boat.bumped = false;

    let diff = 0;
    if (steering) {
      diff = normalizeAngle(Math.atan2(ix, -iy) - boat.heading);
      const turnRate = handling.turnRate - handling.turnSlow * Math.min(1, speed / handling.maxSpeed);
      boat.heading = normalizeAngle(boat.heading + Math.max(-turnRate * dt, Math.min(turnRate * dt, diff)));
    }
    boat.turn += (Math.max(-1, Math.min(1, diff)) * (steering ? 1 : 0) - boat.turn) * Math.min(1, dt * 6);

    const fx = Math.sin(boat.heading);
    const fy = -Math.cos(boat.heading);
    // Empuje en la dirección del casco; si la lancha mira en contra, casi no empuja hasta girar.
    if (steering && !input.brake) {
      const align = Math.max(0, Math.cos(diff));
      const push = handling.thrust * magnitude * align * align;
      boat.vx += fx * push * dt;
      boat.vy += fy * push * dt;
    }
    // Deriva: la velocidad lateral se amortigua mucho más que la longitudinal.
    let along = boat.vx * fx + boat.vy * fy;
    let across = boat.vx * -fy + boat.vy * fx;
    const dragK = input.brake ? handling.brakeDrag : handling.drag;
    along *= Math.exp(-dragK * dt);
    across *= Math.exp(-(handling.lateralGrip + (input.brake ? 2 : 0)) * dt);
    if (along > handling.maxSpeed) along = handling.maxSpeed;
    if (along < -handling.maxSpeed * 0.4) along = -handling.maxSpeed * 0.4;
    boat.vx = fx * along - fy * across;
    boat.vy = fy * along + fx * across;
    if (Math.hypot(boat.vx, boat.vy) < 2 && !steering) { boat.vx = 0; boat.vy = 0; }

    // Movimiento en subpasos para no atravesar paredes aunque un fotograma sea largo.
    const travel = Math.hypot(boat.vx, boat.vy) * dt;
    const substeps = Math.max(1, Math.ceil(travel / 6));
    const h = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      const ox = boat.x;
      const oy = boat.y;
      boat.x += boat.vx * h;
      boat.y += boat.vy * h;
      for (let iteration = 0; iteration < 4; iteration++) {
        const list = contacts(world, boat.x, boat.y, BOAT_RADIUS, scratch);
        if (!list.length) break;
        let deepest = list[0];
        for (const hit of list) if (hit.depth > deepest.depth) deepest = hit;
        boat.x += deepest.nx * (deepest.depth + 0.01);
        boat.y += deepest.ny * (deepest.depth + 0.01);
        const into = boat.vx * deepest.nx + boat.vy * deepest.ny;
        if (into < 0) {
          // Rebota un poco y conserva el deslizamiento a lo largo de la pared.
          boat.vx -= (1 + handling.bounce) * into * deepest.nx;
          boat.vy -= (1 + handling.bounce) * into * deepest.ny;
          result.impact = Math.max(result.impact, -into);
          if (deepest.rock !== undefined) result.rock = deepest.rock;
          boat.bumped = true;
        }
      }
      // Salvaguarda: si algo dejó la lancha dentro de tierra, vuelve a la última posición válida.
      if (contacts(world, boat.x, boat.y, BOAT_RADIUS * 0.6, scratch).length) { boat.x = ox; boat.y = oy; boat.vx = 0; boat.vy = 0; }
    }
    result.moved = Math.hypot(boat.vx, boat.vy) * dt;
    boat.bump = Math.max(0, boat.bump - dt * 3);
    if (result.impact > 40) boat.bump = Math.min(1, result.impact / 160);
    return result;
  }

  // ---------- Muelles ----------
  // Muelle cuya zona de atraque contiene a la lancha (o null).
  function dockAt(world, boat) {
    let best = null;
    let bestD = Infinity;
    for (const dock of world.docks) {
      const d = Math.hypot(boat.x - dock.x, boat.y - dock.y);
      if (d < dock.radius && d < bestD) { best = dock; bestD = d; }
    }
    return best;
  }

  function nearestDock(world, boat, filter) {
    let best = null;
    let bestD = Infinity;
    for (const dock of world.docks) {
      if (filter && !filter(dock)) continue;
      const d = Math.hypot(boat.x - dock.x, boat.y - dock.y);
      if (d < bestD) { best = dock; bestD = d; }
    }
    return best ? { dock: best, distance: bestD } : null;
  }

  // Caladero cuya zona contiene a la lancha (o null).
  function fishingZoneAt(world, boat) {
    for (const zone of world.fishing) if (Math.hypot(boat.x - zone.x, boat.y - zone.y) < zone.radius) return zone;
    return null;
  }

  // ---------- Navegación sobre el mapa (para pruebas y pistas) ----------
  // Busca un camino por los mosaicos de agua con `clearance` mosaicos libres alrededor.
  function pathExists(world, from, to, clearance, blocked) {
    const n = world.n;
    const free = (x, y) => {
      for (let dy = -clearance; dy <= clearance; dy++) {
        for (let dx = -clearance; dx <= clearance; dx++) {
          if (dx * dx + dy * dy > clearance * clearance) continue;
          if (world.isLand(x + dx, y + dy)) return false;
        }
      }
      return !(blocked && blocked(x, y));
    };
    const sx = Math.floor(from.x / TILE);
    const sy = Math.floor(from.y / TILE);
    const tx = Math.floor(to.x / TILE);
    const ty = Math.floor(to.y / TILE);
    const seen = new Uint8Array(n * n);
    const queue = [sy * n + sx];
    seen[sy * n + sx] = 1;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      const x = cell % n;
      const y = (cell - x) / n;
      if (Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen[ny * n + nx] || !free(nx, ny)) continue;
        seen[ny * n + nx] = 1;
        queue.push(ny * n + nx);
      }
    }
    return false;
  }

  window.RioSea = Object.freeze({
    version: 1, TILE, N, SIZE, BOAT_RADIUS, DOCK_RADIUS, DOCK_SPEED, METERS_PER_UNIT, handling, BIOMES,
    build, biomeAt, contacts, createBoat, stepBoat, dockAt, nearestDock, fishingZoneAt, pathExists, normalizeAngle
  });
})();
