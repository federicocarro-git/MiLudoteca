# Plan de trabajo — MiLudoteca

Web app multiusuario para catalogar juegos de mesa, pensada primero para el
celular. Arquitectura y convenciones en [`CLAUDE.md`](../CLAUDE.md); esquema en
[`supabase/migrations/`](../supabase/migrations/).

## Decisiones tomadas (revisar)

| Tema                                | Decisión                                                                                                                                               | Por qué                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visibilidad de `juegos`             | Los de origen `bgg` los ven todos los usuarios autenticados; los `manual`, solo quien los creó.                                                        | "Datos compartidos" sin que un usuario vea ni pise los juegos caseros de otro.                                                                                   |
| Escritura de juegos de BGG          | Solo el servidor, con la service role. Los usuarios no pueden editar filas `bgg`.                                                                      | Es una cache compartida: si un usuario la edita, cambia para todos.                                                                                              |
| "Completar desde búsqueda y editar" | Si el usuario guarda sin cambios, se enlaza la fila `bgg` cacheada. Si edita algo, se crea un juego `manual` que conserva el `bgg_id` como referencia. | Respeta lo anterior sin perder el vínculo con BGG. `bgg_id` es único solo entre filas `bgg`.                                                                     |
| Visibilidad de `resumenes`          | Cada usuario ve solo los suyos (uno por juego y autor).                                                                                                | Es la lectura estricta de "cada usuario solo ve lo suyo". **Para compartirlos entre usuarios alcanza con cambiar una política** (`resumenes: leer los propios`). |
| Filtro "tipo"                       | Columna nueva `juegos.tipos text[]` (cooperativo, party, eurogame, …). En BGG sale de las categorías.                                                  | El pedido lo menciona como filtro pero no estaba en el modelo.                                                                                                   |
| `duracion_min`                      | Duración típica de una partida, **en minutos** (no "duración mínima").                                                                                 | Es la que necesita el filtro "duración máxima".                                                                                                                  |
| `año`                               | Se llama `anio` en la base.                                                                                                                            | Evitar la ñ en identificadores.                                                                                                                                  |
| Complejidad                         | `numeric(3,2)` de 1 a 5, la misma escala que el "weight" de BGG.                                                                                       | Viene directo de BGG y se filtra por rango.                                                                                                                      |
| Puntuación                          | Entero de 1 a 10.                                                                                                                                      | La misma escala que BGG.                                                                                                                                         |
| Imágenes                            | Bucket público `imagenes-juegos`, ruta `<user_id>/<uuid>.<ext>`, máximo 5 MB, jpeg/png/webp/avif. Se redimensionan en el cliente antes de subirlas.    | URLs estables sin firmar y buena caché; RLS limita la escritura a la carpeta propia.                                                                             |
| Mutaciones                          | Server Actions + validación con zod; el cliente de Supabase usa la sesión del usuario (RLS manda).                                                     | Una sola capa de permisos: la base.                                                                                                                              |
| PWA                                 | `app/manifest.ts` + service worker escrito a mano (guía oficial de Next), sin `next-pwa`.                                                              | Menos acoplamiento con el bundler; alcanza para instalar y para un modo offline básico.                                                                          |
| "¿A qué jugamos?"                   | Elección al azar en el cliente entre los juegos que pasan los filtros.                                                                                 | El catálogo es chico; no hace falta una RPC.                                                                                                                     |

## Hitos (fase 1)

Cada hito termina con lint, typecheck y tests en verde, y un commit.

### 0. Base — _este commit_

- [x] Plan (este archivo) y `CLAUDE.md`.
- [x] Migración inicial: tablas, índices, vista `mi_catalogo`, RLS y bucket de Storage.
- [x] Migración validada contra Postgres 16 con stubs de `auth`/`storage`
      (aislamiento entre usuarios, cache de BGG de solo lectura, carpetas de Storage).

### 1. Esqueleto de la app — _hecho_

- [x] Next.js 16.4 (App Router, TS, Tailwind 4, ESLint, `src/`), Vitest y Prettier.
- [x] `@supabase/ssr`: clientes de browser, servidor y admin (`server-only`);
      refresco de sesión y redirección a `/login` en `src/proxy.ts`.
- [x] Supabase local (`supabase/config.toml`); la migración aplica sobre el
      Postgres 17 de Supabase. Tipos generados en `src/lib/supabase/database.types.ts`.
- [x] Layout mobile-first con barra inferior (Catálogo / Agregar / Cuenta),
      tokens de color con modo oscuro, página de cuenta con cierre de sesión.
- [x] PWA: `manifest.ts`, íconos (normal, maskable, Apple), `public/sw.js`
      registrado solo en producción, página `/offline`.
- [x] Verificado con build de producción + Playwright (viewport de celular):
      redirecciones del proxy, sesión leída en la página de cuenta, cierre de sesión.

### 2. Autenticación — _hecho_

- [x] `/login`: email (contraseña, crear cuenta, link mágico) y Google OAuth
      (el botón se muestra con `NEXT_PUBLIC_AUTH_GOOGLE=true`).
