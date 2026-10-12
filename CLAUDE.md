# MiLudoteca

Web app multiusuario para catalogar juegos de mesa, mobile-first e instalable
como PWA. El plan por hitos y las decisiones tomadas están en
[`docs/PLAN.md`](docs/PLAN.md).

## Stack

- **Next.js** (App Router) + **TypeScript** estricto + **Tailwind CSS**
- **Supabase**: Postgres, Auth (email + Google), Storage y Row Level Security
- **Vercel** para el deploy
- Tests: **Vitest** (unitarios) y **Playwright** (e2e); pgTAP para RLS

## Comandos

```bash
npm run db:start     # Supabase local en Docker (después: npx supabase status -o env para las claves)
npm run dev          # servidor de desarrollo (usa MockProvider si no hay BGG_API_TOKEN)
npm run lint
npm run typecheck    # next typegen + tsc --noEmit
npm test             # vitest (los de integración se saltean solos)
npm run test:integracion  # tests contra el Supabase local (necesita db:start y .env.local)
npm run test:bgg-real     # contra la API real de BGG (necesita BGG_API_TOKEN)
npm run format       # prettier (con plugin de Tailwind)
npm run db:reset     # recrea la base local aplicando supabase/migrations/
npm run db:types     # regenera src/lib/supabase/database.types.ts
npm run build
```

Puesta en marcha local: `npm install`, `npm run db:start`, copiar
`.env.example` a `.env.local` y completar las claves con
`npx supabase status -o env` (`API_URL`, `PUBLISHABLE_KEY` y `SECRET_KEY`).

## Next.js 16.4: leer antes de escribir código

Esta versión trae cambios que no están en los datos de entrenamiento (ver
`AGENTS.md`). La documentación de la versión instalada está en
`node_modules/next/dist/docs/`. Lo que más impacta acá:

- **Cache Components** (`cacheComponents: true`) y **Partial Prefetching**
  están activos. Todo lo que lee datos del request (`cookies()`, la sesión,
  Supabase con el cliente de servidor) tiene que estar **dentro de un
  `<Suspense>`**, o en una Server Action o un Route Handler. Si no, falla el
  build. Nunca hacer `await` de la sesión en un layout.
  Guía: `01-app/02-guides/authentication-with-cache-components.md`.
- `middleware.ts` ahora se llama **`proxy.ts`** (exporta `proxy`).
- Los tipos `PageProps<"/ruta">` y `LayoutProps<"/ruta">` son globales y los
  genera `next typegen`, que ya corre dentro de `npm run typecheck`.

## Arquitectura

