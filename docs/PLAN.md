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

| Funcionalidad                           | Qué ya queda listo                                                                                        | Qué falta                                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PDF del reglamento → resumen con Claude | `resumenes.origen` (`manual` / `ia`); la carpeta `src/lib/resumen-ia/` está reservada en la arquitectura. | Bucket privado `reglamentos`, tabla `reglamentos (id, juego_id, autor_id, storage_path, ...)`, Route Handler que manda el PDF a la API de Claude y guarda el borrador para editarlo. |
| Importar colección de BGG               | `BggProvider` ya maneja 202 (el endpoint `collection` lo usa mucho) y la cache en `juegos`.               | Método `importarColeccion(usuario)` en el provider de BGG, pedidos de `thing` en lotes, pantalla de progreso y alta masiva en `catalogo_usuario`.                                    |
| Registro de partidas                    | Nada en la base todavía (se agrega como migración nueva).                                                 | Tablas `partidas (id, user_id, juego_id, jugada_en, duracion, notas)` y `partida_jugadores (partida_id, nombre, puntaje, gano)` con RLS por `user_id`.                               |
