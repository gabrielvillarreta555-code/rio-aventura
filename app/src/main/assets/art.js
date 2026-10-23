// Capa visual de Río Aventura 2.4: dibujo 2.5D tropical sobre Canvas 2D.
// No contiene reglas de juego. game.js le entrega una "escena" en cada fotograma y
// esta capa solo dibuja. Todo el arte es procedural y original (sin imágenes externas).
//
// Rendimiento: los elementos complejos (palmeras, rocas, lancha...) se dibujan una vez en
// lienzos ocultos ("sprites") y después solo se copian con drawImage. Los degradados se
// crean al cambiar de tamaño o de tramo, nunca en cada fotograma.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const WIDTH = 450;
  const MAX_EFFECTS = 28;
  const MAX_SPARKLES = 48;

  // Paletas por tramo: mañana, mediodía, tarde dorada y atardecer tormentoso.
  const palettes = [
    { water: ['#a2f2dc', '#2cc0c8', '#0b86a0'], shallow: '#d2f8e2', haze: '#f2fff0', tint: [255, 226, 170, 0.07], sun: 0.12, sand: ['#f6e3a8', '#dcbf7e'] },
    { water: ['#8aeaea', '#16a8cc', '#0a70a2'], shallow: '#c4f4f0', haze: '#effcff', tint: [255, 255, 255, 0.02], sun: 0.10, sand: ['#f7e6ae', '#dfc482'] },
    { water: ['#bdeec6', '#35b0a6', '#127a86'], shallow: '#eaf6c8', haze: '#fff1cf', tint: [255, 196, 120, 0.09], sun: 0.15, sand: ['#f6dc9a', '#d8b06c'] },
    { water: ['#78c6de', '#2578a8', '#18427a'], shallow: '#bcdcea', haze: '#d6e5ff', tint: [118, 84, 176, 0.14], sun: 0.06, sand: ['#e9d49c', '#c4a672'] }
  ];

  function hash(n, salt) {
    let h = (Math.imul(n | 0, 374761393) + Math.imul(salt | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function clamp(value, low, high) {
    return value < low ? low : value > high ? high : value;
  }

  function parseColor(text) {
    const value = parseInt(text.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgba(hex, alpha) {
    const c = parseColor(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  function mixColor(a, b, t) {
    const x = parseColor(a);
    const y = parseColor(b);
    return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
  }

  // ---------- Utilidades de dibujo (solo se usan al construir sprites) ----------
  function ellipse(g, x, y, rx, ry, rotation) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rotation || 0, 0, TAU);
  }

  function fillEllipse(g, fill, x, y, rx, ry, rotation) {
    ellipse(g, x, y, rx, ry, rotation);
    g.fillStyle = fill;
    g.fill();
  }

  function linear(g, x0, y0, x1, y1, stops) {
    const gradient = g.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) gradient.addColorStop(stops[i], stops[i + 1]);
    return gradient;
  }

  function radial(g, x0, y0, r0, x1, y1, r1, stops) {
    const gradient = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (let i = 0; i < stops.length; i += 2) gradient.addColorStop(stops[i], stops[i + 1]);
    return gradient;
  }

  // Hoja alargada con nervio central: base en (0,0), punta en (length, 0).
  function leaf(g, length, width, light, dark, rib) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(length * 0.25, -width, length * 0.7, -width * 0.85, length, 0);
    g.bezierCurveTo(length * 0.7, width * 0.35, length * 0.25, width * 0.55, 0, 0);
    g.closePath();
    g.fillStyle = linear(g, 0, -width, 0, width * 0.6, [0, light, 1, dark]);
    g.fill();
    g.strokeStyle = rib;
    g.lineWidth = Math.max(0.8, width * 0.08);
    g.beginPath();
    g.moveTo(length * 0.05, 0);
    g.quadraticCurveTo(length * 0.5, -width * 0.22, length * 0.96, -width * 0.02);
    g.stroke();
  }

  // Dibuja una forma que se repite sin costuras en un mosaico cuadrado.
  function tiled(g, size, x, y, margin, paint) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const ox = x + dx * size;
        const oy = y + dy * size;
        if (ox < -margin || ox > size + margin || oy < -margin || oy > size + margin) continue;
        g.save();
        g.translate(ox, oy);
        paint(g);
        g.restore();
      }
    }
  }

  function create(options) {
    const canvas = options.canvas;
    const ctx = options.ctx;
    const doc = options.document;
    const skip = {};
    const debug = { skip, hull: '', counts: { rock: 0, log: 0, drift: 0, coin: 0 }, detail: 2, foreground: 0, drawnLast: 0, boatX: 0, boatY: 0, sprites: 0, spritesBuilt: 0, drawn: 0, immediate: false, scale: 1, frames: 0 };

    let height = 800;
    let renderScale = 1;
    let spriteScale = 1;
    let quality = 'high';
    let requested = 2;
    let time = 0;
    let flow = 0;
    let flowSpeed = 60;
    let cameraX = 0;
    let stageFrom = 0;
    let stageTo = 0;
    let stageMix = 1;
    let sprites = Object.create(null);
    let tiles = null;
    let boatPhase = 0;
    let pattern = null;
    let patterns = [];
    let grassPattern = null;
    const CAUSTIC_SIZES = [72, 100, 128];

    const effects = [];
    for (let i = 0; i < MAX_EFFECTS; i++) effects.push({ kind: 0, x: 0, y: 0, age: 0, life: 0, size: 0, active: false });
    const sparkles = [];
    for (let i = 0; i < MAX_SPARKLES; i++) sparkles.push({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 0, active: false });

    // ---------- Proyección (igual que la usada por la lógica del juego) ----------
    // Alinea a píxeles del dispositivo para que los patrones no se remuestreen.
    function snap(value) {
      return Math.round(value * renderScale) / renderScale;
    }

    function depthAt(y) {
      return 0.62 + 0.38 * clamp(y / height, 0, 1);
    }

    function projectX(x, y) {
      return WIDTH / 2 + (x - WIDTH / 2) * depthAt(y) - cameraX;
    }

    function edgeX(side, y) {
      return projectX(side ? WIDTH - 52 : 52, y);
    }

    // ---------- Sprites ----------
    function makeCanvas(w, h) {
      try {
        if (doc && typeof doc.createElement === 'function') {
          const element = doc.createElement('canvas');
          element.width = w;
          element.height = h;
          if (element && typeof element.getContext === 'function') return element;
        }
      } catch (_) { /* Sin lienzos ocultos se dibuja directamente. */ }
      return null;
    }

    // `paint` dibuja con el origen en el punto de anclaje (ox, oy) del sprite.
    function sprite(key, w, h, ox, oy, paint) {
      let item = sprites[key];
      if (item) return item;
      const element = makeCanvas(Math.max(1, Math.ceil(w * spriteScale)), Math.max(1, Math.ceil(h * spriteScale)));
      item = { canvas: element, w, h, ox, oy, paint };
      if (element) {
        const g = element.getContext('2d');
        g.scale(spriteScale, spriteScale);
        g.translate(ox, oy);
        paint(g);
      } else debug.immediate = true;
      sprites[key] = item;
      debug.spritesBuilt++;
      return item;
    }

    // Copia un sprite con su anclaje en (x, y). Sin lienzo oculto lo dibuja directamente.
    function put(item, x, y, sx, sy, rotation, alpha) {
      debug.drawn++;
      ctx.save();
      ctx.translate(x, y);
      if (rotation) ctx.rotate(rotation);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
      if (item.canvas) ctx.drawImage(item.canvas, -item.ox, -item.oy, item.w, item.h);
      else item.paint(ctx);
      ctx.restore();
    }

    // Variante rápida sin rotación: evita save/restore usando solo drawImage.
    function putFlat(item, x, y, sx, sy, alpha) {
      if (!item.canvas) { put(item, x, y, sx, sy, 0, alpha); return; }
      debug.drawn++;
      if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
      ctx.drawImage(item.canvas, x - item.ox * sx, y - item.oy * sy, item.w * sx, item.h * sy);
      if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = 1;
    }

    // ---------- Pinturas de sprites ----------
    function paintShadow(g) {
      g.save();
      g.scale(1, 0.42);
      g.fillStyle = radial(g, 0, 0, 2, 0, 0, 34, [0, 'rgba(6,34,48,0.55)', 0.6, 'rgba(6,34,48,0.25)', 1, 'rgba(6,34,48,0)']);
      g.beginPath();
      g.arc(0, 0, 34, 0, TAU);
      g.fill();
      g.restore();
    }

    function hullShape(g, grow) {
      g.beginPath();
      g.moveTo(0, -54 - grow);
      g.bezierCurveTo(30 + grow, -34, 44 + grow, -6, 41 + grow, 20);
      g.bezierCurveTo(39 + grow, 42, 22, 56 + grow, 0, 58 + grow);
      g.bezierCurveTo(-22, 56 + grow, -39 - grow, 42, -41 - grow, 20);
      g.bezierCurveTo(-44 - grow, -6, -30 - grow, -34, 0, -54 - grow);
      g.closePath();
    }

    function paintHull(g, style) {
      // Grosor del casco: la misma forma, desplazada, en tono oscuro.
      g.save();
      g.translate(3.5, 6);
      hullShape(g, 0);
      g.fillStyle = style.hull[2];
      g.fill();
      g.restore();
      hullShape(g, 0);
      g.fillStyle = linear(g, -40, -46, 40, 54, [0, style.hull[0], 0.5, style.hull[1], 1, style.hull[2]]);
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = style.trim;
      g.stroke();
      // Brillo del borde superior izquierdo.
      g.save();
      hullShape(g, 0);
      g.clip();
      g.fillStyle = radial(g, -22, -34, 2, -22, -34, 46, [0, 'rgba(255,255,255,0.45)', 1, 'rgba(255,255,255,0)']);
      g.fillRect(-60, -70, 120, 140);
      g.restore();
      // Interior: pared sombreada arriba/izquierda y suelo de madera.
      hullShape(g, -9);
      g.fillStyle = linear(g, -20, -40, 22, 50, [0, '#4b2d22', 0.35, '#7a4a30', 1, '#a8693e']);
      g.fill();
      g.save();
      hullShape(g, -9);
      g.clip();
      g.strokeStyle = 'rgba(40,20,12,0.28)';
      g.lineWidth = 1.4;
      for (let y = -38; y < 52; y += 11) {
        g.beginPath();
        g.moveTo(-40, y);
        g.lineTo(40, y + 1.5);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,214,160,0.18)';
      for (let y = -33; y < 52; y += 11) {
        g.beginPath();
        g.moveTo(-40, y);
        g.lineTo(40, y + 1.5);
        g.stroke();
      }
      g.restore();
      hullShape(g, -9);
      g.strokeStyle = 'rgba(255,230,190,0.32)';
      g.lineWidth = 1.5;
      g.stroke();
      // Asientos (bancadas): sombra, madera y filo iluminado.
      for (const seat of [{ y: -14, w: 29 }, { y: 28, w: 27 }]) {
        g.fillStyle = 'rgba(30,14,10,0.38)';
        g.fillRect(-seat.w, seat.y + 4, seat.w * 2, 7);
        g.fillStyle = linear(g, 0, seat.y - 5, 0, seat.y + 6, [0, '#d99b5c', 1, '#9b5f34']);
        g.beginPath();
        if (g.roundRect) g.roundRect(-seat.w, seat.y - 5, seat.w * 2, 11, 3);
        else g.rect(-seat.w, seat.y - 5, seat.w * 2, 11);
        g.fill();
        g.fillStyle = 'rgba(255,232,190,0.55)';
        g.fillRect(-seat.w + 2, seat.y - 4.5, seat.w * 2 - 4, 2);
      }
      // Proa y popa con el color de adorno, y una cuerda enrollada.
      g.fillStyle = style.trim;
      g.beginPath();
      g.moveTo(0, -52);
      g.quadraticCurveTo(9, -42, 8, -34);
      g.lineTo(-8, -34);
      g.quadraticCurveTo(-9, -42, 0, -52);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(0, -50);
      g.quadraticCurveTo(-5, -43, -5, -37);
      g.lineTo(-1, -37);
      g.closePath();
      g.fill();
      g.strokeStyle = '#e8d3a0';
      g.lineWidth = 2.2;
      ellipse(g, 0, 44, 8, 4);
      g.stroke();
      g.strokeStyle = '#c3a56a';
      g.lineWidth = 1;
      ellipse(g, 0, 44, 5, 2);
      g.stroke();
    }

    function paintRider(g) {
      // Hombros y camisa coral.
      fillEllipse(g, linear(g, -17, -8, 17, 16, [0, '#ff9a72', 1, '#d8554a']), 0, 5, 19, 13);
      fillEllipse(g, 'rgba(255,255,255,0.25)', -8, 0, 7, 3.6, -0.4);
      // Cabeza (se ve poco bajo el sombrero) y sombra del ala sobre los hombros.
      fillEllipse(g, '#e9a77a', 0, -5, 8, 8);
      fillEllipse(g, 'rgba(60,20,20,0.30)', 1, 1, 15, 7);
      // Sombrero de paja: ala, copa y cinta.
      fillEllipse(g, linear(g, -18, -20, 18, 4, [0, '#fbe38c', 0.6, '#e2b653', 1, '#b98730']), 0, -10, 18, 13);
      ellipse(g, 0, -10, 18, 13);
      g.strokeStyle = 'rgba(120,76,20,0.55)';
      g.lineWidth = 1.2;
      g.stroke();
      fillEllipse(g, linear(g, -9, -19, 9, -4, [0, '#fff0b0', 1, '#d8a63e']), 0, -12, 9.5, 7.6);
      ellipse(g, 0, -11, 9.5, 7.2);
      g.strokeStyle = '#e4604f';
      g.lineWidth = 2.6;
      g.stroke();
      g.strokeStyle = 'rgba(150,100,30,0.35)';
      g.lineWidth = 0.9;
      for (let i = 0; i < 4; i++) {
        ellipse(g, 0, -10, 18 - i * 3.4, 13 - i * 2.6);
        g.stroke();
      }
    }

    function paintBlade(g) {
      g.fillStyle = linear(g, -6, -16, 6, 16, [0, '#f4d28b', 0.5, '#d49a54', 1, '#9e6234']);
      ellipse(g, 0, 0, 6.5, 16);
      g.fill();
      g.strokeStyle = 'rgba(255,240,200,0.7)';
      g.lineWidth = 1.2;
      ellipse(g, -1.4, -2, 2.6, 11);
      g.stroke();
    }

    function paintBowWave(g) {
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = `rgba(240,255,255,${0.7 - i * 0.2})`;
        g.lineWidth = 4 - i * 1.1;
        g.beginPath();
        g.moveTo(-6 - i * 5, 12 + i * 5);
        g.quadraticCurveTo(-24 - i * 7, 2 + i * 4, -38 - i * 9, 28 + i * 7);
        g.stroke();
        g.beginPath();
        g.moveTo(6 + i * 5, 12 + i * 5);
        g.quadraticCurveTo(24 + i * 7, 2 + i * 4, 38 + i * 9, 28 + i * 7);
        g.stroke();
      }
    }

    function paintFoamPuff(g) {
      g.fillStyle = radial(g, 0, 0, 1, 0, 0, 14, [0, 'rgba(255,255,255,0.95)', 0.55, 'rgba(235,255,252,0.55)', 1, 'rgba(235,255,252,0)']);
      g.beginPath();
      g.arc(0, 0, 14, 0, TAU);
      g.fill();
    }

    function paintCrest(g) {
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.20)';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(-34, 4);
      g.bezierCurveTo(-14, -9, 14, 11, 34, 0);
      g.stroke();
      g.strokeStyle = 'rgba(244,255,255,0.78)';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(-30, 3);
      g.bezierCurveTo(-12, -8, 12, 9, 30, 0);
      g.stroke();
      g.strokeStyle = 'rgba(244,255,255,0.45)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-22, 8);
      g.quadraticCurveTo(0, 3, 20, 8);
      g.stroke();
    }

    function paintGlint(g) {
      g.fillStyle = radial(g, 0, 0, 0, 0, 0, 9, [0, 'rgba(255,255,255,0.95)', 1, 'rgba(255,255,255,0)']);
      g.beginPath();
      g.arc(0, 0, 9, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.moveTo(0, -9); g.lineTo(1.4, -1.4); g.lineTo(9, 0); g.lineTo(1.4, 1.4);
      g.lineTo(0, 9); g.lineTo(-1.4, 1.4); g.lineTo(-9, 0); g.lineTo(-1.4, -1.4);
      g.closePath();
      g.fill();
    }

    function paintCausticTile(g, size) {
      g.lineCap = 'round';
      const k = size / 128;
      for (let i = 0; i < 26; i++) {
        const x = hash(i, 11) * size;
        const y = hash(i, 12) * size;
        const r = (9 + hash(i, 13) * 18) * k;
        const a = hash(i, 14) * TAU;
        tiled(g, size, x, y, r + 6, g2 => {
          g2.strokeStyle = 'rgba(255,255,255,0.55)';
          g2.lineWidth = (1.3 + hash(i, 15) * 1.1) * k;
          g2.beginPath();
          g2.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.55);
          g2.bezierCurveTo(Math.cos(a + 1.1) * r * 1.2, Math.sin(a + 1.1) * r, Math.cos(a + 2.4) * r, Math.sin(a + 2.4) * r * 0.8,
            Math.cos(a + 3.3) * r * 0.9, Math.sin(a + 3.3) * r * 0.5);
          g2.stroke();
        });
      }
    }

    function paintGrassTile(g) {
      g.fillStyle = '#2f9a52';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 46; i++) {
        const x = hash(i, 21) * 128;
        const y = hash(i, 22) * 128;
        const r = 7 + hash(i, 23) * 16;
        const tone = hash(i, 24);
        tiled(g, 128, x, y, r, g2 => {
          g2.fillStyle = tone < 0.4 ? 'rgba(18,96,60,0.30)' : tone < 0.8 ? 'rgba(124,214,98,0.22)' : 'rgba(255,240,150,0.12)';
          ellipse(g2, 0, 0, r * 1.3, r * 0.8, hash(i, 25) * 3);
          g2.fill();
        });
      }
      for (let i = 0; i < 36; i++) {
        const x = hash(i, 31) * 128;
        const y = hash(i, 32) * 128;
        tiled(g, 128, x, y, 6, g2 => {
          g2.strokeStyle = hash(i, 33) < 0.5 ? 'rgba(20,100,60,0.55)' : 'rgba(170,236,120,0.5)';
          g2.lineWidth = 1.2;
          g2.beginPath();
          g2.moveTo(0, 0); g2.lineTo(-2, -5);
          g2.moveTo(0, 0); g2.lineTo(2, -6);
          g2.moveTo(0, 0); g2.lineTo(0, -4);
          g2.stroke();
        });
      }
    }

    // ---------- Vegetación y escenario ----------
    function paintPalm(g, v) {
      const lean = [-16, 12, 24][v];
      const h = [124, 140, 100][v];
      const bend = [-12, 8, -6][v];
      const topX = lean;
      const topY = -h;
      const ctrlX = lean * 0.2 + bend;
      const ctrlY = -h * 0.55;
      fillEllipse(g, 'rgba(6,46,40,0.30)', 30, 5, 44, 9, -0.04);
      fillEllipse(g, 'rgba(6,46,40,0.18)', 56, 4, 30, 6, -0.02);
      // Tronco: trazo oscuro, trazo claro desplazado y anillos.
      g.lineCap = 'round';
      g.strokeStyle = '#6d4328';
      g.lineWidth = 9.5;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ctrlX, ctrlY, topX, topY); g.stroke();
      g.strokeStyle = '#a7703f';
      g.lineWidth = 6.4;
      g.beginPath(); g.moveTo(-1.2, 0); g.quadraticCurveTo(ctrlX - 1.2, ctrlY, topX - 1.2, topY); g.stroke();
      g.strokeStyle = '#d09a62';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-2.6, -2); g.quadraticCurveTo(ctrlX - 2.6, ctrlY, topX - 2.6, topY + 4); g.stroke();
      g.strokeStyle = 'rgba(58,32,16,0.5)';
      g.lineWidth = 1.3;
      for (let i = 1; i < 11; i++) {
        const t = i / 11;
        const x = 2 * (1 - t) * t * ctrlX + t * t * topX;
        const y = 2 * (1 - t) * t * ctrlY + t * t * topY;
        g.beginPath(); g.moveTo(x - 4.2, y + 1.2); g.quadraticCurveTo(x, y + 3.6, x + 4.2, y + 1.2); g.stroke();
      }
      // Copa: hojas traseras oscuras, delanteras claras y cocos.
      fillEllipse(g, '#2a6a3a', topX, topY + 3, 9, 6);
      const count = 9;
      for (let i = 0; i < count; i++) {
        const spread = -3.0 + i * (2.78 / (count - 1));
        const droop = Math.abs(spread + 1.57) > 1.05 ? 0.35 : 0;
        const length = 52 + hash(i, v + 40) * 16 + (i % 2 ? 0 : 6);
        g.save();
        g.translate(topX, topY);
        g.rotate(spread + (spread < -1.57 ? droop : -droop));
        const back = i % 2 === 0;
        leaf(g, length, 13 + hash(i, v + 50) * 4, back ? '#3fae5a' : '#7be07a', back ? '#146a3c' : '#2a9a50', back ? '#a6e98a' : '#d5ffa6');
        g.restore();
      }
      for (const nut of [[-4, 3], [4, 4], [0, 7]]) {
        fillEllipse(g, radial(g, nut[0] - 1, topY + nut[1] - 1, 0.5, nut[0], topY + nut[1], 5, [0, '#b98a4e', 1, '#5b3a1f']), topX + nut[0], topY + nut[1], 4.6, 4.6);
      }
    }

    function paintJungle(g, v) {
      fillEllipse(g, 'rgba(6,46,40,0.30)', 24, 5, 40, 9, -0.04);
      // Tronco con contrafuertes.
      g.fillStyle = linear(g, -9, 0, 9, 0, [0, '#8a5a35', 1, '#4f301d']);
      g.beginPath();
      g.moveTo(-13, 3); g.quadraticCurveTo(-6, -4, -5, -40); g.lineTo(5, -40);
      g.quadraticCurveTo(7, -4, 14, 3); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,214,160,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-3, -2); g.lineTo(-3, -38); g.stroke();
      // Copa en capas: sombras, medios y luces.
      const blobs = v === 0
        ? [[-24, -62, 24], [22, -60, 25], [0, -86, 30], [-30, -88, 18], [28, -86, 19], [0, -60, 28]]
        : [[-20, -58, 22], [24, -66, 26], [2, -90, 28], [-26, -84, 20], [30, -92, 16], [4, -64, 26]];
      for (const blob of blobs) fillEllipse(g, '#126a3d', blob[0] + 3, blob[1] + 5, blob[2], blob[2] * 0.88);
      for (const blob of blobs) {
        fillEllipse(g, radial(g, blob[0] - blob[2] * 0.3, blob[1] - blob[2] * 0.4, 2, blob[0], blob[1], blob[2],
          [0, '#8be07a', 0.5, '#3dae58', 1, '#1b7e46']), blob[0], blob[1], blob[2], blob[2] * 0.9);
      }
      g.fillStyle = 'rgba(214,255,160,0.55)';
      for (let i = 0; i < 9; i++) {
        const blob = blobs[i % blobs.length];
        fillEllipse(g, 'rgba(214,255,160,0.5)', blob[0] - blob[2] * 0.35 + hash(i, v + 60) * 6, blob[1] - blob[2] * 0.45 + hash(i, v + 61) * 6, 5.5, 2.8, -0.5);
      }
      if (v === 1) {
        for (let i = 0; i < 7; i++) {
          const blob = blobs[i % blobs.length];
          const fx = blob[0] + (hash(i, 70) - 0.5) * blob[2] * 1.3;
          const fy = blob[1] + (hash(i, 71) - 0.5) * blob[2] * 1.1;
          fillEllipse(g, '#ff6f91', fx, fy, 3.4, 3.4);
          fillEllipse(g, '#ffe27a', fx, fy, 1.3, 1.3);
        }
      }
    }

    function paintBush(g, v) {
      fillEllipse(g, 'rgba(6,46,40,0.28)', 14, 4, 30, 7, -0.03);
      const blobs = [[-16, -9, 15], [14, -10, 16], [0, -17, 17], [-4, -6, 15]];
      for (const blob of blobs) fillEllipse(g, '#157044', blob[0] + 2, blob[1] + 3, blob[2], blob[2] * 0.8);
      for (const blob of blobs) {
        fillEllipse(g, radial(g, blob[0] - 5, blob[1] - 6, 1, blob[0], blob[1], blob[2], [0, '#9be87c', 0.55, '#43b65a', 1, '#20844a']), blob[0], blob[1], blob[2], blob[2] * 0.82);
      }
      if (v === 1) {
        for (let i = 0; i < 6; i++) {
          const fx = -18 + hash(i, 80) * 36;
          const fy = -22 + hash(i, 81) * 20;
          fillEllipse(g, '#ff7d9c', fx, fy, 4, 4);
          fillEllipse(g, '#ffd45c', fx, fy, 1.5, 1.5);
          fillEllipse(g, 'rgba(255,255,255,0.5)', fx - 1.3, fy - 1.4, 1.3, 1);
        }
      }
    }

    function paintFern(g) {
      fillEllipse(g, 'rgba(6,46,40,0.25)', 10, 3, 26, 5, -0.03);
      for (let i = 0; i < 10; i++) {
        const angle = -3.0 + i * 0.29 + (hash(i, 90) - 0.5) * 0.15;
        g.save();
        g.translate(0, -2);
        g.rotate(angle);
        leaf(g, 24 + hash(i, 91) * 12, 6, i % 2 ? '#8fe27e' : '#59c264', i % 2 ? '#2a9a50' : '#17703f', '#c8f59a');
        g.restore();
      }
    }

    function paintBankRocks(g) {
      fillEllipse(g, 'rgba(6,46,40,0.28)', 12, 5, 32, 7);
      for (const rock of [[-12, -6, 12, 0], [10, -4, 10, 1], [0, -13, 9, 2]]) {
        fillEllipse(g, linear(g, rock[0] - rock[2], rock[1] - rock[2], rock[0] + rock[2], rock[1] + rock[2], [0, '#d9d2bd', 0.5, '#9d9d92', 1, '#5e6d6e']), rock[0], rock[1], rock[2], rock[2] * 0.82);
        fillEllipse(g, '#5fbf5b', rock[0] - 2, rock[1] - rock[2] * 0.55, rock[2] * 0.6, rock[2] * 0.26);
        fillEllipse(g, 'rgba(255,255,255,0.4)', rock[0] - rock[2] * 0.35, rock[1] - rock[2] * 0.3, rock[2] * 0.3, rock[2] * 0.14, -0.5);
      }
    }

    function paintReeds(g) {
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const x = -16 + i * 4 + (hash(i, 95) - 0.5) * 3;
        const h = 24 + hash(i, 96) * 22;
        g.strokeStyle = i % 3 === 0 ? '#2a8a4a' : '#5bc468';
        g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (i - 4) * 1.6, -h * 0.6, x + (i - 4) * 3, -h); g.stroke();
        if (i % 4 === 1) {
          g.strokeStyle = '#7a4a2a'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(x + (i - 4) * 2.4, -h * 0.84); g.lineTo(x + (i - 4) * 3, -h); g.stroke();
        }
      }
    }

    // ---------- Obstáculos, monedas y efectos ----------
    function paintRock(g, v) {
      fillEllipse(g, radial(g, 0, 8, 3, 0, 8, 38, [0, 'rgba(190,255,236,0.55)', 0.7, 'rgba(120,230,214,0.25)', 1, 'rgba(120,230,214,0)']), 0, 8, 38, 22);
      fillEllipse(g, 'rgba(6,36,52,0.36)', 10, 13, 32, 11);
      const count = 9;
      const radii = [];
      for (let i = 0; i < count; i++) radii.push(22 * (0.84 + hash(i, v * 7 + 1) * 0.3));
      const pointAt = i => {
        const a = (i / count) * TAU - 1.2;
        return [Math.cos(a) * radii[i % count], Math.sin(a) * radii[i % count] * 0.9 - 3];
      };
      const body = () => {
        g.beginPath();
        const first = pointAt(0);
        const second = pointAt(1);
        g.moveTo((first[0] + second[0]) / 2, (first[1] + second[1]) / 2);
        for (let i = 1; i <= count; i++) {
          const a = pointAt(i);
          const b = pointAt(i + 1);
          g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        g.closePath();
      };
      body();
      g.fillStyle = linear(g, -22, -26, 24, 24, [0, '#dcd9c6', 0.4, '#a3aca4', 1, '#42606b']);
      g.fill();
      g.save();
      body();
      g.clip();
      // Facetas: luz arriba a la izquierda, sombra abajo a la derecha.
      g.fillStyle = 'rgba(255,255,255,0.26)';
      g.beginPath(); g.moveTo(-24, -4); g.lineTo(-6, -24); g.lineTo(6, -10); g.lineTo(-10, 4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(10,34,52,0.30)';
      g.beginPath(); g.moveTo(26, -2); g.lineTo(8, 4); g.lineTo(-4, 24); g.lineTo(26, 24); g.closePath(); g.fill();
      g.fillStyle = linear(g, 0, 6, 0, 26, [0, 'rgba(8,44,64,0)', 1, 'rgba(8,44,64,0.6)']);
      g.fillRect(-30, 4, 60, 30);
      // Musgo tropical.
      const mossX = [-4, 3, -9][v % 3];
      fillEllipse(g, 'rgba(24,110,60,0.9)', mossX, -13, 15, 7.5, -0.15);
      fillEllipse(g, '#4dbb58', mossX - 2, -15, 11, 5, -0.15);
      fillEllipse(g, '#a2eb74', mossX - 5, -17, 5, 2.4, -0.3);
      g.restore();
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(mossX - 8 + i * 5, -16 + (i % 2) * 2);
        g.rotate(-1.57 + (i - 1.5) * 0.45);
        leaf(g, 8 + hash(i, v + 99) * 3, 2.6, '#9be87c', '#2a9a50', '#d5ffa6');
        g.restore();
      }
      fillEllipse(g, 'rgba(255,255,255,0.65)', -8, -12, 5.2, 2.6, -0.5);
    }

    function paintWakeTail(g) {
      g.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        g.strokeStyle = `rgba(245,255,255,${0.55 - i * 0.2})`;
        g.lineWidth = 2.6 - i * 0.8;
        g.beginPath(); g.moveTo(-14 - i * 4, 14); g.quadraticCurveTo(-22 - i * 6, 34, -32 - i * 8, 62 + i * 4); g.stroke();
        g.beginPath(); g.moveTo(14 + i * 4, 14); g.quadraticCurveTo(22 + i * 6, 34, 32 + i * 8, 62 + i * 4); g.stroke();
      }
      g.fillStyle = 'rgba(240,255,255,0.4)';
      for (const puff of [[-20, 30, 4.5], [22, 34, 4], [-28, 50, 3.6], [30, 54, 3.2]]) {
        g.beginPath(); g.arc(puff[0], puff[1], puff[2], 0, TAU); g.fill();
      }
    }

    function paintLog(g, v) {
      fillEllipse(g, radial(g, 0, 9, 3, 0, 9, 46, [0, 'rgba(190,255,236,0.5)', 0.7, 'rgba(120,230,214,0.22)', 1, 'rgba(120,230,214,0)']), 0, 9, 46, 20);
      fillEllipse(g, 'rgba(6,36,52,0.36)', 9, 15, 38, 11);
      const palette = v === 0 ? ['#d79a5c', '#8f5a34', '#4f2f1d'] : ['#cfa070', '#8b6544', '#4d3828'];
      g.beginPath();
      if (g.roundRect) g.roundRect(-32, -13, 64, 26, 11); else g.rect(-32, -13, 64, 26);
      g.fillStyle = linear(g, 0, -13, 0, 13, [0, palette[0], 0.45, palette[1], 1, palette[2]]);
      g.fill();
      g.save();
      g.beginPath();
      if (g.roundRect) g.roundRect(-32, -13, 64, 26, 11); else g.rect(-32, -13, 64, 26);
      g.clip();
      g.strokeStyle = 'rgba(40,22,12,0.5)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const y = -10 + i * 2.8;
        const phase = hash(i, v + 110) * 20;
        g.beginPath();
        g.moveTo(-32, y);
        g.bezierCurveTo(-14, y + 1.6 + (i % 2), 6 + phase * 0.1, y - 1.6, 32, y + (i % 3) - 1);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,224,176,0.28)';
      g.fillRect(-32, -12, 64, 3);
      g.fillStyle = 'rgba(10,26,40,0.28)';
      g.fillRect(-32, 8, 64, 6);
      g.restore();
      // Nudos y ramas rotas.
      fillEllipse(g, '#5b3622', 10, -2, 3.5, 2.4);
      fillEllipse(g, '#d8a068', 10, -2.4, 1.6, 1);
      g.lineCap = 'round';
      g.strokeStyle = '#6e4529';
      g.lineWidth = 4.6;
      g.beginPath(); g.moveTo(-6, -11); g.lineTo(-10, -19); g.stroke();
      g.strokeStyle = '#d6a165';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-10.5, -18.4); g.lineTo(-11.2, -20); g.stroke();
      // Cara cortada con anillos de crecimiento.
      fillEllipse(g, '#e5b678', -32, 0, 6.2, 13);
      for (let i = 0; i < 3; i++) {
        ellipse(g, -32, 0, 5 - i * 1.5, 11 - i * 3.4);
        g.strokeStyle = 'rgba(140,84,40,0.65)';
        g.lineWidth = 0.9;
        g.stroke();
      }
      // Musgo.
      fillEllipse(g, 'rgba(36,124,64,0.9)', 14, -11, 12, 4.4, 0.1);
      fillEllipse(g, '#79d46a', 12, -12.5, 7, 2.3, 0.1);
    }

    function paintDriftMark(g) {
      g.lineJoin = 'round';
      for (const offset of [-3, 7]) {
        g.beginPath();
        g.moveTo(offset - 7, -8); g.lineTo(offset + 1, 0); g.lineTo(offset - 7, 8);
        g.strokeStyle = '#6b3f12';
        g.lineWidth = 7;
        g.stroke();
        g.strokeStyle = '#ffd34f';
        g.lineWidth = 4;
        g.stroke();
      }
    }

    function paintCoin(g) {
      fillEllipse(g, linear(g, -15, -15, 15, 15, [0, '#ffe58a', 0.55, '#d39a2c', 1, '#8c5a16']), 0, 0, 15.5, 15.5);
      fillEllipse(g, linear(g, -11, -12, 11, 12, [0, '#fff3b0', 0.5, '#ffd24f', 1, '#e3a02f']), 0, -0.5, 12.2, 12.2);
      g.strokeStyle = 'rgba(160,100,20,0.65)';
      g.lineWidth = 1.2;
      ellipse(g, 0, -0.5, 9.4, 9.4);
      g.stroke();
      // Emblema: tres olas de río.
      g.strokeStyle = '#b8761c';
      g.lineWidth = 1.8;
      g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(-6, i * 3.4 - 0.4);
        g.quadraticCurveTo(-3, i * 3.4 - 3, 0, i * 3.4 - 0.4);
        g.quadraticCurveTo(3, i * 3.4 + 2.2, 6, i * 3.4 - 0.4);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, -0.5, 13.2, 3.5, 4.7); g.stroke();
    }

    function paintGlow(g) {
      g.fillStyle = radial(g, 0, 0, 2, 0, 0, 34, [0, 'rgba(255,224,120,0.75)', 0.5, 'rgba(255,200,80,0.28)', 1, 'rgba(255,200,80,0)']);
      g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
    }

    function paintSparkle(g) {
      g.fillStyle = radial(g, 0, 0, 0, 0, 0, 12, [0, 'rgba(255,240,170,0.9)', 1, 'rgba(255,220,100,0)']);
      g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
      g.fillStyle = '#fffbe0';
      g.beginPath();
      g.moveTo(0, -12); g.lineTo(2, -2); g.lineTo(12, 0); g.lineTo(2, 2);
      g.lineTo(0, 12); g.lineTo(-2, 2); g.lineTo(-12, 0); g.lineTo(-2, -2);
      g.closePath(); g.fill();
    }

    function paintShield(g) {
      g.fillStyle = radial(g, 0, 0, 30, 0, 0, 66, [0, 'rgba(255,230,140,0)', 0.7, 'rgba(255,226,120,0.30)', 1, 'rgba(255,226,120,0.75)']);
      g.beginPath(); g.arc(0, 0, 66, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,248,200,0.9)';
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, 61, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 3.4;
      g.beginPath(); g.arc(0, 0, 58, 3.55, 4.55); g.stroke();
    }

    function paintPetal(g, kind) {
      g.rotate(0.5);
      if (kind === 2) {
        leaf(g, 12, 3.6, '#a6ec7c', '#2a9a50', '#d8ffae');
        return;
      }
      g.fillStyle = linear(g, -6, -3, 6, 3, kind === 0 ? [0, '#ffe0e8', 1, '#ff7d9c'] : [0, '#ffffff', 1, '#ffe6a8']);
      ellipse(g, 0, 0, 6, 3.2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      ellipse(g, -1.4, -0.8, 2.4, 0.9);
      g.fill();
    }

    function paintDrop(g, color) {
      g.fillStyle = radial(g, 0, 0, 0.5, 0, 0, 8, [0, '#ffffff', 0.35, color, 1, 'rgba(255,255,255,0)']);
      g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
    }

    // ---------- Iluminación y fondo ----------
    function paintBackdrop(g) {
      const layers = [
        { base: 118, amp: 22, fill: 'rgba(150,214,196,0.85)', seed: 120 },
        { base: 150, amp: 24, fill: 'rgba(98,184,146,0.9)', seed: 130 },
        { base: 182, amp: 20, fill: 'rgba(52,150,104,0.95)', seed: 140 }
      ];
      for (const layer of layers) {
        g.beginPath();
        g.moveTo(0, 230);
        for (let x = 0; x <= 560; x += 14) {
          const y = layer.base - Math.sin(x * 0.018 + layer.seed) * layer.amp - Math.sin(x * 0.05 + layer.seed * 2) * layer.amp * 0.4;
          g.lineTo(x, y);
        }
        g.lineTo(560, 230);
        g.closePath();
        g.fillStyle = layer.fill;
        g.fill();
      }
      // Siluetas de palmeras lejanas.
      g.strokeStyle = 'rgba(30,110,74,0.9)';
      g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const x = 20 + i * 40 + hash(i, 150) * 20;
        const y = 156 - Math.sin(x * 0.018 + 130) * 24 + 6;
        const h = 22 + hash(i, 151) * 16;
        g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - h); g.stroke();
        g.lineWidth = 1.8;
        for (let k = -2; k <= 2; k++) {
          g.beginPath(); g.moveTo(x + 3, y - h); g.quadraticCurveTo(x + 3 + k * 7, y - h - 8, x + 3 + k * 11, y - h + 2); g.stroke();
        }
      }
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = linear(g, 0, 120, 0, 230, [0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,1)']);
      g.fillRect(0, 0, 560, 230);
      g.globalCompositeOperation = 'source-over';
    }

    function paintShaft(g) {
      g.save();
      g.transform(1, 0, -0.26, 1, 0, 0);
      g.fillStyle = linear(g, 0, 0, 120, 0, [0, 'rgba(255,255,230,0)', 0.5, 'rgba(255,255,230,0.55)', 1, 'rgba(255,255,230,0)']);
      g.fillRect(0, 0, 120, height * 0.8);
      g.restore();
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = linear(g, 0, 0, 0, height * 0.8, [0, 'rgba(0,0,0,1)', 0.6, 'rgba(0,0,0,0.4)', 1, 'rgba(0,0,0,0)']);
      g.fillRect(-200, 0, 700, height * 0.8);
      g.globalCompositeOperation = 'source-over';
    }

    // Viñeta en tres franjas (izquierda, derecha y abajo): cubre pocos píxeles.
    function paintVignetteSide(g, flip) {
      g.fillStyle = linear(g, flip ? 56 : 0, 0, flip ? 0 : 56, 0, [0, 'rgba(6,30,44,0.5)', 0.5, 'rgba(6,30,44,0.16)', 1, 'rgba(6,30,44,0)']);
      g.fillRect(0, 0, 56, 128);
    }

    function paintVignetteBottom(g) {
      g.fillStyle = linear(g, 0, 128, 0, 0, [0, 'rgba(6,30,44,0.5)', 0.5, 'rgba(6,30,44,0.16)', 1, 'rgba(6,30,44,0)']);
      g.fillRect(0, 0, 128, 128);
    }

    function paintFog(g, index) {
      const haze = palettes[index].haze;
      g.fillStyle = linear(g, 0, 0, 0, 64, [0, rgba(haze, 0.5), 0.45, rgba(haze, 0.2), 1, rgba(haze, 0)]);
      g.fillRect(0, 0, 8, 64);
    }

    // ---------- Registro de sprites ----------
    const named = {
      shadow: () => sprite('shadow', 80, 40, 40, 20, paintShadow),
      rider: () => sprite('rider', 56, 50, 28, 30, paintRider),
      blade: () => sprite('blade', 20, 40, 10, 20, paintBlade),
      bowWave: () => sprite('bowWave', 110, 60, 55, 10, paintBowWave),
      foam: () => sprite('foam', 32, 32, 16, 16, paintFoamPuff),
      crest: () => sprite('crest', 80, 28, 40, 14, paintCrest),
      glint: () => sprite('glint', 24, 24, 12, 12, paintGlint),
      palm0: () => sprite('palm0', 176, 250, 86, 228, g => paintPalm(g, 0)),
      palm1: () => sprite('palm1', 176, 250, 86, 228, g => paintPalm(g, 1)),
      palm2: () => sprite('palm2', 176, 220, 86, 198, g => paintPalm(g, 2)),
      jungle0: () => sprite('jungle0', 130, 130, 60, 110, g => paintJungle(g, 0)),
      jungle1: () => sprite('jungle1', 130, 130, 60, 110, g => paintJungle(g, 1)),
      bush0: () => sprite('bush0', 80, 54, 40, 40, g => paintBush(g, 0)),
      bush1: () => sprite('bush1', 80, 54, 40, 40, g => paintBush(g, 1)),
      fern: () => sprite('fern', 80, 50, 40, 36, paintFern),
      bankRocks: () => sprite('bankRocks', 70, 40, 35, 30, paintBankRocks),
      reeds: () => sprite('reeds', 50, 60, 25, 52, paintReeds),
      rock0: () => sprite('rock0', 100, 80, 50, 40, g => paintRock(g, 0)),
      rock1: () => sprite('rock1', 100, 80, 50, 40, g => paintRock(g, 1)),
      rock2: () => sprite('rock2', 100, 80, 50, 40, g => paintRock(g, 2)),
      wakeTail: () => sprite('wakeTail', 100, 80, 50, 4, paintWakeTail),
      log0: () => sprite('log0', 110, 70, 55, 35, g => paintLog(g, 0)),
      log1: () => sprite('log1', 110, 70, 55, 35, g => paintLog(g, 1)),
      driftMark: () => sprite('driftMark', 40, 28, 20, 14, paintDriftMark),
      petal0: () => sprite('petal0', 20, 14, 10, 7, g => paintPetal(g, 0)),
      petal1: () => sprite('petal1', 20, 14, 10, 7, g => paintPetal(g, 1)),
      petal2: () => sprite('petal2', 24, 14, 6, 7, g => paintPetal(g, 2)),
      coin: () => sprite('coin', 36, 36, 18, 18, paintCoin),
      glow: () => sprite('glow', 76, 76, 38, 38, paintGlow),
      sparkle: () => sprite('sparkle', 28, 28, 14, 14, paintSparkle),
      shield: () => sprite('shield', 140, 140, 70, 70, paintShield),
      backdrop: () => sprite('backdrop', 560, 230, 0, 0, paintBackdrop),
      shaft: () => sprite('shaft', 260, height * 0.8, 0, 0, paintShaft),
      vignetteL: () => sprite('vignetteL', 56, 128, 0, 0, g => paintVignetteSide(g, false)),
      vignetteR: () => sprite('vignetteR', 56, 128, 0, 0, g => paintVignetteSide(g, true)),
      vignetteB: () => sprite('vignetteB', 128, 128, 0, 0, paintVignetteBottom),
      fog0: () => sprite('fog0', 8, 64, 0, 0, g => paintFog(g, 0)),
      fog1: () => sprite('fog1', 8, 64, 0, 0, g => paintFog(g, 1)),
      fog2: () => sprite('fog2', 8, 64, 0, 0, g => paintFog(g, 2)),
      fog3: () => sprite('fog3', 8, 64, 0, 0, g => paintFog(g, 3))
    };
    const hullKeys = Object.create(null);
    const dropKeys = Object.create(null);

    function S(name) {
      return sprites[name] || named[name]();
    }

    function hullSprite(style) {
      let key = hullKeys[style.id];
      if (!key) key = hullKeys[style.id] = `hull-${style.id}`;
      return sprites[key] || sprite(key, 108, 132, 54, 70, g => paintHull(g, style));
    }

    function dropSprite(color) {
      let key = dropKeys[color];
      if (!key) key = dropKeys[color] = `drop-${color}`;
      return sprites[key] || sprite(key, 20, 20, 10, 10, g => paintDrop(g, color));
    }

    function buildTiles() {
      tiles = { caustic: [], grass: makeCanvas(Math.ceil(128 * spriteScale), Math.ceil(128 * spriteScale)) };
      patterns = [];
      pattern = null;
      grassPattern = null;
      for (const size of CAUSTIC_SIZES) {
        const element = makeCanvas(Math.ceil(size * spriteScale), Math.ceil(size * spriteScale));
        if (!element) continue;
        const g = element.getContext('2d');
        g.scale(spriteScale, spriteScale);
        paintCausticTile(g, size);
        tiles.caustic.push(element);
        patterns.push(ctx.createPattern(element, 'repeat'));
      }
      if (patterns.length) pattern = patterns[0];
      if (tiles.grass) {
        const g = tiles.grass.getContext('2d');
        g.scale(spriteScale, spriteScale);
        paintGrassTile(g);
        grassPattern = ctx.createPattern(tiles.grass, 'repeat');
      }
    }

    // ---------- Tamaño, calidad y animación ----------
    const DROP_COLORS = ['#e7ffff', '#c9f7f2', '#ffffff', '#ffdf85'];
    let knownStyles = [];

    // Construye todos los sprites de antemano para que no haya tirones a mitad de partida.
    function warm() {
      for (const key in named) S(key);
      for (const color of DROP_COLORS) dropSprite(color);
      for (const style of knownStyles) hullSprite(style);
    }

    function prepare(styles) {
      knownStyles = styles;
      if (tiles) warm();
    }

    function resize(nextHeight, scale) {
      height = nextHeight;
      renderScale = scale || 1;
      const nextSpriteScale = clamp(Math.round(renderScale * 4) / 4, 1, 2);
      if (nextSpriteScale !== spriteScale || !tiles) {
        spriteScale = nextSpriteScale;
        sprites = Object.create(null);
        buildTiles();
        warm();
      } else {
        delete sprites.vignetteL;
        delete sprites.vignetteR;
        delete sprites.vignetteB;
        delete sprites.shaft;
        warm();
      }
      waterStyle = null;
      debug.scale = renderScale;
    }

    function setQuality(value) {
      quality = value === 'low' ? 'low' : 'high';
      detail = quality === 'low' ? 0 : Math.min(requested, 2);
    }

    // Nivel de detalle automático (0 mínimo, 2 máximo); la calidad reducida lo fija en 0.
    function setDetail(level) {
      requested = clamp(level, 0, 2);
      detail = quality === 'low' ? 0 : requested;
    }

    function update(dt, speed, scene) {
      time += dt;
      flowSpeed += (speed - flowSpeed) * Math.min(1, dt * 3);
      flow += flowSpeed * dt;
      boatPhase += dt * (9 + flowSpeed / 100);
      cameraX = scene.cameraX;
      if (scene.stageIndex !== stageTo) {
        stageFrom = stageMix >= 1 ? stageTo : stageFrom;
        stageTo = scene.stageIndex;
        stageMix = 0;
        waterStyle = null;
      }
      if (stageMix < 1) {
        stageMix = Math.min(1, stageMix + dt / 2.2);
        if (stageMix >= 1) waterStyle = null;
      }
      for (let i = 0; i < MAX_EFFECTS; i++) {
        const item = effects[i];
        if (!item.active) continue;
        item.age += dt;
        if (item.age >= item.life) item.active = false;
      }
      for (let i = 0; i < MAX_SPARKLES; i++) {
        const spark = sparkles[i];
        if (!spark.active) continue;
        spark.age += dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vy += 70 * dt;
        if (spark.age >= spark.life) spark.active = false;
      }
    }

    function spawnEffect(kind, x, y, size, life) {
      for (let i = 0; i < MAX_EFFECTS; i++) {
        const item = effects[i];
        if (item.active) continue;
        item.active = true;
        item.kind = kind;
        item.x = x;
        item.y = y;
        item.size = size;
        item.age = 0;
        item.life = life;
        return;
      }
    }

    function spawnSparkles(x, y, count, speed) {
      const limit = quality === 'low' ? Math.ceil(count / 2) : count;
      let made = 0;
      for (let i = 0; i < MAX_SPARKLES && made < limit; i++) {
        const spark = sparkles[i];
        if (spark.active) continue;
        const angle = (made / limit) * TAU + hash(i, Math.floor(time * 60)) * 0.8;
        spark.active = true;
        spark.x = x;
        spark.y = y;
        spark.vx = Math.cos(angle) * speed * (0.6 + hash(i, 5) * 0.6);
        spark.vy = Math.sin(angle) * speed * (0.6 + hash(i, 6) * 0.6) - 30;
        spark.age = 0;
        spark.life = 0.5 + hash(i, 7) * 0.4;
        spark.size = 0.7 + hash(i, 8) * 0.7;
        made++;
      }
    }

    // x es la posición lógica del juego; y, la de pantalla.
    function effect(kind, x, y) {
      if (kind === 'coin') {
        spawnEffect(0, x, y, 30, 0.55);
        spawnSparkles(x, y, 9, 130);
      } else if (kind === 'hit') {
        spawnEffect(1, x, y, 70, 0.7);
        spawnEffect(0, x, y, 44, 0.5);
        spawnSparkles(x, y, 12, 170);
      } else if (kind === 'shield') {
        spawnEffect(0, x, y, 52, 0.6);
        spawnSparkles(x, y, 8, 120);
      } else if (kind === 'stage') {
        spawnEffect(1, x, y, 150, 1.1);
        spawnSparkles(x, y, 18, 210);
      }
    }

    // ---------- Dibujo ----------
    function waterPalette() {
      const from = palettes[stageFrom];
      const to = palettes[stageTo];
      if (stageMix >= 1) return to;
      return {
        water: [mixColor(from.water[0], to.water[0], stageMix), mixColor(from.water[1], to.water[1], stageMix), mixColor(from.water[2], to.water[2], stageMix)],
        shallow: to.shallow, haze: to.haze, tint: to.tint, sun: to.sun, sand: to.sand
      };
    }

    let waterStyle = null;
    let transitionStyle = false;
    const SPACING = 74;
    let detail = 2;

    // El agua se dibuja sin recortes (un clip con forma de trapecio es muy caro en Canvas):
    // sus detalles pueden sobresalir un poco y la tierra se pinta encima después.
    function riverPath(margin) {
      ctx.beginPath();
      ctx.moveTo(edgeX(0, 0) - margin, 0);
      ctx.lineTo(edgeX(1, 0) + margin, 0);
      ctx.lineTo(edgeX(1, height) + margin, height);
      ctx.lineTo(edgeX(0, height) - margin, height);
      ctx.closePath();
    }

    function drawShallows(pal) {
      // Bajíos claros y sombra de la orilla izquierda (el sol viene de arriba a la izquierda).
      const d0 = depthAt(0);
      const d1 = depthAt(height);
      for (let side = 0; side < 2; side++) {
        const dir = side ? -1 : 1;
        const e0 = edgeX(side, 0);
        const e1 = edgeX(side, height);
        ctx.fillStyle = pal.shallow;
        ctx.globalAlpha = detail === 0 ? 0.4 : 0.34;
        ctx.beginPath();
        ctx.moveTo(e0, 0); ctx.lineTo(e0 + dir * (detail === 0 ? 22 : 30) * d0, 0); ctx.lineTo(e1 + dir * (detail === 0 ? 22 : 30) * d1, height); ctx.lineTo(e1, height);
        ctx.closePath(); ctx.fill();
        if (detail === 0) continue;
        ctx.globalAlpha = 0.30;
        ctx.beginPath();
        ctx.moveTo(e0, 0); ctx.lineTo(e0 + dir * 13 * d0, 0); ctx.lineTo(e1 + dir * 13 * d1, height); ctx.lineTo(e1, height);
        ctx.closePath(); ctx.fill();
        if (side === 0) {
          ctx.fillStyle = '#06323f';
          ctx.globalAlpha = 0.20;
          ctx.beginPath();
          ctx.moveTo(e0 + 30 * d0, 0); ctx.lineTo(e0 + 66 * d0, 0); ctx.lineTo(e1 + 66 * d1, height); ctx.lineTo(e1 + 30 * d1, height);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawWater(pal) {
      if (!waterStyle) {
        waterStyle = ctx.createLinearGradient(0, 0, 0, height);
        waterStyle.addColorStop(0, pal.water[0]);
        waterStyle.addColorStop(0.42, pal.water[1]);
        waterStyle.addColorStop(1, pal.water[2]);
        transitionStyle = stageMix < 1;
      }
      ctx.fillStyle = waterStyle;
      riverPath(6);
      ctx.fill();
      if (transitionStyle) waterStyle = null;
      drawShallows(pal);
      // Cáusticas: bandas con escala creciente hacia el espectador (perspectiva).
      if (pattern && detail >= 2) {
        ctx.globalAlpha = 0.12;
        const bands = patterns.length;
        const bandHeight = height / bands;
        for (let band = 0; band < bands; band++) {
          const top = band * bandHeight;
          const size = CAUSTIC_SIZES[band];
          const tx = snap(Math.sin(time * 0.4 + band) * 8 - cameraX * 0.2);
          const ty = snap((flow * 0.6 * (0.55 + (band + 0.5) / bands * 0.55)) % size);
          const left = edgeX(0, top + bandHeight * 0.5) - 4;
          const right = edgeX(1, top + bandHeight * 0.5) + 4;
          ctx.fillStyle = patterns[band];
          ctx.save();
          ctx.translate(tx, ty);
          ctx.fillRect(left - tx, top - ty, right - left, bandHeight + 1);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      // Crestas de espuma que bajan con la corriente.
      const crest = S('crest');
      const spacing = 112;
      const base = Math.floor((flow * 0.95) / spacing);
      const cols = detail >= 1 ? 2 : 1;
      for (let n = base + Math.ceil(height / spacing) + 2; n >= base - 1; n--) {
        const y = n * spacing - flow * 0.95 + height * 0.1;
        if (y < -30 || y > height + 30) continue;
        const d = depthAt(y);
        for (let c = 0; c < cols; c++) {
          const lateral = (hash(n, 200 + c) - 0.5) * 190 + (c ? 70 : -60);
          putFlat(crest, projectX(WIDTH / 2 + lateral, y), y, d * 1.05, d * 1.05, 0.85);
        }
      }
      if (detail >= 2) {
        // Destellos del sol sobre el agua.
        ctx.globalCompositeOperation = 'lighter';
        const glint = S('glint');
        const gspacing = 150;
        const gbase = Math.floor((flow * 0.8) / gspacing);
        for (let n = gbase + Math.ceil(height / gspacing) + 1; n >= gbase - 1; n--) {
          const y = n * gspacing - flow * 0.8;
          if (y < -20 || y > height + 20) continue;
          for (let c = 0; c < 2; c++) {
            const tw = 0.5 + 0.5 * Math.sin(time * 3.2 + n * 1.7 + c * 2.3);
            if (tw < 0.35) continue;
            putFlat(glint, projectX(WIDTH / 2 + (hash(n, 300 + c) - 0.5) * 220, y), y + c * 30, depthAt(y) * tw * 1.05, depthAt(y) * tw * 1.05, tw);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawLand() {
      const l0 = edgeX(0, 0);
      const l1 = edgeX(0, height);
      const r0 = edgeX(1, 0);
      const r1 = edgeX(1, height);
      const scroll = snap(flow % 128);
      const shift = snap(cameraX);
      ctx.save();
      ctx.translate(-shift, scroll);
      ctx.fillStyle = detail >= 1 && grassPattern ? grassPattern : '#2f9a52';
      ctx.beginPath();
      ctx.moveTo(-12 + shift, -scroll); ctx.lineTo(l0 + shift, -scroll); ctx.lineTo(l1 + shift, height - scroll); ctx.lineTo(-12 + shift, height - scroll);
      ctx.closePath();
      ctx.moveTo(r0 + shift, -scroll); ctx.lineTo(WIDTH + 12 + shift, -scroll); ctx.lineTo(WIDTH + 12 + shift, height - scroll); ctx.lineTo(r1 + shift, height - scroll);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (detail >= 2) {
        // Montañas lejanas solo sobre la tierra (un único recorte pequeño).
        const reach = 230;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(l0, 0); ctx.lineTo(edgeX(0, reach), reach); ctx.lineTo(-12, reach); ctx.closePath();
        ctx.moveTo(r0, 0); ctx.lineTo(WIDTH + 12, 0); ctx.lineTo(WIDTH + 12, reach); ctx.lineTo(edgeX(1, reach), reach); ctx.closePath();
        ctx.clip();
        putFlat(S('backdrop'), -55 - cameraX * 0.35, 0, 1, 1, 1);
        ctx.restore();
      }
    }

    function drawBanks(pal) {
      const mid = depthAt(height * 0.5);
      const d0 = depthAt(0);
      const d1 = depthAt(height);
      const foam = S('foam');
      for (let side = 0; side < 2; side++) {
        const dir = side ? 1 : -1;
        const e0 = edgeX(side, 0);
        const e1 = edgeX(side, height);
        ctx.fillStyle = pal.sand[0];
        ctx.beginPath();
        ctx.moveTo(e0, 0); ctx.lineTo(e0 + dir * 30 * d0, 0); ctx.lineTo(e1 + dir * 30 * d1, height); ctx.lineTo(e1, height);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.sand[1];
        ctx.beginPath();
        ctx.moveTo(e0, 0); ctx.lineTo(e0 + dir * 8 * d0, 0); ctx.lineTo(e1 + dir * 8 * d1, height); ctx.lineTo(e1, height);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 7 * mid;
        ctx.beginPath(); ctx.moveTo(e0 - dir * 2 * d0, 0); ctx.lineTo(e1 - dir * 2 * d1, height); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2.4 * mid;
        ctx.beginPath(); ctx.moveTo(e0 - dir * 3 * d0, 0); ctx.lineTo(e1 - dir * 3 * d1, height); ctx.stroke();
        if (detail >= 1) {
          // Rizos de espuma que bajan con la corriente por la orilla.
          const gap = 92;
          const first = Math.floor(flow * 0.9 / gap);
          for (let n = first + Math.ceil(height / gap) + 1; n >= first - 1; n--) {
            const y = n * gap - flow * 0.9;
            if (y < -20 || y > height + 20) continue;
            const d = depthAt(y);
            putFlat(foam, edgeX(side, y) - dir * (3 + hash(n, side + 400) * 7) * d, y, d * 0.9, d * 0.55, 0.8);
          }
        }
      }
    }

    const palmNames = ['palm0', 'palm1', 'palm2'];
    const jungleNames = ['jungle0', 'jungle1'];

    function drawVegetation() {
      const step = detail === 0 ? 2 : 1;
      const first = Math.floor((flow - height - 100) / SPACING);
      const last = Math.ceil((flow + 160) / SPACING);
      const reeds = S('reeds');
      for (let n = last; n >= first; n--) {
        if (step === 2 && (n & 1)) continue;
        const y = flow - n * SPACING;
        if (y < -170 || y > height + 60) continue;
        const d = depthAt(y);
        for (let side = 0; side < 2; side++) {
          const dir = side ? 1 : -1;
          const salt = side * 13;
          const edge = edgeX(side, y);
          if (hash(n, salt + 9) < 0.26) putFlat(reeds, edge - dir * 4 * d, y + 3 * d, d * 0.95, d * 0.95, 1);
          const under = hash(n, salt + 5);
          if (under < 0.72) {
            const lateral = 36 + hash(n, salt + 6) * 30;
            const name = under < 0.3 ? 'bush0' : under < 0.43 ? 'bush1' : under < 0.58 ? 'fern' : 'bankRocks';
            const k = d * (0.9 + hash(n, salt + 7) * 0.35);
            putFlat(S(name), edge + dir * lateral * d, y + 6 * d, k, k, 1);
          }
          const tree = hash(n, salt + 1);
          if (tree < 0.64) {
            const lateral = 44 + hash(n, salt + 2) * 62;
            const k = d * (0.74 + hash(n, salt + 3) * 0.32);
            const name = tree < 0.42 ? palmNames[Math.floor(hash(n, salt + 4) * 3) % 3] : jungleNames[Math.floor(hash(n, salt + 4) * 2) % 2];
            putFlat(S(name), edge + dir * lateral * d, y, k, k, 1);
          }
        }
      }
    }

    function drawObstacle(item) {
      const d = depthAt(item.y);
      const x = projectX(item.x, item.y);
      const y = item.y + Math.sin(time * 3 + item.phase) * 2.2;
      debug.counts[item.kind === 'rock' ? 'rock' : item.kind === 'drift' ? 'drift' : 'log']++;
      if (item.kind === 'rock') {
        const k = d * item.radius / 22;
        const variant = Math.floor(item.phase / (TAU / 3)) % 3;
        if (detail >= 1) putFlat(S('wakeTail'), x, y + 6 * k, k * 1.1, k * 1.15, 0.5 + 0.2 * Math.sin(time * 5 + item.phase));
        ctx.strokeStyle = '#f2ffff';
        ctx.lineWidth = 2.2 * d;
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 4 + item.phase);
        ctx.beginPath();
        ctx.ellipse(x, y + 10 * k, (item.radius + 10 + Math.sin(time * 4 + item.phase) * 2) * d, (item.radius * 0.5 + 5) * d, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        putFlat(S(variant === 0 ? 'rock0' : variant === 1 ? 'rock1' : 'rock2'), x, y, k, k, 1);
      } else {
        const rotation = Math.sin(time * 2 + item.phase) * 0.1 + 0.18;
        const flip = item.vx < 0 ? -1 : 1;
        if (detail >= 1) putFlat(S('wakeTail'), x - 2 * d, y + 14 * d, d * 1.25, d * 1.1, 0.45 + 0.2 * Math.sin(time * 5 + item.phase));
        const log = S(item.kind === 'drift' ? 'log1' : 'log0');
        put(log, x, y, d, d, rotation, 1);
        if (item.kind === 'drift') put(S('driftMark'), x + flip * 12 * d, y + 1 * d, d * flip, d, rotation, 1);
      }
    }

    function drawCollectibles(list) {
      for (let i = 0; i < list.length; i++) {
        const coin = list[i];
        debug.counts.coin++;
        const d = depthAt(coin.y);
        const x = projectX(coin.x, coin.y);
        const y = coin.y + Math.sin(time * 5 + coin.phase) * 3;
        const spin = 0.28 + 0.72 * Math.abs(Math.cos(time * 3.4 + coin.phase * 3));
        ctx.strokeStyle = '#fff2ae';
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2 * d;
        ctx.beginPath();
        ctx.ellipse(x, y + 14 * d, 19 * d, 7 * d, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        putFlat(S('shadow'), x + 5 * d, y + 18 * d, 0.5 * d, 0.5 * d, 0.7);
        ctx.globalCompositeOperation = 'lighter';
        putFlat(S('glow'), x, y, d * 1.05, d * 1.05, 0.55 + 0.25 * Math.sin(time * 6 + coin.phase));
        ctx.globalCompositeOperation = 'source-over';
        putFlat(S('coin'), x, y, d * spin, d, 1);
        const tw = Math.sin(time * 7 + coin.phase * 5);
        if (tw > 0.6) {
          ctx.globalCompositeOperation = 'lighter';
          putFlat(S('sparkle'), x + 7 * d, y - 8 * d, d * (tw - 0.3), d * (tw - 0.3), 1);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    function drawWake(scene) {
      const boat = scene.boat;
      const x = projectX(boat.x, boat.y);
      const turn = boat.vx / 285;
      const d = depthAt(boat.y);
      const length = 44 + scene.riverSpeed * 0.07 + Math.abs(turn) * 20;
      ctx.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        ctx.strokeStyle = 'rgba(240,255,255,0.62)';
        ctx.lineWidth = (3 + Math.abs(turn) * 2) * d;
        ctx.beginPath();
        ctx.moveTo(x + side * 25 * d, boat.y + 26 * d);
        ctx.quadraticCurveTo(x + side * 37 * d - turn * 12, boat.y + length * 0.65,
          x + side * (44 + Math.abs(turn) * 10) * d - turn * 18, boat.y + length);
        ctx.stroke();
      }
      const foam = S('foam');
      const puffs = detail === 0 ? 3 : 6;
      for (let i = 0; i < puffs; i++) {
        const t = (i + 0.5) / puffs;
        const spread = (10 + t * 24) * d;
        const sway = turn * t * 24;
        const size = (0.7 + t * 0.9) * d;
        const alpha = 0.75 * (1 - t);
        putFlat(foam, x - spread - sway, boat.y + (30 + t * length * 0.9) * d, size, size, alpha);
        putFlat(foam, x + spread - sway, boat.y + (30 + t * length * 0.9) * d, size, size, alpha);
      }
    }

    function drawBoat(scene) {
      const boat = scene.boat;
      const d = depthAt(boat.y);
      const bx = projectX(boat.x, boat.y);
      const by = boat.y + Math.sin(time * 7) * 2.5;
      debug.boatX = bx;
      debug.boatY = by;
      debug.hull = scene.boatStyle.id;
      const flicker = scene.immunity > 0 && Math.floor(scene.immunity * 10) % 2 === 0;
      if (flicker) return;
      const tilt = boat.tilt + Math.sin(time * 3) * 0.025;
      const speedFactor = clamp(scene.riverSpeed / 390, 0, 1);
      putFlat(S('shadow'), bx + 9 * d, by + 26 * d, 1.7 * d, 1.5 * d, 0.85);
      // Anillo de espuma en la línea de flotación y ola de proa.
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(tilt);
      ctx.scale(d, d);
      ctx.strokeStyle = '#f2ffff';
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.1;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 3, 50, 63, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
      putFlat(S('bowWave'), bx, by - 50 * d, d * (0.75 + speedFactor * 0.5), d * (0.75 + speedFactor * 0.5), 0.5 + speedFactor * 0.4);
      put(hullSprite(scene.boatStyle), bx, by, d, d, tilt, 1);
      put(S('rider'), bx, by + 8 * d, d, d, boat.lean, 1);
      // Remo doble y brazos.
      const stroke = Math.sin(boatPhase) * (0.65 + Math.abs(boat.vx) / 950);
      const angle = stroke * 0.5;
      const reach = 52;
      const lx = -reach * Math.cos(angle);
      const ly = 12 - reach * Math.sin(angle);
      const rx = reach * Math.cos(angle);
      const ry = 12 + reach * Math.sin(angle);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(tilt);
      ctx.scale(d, d);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5e3822';
      ctx.lineWidth = 5.4;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
      ctx.strokeStyle = '#d9a066';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ly - 1); ctx.lineTo(rx, ry - 1); ctx.stroke();
      ctx.strokeStyle = '#e0604f';
      ctx.lineWidth = 6.5;
      ctx.beginPath(); ctx.moveTo(-12, 9); ctx.lineTo(-17 + stroke * 2, 12 - stroke * 5 + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 9); ctx.lineTo(17 + stroke * 2, 12 + stroke * 5 + 2); ctx.stroke();
      ctx.fillStyle = '#e9a77a';
      ctx.beginPath(); ctx.arc(-17 + stroke * 2, 14 - stroke * 5, 3.4, 0, TAU); ctx.arc(17 + stroke * 2, 14 + stroke * 5, 3.4, 0, TAU); ctx.fill();
      ctx.restore();
      const blade = S('blade');
      put(blade, bx + (lx * Math.cos(tilt) - ly * Math.sin(tilt)) * d, by + (lx * Math.sin(tilt) + ly * Math.cos(tilt)) * d, d, d, tilt - angle * 0.6, 1);
      put(blade, bx + (rx * Math.cos(tilt) - ry * Math.sin(tilt)) * d, by + (rx * Math.sin(tilt) + ry * Math.cos(tilt)) * d, d, d, tilt + angle * 0.6, 1);
      const dip = Math.abs(stroke) > 0.5 ? (stroke > 0 ? 1 : -1) : 0;
      if (dip) {
        const ex = dip > 0 ? rx : lx;
        const ey = dip > 0 ? ry : ly;
        putFlat(S('foam'), bx + (ex * Math.cos(tilt) - ey * Math.sin(tilt)) * d, by + (ex * Math.sin(tilt) + ey * Math.cos(tilt)) * d + 10 * d, d * 1.1, d * 0.8, 0.8);
      }
      if (scene.shieldTimer > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 1 + Math.sin(time * 8) * 0.03;
        put(S('shield'), bx, by + 2 * d, d * pulse, d * pulse, time * 0.9, scene.shieldTimer < 1 ? 0.5 + 0.5 * Math.sin(time * 24) : 0.95);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawParticles(list) {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const d = depthAt(p.y);
        const k = (p.radius * d * (1 + p.age)) / 6;
        putFlat(dropSprite(p.color), projectX(p.x, p.y), p.y, k, k, Math.max(0, 1 - p.age / p.life));
      }
    }

    const petalNames = ['petal0', 'petal1', 'petal2'];

    // Líneas de velocidad en la corriente rápida: un solo trazo con ocho rayas.
    function drawSpeedLines(speed) {
      const amount = clamp((speed - 250) / 140, 0, 1);
      if (amount <= 0) return;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.32 * amount;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const y = ((time * (420 + hash(i, 600) * 260) + hash(i, 601) * height) % (height + 140)) - 70;
        const d = depthAt(y);
        const x = projectX(WIDTH / 2 + (hash(i, 602) - 0.5) * 250, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + (36 + hash(i, 603) * 50) * d);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Pétalos y hojas que flotan por la escena y, al atardecer, luciérnagas (nivel máximo).
    function drawAmbient(scene) {
      if (detail < 2) return;
      drawSpeedLines(scene.riverSpeed);
      if (stageTo === 3) {
        ctx.globalCompositeOperation = 'lighter';
        const glow = S('glow');
        for (let i = 0; i < 9; i++) {
          const x = WIDTH * (0.12 + 0.76 * hash(i, 610)) + Math.sin(time * 0.7 + i * 2.3) * 26;
          const y = height * (0.25 + 0.6 * hash(i, 611)) + Math.cos(time * 0.9 + i * 1.7) * 22;
          const blink = 0.5 + 0.5 * Math.sin(time * 2.6 + i * 3.1);
          putFlat(glow, x, y, 0.28 * (0.6 + blink * 0.5), 0.28 * (0.6 + blink * 0.5), 0.35 + 0.65 * blink);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let i = 0; i < 6; i++) {
        const speed = 22 + hash(i, 500) * 22;
        const y = ((time * speed + hash(i, 501) * (height + 60)) % (height + 60)) - 30;
        const x = ((hash(i, 502) * WIDTH + time * (6 + hash(i, 503) * 10)) % (WIDTH + 40)) - 20 + Math.sin(time * 0.9 + i * 1.7) * 14;
        const flutter = 0.55 + 0.45 * Math.sin(time * 2.2 + i * 2.1);
        const d = depthAt(y);
        putFlat(S(petalNames[i % 3]), x, y, d * 0.9, d * 0.9 * flutter, 0.85);
      }
    }

    function drawEffects() {
      for (let i = 0; i < MAX_EFFECTS; i++) {
        const item = effects[i];
        if (!item.active) continue;
        const t = item.age / item.life;
        const x = projectX(item.x, item.y);
        const d = depthAt(item.y);
        ctx.strokeStyle = item.kind === 1 ? '#fff4d0' : '#ffffff';
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.lineWidth = (item.kind === 1 ? 4 : 2.6) * (1 - t) + 0.6;
        ctx.beginPath();
        ctx.ellipse(x, item.y + 8 * d, item.size * (0.25 + t) * d, item.size * (0.25 + t) * d * 0.5, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      const sparkle = S('sparkle');
      for (let i = 0; i < MAX_SPARKLES; i++) {
        const spark = sparkles[i];
        if (!spark.active) continue;
        const t = spark.age / spark.life;
        const k = spark.size * (1 - t * 0.6) * depthAt(spark.y);
        putFlat(sparkle, projectX(spark.x, spark.y), spark.y, k, k, 1 - t);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const fogNames = ['fog0', 'fog1', 'fog2', 'fog3'];
    let tintKey = null;
    let tintText = '';
    function tintStyle(tint) {
      if (tintKey !== tint[0] * 1e9 + tint[1] * 1e6 + tint[2] * 1e3 + tint[3]) {
        tintKey = tint[0] * 1e9 + tint[1] * 1e6 + tint[2] * 1e3 + tint[3];
        tintText = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`;
      }
      return tintText;
    }

    function drawLighting(pal, scene) {
      if (detail === 0) {
        if (scene.impact > 0) drawImpact(scene);
        return;
      }
      const fogA = S(fogNames[stageTo]);
      if (stageMix < 1) {
        putFlat(S(fogNames[stageFrom]), 0, 0, WIDTH / 8, height * 0.3 / 64, 1 - stageMix);
        putFlat(fogA, 0, 0, WIDTH / 8, height * 0.3 / 64, stageMix);
      } else putFlat(fogA, 0, 0, WIDTH / 8, height * 0.3 / 64, 1);
      if (detail >= 2 && !skip.shafts) {
        ctx.globalCompositeOperation = 'lighter';
        putFlat(S('shaft'), 60 + Math.sin(time * 0.17) * 30 - cameraX * 0.5, 0, 1, 1, pal.sun * (0.8 + 0.2 * Math.sin(time * 0.5)) * 1.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (detail >= 2) {
        const tint = pal.tint;
        ctx.fillStyle = tintStyle(tint);
        ctx.fillRect(0, 0, WIDTH, height);
      }
      if (detail >= 2 && !skip.vignette) {
        putFlat(S('vignetteL'), 0, 0, 0.8, height / 128, 1);
        putFlat(S('vignetteR'), WIDTH - 45, 0, 0.8, height / 128, 1);
        putFlat(S('vignetteB'), 0, height - 70, WIDTH / 128, 0.55, 1);
      }
      if (stageMix < 0.4 && detail >= 1 && stageTo > 0) {
        ctx.fillStyle = '#fffbe0';
        ctx.globalAlpha = 0.22 * (1 - stageMix / 0.4);
        ctx.fillRect(0, 0, WIDTH, height);
        ctx.globalAlpha = 1;
      }
      if (scene.impact > 0) drawImpact(scene);
    }

    function drawImpact(scene) {
      ctx.fillStyle = '#ffe2d0';
      ctx.globalAlpha = Math.min(0.32, scene.impact * 0.26);
      ctx.fillRect(0, 0, WIDTH, height);
      ctx.globalAlpha = 1;
    }

    // Solo para medir: fuerza el vaciado del lienzo y acumula el tiempo de cada pasada.
    let markTime = 0;
    function mark(name) {
      ctx.getImageData(0, 0, 1, 1);
      const now = performance.now();
      debug.timings[name] = (debug.timings[name] || 0) + (now - markTime);
      markTime = now;
    }

    function draw(scene) {
      if (debug.timings) { ctx.getImageData(0, 0, 1, 1); markTime = performance.now(); }
      debug.frames++;
      debug.drawn = 0;
      debug.detail = detail;
      cameraX = scene.cameraX;
      const pal = waterPalette();
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      ctx.save();
      if (scene.impact > 0) ctx.translate((hash(debug.frames, 1) - 0.5) * scene.impact * 13, (hash(debug.frames, 2) - 0.5) * scene.impact * 13);
      const probe = debug.timings;
      if (!skip.water) drawWater(pal);
      if (probe) mark('water');
      if (!skip.land) drawLand();
      if (probe) mark('land');
      if (!skip.banks) drawBanks(pal);
      if (probe) mark('banks');
      if (!skip.vegetation) drawVegetation();
      if (probe) mark('vegetation');
      if (!skip.wake) drawWake(scene);
      if (!skip.coins) drawCollectibles(scene.collectibles);
      if (probe) mark('wake+coins');
      // Todo avanza a la misma velocidad: el más nuevo (arriba) está más lejos.
      const list = scene.obstacles;
      const boat = scene.boat;
      let boatDrawn = false;
      let foreground = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        if (!boatDrawn && list[i].y > boat.y) {
          drawParticles(scene.particles);
          drawBoat(scene);
          boatDrawn = true;
        }
        if (boatDrawn) foreground++;
        drawObstacle(list[i]);
      }
      debug.foreground = foreground;
      if (!boatDrawn) {
        drawParticles(scene.particles);
        drawBoat(scene);
      }
      if (probe) mark('objects');
      drawAmbient(scene);
      drawEffects();
      ctx.restore();
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      if (probe) mark('effects');
      if (!skip.lighting) drawLighting(pal, scene);
      if (probe) mark('lighting');
      debug.drawnLast = debug.drawn;
    }

    return { resize, prepare, setQuality, setDetail, update, draw, effect, debug, depthAt, projectX, sprite: S, hullSprite };
  }

  let lastInstance = null;
  const factory = options => { lastInstance = create(options); return lastInstance; };
  window.RioArt = { create: factory, palettes, hash, get instance() { return lastInstance; } };
})();