```
src/
  app/
    (auth)/login/                 login con email y Google (actions.ts: Server Actions de auth)
    auth/callback/route.ts        vuelta de Google (intercambia el code de OAuth)
    auth/confirm/route.ts         links de los mails (token_hash; también acepta code)
    (app)/                        rutas protegidas (layout que exige sesión)
      catalogo/                   catálogo personal + filtros + "¿A qué jugamos?"
      juegos/nuevo/               alta manual + panel de búsqueda
      juegos/[id]/                layout con pestañas:
        page.tsx                    Ficha
        como-se-juega/              Cómo se juega
        hoja-de-turno/              Hoja de turno (pensada para celular e impresión)
        resumen/editar/             editor de resúmenes en markdown
    manifest.ts                   manifiesto de la PWA
  components/
    ui/                           componentes genéricos (Boton, Campo, ...)
    auth/                         formulario de login
    juegos/                       formulario de alta, buscador, selector e imagen de juego
    catalogo/                     grilla con filtros, panel de filtros, tarjeta y sorteo
    <feature>/                    componentes de cada feature (catalogo/, juegos/, ...)
  lib/
    supabase/
      client.ts                   cliente de browser (createBrowserClient)
      server.ts                   cliente de servidor con cookies (createServerClient)
      admin.ts                    clave secreta (saltea RLS) — `import "server-only"`; solo para la cache de BGG
      proxy.ts                    updateSession(), lo usa src/proxy.ts
      database.types.ts           generado; no editar a mano
    game-data/
      types.ts                    interfaz GameDataProvider y tipos
      index.ts                    getGameDataProvider(): elige la implementación
      tipos.ts                    vocabulario de "tipos" + traducción desde BGG
      texto.ts                    normalizar() y orden por relevancia
      mock/                       MockProvider + juegos.json
      bgg/                        BggProvider, parser XML, __fixtures__/*.xml
    resumen-ia/                   (fase 2) PDF del reglamento → resumen con Claude
    validations/                  esquemas zod compartidos por formularios y acciones
    catalogo/
      filtros.ts                  leer/escribir filtros de la URL, filtrar, ordenar, sortear
      consultas.ts                obtenerMiCatalogo() (vista mi_catalogo; lee cookies)
    juegos/
      consultas.ts                obtenerJuego(id) para la ficha (lee cookies)
      comparar.ts                 mismosDatos() (¿se editó lo que vino de BGG?) y escaparLike()
    formato.ts                    textos de jugadores, duración y complejidad
    imagenes.ts                   achica las fotos en el navegador (máx. 1200 px, WebP)
    auth.ts                       getUsuarioActual() (lee cookies: dentro de <Suspense>)
    auth-errores.ts               códigos de error de Supabase Auth → mensajes en español
    resultado.ts                  tipo Resultado<T> que devuelven las Server Actions
    sitio.ts                      urlDelSitio() para los links de OAuth y de los mails
    rutas.ts                      rutas públicas y validación de ?next= (anti open redirect)
  proxy.ts                        refresco de sesión + redirección a /login (chequeo optimista)
public/sw.js                      service worker (red primero; /offline sin conexión; nunca cachea datos)
public/icons/                     íconos de la PWA (los genera scripts/generar-iconos.mjs)
supabase/
  migrations/                     SQL versionado; la fuente de verdad del esquema
  templates/                      plantillas de mail de Auth (copiarlas al dashboard en producción)
  config.toml                     Supabase local (Auth ya configurado, ver docs/AUTH.md)
  tests/                          tests pgTAP de RLS
docs/PLAN.md                      plan por hitos y decisiones
docs/AUTH.md                      flujos de login y configuración de Auth en producción
```

### Modelo de datos

Ver `supabase/migrations/20261011000000_esquema_inicial.sql`.

- `juegos`: datos de cada juego. `origen = 'bgg'` es una **cache compartida**
  que solo escribe el servidor con la service role; `origen = 'manual'` es
  **privado de su creador** (`creado_por`). Un juego manual puede tener
  `bgg_id` como referencia; la unicidad de `bgg_id` aplica solo a filas `bgg`.
- `catalogo_usuario`: PK `(user_id, juego_id)`, con notas y puntuación (1 a 10).
- `resumenes`: uno por `(juego_id, autor_id)`, en markdown. `origen` queda
  preparado para la fase 2 (`manual` / `ia`).
- Vista `mi_catalogo` (`security_invoker`): catálogo del usuario actual unido
  a los datos del juego. Es la fuente de la pantalla de catálogo y sus filtros.
- Storage `imagenes-juegos`: público para lectura; cada usuario escribe en
  `<user_id>/...`.

### Alta de juegos (`/juegos/nuevo`)

- `actions.ts`: `buscarJuegos`, `obtenerDatosJuego` (pasan por el provider en
  el servidor) y `guardarJuego`:
  1. Valida con `juegoFormularioSchema` (errores por campo).
  2. Si llega `bgg_id` y los datos son **iguales** a la fila cacheada de BGG,
     reusa esa fila compartida. Si se editaron, crea un juego `manual` propio
     que conserva el `bgg_id` como referencia.
  3. Si en el catálogo ya hay un juego con el mismo `bgg_id` o el mismo nombre
     (sin distinguir mayúsculas), avisa y ofrece "Agregar igual"
     (`confirmar_duplicado`).
  4. Inserta en `catalogo_usuario`. Si falla, borra el juego recién creado.
  5. Redirige a `/juegos/<id>?agregado=1`.