- [x] `/auth/callback` (code de OAuth) y `/auth/confirm` (`token_hash` de las
      plantillas propias; también acepta `code`).
- [x] Plantillas de mail en español; confirmación de email obligatoria;
      contraseña de 8 caracteres como mínimo.
- [x] Errores de Auth traducidos; `?next=` validado (sin open redirect).
- [x] Verificado de punta a punta contra Supabase local con Mailpit: alta,
      confirmación desde otro navegador, link reusado, contraseña incorrecta,
      cuenta sin confirmar, `next`, link mágico y redirección a Google.
- [ ] Probar Google con credenciales reales (pasos en `docs/AUTH.md`).

### 3. GameDataProvider — _hecho_

- [x] `types.ts`: interfaz, `ResultadoBusqueda`, `DatosJuego` (con los nombres
      de columna de `juegos`) y `ErrorGameData`.
- [x] `MockProvider` con 12 juegos (búsqueda sin tildes ni mayúsculas, por relevancia).
- [x] `BggProvider`: cliente con 202/429/5xx/401, parser con `fast-xml-parser`
      y `he`, cache de 30 días en `juegos` con el cliente admin y vuelta a la
      copia vencida si BGG falla.
- [x] Vocabulario de `tipos` en español y traducción desde categorías y mecánicas de BGG.
- [x] `getGameDataProvider()` / `elegirProvider()` según el entorno.
- [x] 58 tests nuevos (fixtures XML + `fetch` simulado), 5 de integración
      contra Supabase local y `npm run test:bgg-real` para cuando llegue el token.
- [ ] Correr `test:bgg-real` con el token y completar la checklist de `CLAUDE.md`.

### 4. Agregar juego — _hecho_

- [x] `/juegos/nuevo`: formulario completo (todos los campos de `juegos` +
      puntuación y notas), con errores por campo y sin perder lo escrito.
- [x] Foto: se achica en el navegador (4000×3000 → 1200×900 WebP) y se sube a
      Storage en la carpeta del usuario.
- [x] Panel de búsqueda (oculto si no hay provider): con debounce, descarta
      respuestas viejas, y al elegir un resultado completa el formulario para
      editarlo. Avisa si lo editado se va a guardar como versión propia.
- [x] Guardar: reusa la fila de BGG si no hubo cambios; si hubo, crea un juego
      manual con `bgg_id` de referencia. Aviso de duplicados con "Agregar igual".
- [x] Ficha básica en `/juegos/[id]` (el hito 6 le agrega las pestañas).
- [x] Migración `20261012000000_imagen_url_local.sql`: acepta `http://` de
      localhost en `imagen_url` (Storage local).
- [x] Verificado de punta a punta (21 chequeos con Playwright contra Supabase local).
- [ ] Limpiar fotos huérfanas (subidas y no guardadas): más adelante, con un cron.

### 5. Catálogo — _hecho_

- [x] `/catalogo`: grilla de tarjetas (foto, jugadores, duración, nivel,
      puntuación); 2 columnas en el celular, 3–4 en pantallas grandes.
- [x] Filtros en la query string: jugadores, duración máxima, complejidad,
      tipo (solo los que hay en el catálogo), búsqueda sin tildes y orden.
- [x] Panel de filtros en una hoja inferior, con conteo en vivo; chips de los
      filtros activos para quitarlos de a uno; estado "Ningún juego coincide".
- [x] "¿A qué jugamos?": botón flotante que sortea entre los juegos filtrados.
- [x] Estado vacío y esqueleto de carga.
- [x] Verificado de punta a punta (20 chequeos), incluido que filtrar no
      vuelve a pedir el catálogo y que un juego nuevo aparece al volver.

### 6. Ficha del juego — _hecho_

- [x] Rutas `/juegos/[id]`, `/como-se-juega` y `/hoja-de-turno` con un layout
      de pestañas (cada una se puede compartir e imprimir).
- [x] Ficha: datos, foto, puntuación y notas (editables en una hoja), quitar
      del catálogo (con confirmación) y agregar si no está.
- [x] Editar los datos de un juego manual propio, con el mismo formulario del
      alta; si cambia la foto, se borra la anterior de Storage.
- [x] Markdown con `react-markdown` + `remark-gfm` (tablas, checklists), sin
      HTML crudo; links externos con `noopener`.
- [x] Hoja de turno: letra grande, tablas con scroll propio, impresión en A4
      limpia y "Mantener pantalla encendida".
- [x] Verificado de punta a punta (30 chequeos), incluido un PDF de la hoja.

### 7. Editor de resúmenes — _hecho_

- [x] `/juegos/[id]/resumen/editar`: las dos secciones en un formulario,
      Escribir / Vista previa, contador cerca del límite.
- [x] Barra de formato para el celular (título, negrita, lista, checklist,
      tabla) y plantillas para cada sección.
- [x] Borrador local con "Recuperar" y aviso al salir con cambios sin guardar.
- [x] Guardar vuelve a la pestaña editada con un aviso.
- [x] Verificado de punta a punta (22 chequeos).

