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