- Imágenes: se achican en el navegador (`lib/imagenes.ts`) y se suben directo a
  Storage con la sesión del usuario (`<user_id>/<uuid>.webp`). Si alguien sube
  una foto y no guarda, queda huérfana (pendiente: limpieza periódica).
- La página es estática: **si hay búsqueda o no se decide en el build**
  (`elegirProvider(process.env)`). Al agregar `BGG_API_TOKEN` en Vercel hay que
  redeployar (Vercel lo exige igual). Para los e2e, compilar con
  `GAME_DATA_PROVIDER=mock`.
- Las imágenes `http://` (Storage local) se muestran con `unoptimized`, porque
  el optimizador de Next bloquea las IPs locales.

### Catálogo (`/catalogo`)

- El servidor trae el catálogo **completo** del usuario (`obtenerMiCatalogo`) y
  `CatalogoInteractivo` filtra en el navegador con `filtrarCatalogo` (función
  pura, testeada). Una colección personal tiene, como mucho, unos cientos de
  juegos. Si algún día no alcanza, mover los filtros a la consulta.
- Filtros en la query string: `q`, `jugadores`, `duracion` (máxima, en
  minutos), `complejidad` (`liviano` 1–2, `medio` 2–3, `pesado` 3–5), `tipo`
  y `orden` (`nombre` por defecto, `recientes`, `puntuacion`, `duracion`). Se
  actualizan con `window.history.replaceState`, que Next sincroniza con
  `useSearchParams` sin volver a pedir la página. Lo inválido en la URL se ignora.
- Un juego **sin** un dato no pasa el filtro de ese dato (se avisa en el panel).
- "¿A qué jugamos?" sortea entre los juegos visibles (con los filtros
  aplicados), con una animación corta que respeta `prefers-reduced-motion`.
  "Otro" nunca repite el anterior si hay alternativas.
- La búsqueda ignora tildes y mayúsculas (`normalizar`).

### Datos externos: GameDataProvider

```ts
interface GameDataProvider {
  readonly id: "bgg" | "mock";
  buscar(nombre: string): Promise<ResultadoBusqueda[]>;
  obtenerDetalle(id: string): Promise<DatosJuego | null>;
}
```

`getGameDataProvider()` (solo servidor) elige así:

1. `BGG_API_TOKEN` definido → `BggProvider`.
2. Si no, y `NODE_ENV !== "production"` → `MockProvider`.
3. Si no → `null`: la UI oculta la búsqueda y queda solo la carga manual.

`GAME_DATA_PROVIDER=mock` fuerza el MockProvider (por ejemplo, para los e2e
contra un build de producción).

La UI nunca llama al provider de forma directa: lo hace a través de Server
Actions, así el token de BGG nunca llega al cliente.

### BggProvider

Archivos en `src/lib/game-data/bgg/`:

- `cliente.ts` (`ClienteBgg`): `GET https://boardgamegeek.com/xmlapi2/<endpoint>`
  (**sin** `www`) con `Authorization: Bearer ${BGG_API_TOKEN}`, timeout de 10 s y
  hasta 4 intentos:
  - **202** (pedido encolado), **5xx** y errores de red: reintenta con backoff
    exponencial (1 s, 2 s, 4 s).
  - **429**: espera `Retry-After` (segundos o fecha HTTP) o, si no viene, el
    doble del backoff. Si pide esperar más de 15 s, corta con `limite_de_pedidos`.
  - **401/403**: `no_autorizado`, sin reintentar.
  - Cada espera tiene un tope de 15 s, para no colgar una Server Action.
- `parser.ts`: `parsearBusqueda` (`search`; sin repetidos, porque BGG devuelve
  una entrada por cada nombre que coincide) y `parsearDetalle` (`thing&stats=1`).
  Decodifica entidades HTML (con `he`), convierte los `0` de BGG en `null`,
  usa la imagen `https` (o el thumbnail) y traduce categorías y mecánicas a
  `tipos` (vocabulario en `src/lib/game-data/tipos.ts`).
- `bgg-provider.ts`: `buscar` (mínimo 2 caracteres; ordena primero el nombre
  exacto, después los que empiezan igual, después el resto) y
  `obtenerDetalle` (cache primero; vigencia de 30 días). Si BGG falla y hay una
  copia vencida, devuelve la copia. Si la cache falla, sigue sin ella.
