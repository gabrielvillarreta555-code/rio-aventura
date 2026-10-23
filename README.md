# Río Aventura para Android

Juego de río sin conexión. Esquiva rocas y troncos, suma puntos, conserva tu récord,
pausa y vuelve a jugar. Mantén pulsado el lado izquierdo o derecho de la pantalla
para mover el bote. La versión 1.1 añade corriente y orillas animadas, estela,
salpicaduras, remo en movimiento y efecto visual al chocar.

La versión 1.2 (primera etapa visual 2.5D) adapta el juego a la altura de la
pantalla, añade profundidad gradual y seguimiento horizontal muy suave de la
lancha. Conserva los controles, la puntuación y el récord local de la versión
anterior. No añade todavía cuentas ni servicios de Google.

La versión 1.3 intensifica la perspectiva del río y añade árboles en capas,
orillas definidas, sombras bajo lancha y obstáculos y salpicaduras al girar.
Sigue siendo un juego 2D Canvas; no añade física con inercia ni servicios online.

La versión 1.4 añade aceleración y frenado lateral con inercia suave, una pequeña
reacción del niño al girar y una estela que cambia con el movimiento. El control
táctil sigue un solo dedo para evitar cambios involuntarios. Las colisiones,
las vidas, los puntos y el récord local se mantienen; Google sigue pendiente.

La versión 1.5 añade brillos móviles y espuma junto a las orillas. Rocas y troncos
levantan pequeñas ondas y tienen más detalles de superficie. Estos cambios son
visuales: el tamaño de colisión y las reglas del juego no cambian.

La versión 1.6 incorpora un menú de Ajustes y un perfil de invitado con nombre y
avatar. Guarda localmente viajes terminados, obstáculos esquivados y distancia
estimada sin reemplazar el récord de puntos existente. La calidad visual se puede
reducir para usar menos partículas, árboles y reflejos. Google Play Games y el
guardado en la nube siguen pendientes de la configuración real de Play Console.

La versión 1.7 cuenta una esquiva solo cuando el obstáculo ya pasó sin tocar la
lancha. Los puntos anteriores de la versión 1.6 se conservan como estimación
separada: no es posible recalcular jugadas pasadas. Los viajes y la distancia
siguen registrándose al terminar una partida. En Ajustes se puede generar un
código de respaldo manual y restaurarlo; guarda ese texto fuera del teléfono
antes de desinstalar o borrar datos. Al restaurar se conserva el mayor récord y
el mayor total de cada estadística, sin sumar dos veces una misma copia. El
respaldo no es una cuenta ni un guardado en la nube.

La versión 1.8 ordena la lancha y los obstáculos por profundidad sin copiar ni
ordenar el arreglo en cada fotograma. Reutiliza el degradado del agua hasta que
cambie el tamaño de la pantalla. La calidad reducida dibuja como máximo unos
30 fotogramas por segundo, pero la física sigue actualizándose con cada ciclo.
En Ajustes se muestra el último FPS dibujado durante el juego para comparar
los modos; es una medición orientativa, no una garantía de rendimiento.

La versión 1.9 añade cuatro tramos dentro de la misma partida: Orillas
tranquilas (0 m), Troncos a la deriva (100 m), Corriente rápida (230 m) y Río
bravo (400 m en adelante). Una barra indica la distancia al siguiente tramo y
aparece un aviso al alcanzarlo. El agua cambia de color y los obstáculos
aparecen con mayor frecuencia; desde el segundo tramo hay troncos que se
desplazan lateralmente y pueden rebotar en los límites del río. Siguen valiendo
los controles, las tres vidas y las colisiones de rocas y troncos anteriores.
Los tramos son parte de cada viaje: no son niveles desbloqueables ni se guardan
por separado. El récord y las estadísticas locales mantienen su formato.
Al llegar a cada tramo nuevo se recupera una vida si falta alguna (hasta un
máximo de tres) y se recibe un escudo de tres segundos. Si ya hay tres vidas,
se concede solo el escudo. El escudo bloquea choques; un obstáculo que lo toque
no cuenta como esquiva ni suma puntos. Las recompensas son temporales de esa
partida, no monedas ni compras.

