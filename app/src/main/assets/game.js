(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const world = window.RioWorld;
  const art = window.RioArt.create({ canvas, ctx, document });
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const play = document.getElementById('play');
  const pause = document.getElementById('pause');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const stageLabel = document.getElementById('stageLabel');
  const stageDistance = document.getElementById('stageDistance');
  const stageProgress = document.getElementById('stageProgress');
  const stageToast = document.getElementById('stageToast');
  const rankToast = document.getElementById('rankToast');
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
  const backupText = document.getElementById('backupText');
  const exportProgressButton = document.getElementById('exportProgress');
  const importProgressButton = document.getElementById('importProgress');
  const backupNotice = document.getElementById('backupNotice');
  const performanceInfo = document.getElementById('performanceInfo');
  const coinHud = document.getElementById('coinHud');
  const garageCoins = document.getElementById('garageCoins');
  const garageNotice = document.getElementById('garageNotice');
  const finishTripButton = document.getElementById('finishTrip');
  const width = canvas.width;
  let height = canvas.height;
  const bestKey = 'rio-aventura-best-v1';
  const profileKey = 'rio-aventura-profile-v1';
  const legacyStatsKey = 'rio-aventura-stats-v1';
  const statsKey = 'rio-aventura-stats-v2';
  const backupFormat = 'rio-aventura-progress-v1';
  const economyKey = 'rio-aventura-economy-v1';
  const economyBackupFormat = 'rio-aventura-progress-v2';
  const compactBackupFormat = 'rio-aventura-progress-v3';
  const worldBackupFormat = 'rio-aventura-progress-v4';
  const maxEventAmount = 200;
  const tripKey = 'rio-aventura-trip-v1';
  const settleKey = 'rio-aventura-settle-v1';
  const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
  const hashPattern = /^[0-9a-f]{16}$/;
  const chainStart = '0000000000000000';
  const maxCount = 100000000;
  const maxTripReward = 80;
  const compactAfter = 300;
  const keepRecent = 60;
  const maxTailEvents = 2000;
  const maxLegacyEvents = 50000;
  const maxMarks = 40;
  const maxDays = 60;
  const maxPendingRuns = 10;
  const maxAppliedRuns = 20;
  const tripSaveSeconds = 3;
  const gfxKey = 'rio-aventura-gfx-v1';
  // Escalera de calidad gráfica automática: de menor a mayor detalle y resolución.
  const gfxTiers = [
    { detail: 0, scale: 0.85 }, { detail: 0, scale: 1 }, { detail: 1, scale: 1 }, { detail: 2, scale: 1 },
    { detail: 2, scale: 1.25 }, { detail: 2, scale: 1.5 }, { detail: 2, scale: 2 }
  ];
  const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const avatars = ['🚤', '🧒', '🐬', '🌊'];
  const boats = [
    { id: 'classic', name: 'Clásica', price: 0, hull: ['#d19451', '#7c452b', '#4c2b23'], trim: '#e1aa65' },
    { id: 'coral', name: 'Coral', price: 15, hull: ['#ffad78', '#df675d', '#8b3b50'], trim: '#ffd8a0' },
    { id: 'storm', name: 'Tormenta', price: 45, hull: ['#9fd8e9', '#447aab', '#263c70'], trim: '#c8f4f4' },
    { id: 'breeze', name: 'Brisa', price: 0, unlockRank: 'explorer', hull: ['#b2e7bd', '#53aa80', '#266257'], trim: '#ebffe0' },
    { id: 'aurora', name: 'Aurora', price: 0, unlockRank: 'captain', hull: ['#e0b8fa', '#9163c9', '#413f8b'], trim: '#fff0c6' }
  ];
  art.prepare(boats);
  const ranks = [
    { id: 'explorer', name: 'Explorador', badge: '🥉', distance: 250, dodged: 3, reward: 10 },
    { id: 'navigator', name: 'Navegante', badge: '🥈', distance: 800, dodged: 15, reward: 20 },
    { id: 'captain', name: 'Capitán del río', badge: '🥇', distance: 2000, dodged: 40, reward: 40 }
  ];
  const dailyMissions = [
    { id: 'distance', name: 'Recorre 150 m', metric: 'distance', target: 150, reward: 5 },
    { id: 'dodged', name: 'Esquiva 4 obstáculos', metric: 'dodged', target: 4, reward: 6 },
    { id: 'pickups', name: 'Recoge 2 monedas flotantes', metric: 'pickups', target: 2, reward: 4 }
  ];
  const achievements = [
    { id: 'first', name: 'Primer viaje', metric: 'runs', target: 1 },
    { id: 'regular', name: 'Remero constante', metric: 'runs', target: 10 },
    { id: 'dodger', name: 'Esquivador', metric: 'dodged', target: 25 },
    { id: 'traveler', name: 'Viajero del río', metric: 'distance', target: 1500 },
    { id: 'explorer', name: 'Primer destino', metric: 'discovered', target: 1 },
    { id: 'cartographer', name: 'Cartógrafo', metric: 'discovered', target: world.destinations.length }
  ];
  const stages = [
    { start: 0, name: 'Orillas tranquilas', driftChance: 0 },
    { start: 100, name: 'Troncos a la deriva', driftChance: 0.32 },
    { start: 230, name: 'Corriente rápida', driftChance: 0.42 },
    { start: 400, name: 'Río bravo', driftChance: 0.5 }
  ];
  const profile = readProfile();
  const stats = readStats();
  let economyError = false;
  const economy = readEconomy();
  let state = 'ready';
  let activeRoute = null;
  let launchRouteId = null;
  let tune = world.defaultTune;
  let tripStages = stages;
  let economyView = null;
  let tripId = null;
  let tripSaveIn = tripSaveSeconds;
  let hudReward = -1;
  let interrupted = null;
  let runSerial = 0;
  let boat, obstacles, collectibles, particles, score, lives, elapsed, spawnIn, coinSpawnIn, immunity, shieldTimer, direction, riverSpeed;
  let collectedCoins = 0;
  let runDistance = 0;
  let stageIndex = 0;
  let stageHudTimer = 0;
  let stageToastTimer = 0;
  let rankToastTimer = 0;
  let settingsReturnState = null;
  let wakeTimer = 0;
  let impact = 0;
  let cameraX = 0;
  let lastFrame = 0;
  let lastRender = -Infinity;
  let renderScale = 1;
  const pixelRatio = Number(window.devicePixelRatio) || 1;
  const gfxMaxTier = pixelRatio >= 2 ? 6 : pixelRatio >= 1.5 ? 5 : 3;
  let gfxTier = 3;
  let gfxCeiling = gfxMaxTier;
  let gfxEma = 16.7;
  let gfxRefresh = 17;
  let gfxClock = 0;
  let gfxGood = 0;
  let gfxBad = 0;
  let gfxProbe = 0;
  const scene = { height: 800, cameraX: 0, riverSpeed: 0, stageIndex: 0, theme: 'free', remaining: -1, quality: 'high', state: 'ready',
    boat: null, boatStyle: boats[0], immunity: 0, shieldTimer: 0, impact: 0, obstacles: [], collectibles: [], particles: [] };
  let fpsWindowStart = 0;
  let fpsFrames = 0;
  let measuredFps = null;
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

  function localDayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function validDayKey(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7));
    const date = Number(day.slice(8, 10));
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const maxDate = month === 2 && leap ? 29 : monthLengths[month - 1];
    return month >= 1 && month <= 12 && date >= 1 && date <= maxDate;
  }

  function freshEconomy() {
    return { version: 1, deviceId: `d${Date.now().toString(36)}${Math.floor(Math.random() * 1000000000).toString(36)}`,
      nextEvent: 1, events: [], selected: 'classic' };
  }

  function validRunId(value) {
    return typeof value === 'string' && idPattern.test(value);
  }

  function validRunList(list) {
    return Array.isArray(list) && list.length <= maxAppliedRuns && list.every(validRunId) && new Set(list).size === list.length;
  }

  function newRunId() {
    runSerial = (runSerial + 1) % 1679616;
    return `r${Date.now().toString(36)}${stats.runs.toString(36)}${economy.nextEvent.toString(36)}${runSerial.toString(36)}${Math.floor(Math.random() * 1000000).toString(36)}`;
  }

  // Hash encadenado para comparar historiales sin conservar todos sus eventos.
  function chainHash(previous, event) {
    const text = `${previous}|${JSON.stringify(event)}`;
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 2654435761);
      h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  function replayEconomy(events, base = null) {
    const owned = new Set(['classic']);
    const earnedRanks = new Set();
    const dailyProgress = new Map();
    const claimedMissions = new Set();
    const seen = new Set();
    const discovered = new Set();
    const arrivals = new Map();
    let lastDay = '';
    let coins = 0;
    if (base) {
      coins = base.coins;
      lastDay = base.lastDay;
      for (const id of base.owned) owned.add(id);
      for (const id of base.ranks) earnedRanks.add(id);
      for (const key of base.claimed) claimedMissions.add(key);
      for (const day of Object.keys(base.daily)) dailyProgress.set(day, { ...base.daily[day] });
      for (const id of base.discovered) discovered.add(id);
      for (const id of Object.keys(base.arrivals)) arrivals.set(id, base.arrivals[id]);
    }
    for (const event of events) {
      if (!event || typeof event.id !== 'string' || !idPattern.test(event.id) || seen.has(event.id)) return null;
      seen.add(event.id);
      if (event.type === 'earn' && Number.isInteger(event.amount) && event.amount >= 1 && event.amount <= maxEventAmount) {
        const hasRank = Object.prototype.hasOwnProperty.call(event, 'rank');
        const hasRun = Object.prototype.hasOwnProperty.call(event, 'run');
        const hasDiscover = Object.prototype.hasOwnProperty.call(event, 'discover');
        const hasDaily = Object.prototype.hasOwnProperty.call(event, 'dailyDay') ||
          Object.prototype.hasOwnProperty.call(event, 'dailyMission');
        if (Number(hasRank) + Number(hasRun) + Number(hasDaily) + Number(hasDiscover) > 1) return null;
        if (!hasDiscover && event.amount > 80) return null;
        if (hasRank) {
          const rank = ranks.find(item => item.id === event.rank);
          if (!rank || event.amount !== rank.reward || earnedRanks.has(rank.id)) return null;
          earnedRanks.add(rank.id);
        } else if (hasRun) {
          const run = event.run;
          if (!run || !validDayKey(run.day) || (run.id !== undefined && !validRunId(run.id)) ||
              ![run.distance, run.dodged, run.pickups].every(value =>
                Number.isInteger(value) && value >= 0 && value <= maxCount) ||
              (run.route !== undefined && !world.validId(run.route)) ||
              (run.arrived !== undefined && (run.arrived !== true || run.route === undefined))) return null;
          if (run.arrived) arrivals.set(run.route, (arrivals.get(run.route) || 0) + 1);
          const progress = dailyProgress.get(run.day) || { distance: 0, dodged: 0, pickups: 0 };
          progress.distance += run.distance;
          progress.dodged += run.dodged;
          progress.pickups += run.pickups;
          dailyProgress.set(run.day, progress);
          if (run.day > lastDay) lastDay = run.day;
        } else if (hasDiscover) {
          // Un destino solo se descubre una vez: la repetición haría inválido el historial.
          if (!world.validId(event.discover) || discovered.has(event.discover)) return null;
          discovered.add(event.discover);
        } else if (hasDaily) {
          const mission = dailyMissions.find(item => item.id === event.dailyMission);
          const claimKey = `${event.dailyDay}:${event.dailyMission}`;
          const progress = dailyProgress.get(event.dailyDay);
          if (!validDayKey(event.dailyDay) || !mission || event.amount !== mission.reward ||
              claimedMissions.has(claimKey) || !progress || progress[mission.metric] < mission.target) return null;
          claimedMissions.add(claimKey);
          if (event.dailyDay > lastDay) lastDay = event.dailyDay;
        }
        coins += event.amount;
        if (coins > maxCount) return null;
      } else if (event.type === 'buy') {
        const boatOption = boats.find(item => item.id === event.boat);
        if (!boatOption || boatOption.price === 0 || event.amount !== boatOption.price ||
            owned.has(event.boat) || coins < boatOption.price) return null;
        coins -= boatOption.price;
        owned.add(event.boat);
      } else return null;
    }
    for (const boatOption of boats) {
      if (boatOption.unlockRank && earnedRanks.has(boatOption.unlockRank)) owned.add(boatOption.id);
    }
    return { coins, owned, earnedRanks, dailyProgress, claimedMissions, lastDay, discovered, arrivals };
  }

  function validateBase(base) {
    const count = value => Number.isInteger(value) && value >= 0 && value <= maxCount;
    const unique = list => new Set(list).size === list.length;
    const missionIds = dailyMissions.map(item => item.id);
    if (!base || typeof base !== 'object' || !count(base.count) || base.count < 1 || !count(base.coins) ||
        typeof base.hash !== 'string' || !hashPattern.test(base.hash) ||
        !Array.isArray(base.marks) || base.marks.length > maxMarks ||
        !base.marks.every(mark => mark && count(mark.count) && typeof mark.hash === 'string' && hashPattern.test(mark.hash)) ||
        !Array.isArray(base.owned) || !unique(base.owned) ||
        !base.owned.every(id => boats.some(item => item.id === id && item.price > 0)) ||
        !Array.isArray(base.ranks) || !unique(base.ranks) || !base.ranks.every(id => ranks.some(item => item.id === id)) ||
        (base.lastDay !== '' && !validDayKey(base.lastDay)) ||
        !base.daily || typeof base.daily !== 'object' || Array.isArray(base.daily)) return null;
    const found = base.discovered === undefined ? [] : base.discovered;
    const visits = base.arrivals === undefined ? {} : base.arrivals;
    if (!Array.isArray(found) || !unique(found) || found.length > 64 || !found.every(id => world.validId(id)) ||
        !visits || typeof visits !== 'object' || Array.isArray(visits) || Object.keys(visits).length > 64 ||
        !Object.keys(visits).every(id => world.validId(id) && count(visits[id]))) return null;
    const days = Object.keys(base.daily);
    if (days.length > maxDays || !days.every(day => validDayKey(day) && base.daily[day] &&
        ['distance', 'dodged', 'pickups'].every(key => count(base.daily[day][key])))) return null;
    if (!Array.isArray(base.claimed) || !unique(base.claimed) || base.claimed.length > maxDays * missionIds.length ||
        !base.claimed.every(key => typeof key === 'string' && days.includes(key.slice(0, 10)) &&
          missionIds.includes(key.slice(11)) && key[10] === ':')) return null;
    const daily = {};
    for (const day of days) {
      const counts = base.daily[day];
      daily[day] = { distance: counts.distance, dodged: counts.dodged, pickups: counts.pickups };
    }
    return { count: base.count, hash: base.hash, marks: base.marks.map(mark => ({ count: mark.count, hash: mark.hash })),
      coins: base.coins, owned: [...base.owned], ranks: [...base.ranks], lastDay: base.lastDay, daily, claimed: [...base.claimed],
      discovered: [...found], arrivals: { ...visits } };
  }

  // Un historial usa el formato 3 en cuanto contiene destinos descubiertos o viajes con ruta:
  // la versión anterior (formatos 1 y 2) lo rechaza sin dañarlo en lugar de ignorar esos datos.
  function usesWorld(value) {
    const base = value.base;
    if (base && (base.discovered.length || Object.keys(base.arrivals).length)) return true;
    return value.events.some(event => event && (event.discover !== undefined || (event.run && event.run.route !== undefined)));
  }

  function validateEconomy(value) {
    if (!value || (value.version !== 1 && value.version !== 2 && value.version !== 3) || typeof value.deviceId !== 'string' ||
        !idPattern.test(value.deviceId) || !Number.isInteger(value.nextEvent) || value.nextEvent < 1 ||
        !Array.isArray(value.events) || (value.appliedRuns !== undefined && !validRunList(value.appliedRuns))) return null;
    let base = null;
    if (value.version === 2 || (value.version === 3 && value.base !== undefined)) {
      base = validateBase(value.base);
      if (!base || value.events.length > maxTailEvents) return null;
    } else if (value.base !== undefined || value.events.length > maxLegacyEvents) return null;
    const view = replayEconomy(value.events, base);
    if (!view || !view.owned.has(value.selected)) return null;
    const clean = { version: value.version, deviceId: value.deviceId, nextEvent: value.nextEvent,
      events: value.events, selected: value.selected };
    if (base) clean.base = base;
    if (value.appliedRuns !== undefined) clean.appliedRuns = [...value.appliedRuns];
    return clean;
  }

  function sameEconomyState(a, b) {
    if (a.coins !== b.coins || a.lastDay !== b.lastDay || a.owned.size !== b.owned.size ||
        a.earnedRanks.size !== b.earnedRanks.size) return false;
    for (const id of a.owned) if (!b.owned.has(id)) return false;
    for (const id of a.earnedRanks) if (!b.earnedRanks.has(id)) return false;
    if (a.discovered.size !== b.discovered.size || a.arrivals.size !== b.arrivals.size) return false;
    for (const id of a.discovered) if (!b.discovered.has(id)) return false;
    for (const [id, visitCount] of a.arrivals) if (b.arrivals.get(id) !== visitCount) return false;
    if (JSON.stringify(a.dailyProgress.get(a.lastDay) || null) !== JSON.stringify(b.dailyProgress.get(b.lastDay) || null)) return false;
    return dailyMissions.every(mission =>
      a.claimedMissions.has(`${a.lastDay}:${mission.id}`) === b.claimedMissions.has(`${b.lastDay}:${mission.id}`));
  }

  // Resume los eventos antiguos en un saldo y conserva solo los recientes. Nunca compacta
  // si el estado resultante no es idéntico al del historial completo.
  function compactEconomy(value) {
    if (value.events.length <= compactAfter) return value;
    const base = value.base || null;
    const cut = value.events.length - keepRecent;
    const head = value.events.slice(0, cut);
    const summary = replayEconomy(head, base);
    const before = replayEconomy(value.events, base);
    if (!summary || !before) return value;
    let hash = base ? base.hash : chainStart;
    for (const event of head) hash = chainHash(hash, event);
    const count = (base ? base.count : 0) + head.length;
    const recentDays = [...summary.dailyProgress.keys()].sort().slice(-maxDays);
    const daily = {};
    for (const day of recentDays) {
      const counts = summary.dailyProgress.get(day);
      daily[day] = { distance: counts.distance, dodged: counts.dodged, pickups: counts.pickups };
    }
    const candidate = { ...value, version: 2, events: value.events.slice(cut), base: {
      count, hash, marks: [...(base ? base.marks : []), { count, hash }].slice(-maxMarks),
      coins: summary.coins,
      owned: boats.filter(item => item.price > 0 && summary.owned.has(item.id)).map(item => item.id),
      ranks: ranks.filter(item => summary.earnedRanks.has(item.id)).map(item => item.id),
      lastDay: summary.lastDay, daily,
      claimed: [...summary.claimedMissions].filter(key => recentDays.includes(key.slice(0, 10))),
      discovered: [...summary.discovered], arrivals: Object.fromEntries(summary.arrivals)
    } };
    candidate.version = usesWorld(candidate) ? 3 : 2;
    const after = validateEconomy(candidate);
    const afterView = after && replayEconomy(after.events, after.base);
    return afterView && sameEconomyState(before, afterView) ? after : value;
  }

  function economyChain(value) {
    let hash = value.base ? value.base.hash : chainStart;
    let count = value.base ? value.base.count : 0;
    for (const event of value.events) {
      hash = chainHash(hash, event);
      count++;
    }
    return { count, hash };
  }

  function economyHashAt(value, target) {
    if (target === 0) return chainStart;
    let count = value.base ? value.base.count : 0;
    let hash = value.base ? value.base.hash : chainStart;
    if (target === count) return hash;
    if (target < count) {
      const mark = value.base.marks.find(item => item.count === target);
      return mark ? mark.hash : null;
    }
    for (const event of value.events) {
      hash = chainHash(hash, event);
      if (++count === target) return hash;
    }
    return null;
  }

  // Verdadero si el historial de `outer` empieza exactamente por todo el de `inner`.
  function economyCovers(outer, inner) {
    const tip = economyChain(inner);
    return economyHashAt(outer, tip.count) === tip.hash;
  }

  function readEconomy() {
    let saved;
    try {
      const text = localStorage.getItem(economyKey);
      if (text === null) return freshEconomy();
      saved = validateEconomy(JSON.parse(text));
    } catch (_) { /* Keep the stored value for manual recovery. */ }
    if (saved) return saved;
    economyError = true;
    return freshEconomy();
  }

  function saveEconomy(next, allowRecovery = false) {
    if (economyError && !allowRecovery) return false;
    let compact = compactEconomy(next);
    if (compact.version < 3 && usesWorld(compact)) compact = { ...compact, version: 3 };
    if (!validateEconomy(compact) || !saveObject(economyKey, compact)) return false;
    for (const key of Object.keys(economy)) if (!(key in compact)) delete economy[key];
    Object.assign(economy, compact);
    economyView = null;
    economyError = false;
    updateCoinHud();
    return true;
  }

  function economyWithEvent(event, current = economy) {
    let sequence = current.nextEvent;
    let id = `${current.deviceId}-${sequence}`;
    while (current.events.some(item => item.id === id)) id = `${current.deviceId}-${++sequence}`;
    return { ...current, nextEvent: sequence + 1,
      events: [...current.events, { id, ...event }] };
  }

  function currentView() {
    if (!economyView) economyView = replayEconomy(economy.events, economy.base || null);
    return economyView;
  }

  function worldContext() {
    const view = currentView();
    return { discovered: view.discovered, ranks: view.earnedRanks };
  }

  function routeOpen(id) {
    return Boolean(world.routeById(id)) && world.isOpen(id, worldContext());
  }

  function setActiveRoute(id) {
    activeRoute = id ? world.routeById(id) : null;
    tune = activeRoute ? activeRoute.tune : world.defaultTune;
    tripStages = activeRoute ? activeRoute.stages : stages;
    scene.theme = activeRoute ? activeRoute.theme : 'free';
  }

  function remainingMeters() {
    return activeRoute ? Math.max(0, activeRoute.distance - runDistance) : -1;
  }

  function tripReward(distance, dodged, pickups) {
    return Math.max(1, Math.min(maxTripReward, Math.floor(distance / 35) + dodged * 2 + pickups * 3));
  }

  function updateCoinHud() {
    if (economyError) {
      coinHud.textContent = '🪙 !';
      return;
    }
    hudReward = state === 'playing' ? tripReward(runDistance, score, collectedCoins) : -1;
    const tripText = hudReward < 0 ? '' : ` · viaje +${hudReward}${hudReward >= maxTripReward ? ' (máx.)' : ''}`;
    coinHud.textContent = `🪙 ${currentView().coins}${tripText}`;
  }

  function updateGarageView() {
    const { coins, owned } = currentView();
    garageCoins.textContent = `${coins} monedas`;
    for (const boatOption of boats) {
      const button = document.getElementById(`boat-${boatOption.id}`);
      button.textContent = owned.has(boatOption.id)
        ? economy.selected === boatOption.id ? 'Equipada' : 'Elegir'
        : boatOption.unlockRank
          ? `Requiere ${ranks.find(rank => rank.id === boatOption.unlockRank).name}`
          : `Comprar · ${boatOption.price} 🪙`;
      button.disabled = economy.selected === boatOption.id || economyError ||
        Boolean(boatOption.unlockRank && !owned.has(boatOption.id));
    }
    if (economyError) garageNotice.textContent = 'No se pudo leer el progreso de monedas. Restaura una copia antes de comprar.';
  }

  function updateRankView() {
    const earnedRanks = economyError ? new Set() : currentView().earnedRanks;
    const next = ranks.find(rank => !earnedRanks.has(rank.id));
    const rankProgressText = document.getElementById('rankProgressText');
    const rankProgressFill = document.getElementById('rankProgressFill');
    const rankProgressTrack = document.getElementById('rankProgressTrack');
    if (economyError) {
      rankProgressText.textContent = 'Restaura el progreso para ver el siguiente rango.';
      rankProgressFill.style.width = '0%';
      rankProgressTrack.setAttribute('aria-valuenow', '0');
    } else if (!next) {
      rankProgressText.textContent = '¡Todos los rangos desbloqueados!';
      rankProgressFill.style.width = '100%';
      rankProgressTrack.setAttribute('aria-valuenow', '100');
    } else {
      rankProgressText.textContent = `Siguiente: ${next.badge} ${next.name} · ${Math.min(stats.distance, next.distance)}/${next.distance} m · ${Math.min(stats.dodged, next.dodged)}/${next.dodged} esquivas`;
      const progress = Math.round(Math.min(stats.distance / next.distance, stats.dodged / next.dodged, 1) * 100);
      rankProgressFill.style.width = `${progress}%`;
      rankProgressTrack.setAttribute('aria-valuenow', String(progress));
    }
    for (const rank of ranks) {
      const label = document.getElementById(`rank-${rank.id}`);
      const card = document.getElementById(`rank-card-${rank.id}`);
      if (earnedRanks.has(rank.id)) card.classList.add('unlocked');
      else card.classList.remove('unlocked');
      label.textContent = economyError ? 'Recupera tu progreso de monedas para ver los rangos.'
        : earnedRanks.has(rank.id) ? `Desbloqueado · +${rank.reward} 🪙 recibidas`
          : stats.distance >= rank.distance && stats.dodged >= rank.dodged
            ? `¡Objetivo listo! Termina un viaje para cobrar +${rank.reward} 🪙`
          : `${Math.min(stats.distance, rank.distance)}/${rank.distance} m · ${Math.min(stats.dodged, rank.dodged)}/${rank.dodged} esquivas · premio +${rank.reward} 🪙`;
    }
  }

  function updateDailyView() {
    const dateLabel = document.getElementById('dailyDate');
    if (economyError) {
      dateLabel.textContent = 'Restaura el progreso para ver las misiones.';
      return;
    }
    const view = currentView();
    const today = localDayKey();
    const day = view.lastDay > today ? view.lastDay : today;
    dateLabel.textContent = view.lastDay > today
      ? `Día ${day} · el reloj del teléfono está atrasado; se conserva el último día registrado.`
      : `Día ${day} · se reinician al cambiar de día en tu teléfono.`;
    const progress = view.dailyProgress.get(day) || { distance: 0, dodged: 0, pickups: 0 };
    for (const mission of dailyMissions) {
      const label = document.getElementById(`daily-${mission.id}`);
      label.textContent = view.claimedMissions.has(`${day}:${mission.id}`)
        ? `Completada · +${mission.reward} 🪙 recibidas`
        : `${Math.min(progress[mission.metric], mission.target)}/${mission.target} · premio +${mission.reward} 🪙`;
    }
  }

  function achievementValue(achievement, statistics, discoveredCount) {
    return achievement.metric === 'discovered' ? discoveredCount : statistics[achievement.metric];
  }

  function updateAchievementView() {
    const found = economyError ? 0 : currentView().discovered.size;
    for (const achievement of achievements) {
      const label = document.getElementById(`achievement-${achievement.id}`);
      const value = achievementValue(achievement, stats, found);
      label.textContent = value >= achievement.target ? 'Desbloqueado' : `${Math.min(value, achievement.target)}/${achievement.target}`;
    }
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
    if (saved.version !== 2) {
      const legacy = readObject(legacyStatsKey);
      return {
        runs: safeCount(legacy.runs), dodged: 0,
        distance: safeCount(legacy.distance), legacyDodged: safeCount(legacy.dodged), appliedRuns: []
      };
    }
    return {
      runs: safeCount(saved.runs),
      dodged: safeCount(saved.dodged),
      distance: safeCount(saved.distance),
      legacyDodged: safeCount(saved.legacyDodged),
      appliedRuns: validRunList(saved.appliedRuns) ? [...saved.appliedRuns] : []
    };
  }

  function saveStats(next = stats) {
    return saveObject(statsKey, { version: 2, ...next });
  }

  function exportBackup() {
    return JSON.stringify({
      format: economy.version === 3 ? worldBackupFormat : economy.version === 2 ? compactBackupFormat : economyBackupFormat,
      profile: { ...profile },
      best: readBest(),
      stats: { ...stats },
      economy: { ...economy }
    });
  }

  function parseBackup(text) {
    if (text.length > 3000000) return null;
    let backup;
    try { backup = JSON.parse(text); } catch (_) { return null; }
    if (!backup || ![backupFormat, economyBackupFormat, compactBackupFormat, worldBackupFormat].includes(backup.format) ||
        !backup.profile || !backup.stats) return null;
    const { name, avatar, quality } = backup.profile;
    if (typeof name !== 'string' || !name.trim() || name.length > 18 ||
        !Number.isInteger(avatar) || avatar < 0 || avatar >= avatars.length ||
        !['high', 'low'].includes(quality)) return null;
    const values = [backup.best, backup.stats.runs, backup.stats.dodged,
      backup.stats.distance, backup.stats.legacyDodged];
    if (!values.every(value => Number.isInteger(value) && value >= 0 && value <= 100000000)) return null;
    if (backup.format !== backupFormat) {
      const normalized = validateEconomy(backup.economy);
      if (!normalized) return null;
      backup.economy = normalized;
    }
    return backup;
  }

  function updateSettingsView() {
    avatarButton.textContent = avatars[profile.avatar];
    profileName.value = profile.name;
    qualitySelect.value = profile.quality;
    document.getElementById('bestScore').textContent = String(readBest());
    document.getElementById('totalRuns').textContent = String(stats.runs);
    document.getElementById('totalDodged').textContent = String(stats.dodged);
    document.getElementById('legacyDodged').textContent = String(stats.legacyDodged);
    document.getElementById('totalDistance').textContent = `${stats.distance} m`;
    performanceInfo.textContent = measuredFps === null
      ? 'FPS: juega unos segundos para medirlos.'
      : `Última medición: ${measuredFps} FPS dibujados. Gráficos: detalle ${currentTier().detail}, resolución ${currentTier().scale}×.`;
    updateGarageView();
    updateRankView();
    updateDailyView();
    updateAchievementView();
  }

  function updateProfileBadge() {
    const earnedRanks = economyError ? new Set() : currentView().earnedRanks;
    let highest = null;
    for (const rank of ranks) if (earnedRanks.has(rank.id)) highest = rank;
    playerTag.textContent = `${avatars[profile.avatar]} ${profile.name}${highest ? ` · ${highest.badge} ${highest.name}` : ''}`;
  }

  // Keep the original 450-unit playfield while filling taller phone screens.
  function resizeStage() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const nextHeight = Math.max(800, Math.round(width * bounds.height / bounds.width));
    if (nextHeight === height) return;
    const difference = nextHeight - height;
    height = nextHeight;
    applyCanvasSize();
    if (boat) boat.y += difference;
    if (obstacles) obstacles.forEach(item => { item.y += difference; });
    if (collectibles) collectibles.forEach(coin => { coin.y += difference; });
  }

  function updateStageHud() {
    if (activeRoute) {
      stageLabel.textContent = `Hacia ${activeRoute.destination} · ${stageIndex + 1}/${tripStages.length}`;
      stageDistance.textContent = `${Math.min(Math.floor(runDistance), activeRoute.distance)} / ${activeRoute.distance} m`;
      stageProgress.style.width = `${Math.max(0, Math.min(100, runDistance / activeRoute.distance * 100))}%`;
      return;
    }
    const current = stages[stageIndex];
    const next = stages[stageIndex + 1];
    stageLabel.textContent = `Tramo ${stageIndex + 1} · ${current.name}`;
    stageDistance.textContent = next
      ? `${Math.floor(runDistance)} / ${next.start} m`
      : `${Math.floor(runDistance)} m · sin fin`;
    stageProgress.style.width = next
      ? `${Math.max(0, Math.min(100, (runDistance - current.start) / (next.start - current.start) * 100))}%`
      : '100%';
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
    collectibles = [];
    particles = [];
    score = 0;
    collectedCoins = 0;
    runDistance = 0;
    stageIndex = 0;
    stageHudTimer = 0;
    stageToastTimer = 0;
    stageToast.classList.add('hidden');
    rankToastTimer = 0;
    rankToast.classList.add('hidden');
    lives = 3;
    elapsed = 0;
    spawnIn = tune.firstSpawn;
    coinSpawnIn = tune.firstCoin;
    immunity = 0;
    shieldTimer = 0;
    direction = 0;
    riverSpeed = tune.speedStart;
    activePointerId = null;
    heldKeys.left = false;
    heldKeys.right = false;
    wakeTimer = 0;
    impact = 0;
    cameraX = 0;
    fpsWindowStart = 0;
    fpsFrames = 0;
    measuredFps = null;
    updateHud();
    updateStageHud();
    updateCoinHud();
  }

  function updateHud() {
    scoreEl.textContent = `${score} puntos`;
    livesEl.textContent = `${'♥ '.repeat(lives).trim() || '—'}${shieldTimer > 0 ? ' 🛡' : ''}`;
  }

  function showOverlay(heading, body, button) {
    title.innerHTML = heading;
    message.textContent = body;
    play.textContent = button;
    if (interrupted) finishTripButton.classList.remove('hidden');
    else finishTripButton.classList.add('hidden');
    overlay.classList.remove('hidden');
  }

  function begin() {
    settlePending();
    interrupted = null;
    // Una ruta bloqueada nunca arranca: se vuelve a la navegación libre.
    if (launchRouteId && !routeOpen(launchRouteId)) launchRouteId = null;
    setActiveRoute(launchRouteId);
    reset();
    tripId = newRunId();
    tripSaveIn = tripSaveSeconds;
    state = 'playing';
    updateCoinHud();
    pause.textContent = 'Ⅱ';
    finishTripButton.classList.add('hidden');
    overlay.classList.add('hidden');
  }

  function finish() {
    closeTrip(false);
  }

  function arrive() {
    closeTrip(true);
  }

  // Cierra el viaje: por perder las vidas (finish) o por llegar al destino (arrive).
  function closeTrip(arrived) {
    state = arrived ? 'arrived' : 'over';
    direction = 0;
    activePointerId = null;
    boat.vx = 0;
    stageToast.classList.add('hidden');
    const run = { id: tripId || newRunId(), score, lives, pickups: collectedCoins,
      distance: Math.floor(runDistance * 10) / 10, elapsed: Math.round(elapsed * 10) / 10,
      route: activeRoute ? activeRoute.id : '', arrived: arrived && Boolean(activeRoute) };
    const result = settlePending(run).get(run.id);
    if (result.complete || readPendingRuns().some(item => item.id === run.id)) clearStorageKey(tripKey);
    const rankReward = result.newRanks.reduce((sum, rank) => sum + rank.reward, 0);
    const rankMessage = result.newRanks.length
      ? ` ¡Nuevo rango: ${result.newRanks[result.newRanks.length - 1].name}! Premio extra: ${rankReward} monedas.` : '';
    const dailyMessage = result.newMissions.length
      ? ` Misiones diarias: +${result.newMissions.reduce((sum, mission) => sum + mission.reward, 0)} monedas.` : '';
    const achievementMessage = result.newAchievements.length
      ? ` Nuevo logro: ${result.newAchievements.map(item => item.name).join(', ')}.` : '';
    const coinMessage = result.economySaved ? `ganaste ${result.earned} monedas de viaje` : `tienes ${result.earned} monedas de viaje pendientes`;
    const warning = result.complete ? ''
      : economyError ? ' No se pueden guardar las monedas: restaura una copia en Ajustes y este viaje se completará.'
      : ' No se pudo guardar todo el progreso. Se reintentará al empezar otro viaje; no desinstales la app.';
    if (arrived) {
      const place = activeRoute.destination;
      const arrival = result.arrival;
      const discovery = arrival && arrival.first ? ` ¡Lugar descubierto! +${arrival.reward} monedas de primera visita.` : '';
      const opened = arrival && arrival.opened.length
        ? ` Nuevas rutas abiertas: ${arrival.opened.map(id => world.nodeById(id).name).join(', ')}.` : '';
      showOverlay(`¡Llegaste a<br>${place}!`,
        `Lograste ${score} puntos y ${coinMessage}.${discovery}${opened} Tu récord es ${result.best}.${rankMessage}${dailyMessage}${achievementMessage}${warning}`,
        'Navegar otra vez');
    } else {
      showOverlay('¡Fin del<br>viaje!',
        `Lograste ${score} puntos, recogiste ${collectedCoins} monedas flotantes y ${coinMessage}. Tu récord es ${result.best}.${rankMessage}${dailyMessage}${achievementMessage}${warning}`,
        'Jugar otra vez');
    }
    showRankToast(result.newRanks);
  }

  function showRankToast(newRanks) {
    if (!newRanks.length) return;
    const highest = newRanks[newRanks.length - 1];
    const reward = newRanks.reduce((sum, rank) => sum + rank.reward, 0);
    rankToast.textContent = `${highest.badge} ¡Nuevo rango: ${highest.name}! Premio +${reward} monedas`;
    rankToast.classList.remove('hidden');
    rankToastTimer = 3;
  }

  function resumeInterruptedTrip() {
    if (!interrupted) return;
    restoreTrip(interrupted);
    tripSaveIn = tripSaveSeconds;
    state = 'playing';
    updateCoinHud();
    pause.textContent = 'Ⅱ';
    finishTripButton.classList.add('hidden');
    overlay.classList.add('hidden');
  }

  function cashInterruptedTrip() {
    if (!interrupted) return;
    restoreTrip(interrupted);
    finish();
  }

  function pauseTrip() {
    state = 'paused';
    direction = 0;
    activePointerId = null;
    boat.vx = 0;
    heldKeys.left = false;
    heldKeys.right = false;
    pause.textContent = '▶';
    showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    persistTrip();
  }

  function intWithin(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max;
  }

  function numberWithin(value, max) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
  }

  function tripSnapshot(source) {
    if (!source || !validRunId(source.id) || !intWithin(source.score, 1000000) || !intWithin(source.lives, 3) ||
        !intWithin(source.pickups, 100000) || !numberWithin(source.distance, 1000000) ||
        !numberWithin(source.elapsed, 1000000)) return null;
    const route = typeof source.route === 'string' && world.routeById(source.route) ? source.route : '';
    return { id: source.id, score: source.score, lives: source.lives, pickups: source.pickups,
      distance: source.distance, elapsed: source.elapsed, route, arrived: Boolean(route) && source.arrived === true };
  }

  function readTrip() {
    const saved = readObject(tripKey);
    const trip = saved.version === 1 ? tripSnapshot(saved) : null;
    return trip && trip.lives >= 1 ? trip : null;
  }

  function clearStorageKey(key) {
    try { localStorage.removeItem(key); return true; }
    catch (_) { return false; }
  }

  // Guarda el viaje en curso para poder retomarlo si Android cierra la app.
  function persistTrip() {
    if (!tripId || (state !== 'playing' && state !== 'paused') || lives < 1) return false;
    return saveObject(tripKey, { version: 1, id: tripId, score, lives, pickups: collectedCoins,
      distance: Math.round(runDistance * 10) / 10, elapsed: Math.round(elapsed * 10) / 10,
      route: activeRoute ? activeRoute.id : '' });
  }

  function readPendingRuns() {
    const saved = readObject(settleKey);
    if (saved.version !== 1 || !Array.isArray(saved.runs)) return [];
    return saved.runs.map(tripSnapshot).filter(Boolean).slice(0, maxPendingRuns);
  }

  function writePendingRuns(runs) {
    return runs.length ? saveObject(settleKey, { version: 1, runs }) : clearStorageKey(settleKey);
  }

  function runIsApplied(id) {
    return (economy.appliedRuns || []).includes(id) || stats.appliedRuns.includes(id);
  }

  // Aplica el cierre de un viaje. Cada parte (monedas, estadísticas, récord) se aplica una sola vez
  // aunque se reintente, así que un fallo parcial nunca duplica ni pierde premios.
  function settleRun(run) {
    const result = { run, earned: tripReward(run.distance, run.score, run.pickups), best: Math.max(run.score, readBest()),
      newRanks: [], newMissions: [], newAchievements: [], economySaved: true, statsSaved: true, bestSaved: true };
    const distance = safeCount(Math.round(run.distance));
    const route = run.route ? world.routeById(run.route) : null;
    const arrived = Boolean(route && run.arrived && run.distance >= route.distance);
    const discoveredBefore = economyError ? 0 : currentView().discovered.size;
    const statsApplied = stats.appliedRuns.includes(run.id);
    const projected = statsApplied ? { ...stats } : {
      runs: Math.min(maxCount, stats.runs + 1), dodged: Math.min(maxCount, stats.dodged + run.score),
      distance: Math.min(maxCount, stats.distance + distance), legacyDodged: stats.legacyDodged,
      appliedRuns: [...stats.appliedRuns, run.id].slice(-maxAppliedRuns) };
    if (economyError) {
      result.economySaved = false;
    } else if (!(economy.appliedRuns || []).includes(run.id)) {
      const view = currentView();
      const today = localDayKey();
      const day = view.lastDay > today ? view.lastDay : today;
      const record = { id: run.id, day, distance, dodged: run.score, pickups: run.pickups };
      if (route) record.route = route.id;
      if (arrived) record.arrived = true;
      let next = economyWithEvent({ type: 'earn', amount: result.earned, run: record });
      next.appliedRuns = [...(economy.appliedRuns || []), run.id].slice(-maxAppliedRuns);
      // El premio de la primera visita va en su propio evento: el historial rechaza repetirlo.
      const firstVisit = arrived && !view.discovered.has(route.to);
      if (firstVisit) next = economyWithEvent({ type: 'earn', amount: route.reward, discover: route.to }, next);
      const newRanks = ranks.filter(rank => projected.distance >= rank.distance && projected.dodged >= rank.dodged &&
        !view.earnedRanks.has(rank.id));
      for (const rank of newRanks) next = economyWithEvent({ type: 'earn', rank: rank.id, amount: rank.reward }, next);
      const counts = (replayEconomy(next.events, next.base || null) || { dailyProgress: new Map() }).dailyProgress.get(day);
      const claimed = view.claimedMissions;
      const newMissions = counts ? dailyMissions.filter(mission => counts[mission.metric] >= mission.target &&
        !claimed.has(`${day}:${mission.id}`)) : [];
      for (const mission of newMissions) next = economyWithEvent({ type: 'earn', amount: mission.reward,
        dailyDay: day, dailyMission: mission.id }, next);
      if (saveEconomy(next)) {
        result.newRanks = newRanks;
        result.newMissions = newMissions;
        if (arrived) {
          const open = context => world.openIds(context);
          const after = currentView();
          const wasOpen = open({ discovered: view.discovered, ranks: view.earnedRanks });
          result.arrival = { route, first: firstVisit, reward: firstVisit ? route.reward : 0,
            opened: open({ discovered: after.discovered, ranks: after.earnedRanks }).filter(id => !wasOpen.includes(id)) };
        }
      } else result.economySaved = false;
    }
    if (!statsApplied) {
      const before = new Set(achievements.filter(item => achievementValue(item, stats, discoveredBefore) >= item.target).map(item => item.id));
      if (saveStats(projected)) {
        Object.assign(stats, projected);
        const discoveredNow = economyError ? 0 : currentView().discovered.size;
        result.newAchievements = achievements.filter(item => !before.has(item.id) &&
          achievementValue(item, stats, discoveredNow) >= item.target);
      } else result.statsSaved = false;
    }
    try { localStorage.setItem(bestKey, String(result.best)); }
    catch (_) { result.bestSaved = false; }
    result.complete = result.economySaved && result.statsSaved && result.bestSaved;
    return result;
  }

  // Reintenta los cierres que no se pudieron completar (en orden y sin repetir ninguno).
  function settlePending(extraRun = null) {
    let runs = readPendingRuns();
    if (extraRun && !runs.some(item => item.id === extraRun.id)) {
      runs = [...runs, extraRun].slice(-maxPendingRuns);
      writePendingRuns(runs);
    }
    const results = new Map();
    const remaining = [];
    for (const run of runs) {
      const result = settleRun(run);
      results.set(run.id, result);
      if (!result.complete) remaining.push(run);
    }
    if (runs.length) {
      writePendingRuns(remaining);
      updateCoinHud();
      updateProfileBadge();
    }
    return results;
  }

  function stageIndexFor(distance) {
    let index = 0;
    while (index < tripStages.length - 1 && distance >= tripStages[index + 1].start) index++;
    return index;
  }

  function restoreTrip(trip) {
    setActiveRoute(trip.route || null);
    reset();
    tripId = trip.id;
    score = trip.score;
    lives = Math.max(1, trip.lives);
    collectedCoins = trip.pickups;
    runDistance = trip.distance;
    elapsed = trip.elapsed;
    stageIndex = stageIndexFor(runDistance);
    riverSpeed = Math.min(390, 190 + elapsed * 3.2);
    shieldTimer = 3;
    spawnIn = 1.2;
    coinSpawnIn = 2;
    interrupted = null;
    updateHud();
    updateStageHud();
  }

  function offerInterruptedTrip(trip) {
    interrupted = trip;
    const route = trip.route ? world.routeById(trip.route) : null;
    showOverlay('Viaje<br>interrumpido',
      `Tu viaje ${route ? `hacia ${route.destination}` : 'anterior'} quedó guardado: ${trip.score} puntos y ${Math.floor(trip.distance)} m. Puedes continuarlo con 3 s de escudo o cobrar lo conseguido.`,
      'Continuar viaje');
  }

  function recoverOnStartup() {
    if (!economyError && economy.events.length > compactAfter) saveEconomy({ ...economy });
    for (const result of settlePending().values()) showRankToast(result.newRanks);
    const trip = readTrip();
    if (!trip) return;
    const empty = trip.score === 0 && trip.pickups === 0 && trip.distance < 20;
    if (runIsApplied(trip.id) || readPendingRuns().some(item => item.id === trip.id) || empty) clearStorageKey(tripKey);
    else offerInterruptedTrip(trip);
  }

  function spawn() {
    if (activeRoute && activeRoute.distance - runDistance < tune.quietEnd) return;
    const roll = Math.random();
    const kind = roll < tripStages[stageIndex].driftChance ? 'drift' : roll < tune.rockShare ? 'rock' : 'log';
    const radius = kind === 'rock' ? 19 + Math.random() * 11 : 26;
    obstacles.push({ x: 78 + Math.random() * (width - 156), y: -40, radius, kind,
      vx: kind === 'drift' ? (Math.random() < 0.5 ? -1 : 1) * (tune.driftSpeed + stageIndex * tune.driftStageGain) : 0,
      counted: false, hit: false, phase: Math.random() * Math.PI * 2 });
  }

  function spawnCollectible() {
    if (collectibles.length >= 4) return;
    collectibles.push({ x: 90 + Math.random() * (width - 180), y: -25, phase: Math.random() * Math.PI * 2 });
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
    if (shieldTimer > 0) {
      shieldTimer = Math.max(0, shieldTimer - dt);
      if (shieldTimer === 0) updateHud();
    }
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
    const targetRiverSpeed = Math.min(tune.speedCap, tune.speedBase + elapsed * tune.speedGrowth + stageIndex * tune.speedStageGain);
    riverSpeed += Math.min(targetRiverSpeed - riverSpeed, tune.accel * dt);
    runDistance += riverSpeed * dt / 10;
    tripSaveIn -= dt;
    if (tripSaveIn <= 0) {
      tripSaveIn = tripSaveSeconds;
      persistTrip();
    }
    if (tripReward(runDistance, score, collectedCoins) !== hudReward) updateCoinHud();
    if (stageIndex < tripStages.length - 1 && runDistance >= tripStages[stageIndex + 1].start) {
      stageIndex++;
      art.effect('stage', boat.x, boat.y);
      const healed = lives < 3;
      if (healed) lives++;
      shieldTimer = 3;
      updateHud();
      stageToast.textContent = `¡Tramo ${stageIndex + 1}${activeRoute ? `/${tripStages.length}` : ''}: ${tripStages[stageIndex].name}! ${healed ? 'Vida recuperada + ' : ''}Escudo 3 s`;
      stageToast.classList.remove('hidden');
      stageToastTimer = 2.4;
      updateStageHud();
    }
    if (activeRoute && runDistance >= activeRoute.distance) {
      runDistance = activeRoute.distance;
      arrive();
      return;
    }
    if (stageToastTimer > 0) {
      stageToastTimer = Math.max(0, stageToastTimer - dt);
      if (stageToastTimer === 0) stageToast.classList.add('hidden');
    }
    stageHudTimer -= dt;
    if (stageHudTimer <= 0) { updateStageHud(); stageHudTimer = 0.2; }
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
      spawnIn = Math.max(tune.spawnFloor, tune.spawnBase - elapsed * tune.spawnGrowth - stageIndex * tune.spawnStageGain) + Math.random() * tune.spawnJitter;
    }
    coinSpawnIn -= dt;
    if (coinSpawnIn <= 0) {
      spawnCollectible();
      coinSpawnIn = tune.coinMin + Math.random() * tune.coinJitter;
    }
    for (const coin of collectibles) {
      coin.y += riverSpeed * dt;
      const contactRadius = 16 * depthAt(coin.y) + 23 * depthAt(boat.y);
      if (Math.hypot(projectedX(coin.x, coin.y) - projectedX(boat.x, boat.y), coin.y - boat.y) < contactRadius) {
        coin.collected = true;
        collectedCoins++;
        splash(coin.x, coin.y, 9, '#ffdf85');
        art.effect('coin', coin.x, coin.y);
        updateCoinHud();
      }
    }
    collectibles = collectibles.filter(coin => !coin.collected && coin.y < height + 30);
    for (const item of obstacles) {
      item.y += riverSpeed * dt;
      if (item.kind === 'drift') {
        item.x += item.vx * dt;
        if (item.x < 84 || item.x > width - 84) {
          item.x = Math.max(84, Math.min(width - 84, item.x));
          item.vx = -item.vx;
        }
      }
      const contactRadius = item.radius * depthAt(item.y) + 23 * depthAt(boat.y);
      const separation = Math.hypot(projectedX(item.x, item.y) - projectedX(boat.x, boat.y), item.y - boat.y);
      if (!item.hit && separation < contactRadius) {
        item.hit = true;
        if (immunity !== 0 || shieldTimer > 0) {
          if (shieldTimer > 0) {
            splash(item.x, item.y, 7, '#ffdf85');
            art.effect('shield', item.x, item.y);
          }
          continue;
        }
        lives--;
        immunity = 1.4;
        impact = 1;
        boat.vx *= 0.45;
        riverSpeed *= 0.75;
        splash(boat.x, boat.y, 22, '#ffffff');
        art.effect('hit', boat.x, boat.y);
        updateHud();
        if (lives === 0) { finish(); return; }
      }
      if (!item.counted && item.y > boat.y + contactRadius) {
        item.counted = true;
        if (!item.hit) {
          score++;
          updateHud();
        }
      }
    }
    obstacles = obstacles.filter(item => item.y < height + 50);
  }

  function applyCanvasSize() {
    canvas.width = Math.round(width * renderScale);
    canvas.height = Math.round(height * renderScale);
    scene.height = height;
    art.resize(height, renderScale);
    art.setQuality(profile.quality);
  }

  function render() {
    scene.cameraX = cameraX;
    scene.riverSpeed = riverSpeed;
    scene.stageIndex = stageIndex;
    scene.remaining = remainingMeters();
    scene.quality = profile.quality;
    scene.state = state;
    scene.boat = boat;
    scene.boatStyle = boats.find(item => item.id === economy.selected) || boats[0];
    scene.immunity = immunity;
    scene.shieldTimer = shieldTimer;
    scene.impact = impact;
    scene.obstacles = obstacles;
    scene.collectibles = collectibles;
    scene.particles = particles;
    art.draw(scene);
  }

  function currentTier() {
    return profile.quality === 'low' ? gfxTiers[1] : gfxTiers[gfxTier];
  }

  function applyGraphicsTier() {
    const tier = currentTier();
    art.setDetail(tier.detail);
    if (tier.scale !== renderScale) {
      renderScale = tier.scale;
      applyCanvasSize();
    }
  }

  function readStoredTier() {
    const saved = readObject(gfxKey);
    return Number.isInteger(saved.tier) && saved.tier >= 1 && saved.tier <= gfxMaxTier ? saved.tier : 3;
  }

  function setGraphicsTier(next) {
    gfxTier = Math.max(0, Math.min(gfxMaxTier, next));
    gfxGood = 0;
    gfxBad = 0;
    saveObject(gfxKey, { tier: gfxTier });
    applyGraphicsTier();
  }

  // Mide el tiempo real entre fotogramas y ajusta detalle y resolución: baja deprisa si el
  // teléfono se atasca y sube despacio solo si va sobrado. No toca la física del juego.
  function adaptGraphics(interval) {
    if (interval > 250 || profile.quality !== 'high') return;
    gfxEma += (interval - gfxEma) * 0.08;
    gfxRefresh = Math.max(6, Math.min(gfxRefresh, interval));
    gfxClock += interval;
    if (gfxClock < 1500) return;
    gfxClock = 0;
    const budget = Math.max(gfxRefresh, 16.7);
    const slow = gfxEma > Math.max(budget * 1.3, 20);
    const severe = gfxEma > budget * 2.2;
    const smooth = gfxEma < gfxRefresh * 1.15;
    gfxBad = slow ? gfxBad + 1 : 0;
    gfxGood = smooth && !slow ? gfxGood + 1 : 0;
    if (gfxProbe > 0) gfxProbe--;
    if (gfxProbe > 0 && !smooth && gfxTier > 0) {
      // Una subida a prueba solo se mantiene si el teléfono sigue yendo holgado.
      gfxCeiling = Math.min(gfxCeiling, gfxTier - 1);
      gfxProbe = 0;
      setGraphicsTier(gfxTier - 1);
    } else if ((gfxBad >= 2 || (severe && gfxBad >= 1)) && gfxTier > 0) {
      if (gfxProbe > 0) gfxCeiling = Math.min(gfxCeiling, gfxTier - 1);
      setGraphicsTier(gfxTier - (severe ? 2 : 1));
    } else if (gfxGood >= 6 && gfxTier < gfxCeiling) {
      gfxProbe = 3;
      setGraphicsTier(gfxTier + 1);
    }
  }

  function frame(now) {
    const interval = now - lastFrame;
    const dt = Math.min(0.05, interval / 1000 || 0);
    lastFrame = now;
    if (state === 'playing' && !document.hidden) adaptGraphics(interval);
    step(dt);
    scene.cameraX = cameraX;
    scene.stageIndex = stageIndex;
    art.update(dt, state === 'playing' ? riverSpeed : state === 'paused' || state === 'arrived' ? 0 : 60, scene);
    if (rankToastTimer > 0) {
      rankToastTimer = Math.max(0, rankToastTimer - dt);
      if (rankToastTimer === 0) rankToast.classList.add('hidden');
    }
    if (!document.hidden && (profile.quality === 'high' || now - lastRender >= 1000 / 30 - 1)) {
      render();
      lastRender = now;
      if (state === 'playing') {
        if (fpsWindowStart === 0) fpsWindowStart = now;
        fpsFrames++;
        if (now - fpsWindowStart >= 1000) {
          measuredFps = Math.round(fpsFrames * 1000 / (now - fpsWindowStart));
          fpsWindowStart = now;
          fpsFrames = 0;
        }
      } else { fpsWindowStart = 0; fpsFrames = 0; }
    } else if (document.hidden) { fpsWindowStart = 0; fpsFrames = 0; }
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
    rankToastTimer = 0;
    rankToast.classList.add('hidden');
    settingsReturnState = state;
    if (state === 'playing') {
      state = 'paused';
      direction = 0;
      activePointerId = null;
      boat.vx = 0;
      heldKeys.left = false;
      heldKeys.right = false;
      pause.textContent = '▶';
      persistTrip();
    }
    profileNotice.textContent = '';
    backupNotice.textContent = '';
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
    art.setQuality(profile.quality);
    applyGraphicsTier();
    profileNotice.textContent = saveObject(profileKey, profile) ? 'Calidad guardada.' : 'No se pudo guardar en este teléfono.';
  });
  for (const boatOption of boats) {
    document.getElementById(`boat-${boatOption.id}`).addEventListener('click', () => {
      if (economyError) { updateGarageView(); return; }
      const view = currentView();
      if (view.owned.has(boatOption.id)) {
        if (economy.selected === boatOption.id) return;
        garageNotice.textContent = saveEconomy({ ...economy, selected: boatOption.id })
          ? `${boatOption.name} equipada.` : 'No se pudo guardar la lancha elegida.';
      } else if (boatOption.unlockRank) {
        garageNotice.textContent = `Desbloquea el rango ${ranks.find(rank => rank.id === boatOption.unlockRank).name} para elegir ${boatOption.name}.`;
      } else if (view.coins < boatOption.price) {
        garageNotice.textContent = `Faltan ${boatOption.price - view.coins} monedas para ${boatOption.name}.`;
      } else {
        const next = economyWithEvent({ type: 'buy', boat: boatOption.id, amount: boatOption.price });
        next.selected = boatOption.id;
        garageNotice.textContent = saveEconomy(next)
          ? `${boatOption.name} comprada y equipada.` : 'No se pudo guardar la compra; no se descontaron monedas.';
      }
      updateGarageView();
    });
  }
  exportProgressButton.addEventListener('click', () => {
    if (economyError) {
      backupNotice.textContent = 'Las monedas no se pueden leer. No generes una copia nueva; restaura una copia válida primero.';
      return;
    }
    backupText.value = exportBackup();
    backupText.select();
    backupNotice.textContent = 'Copia el texto seleccionado y guárdalo fuera del juego.';
  });
  importProgressButton.addEventListener('click', () => {
    const backup = parseBackup(backupText.value);
    if (!backup) {
      backupNotice.textContent = 'La copia no es válida. No se cambió el progreso.';
      return;
    }
    if (backup.economy) {
      const importedCoversLocal = economyCovers(backup.economy, economy);
      const localCoversImported = economyCovers(economy, backup.economy);
      if (!economyError && !importedCoversLocal && !localCoversImported) {
        backupNotice.textContent = economy.base || backup.economy.base
          ? 'Esta copia no se puede comparar con las monedas del teléfono porque una es anterior a la compactación del historial. Genera una copia nueva en este teléfono. No se cambió el progreso.'
          : 'Las monedas de esta copia y del teléfono son distintas. No se mezclaron para evitar duplicaciones.';
        return;
      }
      const nextEconomy = economyError || importedCoversLocal
        ? { ...backup.economy, appliedRuns: [...new Set([...(economy.appliedRuns || []), ...(backup.economy.appliedRuns || [])])].slice(-maxAppliedRuns) }
        : economy;
      if (!saveEconomy(nextEconomy, true)) {
        backupNotice.textContent = 'No se pudieron guardar las monedas. No se cambió el resto del progreso.';
        return;
      }
    }
    const nextProfile = { ...backup.profile, name: backup.profile.name.trim() };
    const nextStats = {
      runs: Math.max(stats.runs, backup.stats.runs),
      dodged: Math.max(stats.dodged, backup.stats.dodged),
      distance: Math.max(stats.distance, backup.stats.distance),
      legacyDodged: Math.max(stats.legacyDodged, backup.stats.legacyDodged),
      appliedRuns: [...new Set([...stats.appliedRuns, ...(validRunList(backup.stats.appliedRuns) ? backup.stats.appliedRuns : [])])].slice(-maxAppliedRuns)
    };
    const profileSaved = saveObject(profileKey, nextProfile);
    const statsSaved = saveObject(statsKey, { version: 2, ...nextStats });
    let bestSaved = false;
    try { localStorage.setItem(bestKey, String(Math.max(readBest(), backup.best))); bestSaved = true; }
    catch (_) { /* Keep the existing record in memory. */ }
    if (profileSaved) Object.assign(profile, nextProfile);
    if (statsSaved) Object.assign(stats, nextStats);
    settlePending();
    updateProfileBadge();
    updateSettingsView();
    backupNotice.textContent = economyError
      ? 'La copia antigua restauró perfil y estadísticas, pero no contiene monedas. Restaura una copia nueva para recuperarlas.'
      : profileSaved && statsSaved && bestSaved
      ? 'Copia restaurada. Se conservaron los mayores récords y totales; las monedas no se duplicaron.'
      : 'No se pudo guardar todo. Revisa los datos antes de cerrar el juego.';
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
  finishTripButton.addEventListener('click', cashInterruptedTrip);
  play.addEventListener('click', () => {
    if (interrupted) {
      resumeInterruptedTrip();
    } else if (state === 'paused') {
      state = 'playing';
      overlay.classList.add('hidden');
      pause.textContent = 'Ⅱ';
    } else {
      begin();
    }
  });
  pause.addEventListener('click', () => {
    if (state === 'playing') pauseTrip();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && settingsReturnState === 'playing') {
      settingsReturnState = 'paused';
      showOverlay('En pausa', `Llevas ${score} puntos.`, 'Continuar');
    }
    if (document.hidden && state === 'playing') pauseTrip();
    else if (document.hidden) persistTrip();
  });
  // Android puede cerrar la WebView sin avisar: el viaje se guarda al ocultar la página
  // y también cuando MainActivity llama a este gancho antes de pasar a segundo plano.
  function saveBeforeLeaving() {
    if (state === 'playing') pauseTrip();
    else persistTrip();
  }
  window.addEventListener('pagehide', saveBeforeLeaving);
  window.rioAventuraSave = saveBeforeLeaving;
  gfxTier = readStoredTier();
  renderScale = currentTier().scale;
  applyCanvasSize();
  applyGraphicsTier();
  resizeStage();
  window.addEventListener('resize', resizeStage);
  reset();
  updateProfileBadge();
  updateCoinHud();
  recoverOnStartup();
  requestAnimationFrame(frame);
})();