- `cache-supabase.ts`: cache en `juegos` (`origen = 'bgg'`) con el cliente
  admin. Primero intenta un update y después un insert, porque PostgREST no
  puede hacer upsert contra el índice único parcial de `bgg_id`. Si dos
  pedidos insertan a la vez, el que falla con 23505 actualiza.
- Errores: `ErrorGameData` con `codigo` (`no_autorizado`, `limite_de_pedidos`,
  `no_disponible`, `respuesta_invalida`) y un mensaje en español para la UI.
- Tests: fixtures en `__fixtures__/` y `fetch` simulado (`cliente.test.ts`,
  `parser.test.ts`, `bgg-provider.test.ts`); la cache contra Supabase local en
  `cache-supabase.integracion.test.ts`.

El `MockProvider` (`mock/`) tiene 12 juegos en `juegos.json`, sin `bgg_id` ni
imagen (no se hace pasar por BGG). En desarrollo agrega 300 ms de latencia para
que se vean los estados de carga.

#### Pendiente de verificar con la API real (cuando se apruebe el token)

Correr `BGG_API_TOKEN=... npm run test:bgg-real`: verifica lo que se puede
automatizar e imprime lo observado (códigos, headers) para completar esta lista.
Si algo no coincide, actualizar los fixtures con respuestas reales y ajustar el
parser o el cliente.

- [ ] Que el header `Authorization: Bearer` sea el esquema que BGG acepta, y
      qué devuelve un pedido sin token o con un token inválido (código y cuerpo).
- [ ] Que el dominio sin `www` responda sin redirecciones (un redirect podría perder el header).
- [ ] En qué endpoints aparece realmente el 202 (¿solo en `collection` o también en `thing`?) y cuánto conviene esperar.
- [ ] Límites reales de rate limit, si el 429 trae `Retry-After` y en qué formato.
- [ ] Cantidad máxima de ids por pedido a `thing` (se supone 20).
- [ ] Que la estructura del XML coincida con los fixtures: `name[@type=primary]`,
      `statistics/ratings/averageweight`, `link[@type=boardgamecategory]`, `image`.
- [ ] Codificación de `description` (entidades HTML, `&#10;` como salto de línea).
- [ ] Dominio de las imágenes (se supone `cf.geekdo-images.com`) para
      `images.remotePatterns` de `next.config`.
- [ ] Si `search` incluye expansiones aunque se pida `type=boardgame`.
- [ ] Si los nombres de categorías y mecánicas coinciden con los de `tipos.ts`
      (por ejemplo, "Solo / Solitaire Game", "Deck, Bag, and Pool Building").
- [ ] Cómo es el cuerpo de un 202 en `thing` (el fixture `respuesta-202.xml` es
      una suposición basada en `collection`).
- [ ] Requisitos de atribución de los términos de uso de la API ("Powered by BGG").

## Convenciones

### Idioma y nombres

- **Dominio en español, igual que la base**: `juegos`, `resumenes`,
  `jugadores_min`, `ResultadoBusqueda`, `buscar()`. Sin ñ ni tildes en
  identificadores (`anio`).
- **Términos técnicos en inglés**: `components/`, `hooks`, `client.ts`,
  `GameDataProvider`, `useDebounce`.
- Textos de la UI en español rioplatense ("Agregá un juego", "¿A qué jugamos?").
- Columnas y tablas en `snake_case`; TS en `camelCase` salvo los tipos que
  vienen de la base, que conservan `snake_case` (no se mapean).
- Rutas en español y kebab-case: `/juegos/[id]/hoja-de-turno`.

### Base de datos

- **Todo cambio de esquema es una migración nueva** en `supabase/migrations/`
  (`YYYYMMDDHHMMSS_descripcion.sql`). Nunca editar una migración ya aplicada.
- Toda tabla nueva tiene RLS habilitado y políticas explícitas por operación
  (`select`/`insert`/`update`/`delete`), `to authenticated`, con
  `(select auth.uid())` (se evalúa una vez por consulta).