La versión 2.0 inicia la progresión permanente sin conexión: al terminar un viaje
se ganan monedas según distancia y esquivas (entre 1 y 80 por viaje). Ajustes
incluye una tienda y un garaje con la lancha Clásica y dos colores de lancha
comprables: Coral (15 monedas) y Tormenta (45 monedas). Cambiar de lancha solo
modifica el aspecto, no la física ni las colisiones. Las compras y recompensas
se guardan como eventos locales únicos para no cobrarlas dos veces ni repetir
una compra. El respaldo manual nuevo incluye monedas y lanchas; los respaldos
anteriores siguen aceptándose. Si dos copias contienen historiales de monedas
divergentes, el juego rechaza mezclarlos automáticamente para evitar duplicación
o pérdida. Conserva una copia fuera del teléfono antes de desinstalar: Android
no respalda automáticamente los datos de esta app. Google Play Games,
clasificaciones y sincronización en la nube siguen pendientes de configurar.

La versión 2.1 añade monedas flotantes durante cada viaje. Desvíate para
recogerlas sin tocar los obstáculos: cada una agrega tres monedas a la recompensa
del viaje terminado. La recompensa total mantiene el límite de 80 monedas por
viaje y se guarda en el mismo registro local de la versión 2.0; recoger una
moneda no acredita saldo hasta terminar. El HUD muestra el bono provisional.
No cambia los radios de colisión, las lanchas ni los datos guardados existentes.
Google Play Games y el guardado en la nube siguen pendientes.

La versión 2.2 añade tres rangos permanentes de capitán: Explorador (250 m y
3 esquivas confirmadas), Navegante (800 m y 15 esquivas) y Capitán del río
(2000 m y 40 esquivas). Los objetivos usan totales de viajes terminados;
los puntos estimados anteriores a la 1.7 no cuentan como esquivas. Al terminar
un viaje que cumpla los dos objetivos, el rango da una sola vez 10, 20 o 40
monedas, respectivamente. Los rangos y premios se guardan en el mismo registro
local de monedas y se incluyen en la copia manual; los datos de 2.1 siguen
siendo válidos. No hay conexión con Google ni clasificación mundial todavía.

La versión 2.3 da identidad visual propia a las insignias de Explorador,
Navegante y Capitán del río, muestra una barra de avance hacia el siguiente
rango y celebra brevemente cada ascenso (con anuncio accesible y movimiento
reducido cuando el sistema lo solicita). Incluye tres misiones locales por día:
150 m recorridos (+5 monedas), 4 esquivas (+6) y 2 monedas flotantes recogidas
(+4). Se cuentan al terminar viajes y se pagan automáticamente una sola vez
por misión y día, en el mismo registro local de monedas. Si el reloj retrocede,
el juego conserva el último día registrado para impedir repetir cobros de días
anteriores; sin servidor no puede impedir que alguien adelante manualmente el
reloj. Los viajes de versiones anteriores no contienen fecha ni progreso diario,
así que no se acreditan retroactivamente para estas misiones.

También aparecen cuatro logros permanentes derivados de estadísticas locales
guardadas; no son logros de Google Play Games. La lancha Brisa se desbloquea al
obtener Explorador y Aurora al obtener Capitán del río. Ambas son cosméticas y
no requieren monedas ni cambian la física. Perfil, récord, estadísticas, compras,
rangos y copias manuales anteriores se conservan al actualizar; la copia manual
nueva incluye misiones y desbloqueos. No desinstales la app para actualizarla.

La versión 2.3.1 es de estabilidad y no cambia controles, física, colisiones ni
progresión. El historial de monedas ya no se bloquea al superar los 10.000
eventos: cuando crece, los eventos antiguos se resumen en un saldo con sus
compras, rangos y misión del día, y se conserva una huella encadenada para poder
comparar copias manuales sin mezclar historiales distintos. Los datos de 2.3 se
leen tal cual y solo se resumen cuando hace falta; los de 2.3 que ya hubieran
superado el límite se recuperan al abrir la app. Las copias manuales de un
historial resumido usan un formato nuevo (`rio-aventura-progress-v3`); una copia
anterior a un resumen no se puede comparar y se rechaza con un aviso, sin tocar
el progreso.

Cada viaje terminado se registra primero como cierre pendiente y después se
aplica a las monedas, las estadísticas y el récord. Cada parte se aplica una sola
vez, así que un fallo de escritura o un cierre brusco ya no pierde ni duplica
premios de viaje, rangos ni misiones: lo pendiente se completa al abrir la app,
al empezar otro viaje o al restaurar una copia. El viaje en curso se guarda cada
3 segundos, al pausar, al abrir Ajustes y cuando la app pasa a segundo plano. Si
Android cierra la app, al abrirla se ofrece continuar el viaje (con 3 s de
escudo y sin obstáculos en pantalla) o cobrar lo conseguido; un viaje ya cobrado
no se ofrece de nuevo. El indicador de monedas muestra la misma recompensa y el
mismo límite de 80 que se paga al terminar, y el saldo se calcula una sola vez en
lugar de recorrer el historial en cada moneda recogida. En Android, la app
resiste que el sistema cierre el proceso de la WebView, no se reinicia al
cambiar el tamaño de pantalla y bloquea navegar fuera del juego.

