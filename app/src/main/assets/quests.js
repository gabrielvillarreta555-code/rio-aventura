// Personajes y encargos de transporte de Río Aventura 2.7. Solo datos y reglas puras: no toca el
// DOM, el lienzo ni el almacenamiento, así que se prueba sin navegador. game.js guarda lo ocurrido
// en el historial de monedas (eventos `quest`) y sea-view.js dibuja a los personajes.
//
// Un encargo se acepta hablando con un personaje en su muelle, se cumple conduciendo la lancha
// hasta el muelle de destino y atracando allí; no hay forma de completarlo desde un menú.
(() => {
  'use strict';

  const maxActive = 2;
  const maxRep = 40;

  const kinds = Object.freeze({
    food: { icon: '🐟', name: 'Alimentos', hint: 'Se estropean: llega rápido para una prima de frescura.' },
    tools: { icon: '🧰', name: 'Herramientas', hint: 'Carga resistente: sin prisas ni cuidados especiales.' },
    passenger: { icon: '🧳', name: 'Pasajero', hint: 'Odia los golpes: conduce suave para cobrar más.' }
  });

  // `look` solo sirve para dibujar al personaje en el muelle (sea-view.js).
  const npcList = [
    { id: 'puerto', name: 'Capitana Marisol', role: 'Jefa del puerto', icon: '🧑‍✈️',
      look: { skin: '#e8b08a', shirt: '#2f78c4', hat: 'cap', hatColor: '#f4f0e0' },
      greet: ['¡Bienvenido a Puerto Palmar! Aquí no hay carga pequeña, solo lanchas pequeñas.',
        'Otra vez por aquí. Me gusta la gente que cumple.', '¡Mi mejor lanchero! El puerto entero habla de ti.'],
      chat: ['El río tiene dos canales y una isla en medio. Los viejos dicen que el oeste es más corto, pero más lleno de rocas.',
        'Frena siempre antes de atracar. Un golpe al muelle y se despierta todo el pueblo.',
        'Las cajas de pescado van mejor frescas. Cuanto antes lleguen, más contenta la gente.'],
      none: 'Hoy no me queda nada para ti. Pásate más tarde.' },
    { id: 'aldea', name: 'Tomás el Pescador', role: 'Pescador de la aldea', icon: '🧔',
      look: { skin: '#d49a72', shirt: '#e0524a', hat: 'straw', hatColor: '#e7c66f' },
      greet: ['Buenas, forastero. ¿Traes viento a favor?', 'Ya te conozco: remas bien. Siéntate, que hay faena.',
        'Mi socio de confianza. Lo que pida la aldea, tú lo llevas.'],
      chat: ['Pesco desde antes de que existieran los muelles. Ahora tengo mejores redes y peor espalda.',
        'En el manglar las raíces se mueven con la marea. Ve con cuidado si llevas a alguien a bordo.',
        'Si ves monedas flotando, son de los turistas que se mareaban. Quédatelas.'],
      none: 'Por hoy está todo repartido. Vuelve cuando el mar nos traiga trabajo.' },
    { id: 'manglar', name: 'Abuela Raíz', role: 'Herbolaria del manglar', icon: '👵',
      look: { skin: '#c98a62', shirt: '#4f9a5a', hat: 'hood', hatColor: '#2f6a46' },
      greet: ['Shhh... las raíces escuchan. Pasa, pasa.', 'Tú otra vez, joven. Las plantas te recuerdan.',
        'Eres de la familia del manglar. Pide lo que necesites.'],
      chat: ['Cada hierba cura algo, pero casi todas curan el aburrimiento.',
        'En las aguas oscuras los reflejos engañan. Mira la orilla, no el agua.',
        'La luciérnaga verde solo sale de noche. Dicen que guía a quien va con buen corazón.'],
      none: 'No tengo mandados, hijo. El manglar descansa.' },
    { id: 'cascada', name: 'Ingeniera Lía', role: 'Ingeniera de la presa', icon: '👩‍🔧',
      look: { skin: '#f0c9a6', shirt: '#f2a63a', hat: 'helmet', hatColor: '#ffd23f' },
      greet: ['Seguridad primero: ¿llevas casco? Da igual, ¡bienvenido!', 'El lanchero fiable. Tengo piezas que no pueden esperar.',
        'Con gente como tú, la central nunca para. Gracias.'],
      chat: ['La cascada mueve una turbina antigua. La arreglo cada semana y cada semana se rompe otra cosa.',
        'Los pasajeros odian el agua brusca. Rodea las rocas y cobrarás propina.',
        'Desde aquí arriba se ve toda la isla. Parece un pastel con dos ríos alrededor.'],
      none: 'Sin encargos por hoy. Aprovecha para descansar la lancha.' },
    { id: 'ruinas', name: 'Profesor Quillay', role: 'Arqueólogo', icon: '🧐',
      look: { skin: '#dba784', shirt: '#9a6a3a', hat: 'explorer', hatColor: '#c9a15a' },
      greet: ['¡Ah, un visitante! Cuidado con las columnas, tienen más de mil años.', 'Mi estimado lanchero. Traes buena fortuna.',
        'Colega de excavaciones, por fin. Siéntate; hay mucho que contar.'],
      chat: ['Estas ruinas marcaban la hora con el sol. Hoy marcan la hora de la merienda.',
        'Nunca fíes de un mapa sin muelle. Los antiguos sabían dónde atracar.',
        'En el valle de cristales hay una farera que sabe más de estrellas que yo.'],
      none: 'No hay recados. Estoy ocupado catalogando una piedra.' },
    { id: 'laguna', name: 'Luciana la Farera', role: 'Guardiana de la laguna', icon: '🧙‍♀️',
      look: { skin: '#e6b995', shirt: '#7b62d9', hat: 'hood', hatColor: '#b9a2ff' },
      greet: ['Has llegado lejos. Pocos encuentran el lago escondido.', 'Otra vez tú, de luz tranquila. Bienvenido.',
        'El lago te conoce. Aquí siempre tienes sitio.'],
      chat: ['Las luciérnagas no se asustan de la gente tranquila. Tú les caes bien.',
        'Cuando el lago brilla, las barcas más lentas ganan: nadie tiene prisa en la luz.',
        'Llevo faroles a las ruinas cada vez que el sol se va. Es mi trabajo favorito.'],
      none: 'Hoy el lago está en calma y no hay nada que llevar.' }
  ];

  // Encargos: `reward` es para la primera entrega; las repeticiones pagan la mitad.
  // `minRep`: puntos de reputación con quien los ofrece.
  const templateList = [
    { id: 'pescado-aldea', giver: 'puerto', to: 'aldea', kind: 'food', title: 'Cajas de pescado fresco', minRep: 0, reward: 14,
      ask: 'Tengo cajas de pescado para la Aldea Coral. Si llegan frescas, hay prima.', thanks: 'Pescado fresco, justo a tiempo. ¡Gracias, lanchero!' },
    { id: 'redes-manglar', giver: 'puerto', to: 'manglar', kind: 'tools', title: 'Redes y cuerdas', minRep: 0, reward: 28,
      ask: 'Abuela Raíz pidió redes y cuerdas para el manglar. Es un viaje largo por el canal oeste.', thanks: 'Redes nuevas. Las raíces estarán contentas.' },
    { id: 'turista-cascada', giver: 'puerto', to: 'cascada', kind: 'passenger', title: 'Una turista hacia la cascada', minRep: 3, reward: 36,
      ask: 'Una turista quiere ver la Cascada Brumosa. Que no se maree: nada de golpes.', thanks: '¡Qué viaje! Y qué vistas. Toma, por las molestias.' },
    { id: 'sal-puerto', giver: 'aldea', to: 'puerto', kind: 'food', title: 'Sal y pescado seco', minRep: 0, reward: 14,
      ask: 'Lleva sal y pescado seco a la capitana. Que lo tenga antes de que cierre el puerto.', thanks: 'Justo lo que faltaba en la despensa del puerto.' },
    { id: 'anzuelos-ruinas', giver: 'aldea', to: 'ruinas', kind: 'tools', title: 'Anzuelos para el profesor', minRep: 0, reward: 44,
      ask: 'El profesor Quillay encargó anzuelos de bronce. No sé para qué, pero paga bien. Queda lejos, al norte.', thanks: 'Anzuelos de bronce. Perfectos para probar una teoría.' },
    { id: 'abuela-manglar', giver: 'aldea', to: 'manglar', kind: 'passenger', title: 'Una abuela hacia el manglar', minRep: 3, reward: 26,
      ask: 'Mi tía quiere visitar a Abuela Raíz. Llévala con cuidado, que ya no tiene sus años.', thanks: 'Gracias por no sacudirme. Aquí tienes algo para ti.' },
    { id: 'hierbas-aldea', giver: 'manglar', to: 'aldea', kind: 'food', title: 'Hierbas y miel', minRep: 0, reward: 26,
      ask: 'Hierbas y miel para la aldea. Que no se aplasten ni se enfríen.', thanks: 'Las hierbas de Abuela Raíz, siempre las mejores.' },
    { id: 'raices-cascada', giver: 'manglar', to: 'cascada', kind: 'tools', title: 'Raíces para la presa', minRep: 0, reward: 38,
      ask: 'La ingeniera necesita raíces trenzadas para sujetar la compuerta. Pesan, pero no se rompen.', thanks: 'Raíces trenzadas. Ahora sí aguanta la compuerta.' },
    { id: 'aprendiz-ruinas', giver: 'manglar', to: 'ruinas', kind: 'passenger', title: 'Una aprendiz hacia las ruinas', minRep: 3, reward: 48,
      ask: 'Mi aprendiz quiere estudiar con el profesor. Es un viaje largo; ve con calma.', thanks: 'Bienvenida, joven. Y gracias a ti por traerla entera.' },
    { id: 'piezas-puerto', giver: 'cascada', to: 'puerto', kind: 'tools', title: 'Piezas de turbina', minRep: 0, reward: 36,
      ask: 'Estas piezas van al taller del puerto. Si se me caen al agua, no vuelvo a verlas.', thanks: 'Piezas bien envueltas. La capitana te debe una.' },
    { id: 'turbinas-ruinas', giver: 'cascada', to: 'ruinas', kind: 'tools', title: 'Engranajes para el reloj de sol', minRep: 0, reward: 30,
      ask: 'El profesor quiere engranajes para su reloj de sol. Dice que es "arqueología experimental".', thanks: 'Engranajes. Con esto el reloj de sol tendrá tictac.' },
    { id: 'visitante-laguna', giver: 'cascada', to: 'laguna', kind: 'passenger', title: 'Un visitante hacia la laguna', minRep: 3, reward: 52,
      ask: 'Un visitante quiere ver los cristales de la laguna. Es un tramo largo, mucha paciencia.', thanks: 'Los cristales son aún más bonitos de cerca. ¡Gracias!' },
    { id: 'cuaderno-aldea', giver: 'ruinas', to: 'aldea', kind: 'tools', title: 'Mapas para la aldea', minRep: 0, reward: 42,
      ask: 'Estos mapas son copias para la aldea. Si se mojan, perdemos el trabajo de un mes.', thanks: 'Mapas secos y enteros. ¡Eres un tesoro!' },
    { id: 'fruta-laguna', giver: 'ruinas', to: 'laguna', kind: 'food', title: 'Fruta para la farera', minRep: 0, reward: 26,
      ask: 'Fruta madura para Luciana. Se pasa rápido: cuanto antes llegue, mejor.', thanks: 'Fruta madura. Con esto, los faroles brillarán más.' },
    { id: 'colega-manglar', giver: 'ruinas', to: 'manglar', kind: 'passenger', title: 'Una colega hacia el manglar', minRep: 3, reward: 44,
      ask: 'Una colega botánica quiere consultar a Abuela Raíz. Cuidado con las rocas del canal oeste.', thanks: 'Llegué sin un rasguño. ¡Un lanchero de primera!' },
    { id: 'farolillos-ruinas', giver: 'laguna', to: 'ruinas', kind: 'tools', title: 'Farolillos de cristal', minRep: 0, reward: 28,
      ask: 'Farolillos de cristal para las ruinas. Son frágiles... pero la caja es resistente.', thanks: 'Los farolillos de Luciana. Esta noche brillarán las columnas.' },
    { id: 'pescado-puerto', giver: 'laguna', to: 'puerto', kind: 'food', title: 'Pescado luminoso', minRep: 0, reward: 58,
      ask: 'Pesca del lago para el mercado del puerto. Tienes que cruzar todo el mapa: va rápido o se apaga.', thanks: 'Pescado luminoso, ¡qué rareza! Se venderá solo.' },
    { id: 'viajera-cascada', giver: 'laguna', to: 'cascada', kind: 'passenger', title: 'Una viajera hacia la cascada', minRep: 3, reward: 46,
      ask: 'Una viajera quiere bañarse en las pozas de la cascada. No la sacudas: va muy contenta.', thanks: 'Qué viaje tan tranquilo. ¡Cuánta paz!' }
  ];

  const levels = Object.freeze([
    { min: 0, name: 'Desconocido', stars: 0, bonus: 0 },
    { min: 3, name: 'Conocido', stars: 1, bonus: 0.05 },
    { min: 8, name: 'De confianza', stars: 2, bonus: 0.1 },
    { min: 15, name: 'Aliado', stars: 3, bonus: 0.2 }
  ]);

  const npcs = Object.freeze(npcList.map(npc => Object.freeze(npc)));
  const templates = Object.freeze(templateList.map(item => Object.freeze(item)));
  const npcById = Object.create(null);
  for (const npc of npcs) npcById[npc.id] = npc;
  const templateById = Object.create(null);
  for (const item of templates) templateById[item.id] = item;
  const idPattern = /^[a-z][a-z0-9-]{0,31}$/;

  const npc = id => (typeof id === 'string' ? npcById[id] || null : null);
  const template = id => (typeof id === 'string' ? templateById[id] || null : null);
  const validTemplateId = id => typeof id === 'string' && idPattern.test(id);
  const offersFor = giver => templates.filter(item => item.giver === giver);

  function level(points) {
    let current = levels[0];
    for (const item of levels) if (points >= item.min) current = item;
    return current;
  }

  // Puntos que da una entrega: más la primera vez que las siguientes.
  const repGain = firstTime => (firstTime ? 2 : 1);

  // Segundos razonables para una entrega con comida: distancia en línea recta × 1,5 a ~170 u/s.
  const parSeconds = distance => Math.round(10 + distance * 1.5 / 170);

  // `ctx`: { rep: puntos con quien lo ofrece, done: veces cumplido, active: bool, activeCount, destinationOpen: bool,
  // destinationName }. Devuelve si se puede aceptar y, si no, el motivo en palabras.
  function status(item, ctx) {
    if (ctx.active) return { canAccept: false, reason: 'En curso' };
    if (ctx.activeCount >= maxActive) return { canAccept: false, reason: `Bodega llena (${maxActive}/${maxActive})` };
    if (ctx.rep < item.minRep) return { canAccept: false, reason: `🔒 Pide ${item.minRep} puntos de reputación con ${npc(item.giver).name}` };
    if (!ctx.destinationOpen) return { canAccept: false, reason: `🔒 ${ctx.destinationName} aún no está abierto: descúbrelo antes` };
    return { canAccept: true, reason: ctx.done > 0 ? `Ya hecho ${ctx.done}×: paga la mitad` : 'Disponible' };
  }

  // Recompensa exacta de una entrega y por qué. `ctx`: { done, rep, elapsed, par, bumps }.
  function reward(item, ctx) {
    const parts = [];
    let factor = 1;
    if (ctx.done > 0) { factor *= 0.5; parts.push('Repetición: la mitad'); }
    const lvl = level(ctx.rep);
    if (lvl.bonus > 0) { factor += lvl.bonus; parts.push(`${lvl.name}: +${Math.round(lvl.bonus * 100)} %`); }
    if (item.kind === 'food') {
      if (ctx.elapsed <= ctx.par) { factor += 0.25; parts.push('Entrega fresca: +25 %'); }
      else if (ctx.elapsed > ctx.par * 2) { factor -= 0.2; parts.push('Llegó pasado: −20 %'); }
    } else if (item.kind === 'passenger') {
      if (ctx.bumps === 0) { factor += 0.2; parts.push('Viaje suave: +20 %'); }
      else if (ctx.bumps >= 3) { factor -= 0.3; parts.push(`Viaje incómodo (${ctx.bumps} golpes): −30 %`); }
    } else parts.push('Carga resistente');
    return { amount: Math.max(1, Math.min(200, Math.round(item.reward * factor))), parts };
  }

  window.RioQuests = Object.freeze({
    version: 1, maxActive, maxRep, kinds, npcs, templates, levels,
    npc, template, validTemplateId, offersFor, level, repGain, parSeconds, status, reward
  });
})();