- Las vistas usan `security_invoker = true`.
- Después de migrar, regenerar `database.types.ts`.
- La service role (`lib/supabase/admin.ts`) se usa **solo** para escribir la
  cache de BGG. Cualquier otro acceso usa la sesión del usuario y depende de RLS.

### Next.js

- Server Components por defecto; `"use client"` solo donde hay interacción.
- Mutaciones con **Server Actions** que validan con zod y devuelven
  `{ ok: true, data } | { ok: false, error }`; nunca hacen throw hacia la UI.
- Los filtros del catálogo viven en la **query string** (se pueden compartir y
  sobreviven a un refresh).
- Código solo de servidor: `import "server-only"` (provider de BGG, cliente admin).
- Variables públicas solo con prefijo `NEXT_PUBLIC_`; `BGG_API_TOKEN` y
  `SUPABASE_SECRET_KEY` nunca.

### UI / mobile

- Colores siempre con los tokens de `globals.css` (`bg-fondo`, `bg-superficie`,
  `text-texto`, `text-texto-suave`, `bg-primario`, `border-borde`...), que ya
  resuelven el modo oscuro y la impresión. Íconos de `lucide-react`.

- Mobile-first: diseñar a 360 px y agrandar con `sm:`/`md:`.
- Áreas táctiles de al menos 44 px; acciones principales al alcance del pulgar
  (barra inferior y botones flotantes).
- La hoja de turno se imprime con utilidades `print:` (sin navegación, fondo
  blanco, tablas sin cortes de página adentro de una fila).
- Markdown con `react-markdown` + `remark-gfm`, sin HTML crudo.

### Formularios

- Inputs controlados (`useState`) cuando el formulario usa `useActionState`:
  React 19 resetea el `<form>` después de cada acción y, si no, se borra lo
  que la persona escribió cuando hay un error.
- Errores en un `<p aria-live="polite">`; botón deshabilitado y con spinner
  mientras `pending`.
- Errores por campo: la acción devuelve `errores: Record<campo, mensaje>` y el
  campo los muestra con `error=` (`Campo`, `AreaTexto`, `Selector` ponen
  `aria-invalid` y `aria-describedby`).
- Hojas modales con `Hoja` (`components/ui/hoja.tsx`, sobre `<dialog>`): desde
  abajo en el celular y centradas en pantallas grandes. Chips con `Chip`.
- Inputs ocultos controlados (`bgg_id`, `tipos`, `imagen_url`) salen del estado
  de React: no tocarlos a mano desde el DOM.

### Tests

- Unitarios junto al código: `foo.ts` → `foo.test.ts`.
- Nada de llamadas reales a BGG en los tests: fixtures XML + `fetch` simulado.
- Los e2e corren con `GAME_DATA_PROVIDER=mock`.

### Git

- Commits chicos, en español, en imperativo ("Agrega filtro por duración").
- Antes de commitear: `lint`, `typecheck` y `test` en verde.

## Variables de entorno

Ver `.env.example`.

| Variable                               | Dónde              | Uso                                           |
| -------------------------------------- | ------------------ | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | cliente y servidor | URL del proyecto                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente y servidor | clave pública `sb_publishable_…` (RLS manda)  |
| `SUPABASE_SECRET_KEY`                  | solo servidor      | clave `sb_secret_…`; escribir la cache de BGG |
| `BGG_API_TOKEN`                        | solo servidor      | activa BggProvider                            |
| `GAME_DATA_PROVIDER`                   | solo servidor      | `mock` para forzar MockProvider               |
| `NEXT_PUBLIC_SITE_URL`                 | cliente y servidor | redirecciones de OAuth y magic link           |
| `NEXT_PUBLIC_AUTH_GOOGLE`              | cliente            | `true` muestra el botón de Google             |

## Fase 2 (no implementar sin pedido explícito)

Resumen con IA a partir del PDF del reglamento, importar la colección de un
usuario de BGG y registro de partidas. Qué queda preparado y qué falta: ver
`docs/PLAN.md`.
