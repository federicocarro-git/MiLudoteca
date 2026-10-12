# MiLudoteca

Catálogo de juegos de mesa multiusuario, pensado para el celular e instalable
como app (PWA). Cada persona arma su colección, la filtra para decidir a qué
jugar ("¿A qué jugamos?") y escribe para cada juego un resumen de cómo se
juega y una hoja de turno para tener en la mesa (o imprimir).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(Postgres, Auth, Storage, RLS) · Vercel.

## Correrlo en tu compu

Necesitás **Node 20.9+** (recomendado 22), **Docker Desktop** abierto y **git**.

```bash
git clone https://github.com/federicocarro-git/MiLudoteca.git
cd MiLudoteca
npm install
npm run db:start              # Supabase local en Docker (la primera vez tarda unos minutos)
npx supabase status -o env    # muestra las claves locales
cp .env.example .env.local    # y completá las tres primeras variables con lo anterior
npm run dev
```

| Variable de `.env.local`               | Valor de `supabase status` |
| -------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `API_URL`                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY`          |
| `SUPABASE_SECRET_KEY`                  | `SECRET_KEY`               |

Entrá a **http://localhost:3000** (con `localhost`, no `127.0.0.1`: los links de
los mails apuntan ahí). Al crear una cuenta, el mail de confirmación aparece en
**Mailpit**: http://127.0.0.1:54324. En desarrollo, la búsqueda de juegos usa
12 juegos de prueba.

## Comandos

```bash
npm run dev                # desarrollo
npm run build && npm start # producción local
npm run lint
npm run typecheck
npm test                   # unitarios (Vitest)
npm run test:db            # RLS con pgTAP (necesita db:start)
npm run test:integracion   # cache de BGG contra Supabase local
npm run test:e2e           # Playwright: compila y levanta la app en :3000
npm run db:reset           # recrea la base local desde supabase/migrations
npm run db:types           # regenera los tipos de la base
```

## Documentación

- [`CLAUDE.md`](CLAUDE.md): arquitectura y convenciones del proyecto.
- [`docs/PLAN.md`](docs/PLAN.md): plan por hitos, decisiones y pendientes.
- [`docs/AUTH.md`](docs/AUTH.md): login con email y Google.
- [`docs/DEPLOY.md`](docs/DEPLOY.md): cómo publicarlo en Supabase + Vercel.
