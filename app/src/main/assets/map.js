// Mapa tropical 2.5D de Río Aventura 2.5. Solo pinta: game.js le pasa un modelo con el estado de
// cada lugar y este archivo dibuja el archipiélago, las rutas y la lancha en su propio lienzo.
// La capa fija (mar, islas, palmeras) se guarda en un lienzo aparte y se redibuja solo si cambia
// el tamaño o el estado de algún lugar; cada fotograma solo añade rutas, brillos, niebla y lancha.
(() => {
  'use strict';

  const TAU = Math.PI * 2;

  function create(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    const canCache = typeof document !== 'undefined' && typeof document.createElement === 'function';
    let cache = null;
    let cacheKey = '';
    let lite = Boolean(options.lite);
    let layout = null;

    function setLite(value) { lite = Boolean(value); cacheKey = ''; }

    // `area`: rectángulo (en píxeles del lienzo) donde se reparten los lugares normalizados.
    function resize(width, height, area) {
      canvas.width = Math.max(2, Math.round(width));
      canvas.height = Math.max(2, Math.round(height));
      layout = {
        w: canvas.width, h: canvas.height,
        ax: area.x, ay: area.y, aw: area.w, ah: area.h,
        unit: Math.max(40, Math.min(area.w, area.h * 0.62))
      };
      cacheKey = '';
    }

    function place(node) {
      const depth = 0.78 + 0.34 * node.y;
      return { x: layout.ax + node.x * layout.aw, y: layout.ay + node.y * layout.ah, r: layout.unit * 0.105 * depth, depth };
    }

    function ellipse(c, x, y, rx, ry, color) {
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU);
      c.fill();
    }

    function palm(c, x, y, size, tilt) {
      c.strokeStyle = '#6b4a2b';
      c.lineWidth = Math.max(1.4, size * 0.12);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + tilt * size * 0.3, y - size * 0.6, x + tilt * size * 0.5, y - size);
      c.stroke();
      c.fillStyle = '#2f9a57';
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i - 2) * 0.62 + tilt * 0.2;
        c.beginPath();
        c.ellipse(x + tilt * size * 0.5 + Math.cos(angle) * size * 0.32, y - size + Math.sin(angle) * size * 0.32,
          size * 0.38, size * 0.12, angle, 0, TAU);
        c.fill();
      }
    }

    // Isla con grosor: cara superior clara, borde de acantilado oscuro y espuma en la orilla.
    function island(c, p, node, state) {
      const rx = p.r * 1.35;
      const ry = p.r * 0.72;
      const locked = state === 'locked';
      const top = locked ? '#7c9a92' : node.kind === 'port' ? '#d9bf7a' : '#7bd08b';
      const side = locked ? '#566f6b' : '#a8844d';
      ellipse(c, p.x, p.y + p.r * 0.55, rx * 1.12, ry * 0.8, 'rgba(0,50,70,0.28)');
      ellipse(c, p.x, p.y + p.r * 0.22, rx * 1.12, ry * 1.04, 'rgba(235,255,250,0.55)');
      ellipse(c, p.x, p.y + p.r * 0.2, rx, ry, side);
      ellipse(c, p.x, p.y, rx, ry, top);
      ellipse(c, p.x - rx * 0.1, p.y - ry * 0.12, rx * 0.72, ry * 0.62, locked ? '#8fb0a7' : node.kind === 'port' ? '#e8d395' : '#97e29f');
      if (locked) return;
      landmark(c, p, node);
    }

    function landmark(c, p, node) {
      const s = p.r;
      switch (node.id) {
        case 'puerto':
          c.fillStyle = '#9b6a3a';
          c.fillRect(p.x - s * 0.9, p.y + s * 0.05, s * 1.8, s * 0.16);
          for (let i = -2; i <= 2; i++) c.fillRect(p.x + i * s * 0.4 - 1.5, p.y + s * 0.05, 3, s * 0.4);
          c.fillStyle = '#ffd36a';
          c.fillRect(p.x - 2, p.y - s * 0.9, 4, s * 0.95);
          c.fillStyle = '#ff6a5a';
          c.beginPath(); c.moveTo(p.x + 2, p.y - s * 0.9); c.lineTo(p.x + s * 0.55, p.y - s * 0.7); c.lineTo(p.x + 2, p.y - s * 0.5); c.fill();
          palm(c, p.x - s * 0.9, p.y - s * 0.05, s * 0.9, -1);
          break;
        case 'aldea':
          for (let i = 0; i < 3; i++) {
            const hx = p.x + (i - 1) * s * 0.62;
            const hy = p.y + (i === 1 ? s * 0.12 : -s * 0.08);
            c.fillStyle = '#f3dba8';
            c.fillRect(hx - s * 0.22, hy - s * 0.2, s * 0.44, s * 0.3);
            c.fillStyle = i === 1 ? '#ff7a5a' : '#e0524a';
            c.beginPath(); c.moveTo(hx - s * 0.32, hy - s * 0.2); c.lineTo(hx, hy - s * 0.52); c.lineTo(hx + s * 0.32, hy - s * 0.2); c.fill();
          }
          palm(c, p.x + s * 1.0, p.y + s * 0.05, s * 0.85, 1);
          break;
        case 'manglar':
          c.strokeStyle = '#3b6a47';
          c.lineWidth = Math.max(1.5, s * 0.07);
          for (let i = -3; i <= 3; i++) {
            c.beginPath();
            c.moveTo(p.x + i * s * 0.28, p.y - s * 0.2);
            c.quadraticCurveTo(p.x + i * s * 0.34, p.y + s * 0.05, p.x + i * s * 0.4, p.y + s * 0.3);
            c.stroke();
          }
          ellipse(c, p.x, p.y - s * 0.38, s * 1.0, s * 0.42, '#1f7a4a');
          ellipse(c, p.x - s * 0.25, p.y - s * 0.52, s * 0.6, s * 0.3, '#2f9a5a');
          break;
        case 'cascada':
          c.fillStyle = '#8a97a6';
          c.beginPath(); c.moveTo(p.x - s * 0.9, p.y + s * 0.15); c.lineTo(p.x - s * 0.4, p.y - s * 1.0); c.lineTo(p.x + s * 0.5, p.y - s * 1.1); c.lineTo(p.x + s * 0.95, p.y + s * 0.15); c.fill();
          c.fillStyle = '#eaf8ff';
          c.fillRect(p.x - s * 0.1, p.y - s * 1.0, s * 0.3, s * 1.1);
          ellipse(c, p.x + s * 0.05, p.y + s * 0.12, s * 0.45, s * 0.14, 'rgba(255,255,255,0.9)');
          break;
        case 'ruinas':
          c.fillStyle = '#e6c27a';
          for (let i = -2; i <= 2; i++) {
            const h = i === 0 ? 0.95 : 0.6 + (i % 2 ? 0.1 : 0.25);
            c.fillRect(p.x + i * s * 0.38 - s * 0.1, p.y - s * h, s * 0.2, s * h + s * 0.1);
          }
          c.fillStyle = '#c99f55';
          c.fillRect(p.x - s * 0.95, p.y - s * 0.02, s * 1.9, s * 0.14);
          ellipse(c, p.x, p.y - s * 1.1, s * 0.22, s * 0.22, '#ffcf4a');
          break;
        case 'laguna':
          ellipse(c, p.x, p.y, s * 0.9, s * 0.38, '#4fd0c8');
          c.fillStyle = '#c7b6ff';
          for (let i = -2; i <= 2; i++) {
            const h = 0.55 + ((i * 7) % 3) * 0.14;
            c.beginPath();
            c.moveTo(p.x + i * s * 0.36 - s * 0.12, p.y + s * 0.1);
            c.lineTo(p.x + i * s * 0.36, p.y - s * h);
            c.lineTo(p.x + i * s * 0.36 + s * 0.12, p.y + s * 0.1);
            c.fill();
          }
          break;
        default:
      }
    }

    function drawBase(c, model) {
      const { w, h } = layout;
      const sea = c.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, '#2f95a8');
      sea.addColorStop(0.55, '#46bccb');
      sea.addColorStop(1, '#1e6f86');
      c.fillStyle = sea;
      c.fillRect(0, 0, w, h);
      // Bandas de profundidad para dar sensación de plano inclinado.
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 7; i++) c.fillRect(0, h * (0.06 + i * 0.14), w, h * 0.035);
      // Isla grande del fondo, solo decorativa.
      ellipse(c, w * 0.12, layout.ay + layout.ah * 0.26, layout.unit * 0.24, layout.unit * 0.1, 'rgba(24,110,95,0.45)');
      ellipse(c, w * 0.9, layout.ay + layout.ah * 0.88, layout.unit * 0.22, layout.unit * 0.09, 'rgba(24,110,95,0.4)');
      const ordered = model.nodes.slice().sort((a, b) => a.y - b.y);
      for (const node of ordered) island(c, place(node), node, node.state);
    }

    function ensureBase(model) {
      const key = `${layout.w}x${layout.h}|${layout.ax},${layout.ay},${layout.aw},${layout.ah}|` +
        model.nodes.map(node => `${node.id}:${node.state === 'locked' ? 0 : 1}`).join(',');
      if (key === cacheKey) return;
      cacheKey = key;
      if (!canCache) { cache = null; return; }
      cache = document.createElement('canvas');
      cache.width = layout.w;
      cache.height = layout.h;
      const cc = cache.getContext('2d');
      if (!cc) { cache = null; return; }
      drawBase(cc, model);
    }

    function lane(from, to, bend, open, time) {
      const mx = (from.x + to.x) / 2 + bend * layout.unit * 0.18;
      const my = (from.y + to.y) / 2 - layout.unit * 0.02;
      ctx.lineCap = 'round';
      ctx.lineWidth = open ? Math.max(3, layout.unit * 0.014) : Math.max(2, layout.unit * 0.009);
      ctx.strokeStyle = open ? 'rgba(255,224,130,0.95)' : 'rgba(225,240,240,0.34)';
      ctx.setLineDash(open ? [layout.unit * 0.03, layout.unit * 0.028] : [layout.unit * 0.012, layout.unit * 0.03]);
      ctx.lineDashOffset = open ? -time * layout.unit * 0.05 : 0;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + from.r * 0.3);
      ctx.quadraticCurveTo(mx, my, to.x, to.y + to.r * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
      return { x: mx, y: my };
    }

    // modelo: { nodes: [{id,kind,x,y,state,selected,from}], boat: id, edges: [{from,to,open}] }
    function draw(time, model) {
      if (!layout) return;
      ensureBase(model);
      if (cache) ctx.drawImage(cache, 0, 0);
      else drawBase(ctx, model);
      const spots = Object.create(null);
      for (const node of model.nodes) spots[node.id] = place(node);
      let bend = 1;
      for (const edge of model.edges) {
        lane(spots[edge.from], spots[edge.to], bend, edge.open, time);
        bend = -bend;
      }
      // Brillos de las olas.
      const glints = lite ? 5 : 11;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < glints; i++) {
        const gx = layout.w * ((i * 0.37 + 0.11) % 1);
        const gy = layout.h * ((i * 0.23 + 0.07) % 1);
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.4 + i * 1.9);
        ctx.globalAlpha = 0.15 + 0.4 * pulse;
        ctx.fillRect(gx, gy, layout.unit * 0.05 * (0.6 + pulse), 2);
      }
      ctx.globalAlpha = 1;
      for (const node of model.nodes) {
        const p = spots[node.id];
        if (node.state === 'locked') {
          // Niebla: unos círculos translúcidos que se mecen despacio.
          const puffs = lite ? 3 : 6;
          ctx.fillStyle = 'rgba(232,247,247,0.38)';
          for (let i = 0; i < puffs; i++) {
            const a = i / puffs * TAU + time * 0.12;
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(a) * p.r * 0.9, p.y + Math.sin(a) * p.r * 0.42, p.r * 0.5, 0, TAU);
            ctx.fill();
          }
        }
        if (node.selected) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
          ctx.strokeStyle = `rgba(255,226,120,${0.65 + 0.3 * pulse})`;
          ctx.lineWidth = Math.max(2.5, layout.unit * 0.012);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + p.r * 0.12, p.r * (1.65 + 0.08 * pulse), p.r * (0.95 + 0.05 * pulse), 0, 0, TAU);
          ctx.stroke();
        }
        if (node.state === 'visited') {
          ctx.fillStyle = '#ffe58a';
          ctx.beginPath();
          ctx.arc(p.x + p.r * 1.25, p.y - p.r * 0.7, Math.max(4, p.r * 0.16), 0, TAU);
          ctx.fill();
        }
      }
      // Lancha junto al puerto, balanceándose.
      const dock = spots[model.boat] || spots.puerto;
      if (dock) {
        const bob = Math.sin(time * 2.1) * dock.r * 0.05;
        const bx = dock.x + dock.r * 1.55;
        const by = dock.y + dock.r * 0.55 + bob;
        ellipse(ctx, bx, by + dock.r * 0.2, dock.r * 0.55, dock.r * 0.15, 'rgba(0,50,70,0.3)');
        ctx.fillStyle = '#ffd36a';
        ctx.beginPath();
        ctx.moveTo(bx - dock.r * 0.5, by - dock.r * 0.05);
        ctx.lineTo(bx + dock.r * 0.55, by - dock.r * 0.05);
        ctx.lineTo(bx + dock.r * 0.3, by + dock.r * 0.2);
        ctx.lineTo(bx - dock.r * 0.35, by + dock.r * 0.2);
        ctx.fill();
        ctx.fillStyle = '#e0524a';
        ctx.fillRect(bx - dock.r * 0.12, by - dock.r * 0.3, dock.r * 0.24, dock.r * 0.25);
      }
    }

    return { resize, draw, setLite, place: node => (layout ? place(node) : null) };
  }

  window.RioMap = Object.freeze({ create });
})();
