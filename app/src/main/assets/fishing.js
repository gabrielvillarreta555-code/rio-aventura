// Pesca de Río Aventura 2.7.1: especies, caladeros, tiempos y precios. Solo datos y reglas puras.
// game.js lleva la partida (lancha parada en un caladero, esperar la picada, recoger a tiempo) y
// cobra la venta al pescador en el historial de monedas; sea-view.js dibuja los caladeros.
(() => {
  'use strict';

  // Capacidad de la hielera. Con el precio máximo (20) una venta completa vale 200, el tope de un evento.
  const capacity = 10;
  const maxSale = 200;

  const species = Object.freeze([
    { id: 'sardina', name: 'Sardina', icon: '🐟', price: 2, color: '#9fc5d8' },
    { id: 'caballa', name: 'Caballa', icon: '🐟', price: 3, color: '#5f8fb8' },
    { id: 'pargo', name: 'Pargo', icon: '🐠', price: 6, color: '#e0705a' },
    { id: 'dorada', name: 'Dorada', icon: '🐠', price: 9, color: '#e8b84a' },
    { id: 'pez-luna', name: 'Pez luna', icon: '✨', price: 20, color: '#b9a2ff' }
  ]);
  const speciesById = Object.create(null);
  for (const item of species) speciesById[item.id] = item;

  // Pesos de captura por caladero. El lago del norte es más difícil de alcanzar y da mejores peces.
  const zoneSpecs = Object.freeze([
    { id: 'bahia', name: 'Caladero de la Bahía', tx: 51.5, ty: 91, radius: 90,
      weights: { sardina: 50, caballa: 30, pargo: 15, dorada: 5, 'pez-luna': 0 } },
    { id: 'lago', name: 'Caladero del Lago Norte', tx: 40.5, ty: 17.5, radius: 90,
      weights: { sardina: 15, caballa: 20, pargo: 30, dorada: 25, 'pez-luna': 10 } }
  ]);

  // Tiempos del lance: espera hasta que pique y margen para recoger.
  const timing = Object.freeze({ waitMin: 1.5, waitSpan: 2.5, window: 1.1, quick: 0.5, maxSpeed: 30 });

  const species_ = id => (typeof id === 'string' ? speciesById[id] || null : null);
  const emptyBag = () => Object.fromEntries(species.map(item => [item.id, 0]));
  const count = bag => species.reduce((sum, item) => sum + (bag[item.id] || 0), 0);
  const value = bag => species.reduce((sum, item) => sum + (bag[item.id] || 0) * item.price, 0);

  // Bolsa válida: solo especies conocidas, enteros ≥ 0 y a lo sumo la capacidad. Devuelve una copia limpia o null.
  function cleanBag(bag) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return null;
    const out = emptyBag();
    for (const key of Object.keys(bag)) {
      if (!speciesById[key] || !Number.isInteger(bag[key]) || bag[key] < 0 || bag[key] > capacity) return null;
      out[key] = bag[key];
    }
    return count(out) <= capacity ? out : null;
  }

  // Elige una especie del caladero. `random()` en [0, 1). Con reflejos rápidos se sortea dos veces y se
  // conserva el pez de más valor.
  function roll(zone, random, quick) {
    const pick = () => {
      let total = 0;
      for (const item of species) total += zone.weights[item.id] || 0;
      let point = random() * total;
      for (const item of species) {
        point -= zone.weights[item.id] || 0;
        if (point < 0) return item;
      }
      return species[0];
    };
    const first = pick();
    if (!quick) return first;
    const second = pick();
    return second.price > first.price ? second : first;
  }

  const waitTime = random => timing.waitMin + random() * timing.waitSpan;

  window.RioFishing = Object.freeze({
    version: 1, capacity, maxSale, species, zoneSpecs, timing,
    species_, emptyBag, count, value, cleanBag, roll, waitTime
  });
})();
