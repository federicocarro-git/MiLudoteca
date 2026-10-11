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

> Se completan cuando exista el esqueleto (hito 1).

```bash
npm run dev          # servidor de desarrollo (usa MockProvider si no hay BGG_API_TOKEN)
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run test:e2e     # playwright
supabase db reset    # recrea la base local aplicando supabase/migrations/
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

## Arquitectura

```
src/
  app/
    (auth)/login/                 login con email y Google
    auth/callback/route.ts        intercambio del code de OAuth
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
    ui/                           componentes genéricos (Button, Sheet, Tabs, ...)
    <feature>/                    componentes de cada feature (catalogo/, juegos/, ...)
  lib/
    supabase/
      client.ts                   cliente de browser (createBrowserClient)
      server.ts                   cliente de servidor con cookies (createServerClient)
      admin.ts                    service role — `import "server-only"`; solo para la cache de BGG
      database.types.ts           generado; no editar a mano
    game-data/
      types.ts                    interfaz GameDataProvider y tipos
      index.ts                    getGameDataProvider(): elige la implementación
      mock/                       MockProvider + juegos.json
      bgg/                        BggProvider, parser XML, __fixtures__/*.xml
    resumen-ia/                   (fase 2) PDF del reglamento → resumen con Claude
    validations/                  esquemas zod compartidos por formularios y acciones
  proxy.ts                        refresco de sesión de Supabase (middleware.ts en Next < 16)
public/sw.js                      service worker
supabase/
  migrations/                     SQL versionado; la fuente de verdad del esquema
  tests/                          tests pgTAP de RLS
docs/PLAN.md
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

- Base: `https://boardgamegeek.com/xmlapi2` (**sin** `www`).
- Header `Authorization: Bearer ${BGG_API_TOKEN}` en todas las llamadas.
- `search?query=...&type=boardgame` y `thing?id=...&stats=1`.
- **202**: BGG encoló el pedido. Reintentar con backoff (máximo N intentos).
- **429**: esperar `Retry-After` si viene; si no, backoff exponencial.
- Cache: antes de `thing`, buscar en `juegos` (`origen = 'bgg'`, mismo
  `bgg_id`). Si `bgg_sincronizado_en` tiene menos de 30 días, usar la fila
  cacheada; si no, pedir a BGG y hacer upsert con el cliente admin.
- Tests con XML de ejemplo en `src/lib/game-data/bgg/__fixtures__/` y `fetch` simulado.

#### Pendiente de verificar con la API real (cuando se apruebe el token)

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
  `SUPABASE_SERVICE_ROLE_KEY` nunca.

### UI / mobile
- Mobile-first: diseñar a 360 px y agrandar con `sm:`/`md:`.
- Áreas táctiles de al menos 44 px; acciones principales al alcance del pulgar
  (barra inferior y botones flotantes).
- La hoja de turno se imprime con utilidades `print:` (sin navegación, fondo
  blanco, tablas sin cortes de página adentro de una fila).
- Markdown con `react-markdown` + `remark-gfm`, sin HTML crudo.

### Tests
- Unitarios junto al código: `foo.ts` → `foo.test.ts`.
- Nada de llamadas reales a BGG en los tests: fixtures XML + `fetch` simulado.
- Los e2e corren con `GAME_DATA_PROVIDER=mock`.

### Git
- Commits chicos, en español, en imperativo ("Agrega filtro por duración").
- Antes de commitear: `lint`, `typecheck` y `test` en verde.

## Variables de entorno

Ver `.env.example`.

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente y servidor | clave pública (RLS manda) |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor | escribir la cache de BGG |
| `BGG_API_TOKEN` | solo servidor | activa BggProvider |
| `GAME_DATA_PROVIDER` | solo servidor | `mock` para forzar MockProvider |
| `NEXT_PUBLIC_SITE_URL` | cliente y servidor | redirecciones de OAuth y magic link |

## Fase 2 (no implementar sin pedido explícito)

Resumen con IA a partir del PDF del reglamento, importar la colección de un
usuario de BGG y registro de partidas. Qué queda preparado y qué falta: ver
`docs/PLAN.md`.