Riesgo conocido: las APK de depuración que genera cada ejecución de GitHub
Actions se firman con una clave de depuración distinta. Android no permite
actualizar encima de una APK firmada con otra clave; si falla la instalación,
genera antes una copia manual en Ajustes. Para no depender de esto hace falta
una clave de firma estable guardada como secreto de GitHub.

La versión 2.4 renueva todo el aspecto del juego con un estilo 2.5D tropical, sin
tocar controles, física, colisiones, monedas, rangos, misiones, garaje ni datos
guardados. El dibujo vive ahora en `art.js` (solo pinta; `game.js` conserva todas
las reglas y le entrega una escena en cada fotograma). Todo el arte es procedural
y original, sin imágenes externas ni licencias. Novedades visibles: el río tiene
profundidad (bajíos arenosos, cáusticas, crestas de espuma, destellos y rayos de
luz), orillas con arena, palmeras, árboles de selva con flores, helechos, juncos y
rocas con sombras coherentes y montañas lejanas con bruma; la lancha tiene casco con
grosor, interior, asientos y proa, un remero con sombrero y remo doble que se
hunde en el agua, ola de proa y estela de espuma; las rocas tienen musgo y espuma,
los troncos corteza, ramas y anillos, y los troncos a la deriva una flecha
amarilla; las monedas giran con brillo. Cada tramo tiene su luz (mañana,
mediodía, tarde dorada y atardecer) con un fundido suave al cambiar, y hay
destellos al recoger monedas, ondas al chocar, un escudo luminoso, pétalos
flotando, líneas de velocidad en la corriente rápida y luciérnagas al atardecer. El HUD usa paneles de cristal, corazones rosas, una barra de tramo
dorada y una pantalla de título con el juego visible de fondo.

Rendimiento en Android: los elementos se dibujan una vez en lienzos ocultos y se
copian después; no se crean degradados ni objetos por fotograma; el agua se dibuja
sin recortes costosos y los patrones se alinean a píxeles. La calidad gráfica es
automática: mide el tiempo real entre fotogramas y sube o baja una escalera de
siete niveles (detalle y resolución): baja enseguida si el teléfono se atasca,
sube despacio y a prueba, recuerda el último nivel estable y deja de intentar
subir si el teléfono no lo aguanta. La calidad reducida de Ajustes fija
el nivel mínimo (hasta 30 FPS). En una prueba de laboratorio con un navegador sin
GPU, la calidad alta iguala a la de 2.3.1 (60 FPS) y la reducida es más rápida;
no se ha medido en un teléfono físico. Ajustes muestra el nivel gráfico actual.

## Río Aventura 2.5: un mundo explorable

La versión 2.5 convierte el juego en una aventura de exploración sin quitar nada de
lo anterior: gráficos 2.5D, monedas, garaje, rangos, misiones, logros y la
navegación libre siguen igual. Desde el título (y al terminar cualquier viaje)
el botón **Abrir el mapa** muestra un archipiélago tropical 2.5D con el **Puerto
Palmar** y cinco destinos. Se toca un lugar para ver su descripción, distancia,
duración estimada, dificultad y premio; **Zarpar** inicia el viaje y **Navegación
libre** sale a navegar como siempre.

| Destino | Distancia | Dificultad | Premio de primera visita | Se abre al… |
| --- | --- | --- | --- | --- |
| Aldea Coral | 1200 m | ★ | 20 🪙 | estar abierta desde el principio |
| Manglar Sombrío | 1800 m | ★★ | 35 🪙 | descubrir la Aldea Coral |
| Cascada Brumosa | 2600 m | ★★★ | 40 🪙 | descubrir la Aldea Coral |
| Ruinas del Sol | 3200 m | ★★★★ | 60 🪙 | descubrir el Manglar y la Cascada |
| Laguna de las Luciérnagas | 4200 m | ★★★★★ | 100 🪙 | descubrir las Ruinas y tener el rango Navegante |

