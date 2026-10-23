// Mundo explorable de Río Aventura 2.5: puerto, destinos, rutas y reglas de desbloqueo.
// Solo datos y funciones puras: no toca el DOM, el lienzo ni el almacenamiento, así que se
// puede probar sin navegador. game.js decide cuándo se descubre un destino y lo guarda en
// el historial de monedas; aquí solo se define qué existe y qué requisitos tiene cada cosa.
(() => {
  'use strict';

  // Valores de la navegación libre de siempre. Cada ruta los cambia para tener su propia
  // dificultad: velocidad de la corriente, frecuencia de obstáculos, monedas y troncos a la deriva.
  const defaultTune = Object.freeze({
    speedStart: 140, speedBase: 190, speedGrowth: 3.2, speedCap: 390, speedStageGain: 15, accel: 135,
    spawnBase: 1.1, spawnGrowth: 0.012, spawnStageGain: 0.065, spawnFloor: 0.44, spawnJitter: 0.28, firstSpawn: 0.6,
    coinMin: 2.6, coinJitter: 1.1, firstCoin: 1.8, rockShare: 0.78, driftSpeed: 52, driftStageGain: 10,
    quietEnd: 0
  });

  const rankNames = Object.freeze({ explorer: 'Explorador', navigator: 'Navegante', captain: 'Capitán del río' });

  // `x` e `y` son posiciones normalizadas (0 a 1) sobre el mapa. `requires.discovered` lista los
  // destinos que hay que haber descubierto antes y `requires.rank` un rango permanente.
  const nodeList = [
    {
      id: 'puerto', kind: 'port', name: 'Puerto Palmar', icon: '⚓', x: 0.5, y: 0.86, accent: '#ffd36a',
      tagline: 'Tu puerto de origen',
      blurb: 'Aquí empieza toda aventura. Elige un destino en el mapa y zarpa, o sal a navegar libremente.'
    },
    {
      id: 'aldea', kind: 'dest', name: 'Aldea Coral', icon: '🏘️', x: 0.76, y: 0.69, accent: '#ff9a6a',
      tagline: 'Pueblo de pescadores',
      blurb: 'Casas de palma y muelles de madera. Es la ruta más tranquila: perfecta para empezar a explorar.',
      requires: { discovered: [], rank: '' }, reward: 20, difficulty: 1,
      route: {
        distance: 1200, from: 'puerto', stageNames: ['Muelles del puerto', 'Bahía de las redes', 'Entrada a la aldea'],
        drift: [0, 0, 0.12],
        tune: { speedStart: 130, speedBase: 160, speedGrowth: 2.4, speedCap: 270, speedStageGain: 10, spawnBase: 1.35,
          spawnGrowth: 0.008, spawnFloor: 0.78, spawnStageGain: 0.05, spawnJitter: 0.3, firstSpawn: 1.0, coinMin: 2.2,
          coinJitter: 1.0, rockShare: 0.85, quietEnd: 22 }
      }
    },
    {
      id: 'manglar', kind: 'dest', name: 'Manglar Sombrío', icon: '🌿', x: 0.23, y: 0.58, accent: '#7ad39a',
      tagline: 'Laberinto de raíces',
      blurb: 'Raíces enormes y troncos que se mueven con la marea. Hay que mirar bien por dónde se rema.',
      requires: { discovered: ['aldea'], rank: '' }, reward: 35, difficulty: 2,
      route: {
        distance: 1800, from: 'aldea', stageNames: ['Orilla de barro', 'Túnel de raíces', 'Corazón del manglar'],
        drift: [0.15, 0.35, 0.5],
        tune: { speedStart: 140, speedBase: 170, speedGrowth: 2.6, speedCap: 290, speedStageGain: 12, spawnBase: 1.0,
          spawnGrowth: 0.01, spawnFloor: 0.5, spawnStageGain: 0.06, spawnJitter: 0.26, firstSpawn: 0.8, coinMin: 2.8,
          coinJitter: 1.2, rockShare: 0.55, driftSpeed: 56, quietEnd: 24 }
      }
    },
    {
      id: 'cascada', kind: 'dest', name: 'Cascada Brumosa', icon: '🌊', x: 0.77, y: 0.45, accent: '#7ad8ff',
      tagline: 'Corriente veloz',
      blurb: 'El río baja deprisa de la montaña hasta una cascada envuelta en niebla. Rocas grandes y mucha velocidad.',
      requires: { discovered: ['aldea'], rank: '' }, reward: 40, difficulty: 3,
      route: {
        distance: 2600, from: 'aldea', stageNames: ['Pozas claras', 'Rápidos', 'Pie de la cascada'],
        drift: [0, 0.15, 0.25],
        tune: { speedStart: 170, speedBase: 220, speedGrowth: 3.8, speedCap: 430, speedStageGain: 18, accel: 150,
          spawnBase: 1.1, spawnGrowth: 0.012, spawnFloor: 0.56, spawnStageGain: 0.06, spawnJitter: 0.26, firstSpawn: 0.7,
          coinMin: 2.6, coinJitter: 1.1, rockShare: 0.92, quietEnd: 26 }
      }
    },
    {
      id: 'ruinas', kind: 'dest', name: 'Ruinas del Sol', icon: '🏛️', x: 0.4, y: 0.32, accent: '#ffc65a',
      tagline: 'Ciudad de piedra',
      blurb: 'Columnas y puertas de una ciudad antigua. Dicen que el sol de la tarde enciende un tesoro escondido.',
      requires: { discovered: ['manglar', 'cascada'], rank: '' }, reward: 60, difficulty: 4,
      route: {
        distance: 3200, from: 'cascada', stageNames: ['Escalinatas hundidas', 'Calzada de columnas', 'Puerta del Sol'],
        drift: [0.1, 0.3, 0.45],
        tune: { speedStart: 150, speedBase: 200, speedGrowth: 3.2, speedCap: 350, speedStageGain: 14, spawnBase: 1.0,
          spawnGrowth: 0.012, spawnFloor: 0.46, spawnStageGain: 0.065, spawnJitter: 0.26, firstSpawn: 0.7, coinMin: 2.6,
          coinJitter: 1.1, rockShare: 0.72, quietEnd: 28 }
      }
    },
    {
      id: 'laguna', kind: 'dest', name: 'Laguna de las Luciérnagas', icon: '✨', x: 0.64, y: 0.14, accent: '#b9a2ff',
      tagline: 'Lago secreto',
      blurb: 'Un lago escondido que brilla de noche con cristales y luciérnagas. El destino más difícil y más bonito.',
      requires: { discovered: ['ruinas'], rank: 'navigator' }, reward: 100, difficulty: 5,
      route: {
        distance: 4200, from: 'ruinas', stageNames: ['Cañón dorado', 'Bosque de cristales', 'Lago luminoso'],
        drift: [0.3, 0.45, 0.55],
        tune: { speedStart: 150, speedBase: 190, speedGrowth: 3.0, speedCap: 360, speedStageGain: 14, spawnBase: 1.0,
          spawnGrowth: 0.012, spawnFloor: 0.44, spawnStageGain: 0.06, spawnJitter: 0.24, firstSpawn: 0.7, coinMin: 1.8,
          coinJitter: 0.8, rockShare: 0.7, driftSpeed: 56, quietEnd: 30 }
      }
    }
  ];

  const nodes = Object.freeze(nodeList.map(node => Object.freeze(node)));
  const byId = Object.create(null);
  for (const node of nodes) byId[node.id] = node;

  const destinations = Object.freeze(nodes.filter(node => node.kind === 'dest'));
  const idPattern = /^[a-z][a-z0-9-]{0,23}$/;

  function nodeById(id) {
    return typeof id === 'string' ? byId[id] || null : null;
  }

  function validId(id) {
    return typeof id === 'string' && idPattern.test(id);
  }

  // Convierte un conjunto o lista en algo con `has`, para aceptar Set, arreglos y objetos simples.
  function holds(collection) {
    if (!collection) return { has: () => false };
    if (typeof collection.has === 'function') return collection;
    if (Array.isArray(collection)) return { has: id => collection.includes(id) };
    return { has: id => Boolean(collection[id]) };
  }

  // `context`: { discovered, ranks }. Devuelve si el destino está abierto y qué falta.
  function status(id, context) {
    const node = nodeById(id);
    if (!node || node.kind !== 'dest') return { open: id === 'puerto', missing: [] };
    const discovered = holds(context && context.discovered);
    const ranks = holds(context && context.ranks);
    const missing = [];
    for (const need of node.requires.discovered) {
      if (!discovered.has(need)) missing.push(`Descubre ${byId[need].name}`);
    }
    if (node.requires.rank && !ranks.has(node.requires.rank)) {
      missing.push(`Alcanza el rango ${rankNames[node.requires.rank] || node.requires.rank}`);
    }
    return { open: missing.length === 0, missing };
  }

  function isOpen(id, context) {
    return status(id, context).open;
  }

  function openIds(context) {
    return destinations.filter(node => isOpen(node.id, context)).map(node => node.id);
  }

  // Destinos que se abren al cumplir algo de `id` (para anunciarlo al descubrir).
  function dependents(id) {
    return destinations.filter(node => node.requires.discovered.includes(id)).map(node => node.id);
  }

  function round10(value) {
    return Math.round(value / 10) * 10;
  }

  const routeCache = Object.create(null);

  // Ruta hacia un destino: distancia, tramos de control, ajustes de dificultad y tema visual.
  function routeFor(id) {
    if (routeCache[id]) return routeCache[id];
    const node = nodeById(id);
    if (!node || node.kind !== 'dest') return null;
    const spec = node.route;
    const stages = spec.stageNames.map((name, index) => ({
      start: index === 0 ? 0 : round10(spec.distance * index / spec.stageNames.length),
      name, driftChance: spec.drift[index]
    }));
    const route = Object.freeze({
      id: node.id, to: node.id, from: spec.from, name: `Ruta a ${node.name}`, destination: node.name, theme: node.id,
      distance: spec.distance, stages: Object.freeze(stages.map(stage => Object.freeze(stage))),
      tune: Object.freeze({ ...defaultTune, ...spec.tune }), reward: node.reward, difficulty: node.difficulty
    });
    routeCache[id] = route;
    return route;
  }

  function routeById(id) {
    return validId(id) ? routeFor(id) : null;
  }

  // Segundos aproximados que dura una ruta navegando sin chocar (misma fórmula que el motor).
  function estimateSeconds(route) {
    const tune = route.tune;
    let distance = 0;
    let speed = tune.speedStart;
    let time = 0;
    let stage = 0;
    while (distance < route.distance && time < 900) {
      time += 0.25;
      while (stage < route.stages.length - 1 && distance >= route.stages[stage + 1].start) stage++;
      const target = Math.min(tune.speedCap, tune.speedBase + time * tune.speedGrowth + stage * tune.speedStageGain);
      speed += Math.min(target - speed, tune.accel * 0.25);
      distance += speed * 0.25 / 10;
    }
    return Math.round(time);
  }

  function durationText(route) {
    const seconds = estimateSeconds(route);
    const minutes = Math.max(1, Math.round(seconds / 30) / 2);
    return `≈ ${String(minutes).replace('.', ',')} min`;
  }

  window.RioWorld = Object.freeze({
    version: 1, nodes, destinations, defaultTune, rankNames,
    nodeById, validId, status, isOpen, openIds, dependents, routeFor, routeById, estimateSeconds, durationText
  });
})();
