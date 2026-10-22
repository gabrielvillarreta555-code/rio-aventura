(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const play = document.getElementById('play');
  const pause = document.getElementById('pause');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const width = canvas.width;
  let height = canvas.height;
  const bestKey = 'rio-aventura-best-v1';
  let state = 'ready';
  let boat, obstacles, particles, score, lives, elapsed, spawnIn, immunity, direction;
  let wakeTimer = 0;
  let impact = 0;
  let cameraX = 0;
  let lastFrame = 0;

  // Keep the original 450-unit playfield while filling taller phone screens.
  function resizeStage() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const nextHeight = Math.max(800, Math.round(width * bounds.height / bounds.width));
    if (nextHeight === height) return;
    const difference = nextHeight - height;
    canvas.height = nextHeight;
    height = nextHeight;
    if (boat) boat.y += difference;
    if (obstacles) obstacles.forEach(item => { item.y += difference; });
  }

  function depthAt(y) {
    return 0.76 + 0.24 * Math.max(0, Math.min(1, y / height));
  }

  function projectedX(x, y) {
    return width / 2 + (x - width / 2) * depthAt(y) - cameraX;
  }

  function reset() {
    boat = { x: width / 2, y: height - 150, tilt: 0 };
    obstacles = [];
    particles = [];
    score = 0;
    lives = 3;
    elapsed = 0;
    spawnIn = 0.6;
    immunity = 0;
    direction = 0;
    wakeTimer = 0;
    impact = 0;
    cameraX = 0;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = `${score} puntos`;
    livesEl.textContent = '♥ '.repeat(lives).trim() || '—';
  }

  function showOverlay(heading, body, button) {
    title.innerHTML = heading;
    message.textContent = body;
    play.textContent = button;
    overlay.classList.remove('hidden');
  }

  function begin() {
    reset();
    state = 'playing';
    pause.textContent = 'Ⅱ';
    overlay.classList.add('hidden');
  }

  function finish() {
    state = 'over';
    direction = 0;
    const best = Math.max(score, Number(localStorage.getItem(bestKey)) || 0);
    localStorage.setItem(bestKey, String(best));
    showOverlay('¡Fin del<br>viaje!', `Lograste ${score} puntos. Tu récord es ${best}.`, 'Jugar otra vez');
  }

  function spawn() {
    const kind = Math.random() < 0.78 ? 'rock' : 'log';
    const radius = kind === 'rock' ? 19 + Math.random() * 11 : 26;
    obstacles.push({ x: 78 + Math.random() * (width - 156), y: -40, radius, kind, counted: false, phase: Math.random() * Math.PI * 2 });
  }

  function splash(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = 35 + Math.random() * 125;
      particles.push({ x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force,
        age: 0, life: 0.35 + Math.random() * 0.55, radius: 2 + Math.random() * 4, color });
    }
  }

  function step(dt) {
    if (state !== 'playing') return;
    elapsed += dt;
    immunity = Math.max(0, immunity - dt);
    impact = Math.max(0, impact - dt * 2.6);
    boat.x = Math.max(74, Math.min(width - 74, boat.x + direction * 265 * dt));
    boat.tilt += ((direction * 0.18) - boat.tilt) * Math.min(1, dt * 7);
    const cameraTarget = (boat.x - width / 2) * 0.11;
    cameraX += (cameraTarget - cameraX) * Math.min(1, dt * 4);
    wakeTimer -= dt;
    if (wakeTimer <= 0) {
      splash(boat.x + (Math.random() - 0.5) * 28, boat.y + 35, 2, '#e7ffff');
      wakeTimer = 0.085;
    }
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt + 48 * dt;
      particle.vx *= 0.96;
      particle.age += dt;
    }
    particles = particles.filter(particle => particle.age < particle.life);
    spawnIn -= dt;
    const speed = Math.min(390, 190 + elapsed * 3.2);
    if (spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(0.48, 1.1 - elapsed * 0.012) + Math.random() * 0.28;
    }
    for (const item of obstacles) {
      item.y += speed * dt;
      if (!item.counted && item.y > boat.y + 38) {
        item.counted = true;
        score++;
        updateHud();
      }
      const separation = Math.hypot(projectedX(item.x, item.y) - projectedX(boat.x, boat.y), item.y - boat.y);
      if (immunity === 0 && separation < item.radius * depthAt(item.y) + 23 * depthAt(boat.y)) {
        lives--;
        immunity = 1.4;
        impact = 1;
        splash(boat.x, boat.y, 22, '#ffffff');
        updateHud();
        if (lives === 0) { finish(); return; }
      }
    }
    obstacles = obstacles.filter(item => item.y < height + 50);
  }

  function drawRiver() {
    const water = ctx.createLinearGradient(55, 0, width - 55, 0);
    water.addColorStop(0, '#3c9eae');
    water.addColorStop(0.48, '#74cbd0');
    water.addColorStop(1, '#3796a9');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, width, height);
    const flow = (elapsed * 130) % 130;
    for (const side of [0, 1]) {
      const topEdge = side ? projectedX(width - 52, 0) : projectedX(52, 0);
      const bottomEdge = side ? projectedX(width - 52, height) : projectedX(52, height);
      ctx.fillStyle = '#2f8d76';
      ctx.beginPath();
      if (side) {
        ctx.moveTo(topEdge, 0); ctx.lineTo(width, 0);
        ctx.lineTo(width, height); ctx.lineTo(bottomEdge, height);
      } else {
        ctx.moveTo(0, 0); ctx.lineTo(topEdge, 0);
        ctx.lineTo(bottomEdge, height); ctx.lineTo(0, height);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#d7f7eb88';
    ctx.lineWidth = 2.5;
    for (let y = flow - 130; y < height + 80; y += 130) {
      for (const x of [98, 213, 344]) {
        ctx.beginPath();
        ctx.moveTo(projectedX(x - 18, y), y);
        ctx.quadraticCurveTo(projectedX(x, y), y - 10, projectedX(x + 18, y), y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(projectedX(x - 8, y), y + 10);
        ctx.quadraticCurveTo(projectedX(x, y), y + 5, projectedX(x + 8, y), y + 10);
        ctx.stroke();
      }
    }
    for (let y = (elapsed * 95) % 100 - 100; y < height + 70; y += 100) {
      for (const side of [0, 1]) {
        const x = projectedX(side ? width - 25 : 25, y);
        const sway = Math.sin(elapsed * 2 + y * 0.04 + side) * 4;
        ctx.strokeStyle = '#315d37';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 16);
        ctx.quadraticCurveTo(x + sway, y + 2, x + sway + (side ? -8 : 8), y - 10);
        ctx.stroke();
        ctx.fillStyle = '#3c934b';
        ctx.beginPath();
        ctx.ellipse(x + sway + (side ? -8 : 8), y - 10, 7, 13, side ? -0.5 : 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawObstacle(item) {
    ctx.save();
    ctx.translate(projectedX(item.x, item.y), item.y + Math.sin(elapsed * 3 + item.phase) * 3);
    ctx.scale(depthAt(item.y), depthAt(item.y));
    if (item.kind === 'rock') {
      ctx.fillStyle = '#dff8ed88';
      ctx.beginPath();
      ctx.ellipse(0, 10, item.radius + 11, item.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      const stone = ctx.createRadialGradient(-8, -12, 3, 0, 0, item.radius + 6);
      stone.addColorStop(0, '#a9bec1');
      stone.addColorStop(1, '#455d66');
      ctx.fillStyle = stone;
      ctx.beginPath();
      ctx.arc(0, -3, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aebdc0';
      ctx.beginPath();
      ctx.arc(-7, -10, item.radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(Math.sin(elapsed * 2 + item.phase) * 0.12 + 0.18);
      ctx.fillStyle = '#dcf6ec88';
      ctx.beginPath();
      ctx.ellipse(0, 8, 38, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#764b31';
      ctx.fillRect(-31, -12, 62, 24);
      ctx.fillStyle = '#aa7045';
      ctx.fillRect(-31, -12, 62, 5);
      ctx.strokeStyle = '#d3955c';
      ctx.lineWidth = 2;
      for (const x of [-18, 4, 20]) {
        ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + 8, 8); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBoat() {
    if (immunity > 0 && Math.floor(immunity * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(projectedX(boat.x, boat.y), boat.y + Math.sin(elapsed * 7) * 3);
    ctx.scale(depthAt(boat.y), depthAt(boat.y));
    ctx.rotate(boat.tilt + Math.sin(elapsed * 3) * 0.025);
    ctx.fillStyle = '#e9ffff99';
    ctx.beginPath();
    ctx.ellipse(0, 30, 48, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    const hull = ctx.createLinearGradient(-42, -18, 42, 34);
    hull.addColorStop(0, '#d19451');
    hull.addColorStop(0.48, '#7c452b');
    hull.addColorStop(1, '#4c2b23');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.quadraticCurveTo(45, -20, 40, 15);
    ctx.quadraticCurveTo(30, 47, 0, 53);
    ctx.quadraticCurveTo(-30, 47, -40, 15);
    ctx.quadraticCurveTo(-45, -20, 0, -45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e1aa65';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#9b6037';
    ctx.beginPath();
    ctx.ellipse(0, 5, 29, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#653b2c';
    ctx.fillRect(-27, 20, 54, 6);
    const stroke = Math.sin(elapsed * 11);
    ctx.strokeStyle = '#633b28';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-13, 6);
    ctx.lineTo(-48 - stroke * 8, 25 + stroke * 9);
    ctx.stroke();
    ctx.fillStyle = '#ad7540';
    ctx.save();
    ctx.translate(-48 - stroke * 8, 25 + stroke * 9);
    ctx.rotate(-0.55 + stroke * 0.15);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ed7656';
    ctx.beginPath();
    ctx.ellipse(0, 7, 13, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d89066';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-17, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(18, 13); ctx.stroke();
    ctx.fillStyle = '#e8ac7f';
    ctx.beginPath();
    ctx.arc(0, -15, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2927';
    ctx.beginPath();
    ctx.arc(0, -21, 11, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#322d2b';
    ctx.beginPath(); ctx.arc(-4, -15, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -15, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(projectedX(particle.x, particle.y), particle.y,
        particle.radius * depthAt(particle.y) * (1 + particle.age), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (impact > 0) ctx.translate((Math.random() - 0.5) * impact * 13, (Math.random() - 0.5) * impact * 13);
    drawRiver();
    [...obstacles].sort((a, b) => a.y - b.y).forEach(drawObstacle);
    drawParticles();
    drawBoat();
    ctx.restore();
    if (impact > 0) {
      ctx.fillStyle = `rgba(255,255,255,${impact * 0.23})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    step(dt);
    render();
    requestAnimationFrame(frame);
  }

  function pointerDirection(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * width / rect.width;
    return x < width / 2 ? -1 : 1;
  }

  canvas.addEventListener('pointerdown', event => {
    if (state !== 'playing') return;
    canvas.setPointerCapture(event.pointerId);
    direction = pointerDirection(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (state === 'playing' && event.buttons) direction = pointerDirection(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, () => { direction = 0; });
  }
  window.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') direction = -1;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') direction = 1;
  });
  window.addEventListener('keyup', () => { direction = 0; });
  play.addEventListener('click', () => {
    if (state === 'paused') {
      state = 'playing';
      overlay.classList.add('hidden');
      pause.textContent = 'Ⅱ';
    } else {
      begin();
    }
  });
  pause.addEventListener('click', () => {
    if (state === 'playing') {
      state = 'paused';
      direction = 0;
      pause.textContent = '▶';
      showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') {
      state = 'paused';
      direction = 0;
      pause.textContent = '▶';
      showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    }
  });
  resizeStage();
  window.addEventListener('resize', resizeStage);
  reset();
  requestAnimationFrame(frame);
})();
