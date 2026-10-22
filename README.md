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

## APK

En GitHub, abre **Actions → Generar APK Río Aventura**. Una compilación correcta
publica el artefacto **Rio-Aventura-APK**, que contiene `app-debug.apk`.

El proyecto usa Java 17, Android Gradle Plugin 8.7.3, Gradle 8.9 y Android SDK 35.
No necesita conexión a internet para jugar ni permisos especiales.
