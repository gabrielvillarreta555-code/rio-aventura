# Reglas del equipo — Río Aventura

Este archivo lo leen Codex y cualquier agente que trabaje en el repositorio.
Claude Code tiene las mismas reglas en `CLAUDE.md`: si cambias una regla
compartida, cámbiala en los dos archivos.

## Equipo y flujo

- **ChatGPT** propone ideas y diseño de juego.
- **Codex** implementa en una rama propia y abre un pull request contra `main`.
- **Claude Code** revisa automáticamente cada pull request y, si hace falta,
  propone correcciones en ramas `claude/...`.
- **Una persona** aprueba y fusiona. Nadie fusiona automáticamente.

## Reglas compartidas

1. Nunca hagas commits ni push directamente a `main`. Trabaja siempre en una rama
   y abre un pull request.
2. No actives auto-merge ni fusiones tu propio pull request.
3. No escribas claves, tokens ni contraseñas en el repositorio. Los secretos
   solo se guardan en GitHub → Settings → Secrets.
4. No modifiques `.github/workflows/`, `CLAUDE.md` ni `AGENTS.md` salvo que la
   tarea lo pida expresamente; explícalo en la descripción del pull request.
5. Un pull request = un cambio coherente. Describe qué cambia en física,
   controles, visuales o rendimiento, y cómo lo probaste.
6. Antes de abrir el pull request ejecuta `node tests/visual-smoke.cjs` y, si
   tienes Gradle 8.9 y el SDK de Android, `gradle assembleDebug`.
7. Si cambias el comportamiento del juego, añade o actualiza un test en
   `tests/` y una nota de versión en `README.md`.
8. Al publicar una versión, sube `versionCode` y `versionName` en
   `app/build.gradle.kts`.

## Estructura

- `app/src/main/assets/game.js` — todo el juego (física, controles, colisiones,
  dibujo en Canvas 2D). Es el archivo que se empaqueta en el APK.
- `app/src/main/assets/index.html` — pantalla, HUD y botones.
- `app/src/main/java/com/example/rioaventura/MainActivity.java` — WebView a
  pantalla completa que carga `file:///android_asset/index.html`.
- `tests/visual-smoke.cjs` — test en Node que simula el canvas y comprueba
  movimiento, inercia y dibujo.
- `index.html` en la raíz y los `.zip` son versiones antiguas: no los edites
  pensando que afectan al APK.

## Invariantes del juego (no romper sin pedirlo)

- Campo de juego lógico de 450 unidades de ancho; la altura se adapta a la
  pantalla (mínimo 800).
- Todo movimiento usa `dt` en segundos, limitado a 0.05 s por fotograma: la
  física debe comportarse igual a 30, 60, 90 o 120 Hz.
- Control táctil de un solo dedo (`activePointerId`): un segundo dedo no
  cancela al primero. Teclado: flechas y A/D.
- Radios de colisión: roca 19–30, tronco 26, lancha 23, escalados con
  `depthAt(y)`. Los cambios visuales no deben alterar la colisión.
- 3 vidas, 1.4 s de inmunidad tras un choque, récord en `localStorage` con la
  clave `rio-aventura-best-v1`.
- Al pasar a segundo plano (`visibilitychange`) el juego se pausa.
- Sin permisos de Android ni conexión a internet.

## Rendimiento en Android

- Evita crear gradientes, arrays u objetos nuevos en cada fotograma si se pueden
  reutilizar.
- Limita el número de partículas y obstáculos vivos.
- Evita `shadowBlur` y filtros de canvas costosos en bucles.
- Piensa en móviles de gama baja (minSdk 26).
