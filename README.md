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