Cada ruta usa el mismo motor, controles y física que la navegación libre, pero con
su propia dificultad (velocidad de la corriente, frecuencia de obstáculos, reparto
de rocas y troncos a la deriva, monedas), tres tramos con nombre y una meta: el
HUD muestra «Hacia <destino> · tramo/3» y los metros que faltan. Los últimos metros
antes de llegar no tienen obstáculos nuevos y el hito del destino aparece al fondo
del río. Al llegar sale una tarjeta de descubrimiento con el premio y las rutas
nuevas; el premio de primera visita se cobra **una sola vez** por destino, y
repetir una ruta solo paga el viaje normal. Cada ruta tiene su identidad visual
(`art-themes.js`): la aldea con casas y farolillos, el manglar con raíces y
luciérnagas verdes, la cascada con niebla y una pared de agua, las ruinas con
columnas y polvo dorado y la laguna con cristales violetas y luciérnagas.
Ajustes incluye el **Pasaporte del río** y los logros «Primer destino» y
«Cartógrafo». El botón «atrás» de Android cierra el mapa o los ajustes y pausa un
viaje en marcha; el mapa solo se abre entre viajes.

Arquitectura: `world.js` contiene solo datos y reglas puras (destinos, requisitos,
rutas y su dificultad); `map.js` dibuja el mapa en su propio lienzo con la capa fija
en caché; `art-themes.js` añade un tema por ruta a `art.js`; `game.js` aplica las
reglas. Lo descubierto se guarda en el mismo historial de monedas (eventos
`discover`, idempotentes y únicos por destino), de modo que comparte la protección
contra duplicados, la compactación y las copias manuales de 2.3/2.4. El progreso
de 2.4 se conserva tal cual; el historial pasa a formato 3 solo cuando se
descubre el primer destino, y una versión antigua de la app lo rechaza sin
borrarlo en lugar de corromperlo. Las copias manuales con destinos usan el
formato `rio-aventura-progress-v4`. Las rutas abiertas no se guardan: se calculan
a partir de lo descubierto y los rangos. Un viaje interrumpido por una ruta se
retoma en la misma ruta y no cuenta como llegada hasta que se llega de verdad.

Pruebas: `node tests/visual-smoke.cjs` ejecuta todas las suites (incluidas
`world.cjs`, `exploration.cjs`, `map-ui.cjs` y `themes.cjs`: reglas de desbloqueo,
llegada, descubrimiento único, migración de 2.4, compactación, copias, interfaz del
mapa y presupuesto de dibujo de cada tema). `node tests/e2e-world.cjs [carpeta]`
recorre el flujo completo en Chromium (necesita Playwright; opcional) y guarda
capturas. Capturas de esta versión en `docs/world-2.5/`. Las pruebas de rendimiento
se hicieron en un navegador sin GPU; no se ha probado en un teléfono físico.

## Río Aventura 2.6: mundo libre (prototipo)

La versión 2.5 seguía siendo «subir por un río». La 2.6 añade un **modo separado, «⛵ Explorar el
mundo»** (botón principal del título), donde **tú eliges la dirección**: no hay corriente
que empuje la lancha ni scroll automático.

- **Controles táctiles:** joystick virtual flotante (apoya el dedo en cualquier punto y arrastra:
  la dirección es la del arrastre y la fuerza, la distancia) y botón rojo **FRENO** (se puede usar
  con el otro dedo). En teclado: flechas o WASD y espacio para frenar. La lancha gira, acelera en la
  dirección del casco, tiene inercia y poca deriva lateral; da media vuelta en menos de un segundo.
- **Cámara y mundo:** mapa de 100 × 100 mosaicos (4000 × 4000 unidades, unas 9 pantallas de ancho)
  con una cámara suave que sigue a la lancha y se adelanta un poco hacia donde va. Las coordenadas
  son persistentes: la posición se guarda y al reabrir la app sigues donde estabas. Minimapa en una
  esquina y pista de «rumbo y distancia al próximo muelle» en la barra superior.
- **Geografía real:** puerto con bahía, un río que sube hasta una **bifurcación**; dos canales
  navegables distintos rodean una **isla central** y se vuelven a unir en un lago norte; ramales
  hacia cada muelle; islotes; rocas; monedas flotantes. Zonas con aspecto propio (aldea, manglar,
  tierras altas con cascada, ruinas, valle de cristales).
- **Colisiones:** costa, embarcaderos y rocas son sólidos (rebote y deslizamiento, sin atravesar
  ni a máxima velocidad ni con fotogramas largos). El mapa está rodeado de costa.
- **Muelles:** hay seis (Puerto Palmar y los cinco destinos). **Se llega físicamente**: entra en la
  zona de atraque (círculo punteado) y **frena** (menos de ~115 unidades/s); tras medio segundo se
  atraca. En un destino se descubre (premio de primera visita una sola vez, rutas nuevas, logros) y
  se cobra el viaje; en el puerto se cobra el viaje. Un muelle cerrado explica qué falta (por
  ejemplo, «Descubre Aldea Coral» o el rango Navegante para la laguna).