### 8. Cierre de fase 1 — _hecho_

- [x] Tests de RLS con pgTAP (`npm run test:db`, 32 casos), con prueba de
      mutación: una política permisiva agregada a mano hace fallar el test.
- [x] e2e con Playwright en el repo (`npm run test:e2e`, 41 tests en 6
      archivos): auth, alta, catálogo, ficha, resúmenes y seguridad entre
      usuarios. Estables en 3 corridas seguidas.
- [x] CI en GitHub Actions: lint, tipos, formato, unitarios y build; después
      pgTAP, integración y e2e contra Supabase local.
- [x] `README.md` (puesta en marcha) y `docs/DEPLOY.md` (Supabase + Vercel).
- [x] Arreglos encontrados al cerrar: `connection()` en el cliente de
      Supabase del servidor (error de prerender con `Date.now()`) y borrador del
      editor guardado al cerrar la página.

## Pendientes de la fase 1

- [ ] Deploy en Vercel y configuración de Auth en el proyecto real (pasos en
      `docs/DEPLOY.md` y `docs/AUTH.md`).
- [ ] Probar Google con credenciales reales.
- [ ] Token de BGG: correr `npm run test:bgg-real` y completar la checklist de `CLAUDE.md`.
- [ ] Limpiar fotos huérfanas en Storage (subidas y no guardadas) con un cron.

## Cambios después de la fase 1

- **Descripción del juego**: la columna ya existía. Se agregó la atribución
  "Descripción: BoardGameGeek" con link en los juegos de BGG, el link "Ver en
  BoardGameGeek" para cualquier juego con `bgg_id`, una limpieza más completa
  de la descripción de `/thing` (párrafos, saltos simples, espacios) y
  descripciones con varios párrafos en el MockProvider.
- **Pestañas opcionales**: "Cómo se juega" y "Hoja de turno" vacías ofrecen el
  link a BGG (si el juego tiene `bgg_id`) y "Escribir".
- **Sin resúmenes con IA**: se descartó generar resúmenes con la API de Claude.
  Se quitó `resumenes.origen` (migración `20261013000000_quitar_origen_resumenes.sql`)
  y la carpeta reservada `src/lib/resumen-ia/` de la arquitectura.

## Fase 2: jugar con amigos

Pedido después de publicar la fase 1. Reemplaza el "registro de partidas"
individual que estaba previsto: las partidas ahora son salas multiusuario en
vivo.

### Decisiones

- **Invitados sin cuenta**: entran a una sala escaneando el QR o con el código
  y un nombre temporal. No se les guarda historial propio; el nombre queda en
  la partida para los demás. Técnicamente son usuarios anónimos de Supabase
  Auth (`signInAnonymously`), así RLS y Realtime funcionan igual; una política
  restrictiva les cierra todo lo que no es su sala.
- **Puntaje**: total por jugador. Por rondas, más adelante (hito 14).
- **Cooperativos**: al cerrar, "ganamos todos" o "perdimos todos".
- **Ganador**: por defecto el puntaje más alto; opción "menor puntaje gana",
  empate o elegirlo a mano.
- **Navegación**: Catálogo · Jugar · Agregar · Cuenta. Amigos, Historial y
  Ranking van dentro de Jugar.
- **Código de amigo**: 6 caracteres sin letras ambiguas (sin I, O, 0, 1). Se
  comparte el código, nunca el mail.

### Hitos

| #   | Hito                               | Qué incluye                                                                                                                                       |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Perfiles y amigos (_hecho_)        | `perfiles` (nombre visible, código de amigo), `amistades` (solicitud y aceptación), pantalla de Amigos, nombre editable en Cuenta, pestaña Jugar. |
| 10  | Salas en vivo (_hecho_)            | Crear sala con un juego, código y QR, invitar amigos, unirse con cuenta o como invitado, puntos totales en vivo con Supabase Realtime.            |
| 11  | Cierre, historial, fotos (_hecho_) | Ganador (o cooperativo), historial filtrable, fotos y notas de la partida, partidas jugadas en la Ficha.                                          |
| 12  | Ranking y rivalidades (_hecho_)    | Victorias, partidas y porcentaje entre amigos (general y por juego); cara a cara con cada amigo.                                                  |
| 13  | Catálogos de la mesa (_hecho_)     | "¿Quién lo tiene?" (juegos de tus amigos) y "¿A qué jugamos?" entre los catálogos de los presentes en la sala.                                    |
| 14  | Puntuación por rondas (_hecho_)    | Rondas en la sala y hojas de puntuación por juego (categorías con suma automática).                                                               |

### Pendiente aparte

- **Importar la colección de BGG**: `BggProvider` ya maneja el 202 (el
  endpoint `collection` lo usa mucho) y la cache en `juegos`. Falta
  `importarColeccion(usuario)`, pedidos de `thing` en lotes, pantalla de
  progreso y alta masiva en `catalogo_usuario`.
