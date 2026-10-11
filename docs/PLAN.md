# Plan de trabajo — MiLudoteca

Web app multiusuario para catalogar juegos de mesa, pensada primero para el
celular. Arquitectura y convenciones en [`CLAUDE.md`](../CLAUDE.md); esquema en
[`supabase/migrations/`](../supabase/migrations/).

## Decisiones tomadas (revisar)

| Tema | Decisión | Por qué |
|---|---|---|
| Visibilidad de `juegos` | Los de origen `bgg` los ven todos los usuarios autenticados; los `manual`, solo quien los creó. | "Datos compartidos" sin que un usuario vea ni pise los juegos caseros de otro. |
| Escritura de juegos de BGG | Solo el servidor, con la service role. Los usuarios no pueden editar filas `bgg`. | Es una cache compartida: si un usuario la edita, cambia para todos. |
| "Completar desde búsqueda y editar" | Si el usuario guarda sin cambios, se enlaza la fila `bgg` cacheada. Si edita algo, se crea un juego `manual` que conserva el `bgg_id` como referencia. | Respeta lo anterior sin perder el vínculo con BGG. `bgg_id` es único solo entre filas `bgg`. |
| Visibilidad de `resumenes` | Cada usuario ve solo los suyos (uno por juego y autor). | Es la lectura estricta de "cada usuario solo ve lo suyo". **Para compartirlos entre usuarios alcanza con cambiar una política** (`resumenes: leer los propios`). |
| Filtro "tipo" | Columna nueva `juegos.tipos text[]` (cooperativo, party, eurogame, …). En BGG sale de las categorías. | El pedido lo menciona como filtro pero no estaba en el modelo. |
| `duracion_min` | Duración típica de una partida, **en minutos** (no "duración mínima"). | Es la que necesita el filtro "duración máxima". |
| `año` | Se llama `anio` en la base. | Evitar la ñ en identificadores. |
| Complejidad | `numeric(3,2)` de 1 a 5, la misma escala que el "weight" de BGG. | Viene directo de BGG y se filtra por rango. |
| Puntuación | Entero de 1 a 10. | La misma escala que BGG. |
| Imágenes | Bucket público `imagenes-juegos`, ruta `<user_id>/<uuid>.<ext>`, máximo 5 MB, jpeg/png/webp/avif. Se redimensionan en el cliente antes de subirlas. | URLs estables sin firmar y buena caché; RLS limita la escritura a la carpeta propia. |
| Mutaciones | Server Actions + validación con zod; el cliente de Supabase usa la sesión del usuario (RLS manda). | Una sola capa de permisos: la base. |
| PWA | `app/manifest.ts` + service worker escrito a mano (guía oficial de Next), sin `next-pwa`. | Menos acoplamiento con el bundler; alcanza para instalar y para un modo offline básico. |
| "¿A qué jugamos?" | Elección al azar en el cliente entre los juegos que pasan los filtros. | El catálogo es chico; no hace falta una RPC. |

## Hitos (fase 1)

Cada hito termina con lint, typecheck y tests en verde, y un commit.

### 0. Base — *este commit*
- [x] Plan (este archivo) y `CLAUDE.md`.
- [x] Migración inicial: tablas, índices, vista `mi_catalogo`, RLS y bucket de Storage.
- [x] Migración validada contra Postgres 16 con stubs de `auth`/`storage`
  (aislamiento entre usuarios, cache de BGG de solo lectura, carpetas de Storage).

### 1. Esqueleto de la app
- `create-next-app` (App Router, TS, Tailwind, ESLint, `src/`), Vitest, Prettier.
- `@supabase/ssr`: clientes de browser, servidor y admin (`server-only`);
  refresco de sesión en `proxy.ts` (`middleware.ts` en Next < 16).
- Tipos generados: `supabase gen types typescript` → `src/lib/supabase/database.types.ts`.
- Layout mobile-first: barra inferior (Catálogo / Agregar / Cuenta).
- PWA: `manifest.ts`, íconos, `public/sw.js`, registro del service worker.

### 2. Autenticación
- `/login`: email (magic link + contraseña) y Google OAuth.
- `/auth/callback` (intercambio del code) y `/auth/confirm` (OTP por email).
- Grupo `(app)` protegido: redirige a `/login` si no hay sesión.

