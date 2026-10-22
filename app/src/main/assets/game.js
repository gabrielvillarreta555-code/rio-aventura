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
  const height = canvas.height;
  const bestKey = 'rio-aventura-best-v1';
  let state = 'ready';
  let boat, obstacles, score, lives, elapsed, spawnIn, immunity, direction;
  let lastFrame = 0;

  function reset() {
    boat = { x: width / 2, y: height - 150, tilt: 0 };
    obstacles = [];
    score = 0;
    lives = 3;
    elapsed = 0;
    spawnIn = 0.6;
    immunity = 0;
    direction = 0;
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
    obstacles.push({ x: 78 + Math.random() * (width - 156), y: -40, radius, kind, counted: false });
  }

  function step(dt) {
    if (state !== 'playing') return;
    elapsed += dt;
    immunity = Math.max(0, immunity - dt);
    boat.x = Math.max(74, Math.min(width - 74, boat.x + direction * 265 * dt));
    boat.tilt += ((direction * 0.18) - boat.tilt) * Math.min(1, dt * 7);
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
      if (immunity === 0 && Math.hypot(item.x - boat.x, item.y - boat.y) < item.radius + 23) {
        lives--;
        immunity = 1.4;
        updateHud();
        if (lives === 0) { finish(); return; }
      }
    }
    obstacles = obstacles.filter(item => item.y < height + 50);
  }

  function drawRiver() {
    ctx.fillStyle = '#60bdc9';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#72bd68';
    ctx.fillRect(0, 0, 55, height);
    ctx.fillRect(width - 55, 0, 55, height);
    ctx.fillStyle = '#94d07a';
    ctx.fillRect(46, 0, 9, height);
    ctx.fillRect(width - 55, 0, 9, height);
    ctx.strokeStyle = '#c3f2eb88';
    ctx.lineWidth = 3;
    const flow = (elapsed * 80) % 100;
    for (let y = flow - 100; y < height; y += 100) {
      for (const x of [110, 245, 370]) {
        ctx.beginPath();
        ctx.arc(x, y, 18, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
    }
  }

  function drawObstacle(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    if (item.kind === 'rock') {
      ctx.fillStyle = '#87959a';
      ctx.beginPath();
      ctx.ellipse(0, 4, item.radius + 6, item.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#536e76';
      ctx.beginPath();
      ctx.arc(0, -3, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aebdc0';
      ctx.beginPath();
      ctx.arc(-7, -10, item.radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(0.25);
      ctx.fillStyle = '#764b31';
      ctx.fillRect(-31, -12, 62, 24);
      ctx.fillStyle = '#aa7045';
      ctx.fillRect(-31, -12, 62, 5);
    }
    ctx.restore();
  }

  function drawBoat() {
    if (immunity > 0 && Math.floor(immunity * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(boat.x, boat.y + Math.sin(elapsed * 4) * 4);
    ctx.rotate(boat.tilt);
    ctx.fillStyle = '#d6f5ec88';
    ctx.beginPath();
    ctx.ellipse(0, 28, 43, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6f3f28';
    ctx.beginPath();
    ctx.moveTo(-38, -23);
    ctx.quadraticCurveTo(-52, 33, 0, 43);
    ctx.quadraticCurveTo(52, 33, 38, -23);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b9753d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e7a577';
    ctx.beginPath();
    ctx.arc(0, -12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f36c50';
    ctx.fillRect(-10, 0, 20, 22);
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-15, 9);
    ctx.lineTo(-56, 38);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    drawRiver();
    obstacles.forEach(drawObstacle);
    drawBoat();
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
  reset();
  requestAnimationFrame(frame);
})();
