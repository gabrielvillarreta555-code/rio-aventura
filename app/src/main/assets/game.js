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
  const playerTag = document.getElementById('playerTag');
  const settingsButton = document.getElementById('settings');
  const openingSettings = document.getElementById('openingSettings');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettingsButton = document.getElementById('closeSettings');
  const avatarButton = document.getElementById('avatar');
  const profileName = document.getElementById('profileName');
  const saveProfileButton = document.getElementById('saveProfile');
  const profileNotice = document.getElementById('profileNotice');
  const qualitySelect = document.getElementById('quality');
  const width = canvas.width;
  let height = canvas.height;
  const bestKey = 'rio-aventura-best-v1';
  const profileKey = 'rio-aventura-profile-v1';
  const statsKey = 'rio-aventura-stats-v1';
  const avatars = ['🚤', '🧒', '🐬', '🌊'];
  const profile = readProfile();
  const stats = readStats();
  let state = 'ready';
  let boat, obstacles, particles, score, lives, elapsed, spawnIn, immunity, direction, riverSpeed;
  let runDistance = 0;
  let settingsReturnState = null;
  let wakeTimer = 0;
  let impact = 0;
  let cameraX = 0;
  let lastFrame = 0;
  let activePointerId = null;
  const heldKeys = { left: false, right: false };

  function readObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }

  function saveObject(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function readBest() {
    try { return safeCount(localStorage.getItem(bestKey)); }
    catch (_) { return 0; }
  }

  function safeCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100000000, Math.floor(number))) : 0;
  }

  function readProfile() {
    const saved = readObject(profileKey);
    const name = typeof saved.name === 'string' ? saved.name.trim().slice(0, 18) : '';
    return {
      name: name || 'Invitado',
      avatar: Math.min(avatars.length - 1, safeCount(saved.avatar)),
      quality: saved.quality === 'low' ? 'low' : 'high'
    };
  }

  function readStats() {
    const saved = readObject(statsKey);
    return {
      runs: safeCount(saved.runs),
      dodged: safeCount(saved.dodged),
      distance: safeCount(saved.distance)
    };
  }

  function updateSettingsView() {
    avatarButton.textContent = avatars[profile.avatar];
    profileName.value = profile.name;
    qualitySelect.value = profile.quality;
    document.getElementById('bestScore').textContent = String(readBest());
    document.getElementById('totalRuns').textContent = String(stats.runs);
    document.getElementById('totalDodged').textContent = String(stats.dodged);
    document.getElementById('totalDistance').textContent = `${stats.distance} m`;
  }

  function updateProfileBadge() {
    playerTag.textContent = `${avatars[profile.avatar]} ${profile.name}`;
  }

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
    return 0.62 + 0.38 * Math.max(0, Math.min(1, y / height));
  }

  function projectedX(x, y) {
    return width / 2 + (x - width / 2) * depthAt(y) - cameraX;
  }

  function reset() {
    boat = { x: width / 2, y: height - 150, vx: 0, tilt: 0, lean: 0 };
    obstacles = [];
    particles = [];
    score = 0;
    runDistance = 0;
    lives = 3;
    elapsed = 0;
    spawnIn = 0.6;
    immunity = 0;
    direction = 0;
    riverSpeed = 140;
    activePointerId = null;
    heldKeys.left = false;
    heldKeys.right = false;
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
    activePointerId = null;
    boat.vx = 0;
    const best = Math.max(score, readBest());
    try { localStorage.setItem(bestKey, String(best)); } catch (_) { /* Session can still finish. */ }
    stats.runs = Math.min(100000000, stats.runs + 1);
    stats.dodged = Math.min(100000000, stats.dodged + score);
    stats.distance = Math.min(100000000, stats.distance + Math.round(runDistance));
    saveObject(statsKey, stats);
    showOverlay('¡Fin del<br>viaje!', `Lograste ${score} puntos. Tu récord es ${best}.`, 'Jugar otra vez');
  }

  function spawn() {
    const kind = Math.random() < 0.78 ? 'rock' : 'log';
    const radius = kind === 'rock' ? 19 + Math.random() * 11 : 26;
    obstacles.push({ x: 78 + Math.random() * (width - 156), y: -40, radius, kind, counted: false, phase: Math.random() * Math.PI * 2 });
  }

  function splash(x, y, count, color) {
    const limit = profile.quality === 'low' ? Math.ceil(count * 0.45) : count;
    for (let i = 0; i < limit; i++) {
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
    const targetVx = direction * 285;
    const velocityChange = targetVx - boat.vx;
    const acceleration = direction === 0 ? 1180 : 1050;
    boat.vx += Math.sign(velocityChange) * Math.min(Math.abs(velocityChange), acceleration * dt);
    boat.x += boat.vx * dt;
    if (boat.x < 74 || boat.x > width - 74) {
      boat.x = Math.max(74, Math.min(width - 74, boat.x));
      boat.vx = 0;
    }
    const turnAmount = boat.vx / 285;
    boat.tilt += ((turnAmount * 0.17 + direction * 0.025) - boat.tilt) * Math.min(1, dt * 7);
    boat.lean += ((turnAmount * 0.20 + direction * 0.07) - boat.lean) * Math.min(1, dt * 8);
    const cameraTarget = (boat.x - width / 2) * 0.16;
    cameraX += (cameraTarget - cameraX) * Math.min(1, dt * 4);
    const targetRiverSpeed = Math.min(390, 190 + elapsed * 3.2);
    riverSpeed += Math.min(targetRiverSpeed - riverSpeed, 135 * dt);
    runDistance += riverSpeed * dt / 10;
    wakeTimer -= dt;
    if (wakeTimer <= 0) {
      const spray = Math.abs(turnAmount);
      splash(boat.x + (Math.random() - 0.5) * 28, boat.y + 35, 2 + Math.round(spray * 2), '#e7ffff');
      if (spray > 0.3) splash(boat.x - Math.sign(boat.vx) * 36, boat.y + 15, 2, '#c9f7f2');
      wakeTimer = 0.12 - spray * 0.035;
    }
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt + 48 * dt;
      particle.vx *= 0.96;
      particle.age += dt;
    }
    particles = particles.filter(particle => particle.age < particle.life);
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(0.48, 1.1 - elapsed * 0.012) + Math.random() * 0.28;
    }
    for (const item of obstacles) {
      item.y += riverSpeed * dt;
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
        boat.vx *= 0.45;
        riverSpeed *= 0.75;
        splash(boat.x, boat.y, 22, '#ffffff');
        updateHud();
        if (lives === 0) { finish(); return; }
      }
    }
    obstacles = obstacles.filter(item => item.y < height + 50);
  }

  function riverEdge(side, y) {
    return projectedX(side ? width - 52 : 52, y);
  }

  function drawTree(x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = '#092e3280';
    ctx.beginPath(); ctx.ellipse(16, 17, 29, 10, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#61452c';
    ctx.fillRect(-4, -28, 8, 42);
    ctx.fillStyle = '#174b3b';
    ctx.beginPath(); ctx.arc(-14, -35, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, -37, 21, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f8b59';
    ctx.beginPath(); ctx.arc(0, -51, 23, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#69b875';
    ctx.beginPath(); ctx.ellipse(-8, -59, 9, 5, -0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawRiver() {
    ctx.fillStyle = '#224d3a';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(riverEdge(0, 0), 0);
    ctx.lineTo(riverEdge(1, 0), 0);
    ctx.lineTo(riverEdge(1, height), height);
    ctx.lineTo(riverEdge(0, height), height);
    ctx.closePath();
    ctx.clip();
    const water = ctx.createLinearGradient(0, 0, width, height);
    water.addColorStop(0, '#18566c');
    water.addColorStop(0.47, '#2a9caa');
    water.addColorStop(1, '#64c8c2');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, width, height);
    if (profile.quality === 'high') {
      const shimmer = (elapsed * 82) % 190;
      for (let y = shimmer - 190; y < height + 90; y += 190) {
        const left = riverEdge(0, y) + 18;
        const right = riverEdge(1, y) - 18;
        ctx.strokeStyle = '#dcfff038';
        ctx.lineWidth = 14 * depthAt(y);
        ctx.beginPath();
        ctx.moveTo(left, y + 18);
        ctx.bezierCurveTo(left + 52, y - 12, right - 55, y + 46, right, y + 10);
        ctx.stroke();
      }
    }
    for (const side of [0, 1]) {
      const bankShade = ctx.createLinearGradient(riverEdge(side, height / 2), 0, width / 2, 0);
      bankShade.addColorStop(0, '#113f5688');
      bankShade.addColorStop(1, '#113f5600');
      ctx.fillStyle = bankShade;
      const edge = riverEdge(side, height / 2);
      ctx.fillRect(side ? edge - 28 : edge, 0, 28, height);
    }
    const flow = (elapsed * 125) % 125;
    for (let y = flow - 125; y < height + 50; y += 125) {
      for (const x of [115, 225, 335]) {
        const center = projectedX(x + Math.sin(elapsed * 1.8 + y * 0.018) * 5, y);
        const size = 12 * depthAt(y);
        ctx.strokeStyle = '#e6ffff99';
        ctx.lineWidth = 2.5 * depthAt(y);
        ctx.beginPath();
        ctx.moveTo(center - size, y);
        ctx.quadraticCurveTo(center, y - size * 0.6, center + size, y);
        ctx.stroke();
        ctx.strokeStyle = '#b7f8ee88';
        ctx.beginPath();
        ctx.moveTo(center - size * 0.45, y + 9);
        ctx.lineTo(center + size * 0.45, y + 9);
        ctx.stroke();
      }
    }
    if (profile.quality === 'high') {
      const shoreFlow = (elapsed * 105) % 92;
      for (const side of [0, 1]) {
        const inward = side ? -1 : 1;
        for (let y = shoreFlow - 92; y < height + 25; y += 92) {
          const x = riverEdge(side, y) + inward * (13 + 5 * Math.sin(y * 0.025));
          ctx.strokeStyle = '#d8fff1aa';
          ctx.lineWidth = 2 * depthAt(y);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + inward * 9, y - 6, x + inward * 17, y + 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    for (const side of [0, 1]) {
      ctx.strokeStyle = '#102f32';
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(riverEdge(side, 0), 0);
      ctx.lineTo(riverEdge(side, height), height); ctx.stroke();
      ctx.strokeStyle = '#dac78c';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(riverEdge(side, 0), 0);
      ctx.lineTo(riverEdge(side, height), height); ctx.stroke();
      for (let y = (elapsed * 94) % 165 - 165; y < height + 110; y += profile.quality === 'low' ? 330 : 165) {
        const treeX = riverEdge(side, y) + (side ? 30 : -30);
        drawTree(treeX, y, 0.58 + 0.5 * depthAt(y));
      }
    }
  }

  function drawObstacle(item) {
    ctx.save();
    ctx.translate(projectedX(item.x, item.y), item.y + Math.sin(elapsed * 3 + item.phase) * 3);
    ctx.scale(depthAt(item.y), depthAt(item.y));
    const ripple = (elapsed * 24 + item.phase * 4) % 18;
    ctx.strokeStyle = '#e9ffffa8';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * (item.radius + 2), 10);
      ctx.quadraticCurveTo(side * (item.radius + 15), 17 + ripple * 0.4,
        side * (item.radius + 12), 24 + ripple);
      ctx.stroke();
    }
    if (item.kind === 'rock') {
      ctx.fillStyle = '#0d3b4977';
      ctx.beginPath();
      ctx.ellipse(8, 16, item.radius + 12, item.radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.fillStyle = '#718d94';
      ctx.beginPath();
      ctx.moveTo(-item.radius * 0.62, 1);
      ctx.lineTo(-3, -item.radius * 0.62);
      ctx.lineTo(9, item.radius * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#aebdc0';
      ctx.beginPath();
      ctx.arc(-7, -10, item.radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(Math.sin(elapsed * 2 + item.phase) * 0.12 + 0.18);
      ctx.fillStyle = '#0d3b4977';
      ctx.beginPath(); ctx.ellipse(8, 16, 38, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dcf6ec88';
      ctx.beginPath();
      ctx.ellipse(0, 8, 38, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#764b31';
      ctx.fillRect(-31, -12, 62, 24);
      ctx.fillStyle = '#aa7045';
      ctx.fillRect(-31, -12, 62, 5);
      ctx.fillStyle = '#c38b58';
      ctx.beginPath(); ctx.ellipse(-31, 0, 5, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d3955c';
      ctx.lineWidth = 2;
      for (const x of [-18, 4, 20]) {
        ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + 8, 8); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawWake() {
    const x = projectedX(boat.x, boat.y);
    const turn = boat.vx / 285;
    const length = 44 + riverSpeed * 0.07 + Math.abs(turn) * 20;
    ctx.save();
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#e8ffffa8';
      ctx.lineWidth = 3 + Math.abs(turn) * 2;
      ctx.beginPath();
      ctx.moveTo(x + side * 25, boat.y + 26);
      ctx.quadraticCurveTo(x + side * 37 - turn * 12, boat.y + length * 0.65,
        x + side * (44 + Math.abs(turn) * 10) - turn * 18, boat.y + length);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoat() {
    if (immunity > 0 && Math.floor(immunity * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(projectedX(boat.x, boat.y), boat.y + Math.sin(elapsed * 7) * 3);
    ctx.scale(depthAt(boat.y), depthAt(boat.y));
    ctx.rotate(boat.tilt + Math.sin(elapsed * 3) * 0.025);
    ctx.fillStyle = '#0b34468c';
    ctx.beginPath();
    ctx.ellipse(9, 38, 48, 15, 0, 0, Math.PI * 2);
    ctx.fill();
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
    const stroke = Math.sin(elapsed * (9 + riverSpeed / 100)) * (0.65 + Math.abs(boat.vx) / 950);
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
    ctx.translate(0, 5);
    ctx.rotate(boat.lean);
    ctx.translate(0, -5);
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
    drawWake();
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

  function restoreKeyboardDirection() {
    direction = Number(heldKeys.right) - Number(heldKeys.left);
  }

  function openSettings() {
    if (settingsReturnState !== null) return;
    settingsReturnState = state;
    if (state === 'playing') {
      state = 'paused';
      direction = 0;
      activePointerId = null;
      boat.vx = 0;
      heldKeys.left = false;
      heldKeys.right = false;
      pause.textContent = '▶';
    }
    profileNotice.textContent = '';
    updateSettingsView();
    settingsPanel.classList.remove('hidden');
  }

  function closeSettings() {
    if (settingsReturnState === null) return;
    settingsPanel.classList.add('hidden');
    if (settingsReturnState === 'playing') {
      state = 'playing';
      pause.textContent = 'Ⅱ';
    }
    settingsReturnState = null;
  }

  settingsButton.addEventListener('click', openSettings);
  openingSettings.addEventListener('click', openSettings);
  closeSettingsButton.addEventListener('click', closeSettings);
  avatarButton.addEventListener('click', () => {
    profile.avatar = (profile.avatar + 1) % avatars.length;
    avatarButton.textContent = avatars[profile.avatar];
    updateProfileBadge();
    profileNotice.textContent = saveObject(profileKey, profile) ? 'Avatar guardado.' : 'No se pudo guardar en este teléfono.';
  });
  saveProfileButton.addEventListener('click', () => {
    profile.name = profileName.value.trim().slice(0, 18) || 'Invitado';
    profileName.value = profile.name;
    updateProfileBadge();
    profileNotice.textContent = saveObject(profileKey, profile) ? 'Perfil guardado.' : 'No se pudo guardar en este teléfono.';
  });
  qualitySelect.addEventListener('change', () => {
    profile.quality = qualitySelect.value === 'low' ? 'low' : 'high';
    profileNotice.textContent = saveObject(profileKey, profile) ? 'Calidad guardada.' : 'No se pudo guardar en este teléfono.';
  });

  canvas.addEventListener('pointerdown', event => {
    if (state !== 'playing' || activePointerId !== null) return;
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    direction = pointerDirection(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (state === 'playing' && event.pointerId === activePointerId) direction = pointerDirection(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, event => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      restoreKeyboardDirection();
    });
  }
  window.addEventListener('keydown', event => {
    if (state !== 'playing') return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') heldKeys.left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') heldKeys.right = true;
    if (activePointerId === null) restoreKeyboardDirection();
  });
  window.addEventListener('keyup', event => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') heldKeys.left = false;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') heldKeys.right = false;
    if (activePointerId === null) restoreKeyboardDirection();
  });
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
      activePointerId = null;
      boat.vx = 0;
      heldKeys.left = false;
      heldKeys.right = false;
      pause.textContent = '▶';
      showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && settingsReturnState === 'playing') {
      settingsReturnState = 'paused';
      showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    }
    if (document.hidden && state === 'playing') {
      state = 'paused';
      direction = 0;
      activePointerId = null;
      boat.vx = 0;
      heldKeys.left = false;
      heldKeys.right = false;
      pause.textContent = '▶';
      showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    }
  });
  resizeStage();
  window.addEventListener('resize', resizeStage);
  reset();
  updateProfileBadge();
  requestAnimationFrame(frame);
})();