### 3. GameDataProvider
- `src/lib/game-data/types.ts`: interfaz + tipos `ResultadoBusqueda` y `DatosJuego`.
- `MockProvider`: lee `src/lib/game-data/mock/juegos.json` (unos 10 juegos
  conocidos), con búsqueda sin distinguir mayúsculas ni acentos.
- `BggProvider`: `fetch` a `https://boardgamegeek.com/xmlapi2/...` con
  `Authorization: Bearer`, reintento ante 202, espera ante 429 (respeta
  `Retry-After` o hace backoff exponencial), parseo con `fast-xml-parser`,
  decodificación de entidades HTML en la descripción y cache en `juegos`
  (si `bgg_sincronizado_en` tiene menos de 30 días, no se vuelve a llamar).
- `getGameDataProvider()`: BGG si hay token; Mock si no es producción;
  `null` (búsqueda oculta) en producción sin token.
- Tests: `MockProvider`, selección del provider, y `BggProvider` con XML de
  ejemplo en `__fixtures__/` y un `fetch` simulado (incluye los casos 202 y 429).

### 4. Agregar juego
- `/juegos/nuevo`: formulario completo (react-hook-form + zod), subida de
  imagen con vista previa y redimensionado.
- Panel de búsqueda (solo si hay provider): elegir un resultado completa el
  formulario, que se puede editar antes de guardar (ver la tabla de decisiones).
- Detección de duplicados en el catálogo propio por `bgg_id` o nombre.

### 5. Catálogo
- `/catalogo`: grilla de tarjetas con los filtros en la query string
  (`?jugadores=4&duracion=60&complejidad=1-2.5&tipo=cooperativo&q=cat`).
- Hoja inferior con filtros en el celular; chips con los filtros activos.
- Botón "¿A qué jugamos?" (respeta los filtros; animación corta y link a la ficha).
- Estados vacíos y skeletons.

### 6. Ficha del juego
- `/juegos/[id]` (Ficha), `/juegos/[id]/como-se-juega`, `/juegos/[id]/hoja-de-turno`:
  rutas anidadas con un layout de pestañas, para poder enlazar cada una.
- Ficha: datos, notas y puntuación propias, editar/quitar del catálogo.
- Hoja de turno: tipografía grande, tablas con scroll horizontal y estilos
  `print:` (oculta la navegación, A4 en blanco y negro). Botón "Imprimir".

### 7. Editor de resúmenes
- `/juegos/[id]/resumen/editar`: dos textareas (cómo se juega / hoja de
  turno) con pestañas Editar/Vista previa, barra mínima de formato
  (encabezado, lista, checklist, tabla) y aviso al salir con cambios sin guardar.
- Render: `react-markdown` + `remark-gfm` (sin HTML crudo).

### 8. Cierre de fase 1
- Tests de RLS con pgTAP (`supabase test db`) a partir de los casos ya validados.
- E2E con Playwright de los flujos principales usando MockProvider.
- Deploy en Vercel; configurar Google OAuth y las URLs de redirección en Supabase.

## Fase 2 (preparado, no implementado)

| Funcionalidad | Qué ya queda listo | Qué falta |
|---|---|---|
| PDF del reglamento → resumen con Claude | `resumenes.origen` (`manual` / `ia`); la carpeta `src/lib/resumen-ia/` está reservada en la arquitectura. | Bucket privado `reglamentos`, tabla `reglamentos (id, juego_id, autor_id, storage_path, ...)`, Route Handler que manda el PDF a la API de Claude y guarda el borrador para editarlo. |
| Importar colección de BGG | `BggProvider` ya maneja 202 (el endpoint `collection` lo usa mucho) y la cache en `juegos`. | Método `importarColeccion(usuario)` en el provider de BGG, pedidos de `thing` en lotes, pantalla de progreso y alta masiva en `catalogo_usuario`. |
| Registro de partidas | Nada en la base todavía (se agrega como migración nueva). | Tablas `partidas (id, user_id, juego_id, jugada_en, duracion, notas)` y `partida_jugadores (partida_id, nombre, puntaje, gano)` con RLS por `user_id`. |
