// Dibujo del mundo libre de Río Aventura 2.6. Solo pinta: game.js le entrega el estado de cada
// fotograma. Para que un mapa grande sea barato en Android WebView:
//  - la tierra se dibuja una vez por "trozo" (8 × 8 mosaicos) en un lienzo oculto y después solo se
//    copia con drawImage; solo hay trozos de lo que se ve (y un anillo alrededor), con una caché
//    de uso reciente que descarta los lejanos;
//  - el agua es un color, un degradado precalculado y dos patrones de reflejos que se desplazan;
//  - árboles, rocas, monedas, muelles y lancha se ordenan por profundidad y se copian como sprites
//    (los de art.js y art-themes.js); no se crean degradados ni objetos nuevos por fotograma.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const CHUNK_TILES = 8;
  const MAX_CHUNKS = 30;
  const MAX_CHUNK_SCALE = 1.5; // la tierra es arte suave: no hace falta más resolución (ni memoria)
  const WIDTH = 450;
  const NPC_SCALE = 1.25;

  // Colores de suelo por zona: hierba clara/oscura, arena, acantilado y un detalle decorativo.
  const GROUND = {
    tropical: { grass: ['#47b35e', '#44ae5b', '#4bb761'], sand: '#f3deA0', cliff: '#9a7048', accent: '#2f8d49' },
    aldea: { grass: ['#52bd5e', '#4eb85b', '#56c262'], sand: '#f8e4b2', cliff: '#a97a4a', accent: '#e9c36e' },
    manglar: { grass: ['#2e8a58', '#2b8455', '#319059'], sand: '#a99466', cliff: '#5a4630', accent: '#1d5a3c' },
    cascada: { grass: ['#4f9f6c', '#4c9a69', '#52a470'], sand: '#d3dae0', cliff: '#6f7d8c', accent: '#8fa0b0' },
    ruinas: { grass: ['#93aa52', '#8da64e', '#9bb057'], sand: '#f1d796', cliff: '#a8834a', accent: '#d9b672' },
    laguna: { grass: ['#3d8d88', '#3a8883', '#41938e'], sand: '#cdc1e8', cliff: '#5d4fa0', accent: '#b6a0ff' }
  };
  const DEFAULT_TREES = ['palm0', 'palm1', 'palm2', 'jungle0', 'jungle1'];
  const DEFAULT_UNDER = ['bush0', 'bush1', 'fern', 'bankRocks'];
  const DOCK_HUTS = { puerto: 'aldea:hut', aldea: 'aldea:hut', manglar: 'manglar:stilts', cascada: 'cascada:pine0',
    ruinas: 'ruinas:column0', laguna: 'laguna:crystal0' };

  function create(options) {
    const { canvas, ctx, art, doc, world } = options;
    const sea = window.RioSea;
    const TILE = sea.TILE;
    const CHUNK = CHUNK_TILES * TILE;
    const chunksPerSide = Math.ceil(sea.N / CHUNK_TILES);
    const hash = window.RioArt.hash;
    const radial = window.RioArt.helpers.radial;

    let height = 800;
    let scale = 1;
    let detail = 2;
    let time = 0;
    let chunks = new Map();
    let waterGradient = null;
    let patterns = [];
    let minimapBase = null;
    const stats = { npcs: 0, chunksBuilt: 0, chunkBuildMs: 0, drawnChunks: 0, items: 0, missing: 0 };

    function makeCanvas(w, h) {
      try {
        if (doc && typeof doc.createElement === 'function') {
          const element = doc.createElement('canvas');
          element.width = w;
          element.height = h;
          if (typeof element.getContext === 'function' && element.getContext('2d')) return element;
        }
      } catch (_) { /* sin lienzos ocultos se dibuja directamente */ }
      return null;
    }

    // ---------- Decoración fija (árboles y arbustos), calculada una vez ----------
    const propsByChunk = new Map();
    function nearPier(x, y) {
      for (const dock of world.docks) {
        if (Math.hypot(x - dock.x, y - dock.y) < 150) return true;
        // Todo el embarcadero y el espacio donde está el personaje quedan despejados.
        const p = dock.pier;
        const cx = Math.max(p.x, Math.min(x, p.x + p.w));
        const cy = Math.max(p.y, Math.min(y, p.y + p.h));
        if (Math.hypot(x - cx, y - cy) < 110) return true;
      }
      return false;
    }
    function buildProps() {
      for (let ty = 0; ty < sea.N; ty++) {
        for (let tx = 0; tx < sea.N; tx++) {
          if (!world.isLand(tx, ty)) continue;
          const biome = world.biomeAt(tx, ty);
          const theme = window.RioArt.themes[biome];
          const veg = theme && theme.vegetation;
          const trees = veg ? veg.trees : DEFAULT_TREES;
          const under = veg ? veg.under : DEFAULT_UNDER;
          let water = false;
          for (let dy = -1; dy <= 1 && !water; dy++) for (let dx = -1; dx <= 1; dx++) if (!world.isLand(tx + dx, ty + dy)) { water = true; break; }
          const roll = hash(ty * sea.N + tx, 71);
          const x = (tx + 0.25 + hash(tx * 7 + ty, 72) * 0.5) * TILE;
          const y = (ty + 0.55 + hash(tx + ty * 5, 73) * 0.4) * TILE;
          if (nearPier(x, y)) continue;
          let prop = null;
          if (roll < (water ? 0.16 : 0.22)) {
            prop = { name: trees[Math.floor(hash(tx + ty * 13, 74) * trees.length) % trees.length], s: 0.42 + hash(tx, ty + 75) * 0.14 };
          } else if (roll < (water ? 0.3 : 0.4)) {
            prop = { name: under[Math.floor(hash(tx * 3 + ty, 76) * under.length) % under.length], s: 0.62 + hash(ty, tx + 77) * 0.2 };
          }
          if (!prop) continue;
          prop.x = x;
          prop.y = y;
          prop.low = roll >= 0.1; // en calidad mínima solo se dibujan los árboles principales
          const key = Math.floor(ty / CHUNK_TILES) * chunksPerSide + Math.floor(tx / CHUNK_TILES);
          if (!propsByChunk.has(key)) propsByChunk.set(key, []);
          propsByChunk.get(key).push(prop);
        }
      }
    }
    buildProps();
    for (const rock of world.rocks) {
      const theme = window.RioArt.themes[world.biomeAt(Math.floor(rock.x / TILE), Math.floor(rock.y / TILE))];
      rock.name = theme && theme.rocks ? theme.rocks[rock.variant] : `rock${rock.variant}`;
    }

    // Construye de antemano todos los sprites que usa el mundo: así no hay tirones al descubrir
    // una zona nueva. Hay que repetirlo si art.js reconstruye sus sprites (cambio de resolución).
    function warm() {
      const names = new Set(['coin', 'foam', 'shadow', 'bowWave', 'rider', 'shield']);
      for (const list of propsByChunk.values()) for (const p of list) names.add(p.name);
      for (const rock of world.rocks) names.add(rock.name);
      for (const id in DOCK_HUTS) names.add(DOCK_HUTS[id]);
      for (const name of names) art.sprite(name);
      for (const dock of world.docks) labelFor(dock);
      if (window.RioQuests) for (const person of window.RioQuests.npcs) labelFor({ id: `n-${person.id}`, name: person.name, sub: `${person.role} · ${world.docks.find(d => d.id === person.id).name}` });
      if (window.RioQuests) {
        for (const person of window.RioQuests.npcs) npcSprite(person);
        markSprite(1);
        markSprite(2);
      }
      fishShadow();
      bobber();
      for (const zone of world.fishing) labelFor({ id: `z-${zone.id}`, name: zone.name, sub: '🎣 Para la lancha y pesca aquí' });
    }

    // ---------- Trozos de tierra ----------
    function palette(tx, ty) {
      return GROUND[world.biomeAt(tx, ty)] || GROUND.tropical;
    }

    function roundedRect(g, x0, y0, x1, y1, r) {
      g.beginPath();
      g.moveTo(x0 + r, y0);
      g.lineTo(x1 - r, y0); g.quadraticCurveTo(x1, y0, x1, y0 + r);
      g.lineTo(x1, y1 - r); g.quadraticCurveTo(x1, y1, x1 - r, y1);
      g.lineTo(x0 + r, y1); g.quadraticCurveTo(x0, y1, x0, y1 - r);
      g.lineTo(x0, y0 + r); g.quadraticCurveTo(x0, y0, x0 + r, y0);
      g.closePath();
    }

    function paintChunk(g, cx, cy) {
      const tx0 = cx * CHUNK_TILES;
      const ty0 = cy * CHUNK_TILES;
      const ox = cx * CHUNK;
      const oy = cy * CHUNK;
      const land = (x, y) => world.isLand(x, y);
      const edge = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!land(x + dx, y + dy)) return true;
        return false;
      };
      const lo = -1;
      const hi = CHUNK_TILES;
      // 1) Aguas someras y sombra de la costa.
      for (let y = lo; y <= hi; y++) {
        for (let x = lo; x <= hi; x++) {
          const tx = tx0 + x;
          const ty = ty0 + y;
          if (!land(tx, ty) || !edge(tx, ty)) continue;
          const px = tx * TILE + TILE / 2 - ox;
          const py = ty * TILE + TILE / 2 - oy;
          g.fillStyle = 'rgba(0,60,80,0.2)';
          g.beginPath(); g.ellipse(px + 5, py + 9, TILE * 0.95, TILE * 0.8, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(205,250,240,0.34)';
          g.beginPath(); g.arc(px, py, TILE * 1.02, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.4)';
          g.beginPath(); g.arc(px, py, TILE * 0.8, 0, TAU); g.fill();
        }
      }
      // 2) Acantilado (cara sur de la costa), arena y hierba.
      for (let pass = 0; pass < 3; pass++) {
        for (let y = lo; y <= hi; y++) {
          for (let x = lo; x <= hi; x++) {
            const tx = tx0 + x;
            const ty = ty0 + y;
            if (!land(tx, ty)) continue;
            const border = edge(tx, ty);
            const px = tx * TILE - ox;
            const py = ty * TILE - oy;
            const colors = palette(tx, ty);
            if (pass === 0) {
              if (border && !land(tx, ty + 1)) {
                g.fillStyle = colors.cliff;
                g.beginPath(); g.ellipse(px + TILE / 2, py + TILE * 0.8, TILE * 0.7, TILE * 0.52, 0, 0, TAU); g.fill();
              }
            } else if (pass === 1) {
              if (border) {
                g.fillStyle = colors.sand;
                g.beginPath(); g.arc(px + TILE / 2, py + TILE / 2, TILE * 0.68, 0, TAU); g.fill();
              }
            } else {
              const grass = colors.grass[Math.floor(hash(tx * 31 + ty, 61) * 3) % 3];
              g.fillStyle = grass;
              if (border) {
                const inset = TILE * 0.24;
                const x0 = px + (land(tx - 1, ty) ? -0.5 : inset);
                const x1 = px + TILE + (land(tx + 1, ty) ? 0.5 : -inset);
                const y0 = py + (land(tx, ty - 1) ? -0.5 : inset);
                const y1 = py + TILE + (land(tx, ty + 1) ? 0.5 : -inset);
                roundedRect(g, x0, y0, x1, y1, TILE * 0.22);
                g.fill();
              } else {
                g.fillRect(px - 0.5, py - 0.5, TILE + 1, TILE + 1);
              }
            }
          }
        }
      }
      // 3) Detalles del suelo: manchas y flores de cada zona.
      for (let y = 0; y < CHUNK_TILES; y++) {
        for (let x = 0; x < CHUNK_TILES; x++) {
          const tx = tx0 + x;
          const ty = ty0 + y;
          if (!land(tx, ty) || edge(tx, ty)) continue;
          const colors = palette(tx, ty);
          const r = hash(tx * 17 + ty, 62);
          const px = tx * TILE - ox + r * 24 + 6;
          const py = ty * TILE - oy + hash(tx, ty * 3 + 63) * 24 + 6;
          g.fillStyle = colors.accent;
          g.globalAlpha = 0.35;
          g.beginPath(); g.ellipse(px, py, 7 + r * 6, 4 + r * 3, 0, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
      }
    }

    function chunkKey(cx, cy) {
      return cy * chunksPerSide + cx;
    }

    function buildChunk(cx, cy) {
      const started = typeof performance !== 'undefined' ? performance.now() : 0;
      const chunkScale = Math.min(scale, MAX_CHUNK_SCALE);
      const element = makeCanvas(Math.ceil(CHUNK * chunkScale), Math.ceil(CHUNK * chunkScale));
      const entry = { canvas: element, cx, cy };
      if (element) {
        const g = element.getContext('2d');
        g.scale(chunkScale, chunkScale);
        paintChunk(g, cx, cy);
      }
      chunks.set(chunkKey(cx, cy), entry);
      stats.chunksBuilt++;
      if (typeof performance !== 'undefined') stats.chunkBuildMs = performance.now() - started;
      while (chunks.size > MAX_CHUNKS) chunks.delete(chunks.keys().next().value);
      return entry;
    }

    function touchChunk(cx, cy) {
      const key = chunkKey(cx, cy);
      const entry = chunks.get(key);
      if (!entry) return null;
      chunks.delete(key);
      chunks.set(key, entry);
      return entry;
    }

    // ---------- Agua ----------
    function paintReflections(g, size, seed, count) {
      g.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        const x = hash(i, seed) * size;
        const y = hash(i, seed + 1) * size;
        const w = 14 + hash(i, seed + 2) * 26;
        for (const dx of [-size, 0, size]) {
          for (const dy of [-size, 0, size]) {
            g.strokeStyle = `rgba(255,255,255,${0.35 + hash(i, seed + 3) * 0.4})`;
            g.lineWidth = 1.6 + hash(i, seed + 4) * 1.6;
            g.beginPath();
            g.moveTo(x + dx - w / 2, y + dy);
            g.quadraticCurveTo(x + dx, y + dy - 5, x + dx + w / 2, y + dy);
            g.stroke();
          }
        }
      }
    }

    function buildWater() {
      waterGradient = makeCanvas(Math.ceil(WIDTH * scale), Math.ceil(height * scale));
      if (waterGradient) {
        const g = waterGradient.getContext('2d');
        g.scale(scale, scale);
        const gradient = g.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(210,255,235,0.22)');
        gradient.addColorStop(0.5, 'rgba(60,200,205,0)');
        gradient.addColorStop(1, 'rgba(8,90,130,0.28)');
        g.fillStyle = gradient;
        g.fillRect(0, 0, WIDTH, height);
      }
      patterns = [];
      for (const [size, seed, count] of [[128, 900, 26], [96, 940, 18]]) {
        const tile = makeCanvas(Math.ceil(size * scale), Math.ceil(size * scale));
        if (!tile) continue;
        const g = tile.getContext('2d');
        g.scale(scale, scale);
        paintReflections(g, size, seed, count);
        patterns.push({ pattern: ctx.createPattern(tile, 'repeat'), size });
      }
    }

    function drawWater(cam) {
      ctx.fillStyle = '#36bcc8';
      ctx.fillRect(0, 0, WIDTH, height);
      if (waterGradient) ctx.drawImage(waterGradient, 0, 0, WIDTH, height);
      const layers = detail >= 2 ? 2 : detail >= 1 ? 1 : 0;
      for (let i = 0; i < layers && i < patterns.length; i++) {
        const { pattern, size } = patterns[i];
        const k = i === 0 ? 1 : 0.8;
        // Se desplaza con la cámara (suelo) más una deriva lenta: el agua parece quieta y viva.
        const tx = -(((cam.x * k + time * (i ? -7 : 5)) % size) + size) % size;
        const ty = -(((cam.y * k + time * (i ? 4 : -3)) % size) + size) % size;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.globalAlpha = i === 0 ? 0.2 : 0.12;
        ctx.fillStyle = pattern;
        ctx.fillRect(-tx, -ty, WIDTH + size, height + size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // ---------- Sprites ----------
    function blit(item, x, y, sx, sy, alpha) {
      if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
      if (item.canvas) ctx.drawImage(item.canvas, x - item.ox * sx, y - item.oy * sy, item.w * sx, item.h * sy);
      else {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        item.paint(ctx);
        ctx.restore();
      }
      if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = 1;
    }

    function blitRotated(item, x, y, sx, sy, rotation, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(sx, sy);
      if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
      if (item.canvas) ctx.drawImage(item.canvas, -item.ox, -item.oy, item.w, item.h);
      else item.paint(ctx);
      ctx.restore();
    }

    const labels = Object.create(null);
    // Etiqueta de dos líneas (nombre y lugar): se pinta una vez en un lienzo oculto.
    function labelFor(dock) {
      if (labels[dock.id]) return labels[dock.id];
      const w = 176;
      const h = dock.sub ? 40 : 26;
      const element = makeCanvas(Math.ceil(w * 2), Math.ceil(h * 2));
      const item = { canvas: element, w, h, ox: w / 2, oy: h, paint: g => paintLabel(g, dock.name, dock.sub, w, h) };
      if (element) {
        const g = element.getContext('2d');
        g.scale(2, 2);
        paintLabel(g, dock.name, dock.sub, w, h);
      }
      labels[dock.id] = item;
      return item;
    }

    function paintLabel(g, text, sub, w, h) {
      const x = g.canvas ? 0 : -w / 2;
      const y = g.canvas ? 0 : -h;
      g.fillStyle = 'rgba(6,50,66,0.88)';
      g.beginPath(); g.moveTo(x + 12, y); g.lineTo(x + w - 12, y); g.quadraticCurveTo(x + w, y, x + w, y + 12);
      g.lineTo(x + w, y + h - 12); g.quadraticCurveTo(x + w, y + h, x + w - 12, y + h); g.lineTo(x + 12, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - 12); g.lineTo(x, y + 12); g.quadraticCurveTo(x, y, x + 12, y); g.fill();
      g.strokeStyle = 'rgba(255,226,140,0.8)';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#ffe58a';
      g.font = '800 14px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const cut = (value, n) => (value.length > n ? `${value.slice(0, n - 1)}…` : value);
      g.fillText(cut(text, 24), x + w / 2, y + (sub ? 14 : h / 2 + 1));
      if (sub) {
        g.fillStyle = '#bfeee8';
        g.font = '700 11px system-ui, sans-serif';
        g.fillText(cut(sub, 30), x + w / 2, y + 29);
      }
    }

    // ---------- Personajes de los muelles ----------
    function paintNpc(g, npc) {
      const look = npc.look;
      // Sombra, piernas y torso.
      g.fillStyle = 'rgba(0,40,50,0.35)';
      g.beginPath(); g.ellipse(0, 1, 19, 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#3a3048';
      g.fillRect(-8, -16, 6.5, 16); g.fillRect(1.5, -16, 6.5, 16);
      g.fillStyle = '#2a2230';
      g.fillRect(-9, -2, 8.5, 3); g.fillRect(1, -2, 8.5, 3);
      g.fillStyle = look.shirt;
      g.beginPath(); g.moveTo(-12, -14); g.lineTo(-10, -42); g.quadraticCurveTo(0, -48, 10, -42); g.lineTo(12, -14); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.moveTo(-10, -42); g.quadraticCurveTo(-3, -46, -1, -42); g.lineTo(-1, -16); g.lineTo(-11, -16); g.closePath(); g.fill();
      g.fillStyle = '#5a3d22';
      g.fillRect(-12, -22, 24, 3.5);
      // Brazos: el izquierdo cuelga y el derecho sujeta el objeto que los distingue.
      g.strokeStyle = look.shirt;
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(-10, -40); g.lineTo(-17, -24); g.stroke();
      g.beginPath(); g.moveTo(10, -40); g.lineTo(19, -30); g.stroke();
      g.fillStyle = look.skin;
      g.beginPath(); g.arc(-17.5, -22, 3.6, 0, TAU); g.arc(20, -29, 3.6, 0, TAU); g.fill();
      paintProp(g, look.prop);
      // Cabeza, cara y sombrero.
      g.fillStyle = look.skin;
      g.beginPath(); g.arc(0, -53, 11.5, 0, TAU); g.fill();
      g.fillStyle = '#2b2018';
      g.beginPath(); g.arc(-4, -53, 1.6, 0, TAU); g.arc(4, -53, 1.6, 0, TAU); g.fill();
      g.strokeStyle = '#a05a3a';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, -50, 4.5, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = look.hatColor;
      if (look.hat === 'straw') { g.beginPath(); g.ellipse(0, -60, 19, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -61, 10.5, Math.PI, 0); g.fill(); g.fillStyle = '#c0402f'; g.fillRect(-10, -62, 20, 3); }
      else if (look.hat === 'cap') { g.beginPath(); g.arc(0, -57, 12.5, Math.PI, 0); g.fill(); g.fillRect(-12.5, -58, 25, 3.5); g.fillStyle = '#1f4f8a'; g.fillRect(-5, -66, 10, 4); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, -64, 2.2, 0, TAU); g.fill(); }
      else if (look.hat === 'helmet') { g.beginPath(); g.arc(0, -57, 13, Math.PI, 0); g.fill(); g.fillRect(-14, -58, 28, 4); g.fillStyle = '#fff'; g.fillRect(-2.5, -70, 5, 7); }
      else if (look.hat === 'hood') { g.beginPath(); g.arc(0, -55, 14, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(11, -44); g.lineTo(-11, -44); g.closePath(); g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1; g.fillStyle = look.skin; g.beginPath(); g.arc(0, -52, 9, 0, TAU); g.fill(); g.fillStyle = '#2b2018'; g.beginPath(); g.arc(-3.5, -52, 1.5, 0, TAU); g.arc(3.5, -52, 1.5, 0, TAU); g.fill(); }
      else if (look.hat === 'explorer') { g.beginPath(); g.ellipse(0, -60, 18, 4.5, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -61, 10, Math.PI, 0); g.fill(); g.fillStyle = '#6a4a22'; g.fillRect(-10, -62, 20, 3); }
    }

    // Objeto en la mano derecha: hace reconocible al personaje de un vistazo.
    function paintProp(g, prop) {
      g.save();
      g.translate(20, -29);
      g.lineCap = 'round';
      if (prop === 'clipboard') {
        g.fillStyle = '#8a5a30'; g.fillRect(-2, -22, 18, 24);
        g.fillStyle = '#fffdf0'; g.fillRect(0, -19, 14, 19);
        g.strokeStyle = '#7a8a95'; g.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(2, -15 + i * 4); g.lineTo(12, -15 + i * 4); g.stroke(); }
      } else if (prop === 'rod') {
        g.strokeStyle = '#7a4a22'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(0, 2); g.lineTo(18, -52); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(18, -52); g.quadraticCurveTo(26, -34, 21, -16); g.stroke();
        g.fillStyle = '#ff9a3a';
        g.beginPath(); g.ellipse(21, -13, 6, 3, 0.4, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(26, -11); g.lineTo(31, -16); g.lineTo(31, -8); g.closePath(); g.fill();
      } else if (prop === 'herbs') {
        g.strokeStyle = '#6fbf5f'; g.lineWidth = 3;
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(2 + i * 4, -12, 3 + i * 6, -22); g.stroke(); }
        g.fillStyle = '#ffdf6a';
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(3 + i * 6, -23, 2.6, 0, TAU); g.fill(); }
        g.fillStyle = '#a05a3a'; g.fillRect(-2, -3, 10, 4);
      } else if (prop === 'wrench') {
        g.strokeStyle = '#c8d0d8'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(2, 0); g.lineTo(12, -26); g.stroke();
        g.fillStyle = '#c8d0d8';
        g.beginPath(); g.arc(13, -29, 6, 0, TAU); g.fill();
        g.fillStyle = '#7a8892'; g.beginPath(); g.arc(13, -31, 2.6, 0, TAU); g.fill();
      } else if (prop === 'lens') {
        g.strokeStyle = '#7a4a22'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(1, 0); g.lineTo(9, -16); g.stroke();
        g.strokeStyle = '#d9b24a'; g.lineWidth = 3;
        g.beginPath(); g.arc(14, -24, 8, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(190,235,255,0.55)'; g.beginPath(); g.arc(14, -24, 6.5, 0, TAU); g.fill();
      } else if (prop === 'lantern') {
        g.fillStyle = radial(g, 8, -14, 1, 8, -14, 26, [0, 'rgba(255,240,150,0.9)', 1, 'rgba(255,220,120,0)']);
        g.beginPath(); g.arc(8, -14, 26, 0, TAU); g.fill();
        g.strokeStyle = '#6a5a8a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(8, -34); g.lineTo(8, -26); g.stroke();
        g.fillStyle = '#4a3a6a'; g.fillRect(1, -27, 14, 3);
        g.fillStyle = '#ffe98a'; g.fillRect(2, -24, 12, 14);
        g.fillStyle = '#4a3a6a'; g.fillRect(1, -11, 14, 3);
      }
      g.restore();
    }

    function paintMark(g, kind) {
      g.fillStyle = kind === 2 ? '#3ed17a' : '#ffd23f';
      g.strokeStyle = 'rgba(10,40,50,0.85)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#12313c';
      g.font = '900 16px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(kind === 2 ? '✓' : '!', 0, 1);
    }

    const npcSprites = Object.create(null);
    // Sprite 96 × 110 con contorno blanco (se construye una vez): se distingue sobre el agua, la madera y la hierba.
    function npcSprite(npc) {
      if (npcSprites[npc.id]) return npcSprites[npc.id];
      const w = 96;
      const h = 110;
      const k = 3;
      const ox = w / 2;
      const oy = h - 12;
      const element = makeCanvas(w * k, h * k);
      const item = { canvas: element, w, h, ox, oy, paint: g => paintNpc(g, npc) };
      if (element) {
        const g = element.getContext('2d');
        const plain = makeCanvas(w * k, h * k);
        if (plain) {
          const pg = plain.getContext('2d');
          pg.scale(k, k);
          pg.translate(ox, oy);
          paintNpc(pg, npc);
          // Contorno: la silueta en blanco desplazada en ocho direcciones, y encima el dibujo.
          const ring = makeCanvas(w * k, h * k);
          const rg = ring.getContext('2d');
          const r = 2.6 * k;
          for (let i = 0; i < 8; i++) rg.drawImage(plain, Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
          rg.globalCompositeOperation = 'source-in';
          rg.fillStyle = '#ffffff';
          rg.fillRect(0, 0, w * k, h * k);
          g.drawImage(ring, 0, 0);
          g.drawImage(plain, 0, 0);
        } else {
          g.scale(k, k);
          g.translate(ox, oy);
          paintNpc(g, npc);
        }
      }
      return (npcSprites[npc.id] = item);
    }
    const markSprites = [null, null, null];
    function markSprite(kind) {
      if (markSprites[kind]) return markSprites[kind];
      const size = 30;
      const element = makeCanvas(size * 2, size * 2);
      const item = { canvas: element, w: size, h: size, ox: size / 2, oy: size / 2, paint: g => paintMark(g, kind) };
      if (element) {
        const g = element.getContext('2d');
        g.scale(2, 2);
        g.translate(size / 2, size / 2);
        paintMark(g, kind);
      }
      return (markSprites[kind] = item);
    }


    function paintFishShadow(g) {
      g.fillStyle = 'rgba(8,60,80,0.42)';
      g.beginPath(); g.ellipse(0, 0, 13, 5.5, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(-20, -6); g.lineTo(-20, 6); g.closePath(); g.fill();
    }

    function paintBobber(g) {
      g.fillStyle = 'rgba(0,50,70,0.3)';
      g.beginPath(); g.ellipse(0, 2, 9, 4, 0, 0, TAU); g.fill();
      g.fillStyle = '#f4f4ee';
      g.beginPath(); g.arc(0, -4, 8, 0, TAU); g.fill();
      g.fillStyle = '#e0403a';
      g.beginPath(); g.arc(0, -4, 8, Math.PI, 0); g.fill();
      g.fillStyle = '#e0403a';
      g.fillRect(-1.2, -20, 2.4, 9);
      g.strokeStyle = 'rgba(30,40,50,0.8)';
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(0, -4, 8, 0, TAU); g.stroke();
    }

    const fishSprite = { canvas: null };
    function simpleSprite(cache, key, w, h, ox, oy, paint) {
      if (cache[key]) return cache[key];
      const element = makeCanvas(w * 2, h * 2);
      const item = { canvas: element, w, h, ox, oy, paint };
      if (element) {
        const g = element.getContext('2d');
        g.scale(2, 2);
        g.translate(ox, oy);
        paint(g);
      }
      return (cache[key] = item);
    }
    const miscSprites = Object.create(null);
    const fishShadow = () => simpleSprite(miscSprites, 'fish', 44, 20, 26, 10, paintFishShadow);
    const bobber = () => simpleSprite(miscSprites, 'bobber', 24, 34, 12, 26, paintBobber);

    // ---------- Objetos ordenados por profundidad ----------
    const items = [];
    function pushItem(y, kind, ref, extra) {
      let item = items[stats.items];
      if (!item) { item = { y: 0, kind: 0, ref: null, extra: 0 }; items.push(item); }
      item.y = y; item.kind = kind; item.ref = ref; item.extra = extra || 0;
      stats.items++;
    }

    function drawPier(dock, cam, status) {
      const p = dock.pier;
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      ctx.fillStyle = '#7a4d2a';
      ctx.fillRect(x - 1, y + 3, p.w + 2, p.h + 3);
      ctx.fillStyle = '#b8814d';
      ctx.fillRect(x, y, p.w, p.h);
      ctx.strokeStyle = 'rgba(70,40,18,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (p.w > p.h) for (let i = 8; i < p.w; i += 8) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + p.h); }
      else for (let i = 8; i < p.h; i += 8) { ctx.moveTo(x, y + i); ctx.lineTo(x + p.w, y + i); }
      ctx.stroke();
      ctx.fillStyle = '#5e3a1e';
      const tipX = dock.dir === 'W' ? x + p.w : dock.dir === 'E' ? x : x + p.w / 2;
      const tipY = dock.dir === 'N' ? y + p.h : dock.dir === 'S' ? y : y + p.h / 2;
      ctx.beginPath(); ctx.arc(tipX, tipY, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = status === 'locked' ? '#9aa6a8' : '#ffd36a';
      ctx.beginPath(); ctx.arc(tipX, tipY - 1, 3.4, 0, TAU); ctx.fill();
    }

    function drawDockBuilding(dock, cam, status, f) {
      const p = dock.pier;
      const dx = dock.dir === 'E' ? 1 : dock.dir === 'W' ? -1 : 0;
      const dy = dock.dir === 'S' ? 1 : dock.dir === 'N' ? -1 : 0;
      const bx = (dock.dir === 'W' ? p.x : dock.dir === 'E' ? p.x + p.w : p.x + p.w / 2) + dx * 44 - cam.x;
      const by = (dock.dir === 'N' ? p.y : dock.dir === 'S' ? p.y + p.h : p.y + p.h / 2) + dy * 44 - cam.y + 14;
      blit(art.sprite(DOCK_HUTS[dock.id]), bx, by, 0.62, 0.62, status === 'locked' ? 0.7 : 1);
      const person = window.RioQuests && window.RioQuests.npc(dock.id);
      if (!person) blit(labelFor(dock), bx, by - 78, 1, 1, status === 'locked' ? 0.75 : 1);
      if (person) {
        // El personaje está de pie sobre el embarcadero, grande y con contorno, y su nombre flota encima.
        const toLand = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[dock.dir];
        const nx = p.x + p.w / 2 + toLand[0] * 10 - cam.x;
        const ny = p.y + p.h / 2 + toLand[1] * 10 - cam.y + 12;
        const dim = status === 'locked' ? 0.8 : 1;
        blit(npcSprite(person), nx, ny, NPC_SCALE, NPC_SCALE, dim);
        stats.npcs++;
        blit(labelFor({ id: `n-${person.id}`, name: person.name, sub: `${person.role} · ${dock.name}` }), nx, ny - 64 * NPC_SCALE - 4, 1, 1, dim);
        const mark = f.dockMark ? f.dockMark[dock.id] : 0;
        if (mark) blit(markSprite(mark), nx, ny - 64 * NPC_SCALE - 50 + Math.sin(time * 4 + nx) * 3, 1.5, 1.5, 1);
      }
      if (status === 'visited') {
        ctx.fillStyle = '#ffe58a';
        ctx.beginPath(); ctx.arc(bx + 84, by - 90, 5, 0, TAU); ctx.fill();
      }
    }

    function drawBoat(f, cam) {
      const b = f.boat;
      const bob = Math.sin(time * 6) * 0.8;
      const x = b.x - cam.x;
      const y = b.y - cam.y + bob;
      const speed = Math.hypot(b.vx, b.vy);
      const sc = 0.55;
      blit(art.sprite('shadow'), x + 6, y + 10, 1.2, 0.85, 0.7);
      if (speed > 25) {
        // Ola de proa: crece con la velocidad y apunta a donde va la lancha.
        const bowX = x + Math.sin(b.heading) * 34;
        const bowY = y - Math.cos(b.heading) * 34;
        blitRotated(art.sprite('bowWave'), bowX, bowY, 0.5 + speed / 500, 0.5 + speed / 500, b.heading, Math.min(0.85, speed / 160));
      }
      const lean = b.turn * 0.12 + Math.sin(time * 3) * 0.02;
      blitRotated(art.hullSprite(f.boatStyle), x, y, sc, sc, b.heading + lean, 1);
      blitRotated(art.sprite('rider'), x, y, sc, sc, b.heading + lean, 1);
      if (f.fishPhase) {
        // Boya por delante de la proa: flota y, cuando pica, salta y salpica.
        const fx = x + Math.sin(b.heading) * 78;
        const fy = y - Math.cos(b.heading) * 78;
        const bite = f.fishPhase === 2;
        const dip = bite ? Math.sin(time * 30) * 4 : Math.sin(time * 2.5) * 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x + Math.sin(b.heading) * 22, y - Math.cos(b.heading) * 22); ctx.lineTo(fx, fy - 4); ctx.stroke();
        const ring = bite ? (time * 3) % 1 : (time * 0.8) % 1;
        ctx.globalAlpha = (1 - ring) * 0.8;
        ctx.beginPath(); ctx.ellipse(fx, fy + 2, 8 + ring * (bite ? 26 : 14), 3 + ring * (bite ? 10 : 6), 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        blit(bobber(), fx, fy + dip, bite ? 1.25 : 1, bite ? 1.25 : 1, 1);
        if (bite) blit(markSprite(1), fx, fy - 40 + Math.sin(time * 14) * 3, 1.6, 1.6, 1);
      }
      if (f.shield) {
        ctx.globalCompositeOperation = 'lighter';
        blit(art.sprite('shield'), x, y, 0.5, 0.5, 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawWake(f, cam) {
      const foam = art.sprite('foam');
      const wake = f.wake;
      for (let i = 0; i < wake.length; i++) {
        const w = wake[i];
        const t = w.age / w.life;
        if (t >= 1) continue;
        const k = (0.45 + t * 0.9) * w.size;
        blit(foam, w.x - cam.x, w.y - cam.y, k, k * 0.8, (1 - t) * 0.7);
      }
    }

    // ---------- Fotograma ----------
    function visibleRange(cam) {
      return {
        cx0: Math.max(0, Math.floor(cam.x / CHUNK)), cx1: Math.min(chunksPerSide - 1, Math.floor((cam.x + WIDTH) / CHUNK)),
        cy0: Math.max(0, Math.floor(cam.y / CHUNK)), cy1: Math.min(chunksPerSide - 1, Math.floor((cam.y + height) / CHUNK))
      };
    }

    // Construye lo que falta: primero lo visible (sin límite si hay poco) y después, con el
    // presupuesto que quede, un anillo alrededor para que no aparezcan huecos al avanzar.
    function ensureChunks(cam, budget) {
      const r = visibleRange(cam);
      let built = 0;
      stats.missing = 0;
      for (let cy = r.cy0; cy <= r.cy1; cy++) {
        for (let cx = r.cx0; cx <= r.cx1; cx++) {
          if (touchChunk(cx, cy)) continue;
          stats.missing++;
          if (built < budget.visible) { buildChunk(cx, cy); built++; }
        }
      }
      if (built >= budget.ring) return;
      for (let cy = Math.max(0, r.cy0 - 1); cy <= Math.min(chunksPerSide - 1, r.cy1 + 1); cy++) {
        for (let cx = Math.max(0, r.cx0 - 1); cx <= Math.min(chunksPerSide - 1, r.cx1 + 1); cx++) {
          if (touchChunk(cx, cy)) continue;
          buildChunk(cx, cy);
          return;
        }
      }
    }

    // Construye de antemano todo lo que se ve desde `cam` (al empezar o reanudar).
    function prewarm(cam) {
      ensureChunks(cam, { visible: 99, ring: 0 });
    }

    function draw(f) {
      const cam = f.cam;
      stats.items = 0;
      stats.npcs = 0;
      ensureChunks(cam, { visible: stats.missing > 3 ? 6 : 3, ring: 1 });
      drawWater(cam);
      drawWake(f, cam);
      // Tierra.
      const r = visibleRange(cam);
      stats.drawnChunks = 0;
      for (let cy = r.cy0; cy <= r.cy1; cy++) {
        for (let cx = r.cx0; cx <= r.cx1; cx++) {
          const entry = chunks.get(chunkKey(cx, cy));
          if (!entry) continue;
          stats.drawnChunks++;
          if (entry.canvas) ctx.drawImage(entry.canvas, cx * CHUNK - cam.x, cy * CHUNK - cam.y, CHUNK, CHUNK);
        }
      }
      // Anillo dorado en los muelles cercanos.
      for (const dock of world.docks) {
        const dx = dock.x - cam.x;
        const dy = dock.y - cam.y;
        if (dx < -90 || dx > WIDTH + 90 || dy < -90 || dy > height + 90) continue;
        const status = f.dockStatus[dock.id];
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        const deliver = f.dockMark && f.dockMark[dock.id] === 2;
        ctx.strokeStyle = status === 'locked' ? 'rgba(220,230,232,0.55)' : deliver ? `rgba(80,235,140,${0.7 + 0.3 * pulse})` : `rgba(255,222,110,${0.6 + 0.3 * pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.ellipse(dx, dy, dock.radius * (0.92 + 0.05 * pulse), dock.radius * 0.72, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        pushItem(dock.pier.y + dock.pier.h, 3, dock);
      }
      // Caladeros: anillo azul con peces que nadan en círculo (solo los que se ven).
      for (const zone of world.fishing) {
        const zx = zone.x - cam.x;
        const zy = zone.y - cam.y;
        if (zx < -130 || zx > WIDTH + 130 || zy < -130 || zy > height + 130) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
        ctx.strokeStyle = `rgba(150,235,255,${0.65 + 0.3 * pulse})`;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.ellipse(zx, zy, zone.radius, zone.radius * 0.76, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        const shadow = fishShadow();
        const count = detail === 0 ? 2 : 4;
        for (let i = 0; i < count; i++) {
          const a = time * (0.6 + i * 0.07) + i * TAU / count;
          const rx = zone.radius * (0.45 + 0.12 * (i % 2));
          blitRotated(shadow, zx + Math.cos(a) * rx, zy + Math.sin(a) * rx * 0.76, 1, 1, a + Math.PI / 2 + Math.PI, 1);
        }
        blit(labelFor({ id: `z-${zone.id}`, name: zone.name, sub: '🎣 Para la lancha y pesca aquí' }), zx, zy - zone.radius * 0.76 - 8, 1, 1, 1);
      }
      // Objetos por profundidad.
      for (let cy = Math.max(0, r.cy0 - 1); cy <= Math.min(chunksPerSide - 1, r.cy1 + 1); cy++) {
        for (let cx = Math.max(0, r.cx0 - 1); cx <= Math.min(chunksPerSide - 1, r.cx1 + 1); cx++) {
          const list = propsByChunk.get(chunkKey(cx, cy));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const sy = p.y - cam.y;
            if (sy < -140 || sy > height + 40 || p.x - cam.x < -90 || p.x - cam.x > WIDTH + 90) continue;
            if (detail === 0 && p.low) continue;
            pushItem(p.y, 0, p);
          }
        }
      }
      for (const rock of world.rocks) {
        const sy = rock.y - cam.y;
        if (sy > -60 && sy < height + 60 && rock.x - cam.x > -60 && rock.x - cam.x < WIDTH + 60) pushItem(rock.y, 1, rock);
      }
      for (const coin of world.coins) {
        if (f.taken[coin.id]) continue;
        const sy = coin.y - cam.y;
        if (sy > -30 && sy < height + 30 && coin.x - cam.x > -30 && coin.x - cam.x < WIDTH + 30) pushItem(coin.y, 2, coin);
      }
      pushItem(f.boat.y, 4, f.boat);
      const list = items;
      const n = stats.items;
      // Ordenación por inserción: los objetos ya vienen casi ordenados por trozo.
      for (let i = 1; i < n; i++) {
        const current = list[i];
        const y = current.y;
        const kind = current.kind;
        const ref = current.ref;
        const extra = current.extra;
        let j = i - 1;
        while (j >= 0 && list[j].y > y) {
          list[j + 1].y = list[j].y; list[j + 1].kind = list[j].kind; list[j + 1].ref = list[j].ref; list[j + 1].extra = list[j].extra;
          j--;
        }
        list[j + 1].y = y; list[j + 1].kind = kind; list[j + 1].ref = ref; list[j + 1].extra = extra;
      }
      for (let i = 0; i < n; i++) {
        const item = list[i];
        const ref = item.ref;
        if (item.kind === 0) blit(art.sprite(ref.name), ref.x - cam.x, ref.y - cam.y, ref.s, ref.s, 1);
        else if (item.kind === 1) {
          const k = ref.r / 26;
          const rx = ref.x - cam.x;
          const ry = ref.y - cam.y;
          if (detail >= 1) {
            ctx.strokeStyle = 'rgba(242,255,255,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(rx, ry + 6 * k, ref.r + 9 + Math.sin(time * 3 + ref.id) * 2, ref.r * 0.55 + 5, 0, 0, TAU); ctx.stroke();
          }
          blit(art.sprite(ref.name), rx, ry, k, k, 1);
        } else if (item.kind === 2) {
          const bob = Math.sin(time * 3 + ref.id) * 2.5;
          blit(art.sprite('coin'), ref.x - cam.x, ref.y - cam.y + bob, 0.7, 0.7, 1);
        } else if (item.kind === 3) {
          const status = f.dockStatus[ref.id];
          drawPier(ref, cam, status);
          drawDockBuilding(ref, cam, status, f);
        } else drawBoat(f, cam);
      }
      stats.drawnItems = n;
    }

    // ---------- Minimapa ----------
    function buildMinimap() {
      minimapBase = makeCanvas(sea.N, sea.N);
      if (!minimapBase) return;
      const g = minimapBase.getContext('2d');
      for (let y = 0; y < sea.N; y++) {
        for (let x = 0; x < sea.N; x++) {
          if (world.isLand(x, y)) {
            const colors = GROUND[world.biomeAt(x, y)] || GROUND.tropical;
            g.fillStyle = colors.grass[0];
          } else g.fillStyle = '#35b8c6';
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    function drawMinimap(mctx, size, f) {
      if (!minimapBase) buildMinimap();
      mctx.clearRect(0, 0, size, size);
      mctx.fillStyle = '#35b8c6';
      mctx.fillRect(0, 0, size, size);
      if (minimapBase) mctx.drawImage(minimapBase, 0, 0, size, size);
      const k = size / world.size;
      for (const dock of world.docks) {
        const status = f.dockStatus[dock.id];
        mctx.fillStyle = f.dockMark && f.dockMark[dock.id] === 2 ? '#3ed17a' : status === 'locked' ? '#9aa6a8' : status === 'visited' ? '#ffffff' : '#ffd36a';
        mctx.beginPath(); mctx.arc(dock.x * k, dock.y * k, dock.kind === 'port' ? 3.4 : 2.8, 0, TAU); mctx.fill();
      }
      mctx.strokeStyle = '#7fe3ff';
      mctx.lineWidth = 1.5;
      for (const zone of world.fishing) { mctx.beginPath(); mctx.arc(zone.x * k, zone.y * k, 4.2, 0, TAU); mctx.stroke(); }
      mctx.strokeStyle = 'rgba(255,255,255,0.75)';
      mctx.lineWidth = 1;
      mctx.strokeRect(f.cam.x * k, f.cam.y * k, WIDTH * k, height * k);
      const b = f.boat;
      mctx.save();
      mctx.translate(b.x * k, b.y * k);
      mctx.rotate(b.heading);
      mctx.fillStyle = '#ff5a4a';
      mctx.beginPath(); mctx.moveTo(0, -4.5); mctx.lineTo(3.2, 3.5); mctx.lineTo(-3.2, 3.5); mctx.closePath(); mctx.fill();
      mctx.restore();
    }

    function resize(nextHeight, nextScale) {
      const changed = nextScale !== scale || nextHeight !== height || !waterGradient;
      height = nextHeight;
      if (nextScale !== scale) chunks = new Map();
      scale = nextScale;
      if (changed) buildWater();
    }

    function setDetail(value) {
      detail = Math.max(0, Math.min(2, value));
    }

    function update(dt) {
      time += dt;
    }

    resize(height, scale);

    // Para pruebas: decoración cercana a un punto (nada debe tapar a los personajes).
    function propsNear(x, y, radius) {
      const found = [];
      for (const list of propsByChunk.values()) for (const p of list) if (Math.hypot(p.x - x, p.y - y) < radius) found.push(p);
      return found;
    }

    return { npcScale: NPC_SCALE, propsNear, resize, setDetail, update, draw, prewarm, warm, drawMinimap, stats, chunkCount: () => chunks.size,
      hasChunk: (cx, cy) => chunks.has(chunkKey(cx, cy)), CHUNK, propCount: () => [...propsByChunk.values()].reduce((a, l) => a + l.length, 0) };
  }

  window.RioSeaView = Object.freeze({ create });
})();