- **Economía y progreso intactos:** el viaje del mundo libre se cobra al atracar con la misma
  fórmula (distancia, esquivas y monedas flotantes, tope de 80) y el mismo diario de cobros
  pendientes, así que es idempotente. Rozar una roca sin chocar cuenta como esquiva (una vez por
  roca y viaje), lo que da rango. Volver a atracar sin haber navegado no da monedas. Lo descubierto
  en el mapa de rutas clásicas abre muelles y viceversa. La navegación clásica (río, rutas y mapa
  de 2.5) sigue siendo un modo aparte, con «Salir al menú» para volver a ella.

Limitaciones del prototipo: un solo mapa fijo (no procedural), sin vidas ni peligros más allá de los
choques, sin sonido, y el botón «atrás» pausa pero no tiene confirmación para salir. No se ha probado
en un teléfono físico.

**Rendimiento.** Se investigó con Chromium sin GPU (CPU 1×/2×/4× más lenta): en la navegación clásica,
la JS por fotograma es baja (≤ 6 ms), no hay recolecciones de memoria largas y los accesos a
`localStorage` son de ~0,1 ms; los tirones medidos venían de la **calidad automática**: en una CPU
lenta pasaban ~4 s a máxima calidad antes de reaccionar, y cada cambio de resolución reconstruye el
lienzo y los sprites (50–120 ms de tirón), también al subir «a prueba» cada ~9 s. Cambios: la primera
medición tarda 0,7 s en vez de 1,5 s, las subidas a prueba piden 18 s buenos y se limitan a 2 por
sesión (menos cambios de resolución). El mundo libre se diseñó para no repetir esos costes: la
tierra se dibuja **una vez por trozo de 8 × 8 mosaicos** (≈0,6 ms por trozo, ≈3 ms con CPU 4× más
lenta) y se copia con `drawImage`; solo se mantienen unos 30 trozos en una caché de uso reciente
(≈28 MB como máximo), el resto se construye bajo demanda con un anillo por delante de la cámara;
árboles y objetos se recortan por pantalla y se ordenan sin crear objetos nuevos; no hay degradados
ni sprites nuevos por fotograma (las pruebas lo vigilan); el minimapa se dibuja a 15 Hz desde una
imagen en caché; la partida solo se escribe en `localStorage` si cambió algo y cada 3 s. En el
navegador de pruebas, las rutas dibujan ≤ 150 `drawImage` por fotograma y 60 FPS estables; en un teléfono
real puede variar, y Ajustes → Gráficos muestra el nivel automático elegido.

Pruebas: `node tests/visual-smoke.cjs` incluye `sea.cjs` (16: mapa, bifurcación y isla comprobadas por
búsqueda de caminos, movimiento en las 4 direcciones, inercia, freno, colisiones con 20 000 pasos
aleatorios, rodeo de la isla navegando) y `sea-game.cjs` (25: controles de teclado, joystick con
varios dedos y freno, cámara, atraque, muelles cerrados, descubrimiento único, guardado y reanudación,
diario de pendientes, modos, presupuesto de dibujo y calidad automática). `node tests/e2e-sea.cjs
[carpeta]` (opcional, necesita Playwright) hace en Chromium real todo el recorrido con teclado y
joystick: cuatro direcciones, rodear la isla por los dos canales, atracar en la aldea y recargar;
con `RECORD_DIR=<carpeta>` graba un vídeo. Capturas y vídeo en `docs/world-2.6/`.

## APK

En GitHub, abre **Actions → Generar APK Río Aventura**. Una compilación correcta
publica el artefacto **Rio-Aventura-APK**, que contiene `app-debug.apk`.

Cada pull request contra `main` ejecuta el test visual (`node tests/visual-smoke.cjs`)
y compila el APK; el artefacto se llama **Rio-Aventura-APK-PR-<número>**.

El proyecto usa Java 17, Android Gradle Plugin 8.7.3, Gradle 8.9 y Android SDK 35.

## Equipo

Codex implementa, Claude Code revisa y una persona fusiona. Las reglas están en
`AGENTS.md` (Codex) y `CLAUDE.md` (Claude). El workflow **Revisión de Claude**
comenta automáticamente cada pull request; nunca aprueba ni fusiona. Añade la
etiqueta `sin-revision-claude` a un pull request para omitir la revisión.
No necesita conexión a internet para jugar ni permisos especiales.
