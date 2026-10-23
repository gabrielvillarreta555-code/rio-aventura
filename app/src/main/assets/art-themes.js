// Temas visuales de las rutas de Río Aventura 2.5: un aspecto propio para cada destino.
// Solo datos y pinturas de sprites. art.js decide cuándo dibujarlos; aquí no hay reglas de juego
// y no se toca la física ni las colisiones (las rocas y troncos siguen siendo los mismos radios).
// Cada tema tiene 3 paletas, una por tramo de la ruta, y define el hito que aparece al llegar.
// Todo es procedural y original, y se pinta una sola vez en lienzos ocultos.
(() => {
  'use strict';
  const art = window.RioArt;
  const h = art.helpers;
  const TAU = h.TAU;
  const { fillEllipse, linear, radial, hash } = h;

  function pal(water, shallow, haze, tint, sun, sand) {
    return { water, shallow, haze, tint, sun, sand };
  }

  // ---------- Pinturas compartidas ----------
  // ---------- Aldea Coral ----------
  function paintHut(g) {
    fillEllipse(g, 'rgba(0,50,40,0.28)', 0, 2, 44, 10);
    g.fillStyle = '#7d5532';
    for (const px of [-30, -12, 12, 30]) g.fillRect(px - 2, -8, 4, 14);
    g.fillStyle = '#9b6a3a';
    g.fillRect(-38, -14, 76, 7);
    g.fillStyle = linear(g, 0, -52, 0, -14, [0, '#f6e2b0', 1, '#d8b878']);
    g.fillRect(-28, -50, 56, 38);
    g.fillStyle = '#7a4d2a';
    g.fillRect(-7, -38, 14, 26);
    g.fillStyle = '#ffe9a8';
    g.fillRect(14, -40, 9, 9);
    g.fillStyle = linear(g, 0, -86, 0, -46, [0, '#ff8a68', 1, '#d8483f']);
    g.beginPath(); g.moveTo(-40, -46); g.lineTo(0, -88); g.lineTo(40, -46); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,30,30,0.5)';
    g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 8, -78 + Math.abs(i) * 7); g.lineTo(i * 14, -48); g.stroke(); }
  }

  function paintNet(g) {
    fillEllipse(g, 'rgba(0,50,40,0.25)', 0, 2, 34, 7);
    g.strokeStyle = '#7d5532';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(-26, 0); g.lineTo(-26, -46); g.moveTo(26, 0); g.lineTo(26, -46); g.stroke();
    g.strokeStyle = 'rgba(245,235,205,0.85)';
    g.lineWidth = 1.2;
    for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(-26 + i * 8.7, -44); g.lineTo(-24 + i * 8, -12); g.stroke(); }
    for (let j = 0; j < 5; j++) { g.beginPath(); g.moveTo(-26, -42 + j * 7); g.quadraticCurveTo(0, -36 + j * 7, 26, -42 + j * 7); g.stroke(); }
    g.fillStyle = '#ff7a5a';
    for (const [bx, by] of [[-14, -20], [4, -26], [18, -16]]) { g.beginPath(); g.arc(bx, by, 3, 0, TAU); g.fill(); }
  }

  function paintCrate(g) {
    fillEllipse(g, 'rgba(0,50,40,0.25)', 0, 3, 24, 6);
    g.fillStyle = '#b07a3e';
    g.fillRect(-14, -22, 28, 22);
    g.strokeStyle = '#6d4722';
    g.lineWidth = 2;
    g.strokeRect(-14, -22, 28, 22);
    g.beginPath(); g.moveTo(-14, -11); g.lineTo(14, -11); g.moveTo(0, -22); g.lineTo(0, 0); g.stroke();
  }

  function paintVillageGate(g) {
    fillEllipse(g, 'rgba(0,60,70,0.3)', 0, 4, 150, 14);
    for (const side of [-1, 1]) {
      const x = side * 112;
      g.save(); g.translate(x, 0); g.scale(1.45, 1.45); paintHut(g); g.restore();
    }
    g.fillStyle = '#8a5a30';
    g.fillRect(-170, -6, 340, 10);
    for (let i = -7; i <= 7; i++) g.fillRect(i * 22 - 2, -6, 4, 26);
    // Farolillos entre las casas.
    g.strokeStyle = '#6a4424';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-80, -130); g.quadraticCurveTo(0, -100, 80, -130); g.stroke();
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = -80 + t * 160;
      const y = -130 + Math.sin(t * Math.PI) * 30;
      g.fillStyle = radial(g, x, y + 7, 1, x, y + 7, 16, [0, 'rgba(255,230,140,0.7)', 1, 'rgba(255,200,90,0)']);
      g.beginPath(); g.arc(x, y + 7, 16, 0, TAU); g.fill();
      g.fillStyle = i % 2 ? '#ff6a5a' : '#ffcf4a';
      g.beginPath(); g.ellipse(x, y + 7, 5, 7, 0, 0, TAU); g.fill();
    }
    // Barquitas de pesca delante.
    for (const bx of [-40, 46]) {
      g.fillStyle = '#c1814a';
      g.beginPath(); g.moveTo(bx - 22, -4); g.lineTo(bx + 22, -4); g.lineTo(bx + 14, 8); g.lineTo(bx - 14, 8); g.closePath(); g.fill();
      g.fillStyle = '#f3dba8';
      g.fillRect(bx - 1, -26, 2, 22);
    }
  }

  // ---------- Manglar Sombrío ----------
  function paintMangrove(g, variant) {
    fillEllipse(g, 'rgba(10,40,30,0.35)', 0, 2, 54, 11);
    g.strokeStyle = '#4a3a24';
    g.lineCap = 'round';
    const roots = variant ? 7 : 5;
    for (let i = 0; i < roots; i++) {
      const t = i / (roots - 1) - 0.5;
      g.lineWidth = 5 - Math.abs(t) * 3;
      g.beginPath();
      g.moveTo(t * 14, -46);
      g.quadraticCurveTo(t * 70, -40, t * 96, 0);
      g.stroke();
    }
    g.strokeStyle = '#6b5334';
    g.lineWidth = 11;
    g.beginPath(); g.moveTo(0, -30); g.lineTo(2, -66); g.stroke();
    for (let i = 0; i < 4; i++) {
      const cx = (i - 1.5) * 26 + (variant ? 6 : -4);
      const cy = -78 - hash(i, 700 + variant) * 16;
      g.fillStyle = linear(g, cx, cy - 26, cx, cy + 22, [0, '#4fae62', 1, '#1b5a3c']);
      g.beginPath(); g.ellipse(cx, cy, 34, 24, 0, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(40,110,60,0.8)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 9; i++) { const vx = -50 + i * 12; g.beginPath(); g.moveTo(vx, -60 - hash(i, 710) * 10); g.lineTo(vx + 2, -34 - hash(i, 711) * 24); g.stroke(); }
  }

  function paintStilts(g) {
    fillEllipse(g, 'rgba(10,40,30,0.3)', 0, 2, 34, 7);
    g.strokeStyle = '#4a3a24';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 4, -22); g.quadraticCurveTo(i * 9, -10, i * 12, 0); g.stroke(); }
    fillEllipse(g, '#2f8a52', 0, -26, 26, 14);
    fillEllipse(g, '#4fae62', -6, -30, 16, 8);
  }

  function paintRootArch(g) {
    fillEllipse(g, 'rgba(10,40,30,0.4)', 0, 4, 160, 14);
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        g.strokeStyle = i % 2 ? '#4a3a24' : '#6b5334';
        g.lineWidth = 12 - i * 2;
        g.beginPath();
        g.moveTo(side * (90 + i * 20), 0);
        g.bezierCurveTo(side * (96 + i * 18), -80 - i * 10, side * (50 - i * 8), -150 + i * 6, side * (8 + i * 6), -140 + i * 4);
        g.stroke();
      }
    }
    g.fillStyle = linear(g, 0, -190, 0, -110, [0, '#3f9a58', 1, '#165236']);
    g.beginPath(); g.ellipse(0, -142, 108, 30, 0, 0, TAU); g.fill();
    g.fillStyle = '#58bd6c';
    g.beginPath(); g.ellipse(-26, -154, 62, 18, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,150,80,0.9)';
    g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const vx = -90 + i * 16; g.beginPath(); g.moveTo(vx, -128); g.lineTo(vx + 3, -96 - hash(i, 720) * 30); g.stroke(); }
    // Luces verdosas entre las raíces.
    g.fillStyle = radial(g, 0, -70, 1, 0, -70, 64, [0, 'rgba(190,255,200,0.4)', 1, 'rgba(190,255,200,0)']);
    g.beginPath(); g.arc(0, -70, 64, 0, TAU); g.fill();
  }

  // ---------- Cascada Brumosa ----------
  function paintPine(g, variant) {
    fillEllipse(g, 'rgba(10,40,60,0.3)', 0, 2, 32, 7);
    g.fillStyle = '#5b4631';
    g.fillRect(-3, -22, 6, 24);
    for (let i = 0; i < 4; i++) {
      const w = 40 - i * 8 + variant * 4;
      const y = -18 - i * 24;
      g.fillStyle = linear(g, 0, y - 40, 0, y, [0, i % 2 ? '#3f9a6a' : '#4cae78', 1, '#1d5a46']);
      g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 44); g.lineTo(w, y); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(240,252,255,0.8)';
    g.beginPath(); g.moveTo(-9, -92); g.lineTo(0, -108); g.lineTo(9, -92); g.closePath(); g.fill();
  }

  function paintMist(g) {
    g.fillStyle = radial(g, 0, 0, 2, 0, 0, 60, [0, 'rgba(245,252,255,0.55)', 0.5, 'rgba(235,248,255,0.22)', 1, 'rgba(235,248,255,0)']);
    g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
  }

  function paintFallsWall(g) {
    fillEllipse(g, 'rgba(10,50,80,0.35)', 0, 4, 170, 16);
    g.fillStyle = linear(g, 0, -200, 0, 0, [0, '#8a97a8', 1, '#4f5f72']);
    g.beginPath();
    g.moveTo(-178, 0); g.lineTo(-150, -110); g.lineTo(-100, -160); g.lineTo(-50, -196);
    g.lineTo(50, -196); g.lineTo(100, -166); g.lineTo(152, -110); g.lineTo(178, 0);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,50,60,0.35)';
    for (let i = 0; i < 6; i++) { const x = -150 + i * 56; g.fillRect(x, -170 + hash(i, 730) * 20, 14, 150); }
    // Cortina de agua.
    for (const [x, w] of [[-34, 22], [4, 30], [44, 18]]) {
      g.fillStyle = linear(g, 0, -196, 0, -6, [0, 'rgba(255,255,255,0.95)', 1, 'rgba(190,232,255,0.8)']);
      g.fillRect(x - w / 2, -196, w, 192);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - w / 4, -190); g.lineTo(x - w / 4, -10); g.moveTo(x + w / 5, -186); g.lineTo(x + w / 5, -14); g.stroke();
    }
    // Espuma y niebla en la base.
    for (let i = 0; i < 7; i++) {
      const x = -70 + i * 23;
      g.fillStyle = radial(g, x, -6, 1, x, -6, 34, [0, 'rgba(255,255,255,0.85)', 1, 'rgba(255,255,255,0)']);
      g.beginPath(); g.arc(x, -6, 34, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-60 + i * 15, -16 - hash(i, 731) * 10, 5 + hash(i, 732) * 4, 0, TAU); g.fill(); }
    // Arcoíris tenue.
    const colors = ['rgba(255,120,120,0.22)', 'rgba(255,214,120,0.22)', 'rgba(130,230,160,0.22)', 'rgba(130,190,255,0.22)'];
    colors.forEach((color, i) => { g.strokeStyle = color; g.lineWidth = 6; g.beginPath(); g.arc(0, -70, 120 - i * 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); });
  }

  // ---------- Ruinas del Sol ----------
  function paintColumn(g, variant) {
    fillEllipse(g, 'rgba(60,40,10,0.3)', 0, 2, 26, 6);
    const top = variant ? -46 : -86;
    g.fillStyle = linear(g, -14, 0, 14, 0, [0, '#f3dba0', 0.5, '#e2bf7c', 1, '#b8924f']);
    g.fillRect(-12, top, 24, -top);
    g.fillStyle = '#d5b06a';
    g.fillRect(-18, -6, 36, 8);
    if (!variant) {
      g.fillRect(-18, top - 8, 36, 10);
      g.fillStyle = '#c99f55';
      g.fillRect(-14, top - 14, 28, 6);
    } else {
      g.beginPath(); g.moveTo(-12, top); g.lineTo(-4, top - 8); g.lineTo(4, top - 2); g.lineTo(12, top - 9); g.lineTo(12, top); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(120,80,20,0.35)';
    g.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 6, top + 2); g.lineTo(i * 6, -8); g.stroke(); }
    g.strokeStyle = 'rgba(70,140,60,0.8)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-10, -4); g.quadraticCurveTo(-14, top * 0.4, -8, top * 0.7); g.stroke();
  }

  function paintBlock(g) {
    fillEllipse(g, 'rgba(60,40,10,0.28)', 0, 3, 34, 7);
    g.fillStyle = '#d9b672';
    g.fillRect(-28, -22, 56, 22);
    g.fillStyle = '#e8cc8c';
    g.fillRect(-20, -34, 36, 14);
    g.strokeStyle = 'rgba(120,80,20,0.4)';
    g.lineWidth = 1.5;
    g.strokeRect(-28, -22, 56, 22);
    g.strokeRect(-20, -34, 36, 14);
  }

  function paintSunGate(g) {
    fillEllipse(g, 'rgba(60,40,10,0.35)', 0, 4, 170, 15);
    g.fillStyle = radial(g, 0, -120, 4, 0, -120, 150, [0, 'rgba(255,225,130,0.55)', 0.6, 'rgba(255,200,90,0.16)', 1, 'rgba(255,200,90,0)']);
    g.beginPath(); g.arc(0, -120, 150, 0, TAU); g.fill();
    for (const side of [-1, 1]) {
      g.save(); g.translate(side * 110, 0); g.scale(1.6, 1.8); paintColumn(g, 0); g.restore();
      g.save(); g.translate(side * 150, 0); g.scale(1.2, 1.2); paintBlock(g); g.restore();
    }
    g.fillStyle = linear(g, 0, -190, 0, -150, [0, '#f3dba0', 1, '#c99f55']);
    g.fillRect(-140, -176, 280, 24);
    g.fillRect(-120, -198, 240, 22);
    // Disco solar.
    g.fillStyle = '#ffcf4a';
    g.beginPath(); g.arc(0, -190, 20, 0, TAU); g.fill();
    g.strokeStyle = '#ffe58a';
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      g.beginPath(); g.moveTo(Math.cos(a) * 26, -190 + Math.sin(a) * 26); g.lineTo(Math.cos(a) * 36, -190 + Math.sin(a) * 36); g.stroke();
    }
    // Escalones al agua.
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i % 2 ? '#d5b06a' : '#e6c98a';
      g.fillRect(-60 - i * 12, -6 + i * 7, 120 + i * 24, 7);
    }
  }

  function paintDust(g) {
    g.fillStyle = radial(g, 0, 0, 1, 0, 0, 18, [0, 'rgba(255,224,130,0.8)', 1, 'rgba(255,214,110,0)']);
    g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill();
  }

  // ---------- Laguna de las Luciérnagas ----------
  function paintCrystals(g, variant) {
    fillEllipse(g, 'rgba(20,10,60,0.35)', 0, 2, 38, 8);
    g.fillStyle = radial(g, 0, -30, 2, 0, -30, 56, [0, 'rgba(190,170,255,0.55)', 1, 'rgba(190,170,255,0)']);
    g.beginPath(); g.arc(0, -30, 56, 0, TAU); g.fill();
    const count = 5 + variant;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 15 + (hash(i, 740 + variant) - 0.5) * 6;
      const height = 34 + hash(i, 741 + variant) * 40 + (i === (count >> 1) ? 14 : 0);
      const w = 8 + hash(i, 742 + variant) * 5;
      g.fillStyle = linear(g, x - w, -height, x + w, 0, [0, '#e9dcff', 0.5, '#a58cf0', 1, '#5e4bc0']);
      g.beginPath();
      g.moveTo(x - w, 0); g.lineTo(x - w * 0.7, -height * 0.8); g.lineTo(x, -height); g.lineTo(x + w * 0.7, -height * 0.8); g.lineTo(x + w, 0);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.moveTo(x - w * 0.3, -height * 0.9); g.lineTo(x, -height); g.lineTo(x + w * 0.2, -height * 0.5); g.lineTo(x - w * 0.2, -height * 0.4); g.closePath(); g.fill();
    }
  }

  function paintGlowFern(g) {
    fillEllipse(g, 'rgba(20,10,60,0.28)', 0, 3, 30, 6);
    g.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      g.strokeStyle = i % 2 ? '#4fd0c8' : '#7de8d4';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(i * 8, -24, i * 14, -34 + Math.abs(i) * 4); g.stroke();
      g.fillStyle = '#c9fff2';
      g.beginPath(); g.arc(i * 14, -34 + Math.abs(i) * 4, 2.6, 0, TAU); g.fill();
    }
  }

  function paintCrystalArch(g) {
    fillEllipse(g, 'rgba(20,10,60,0.4)', 0, 4, 170, 15);
    g.fillStyle = radial(g, 0, -100, 4, 0, -100, 170, [0, 'rgba(200,180,255,0.5)', 0.6, 'rgba(150,130,255,0.16)', 1, 'rgba(150,130,255,0)']);
    g.beginPath(); g.arc(0, -100, 170, 0, TAU); g.fill();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = side * (96 + i * 17);
        const height = 120 - i * 17 + hash(i, 750) * 14;
        const w = 17 - i;
        g.fillStyle = linear(g, x - w, -height, x + w, 0, [0, '#f0e6ff', 0.5, '#a58cf0', 1, '#4f3cb0']);
        g.beginPath();
        g.moveTo(x - w, 0); g.lineTo(x - w * 0.6, -height * 0.82); g.lineTo(x - side * 3, -height); g.lineTo(x + w * 0.6, -height * 0.82); g.lineTo(x + w, 0);
        g.closePath(); g.fill();
      }
    }
    // Arco de cristales que se juntan arriba.
    for (let i = 0; i < 7; i++) {
      const t = (i - 3) / 3;
      const x = t * 92;
      const y = -150 + t * t * 38;
      g.fillStyle = i % 2 ? '#d7c8ff' : '#b49cf6';
      g.beginPath(); g.moveTo(x - 13, y + 24); g.lineTo(x, y - 18); g.lineTo(x + 13, y + 24); g.closePath(); g.fill();
    }
    // Luz del lago dentro del arco.
    g.fillStyle = linear(g, 0, -110, 0, 0, [0, 'rgba(120,255,235,0.0)', 1, 'rgba(120,255,235,0.55)']);
    g.fillRect(-80, -110, 160, 108);
    g.fillStyle = '#e9fff8';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(-70 + hash(i, 751) * 140, -100 + hash(i, 752) * 90, 2 + hash(i, 753) * 2, 0, TAU); g.fill(); }
  }

  function paintFirefly(g) {
    g.fillStyle = radial(g, 0, 0, 0, 0, 0, 22, [0, 'rgba(235,255,170,0.95)', 0.25, 'rgba(190,255,140,0.5)', 1, 'rgba(190,255,140,0)']);
    g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
  }

  const tint = (base, color, mode) => ({ base, tint: color, mode });
  const custom = (w, hgt, ox, oy, paint) => ({ w, h: hgt, ox, oy, paint });

  // ---------- Registro ----------
  art.addTheme('aldea', {
    palettes: [
      pal(['#aaf5df', '#35cbc9', '#0e8aa3'], '#dcfae6', '#fff6e6', [255, 214, 160, 0.06], 0.12, ['#f9e6b4', '#e3c385']),
      pal(['#98efe4', '#1fb4cf', '#0b78a6'], '#cdf6f0', '#f2fdff', [255, 255, 255, 0.02], 0.10, ['#f9e9b8', '#e3c88a']),
      pal(['#c3f0c6', '#3db8a8', '#167f88'], '#eef8cf', '#ffe9c4', [255, 170, 110, 0.12], 0.15, ['#f7d9a0', '#dca96b'])
    ],
    landTint: 'rgba(255,170,110,0.07)',
    vegetation: { trees: ['palm0', 'palm1', 'palm2', 'aldea:hut', 'palm1', 'aldea:hut'], under: ['bush0', 'aldea:net', 'aldea:crate', 'fern'],
      treeChance: 0.62, underChance: 0.68, reedChance: 0.2 },
    landmark: 'aldea:gate',
    sprites: {
      'aldea:hut': custom(110, 110, 55, 100, paintHut),
      'aldea:net': custom(80, 60, 40, 54, paintNet),
      'aldea:crate': custom(50, 40, 25, 34, paintCrate),
      'aldea:gate': custom(380, 240, 190, 220, paintVillageGate)
    }
  });

  art.addTheme('manglar', {
    palettes: [
      pal(['#9bd3a6', '#3f9a86', '#14606a'], '#cbe9c4', '#e6f5df', [60, 120, 80, 0.10], 0.07, ['#b8a070', '#8d7650']),
      pal(['#7fc29a', '#2c8374', '#0f4f5c'], '#b2dcb4', '#d9eed4', [30, 90, 60, 0.16], 0.05, ['#a58f62', '#7d6844']),
      pal(['#6fb08a', '#216e66', '#0b3f50'], '#9ccfa6', '#c5e2c4', [20, 70, 50, 0.20], 0.04, ['#957f55', '#6f5c3c'])
    ],
    landTint: 'rgba(8,48,30,0.28)',
    vegetation: { trees: ['manglar:root0', 'manglar:root1', 'manglar:jungle0', 'manglar:root0', 'manglar:jungle1'], under: ['manglar:stilts', 'manglar:fern', 'manglar:stilts', 'manglar:rocks'],
      treeChance: 0.64, underChance: 0.66, reedChance: 0.26, scale: 1.1 },
    rocks: ['manglar:rock0', 'manglar:rock1', 'manglar:rock2'],
    logs: ['manglar:log0', 'manglar:log1'],
    landmark: 'manglar:arch',
    ambient: { sprite: 'manglar:spore', count: 9, additive: true, size: 0.3, alpha: 0.7, blink: true, sway: 20 },
    sprites: {
      'manglar:root0': custom(150, 130, 75, 112, g => paintMangrove(g, 0)),
      'manglar:root1': custom(150, 130, 75, 112, g => paintMangrove(g, 1)),
      'manglar:stilts': custom(80, 60, 40, 54, paintStilts),
      'manglar:jungle0': tint('jungle0', 'rgba(10,70,40,0.5)'),
      'manglar:jungle1': tint('jungle1', 'rgba(10,70,40,0.5)'),
      'manglar:fern': tint('fern', 'rgba(20,90,60,0.45)'),
      'manglar:rocks': tint('bankRocks', 'rgba(40,110,60,0.5)'),
      'manglar:rock0': tint('rock0', 'rgba(40,110,60,0.42)'),
      'manglar:rock1': tint('rock1', 'rgba(40,110,60,0.42)'),
      'manglar:rock2': tint('rock2', 'rgba(40,110,60,0.42)'),
      'manglar:log0': tint('log0', 'rgba(20,50,30,0.4)'),
      'manglar:log1': tint('log1', 'rgba(20,50,30,0.4)'),
      'manglar:spore': tint('glow', 'rgba(150,255,150,0.9)'),
      'manglar:arch': custom(400, 230, 200, 214, paintRootArch)
    }
  });

  art.addTheme('cascada', {
    palettes: [
      pal(['#c6f3ff', '#5fc2ee', '#1d78b8'], '#e4f9ff', '#f4fcff', [210, 240, 255, 0.05], 0.14, ['#d4dce2', '#a9b5be']),
      pal(['#b5ecff', '#42aee6', '#1666ac'], '#d6f4ff', '#eef9ff', [200, 232, 255, 0.07], 0.13, ['#c6d0d8', '#9aa8b4']),
      pal(['#d4f4ff', '#6cc6ee', '#2d86c2'], '#f0fbff', '#ffffff', [235, 248, 255, 0.10], 0.17, ['#dce4ea', '#b4c0ca'])
    ],
    landTint: 'rgba(60,120,160,0.12)',
    backdrop: 'cascada:backdrop',
    vegetation: { trees: ['cascada:pine0', 'cascada:pine1', 'cascada:jungle', 'cascada:pine0', 'palm2'], under: ['bush1', 'cascada:rocks', 'cascada:fern', 'cascada:rocks'],
      treeChance: 0.66, underChance: 0.7, reedChance: 0.18 },
    rocks: ['cascada:rock0', 'cascada:rock1', 'cascada:rock2'],
    landmark: 'cascada:falls',
    ambient: { sprite: 'cascada:mist', count: 8, additive: false, size: 0.9, alpha: 0.5, fall: 0, sway: 40 },
    petals: false,
    sprites: {
      'cascada:pine0': custom(110, 130, 55, 118, g => paintPine(g, 0)),
      'cascada:pine1': custom(110, 130, 55, 118, g => paintPine(g, 1)),
      'cascada:jungle': tint('jungle0', 'rgba(60,130,170,0.32)'),
      'cascada:rocks': tint('bankRocks', 'rgba(130,160,200,0.45)'),
      'cascada:fern': tint('fern', 'rgba(60,150,170,0.35)'),
      'cascada:rock0': tint('rock0', 'rgba(110,150,200,0.45)'),
      'cascada:rock1': tint('rock1', 'rgba(110,150,200,0.45)'),
      'cascada:rock2': tint('rock2', 'rgba(110,150,200,0.45)'),
      'cascada:backdrop': tint('backdrop', 'rgba(110,150,200,0.55)'),
      'cascada:mist': custom(130, 130, 65, 65, paintMist),
      'cascada:falls': custom(380, 230, 190, 214, paintFallsWall)
    }
  });

  art.addTheme('ruinas', {
    palettes: [
      pal(['#d6f0bc', '#52b49c', '#1a7c82'], '#f3f3cc', '#fff3d2', [255, 210, 130, 0.09], 0.14, ['#f2d898', '#cba760']),
      pal(['#c9ecb4', '#44a898', '#176e7e'], '#eff2c4', '#ffeec4', [255, 196, 110, 0.12], 0.16, ['#efd08c', '#c29e58']),
      pal(['#e8e8a6', '#58b08a', '#1c7a74'], '#fbf1b8', '#ffe6a8', [255, 168, 84, 0.17], 0.19, ['#f0c880', '#bf9450'])
    ],
    landTint: 'rgba(210,160,60,0.2)',
    backdrop: 'ruinas:backdrop',
    vegetation: { trees: ['ruinas:column0', 'ruinas:palm', 'ruinas:column1', 'ruinas:palm', 'ruinas:column0'], under: ['ruinas:block', 'ruinas:rocks', 'bush0', 'ruinas:block'],
      treeChance: 0.6, underChance: 0.66, reedChance: 0.16 },
    rocks: ['ruinas:rock0', 'ruinas:rock1', 'ruinas:rock2'],
    logs: ['ruinas:log0', 'ruinas:log1'],
    landmark: 'ruinas:gate',
    ambient: { sprite: 'ruinas:dust', count: 11, additive: true, size: 0.4, alpha: 0.6, fall: 10, sway: 16 },
    sprites: {
      'ruinas:column0': custom(80, 120, 40, 108, g => paintColumn(g, 0)),
      'ruinas:column1': custom(80, 90, 40, 80, g => paintColumn(g, 1)),
      'ruinas:palm': tint('palm1', 'rgba(210,170,60,0.38)'),
      'ruinas:block': custom(90, 60, 45, 52, paintBlock),
      'ruinas:rocks': tint('bankRocks', 'rgba(230,190,110,0.5)'),
      'ruinas:rock0': tint('rock0', 'rgba(230,190,110,0.5)'),
      'ruinas:rock1': tint('rock1', 'rgba(230,190,110,0.5)'),
      'ruinas:rock2': tint('rock2', 'rgba(230,190,110,0.5)'),
      'ruinas:log0': tint('log0', 'rgba(200,160,80,0.3)'),
      'ruinas:log1': tint('log1', 'rgba(200,160,80,0.3)'),
      'ruinas:backdrop': tint('backdrop', 'rgba(230,185,90,0.5)'),
      'ruinas:dust': custom(40, 40, 20, 20, paintDust),
      'ruinas:gate': custom(400, 250, 200, 232, paintSunGate)
    }
  });

  art.addTheme('laguna', {
    palettes: [
      pal(['#8fd8ef', '#3e8fd0', '#1f4d92'], '#c6e2f4', '#dbe4ff', [130, 100, 200, 0.12], 0.08, ['#cfc4ea', '#a090cc']),
      pal(['#7ac4e6', '#3379c2', '#193d86'], '#b4d4ee', '#d2d9ff', [110, 80, 190, 0.17], 0.06, ['#c0b4e0', '#9282c0']),
      pal(['#6fe0d8', '#2f8ccb', '#1a3a8a'], '#a8ece4', '#cdd4ff', [100, 70, 190, 0.22], 0.05, ['#b6aadc', '#887ab8'])
    ],
    landTint: 'rgba(60,40,130,0.3)',
    backdrop: 'laguna:backdrop',
    vegetation: { trees: ['laguna:crystal0', 'laguna:jungle', 'laguna:crystal1', 'laguna:jungle', 'laguna:crystal0'], under: ['laguna:glowfern', 'laguna:glowfern', 'laguna:crystal1', 'laguna:bush'],
      treeChance: 0.62, underChance: 0.66, reedChance: 0.2 },
    rocks: ['laguna:rock0', 'laguna:rock1', 'laguna:rock2'],
    logs: ['laguna:log0', 'laguna:log1'],
    landmark: 'laguna:arch',
    ambient: { sprite: 'laguna:firefly', count: 14, additive: true, size: 0.5, alpha: 0.9, blink: true, sway: 28 },
    sprites: {
      'laguna:crystal0': custom(110, 110, 55, 98, g => paintCrystals(g, 0)),
      'laguna:crystal1': custom(110, 110, 55, 98, g => paintCrystals(g, 1)),
      'laguna:jungle': tint('jungle1', 'rgba(70,60,170,0.4)'),
      'laguna:bush': tint('bush0', 'rgba(70,60,170,0.4)'),
      'laguna:glowfern': custom(90, 60, 45, 54, paintGlowFern),
      'laguna:rock0': tint('rock0', 'rgba(120,100,220,0.5)'),
      'laguna:rock1': tint('rock1', 'rgba(120,100,220,0.5)'),
      'laguna:rock2': tint('rock2', 'rgba(120,100,220,0.5)'),
      'laguna:log0': tint('log0', 'rgba(70,50,150,0.42)'),
      'laguna:log1': tint('log1', 'rgba(70,50,150,0.42)'),
      'laguna:backdrop': tint('backdrop', 'rgba(120,90,210,0.55)'),
      'laguna:firefly': custom(50, 50, 25, 25, paintFirefly),
      'laguna:arch': custom(400, 250, 200, 232, paintCrystalArch)
    }
  });
})();
