# Autenticación

Login con **email** (contraseña, crear cuenta, link mágico) y con **Google**,
todo con Supabase Auth y `@supabase/ssr` (sesión en cookies).

## Cómo funciona

| Flujo                   | Dónde                                  | Qué pasa                                                                    |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Ingresar con contraseña | `autenticarConEmail` (`modo=ingresar`) | `signInWithPassword` → redirige a `next` (validado con `destinoSeguro`).    |
| Crear cuenta            | `autenticarConEmail` (`modo=crear`)    | `signUp` → mail de confirmación → `/auth/confirm` inicia sesión.            |
| Link mágico             | `autenticarConEmail` (`modo=link`)     | `signInWithOtp` (crea la cuenta si no existe) → mail → `/auth/confirm`.     |
| Google                  | `ingresarConGoogle`                    | `signInWithOAuth` → Google → Supabase → `/auth/callback?code=...&next=...`. |
| Cerrar sesión           | `cerrarSesion` (página Cuenta)         | `signOut` → `/login`.                                                       |

- **`/auth/confirm`** acepta `?token_hash=&type=` (las plantillas propias, que
  funcionan aunque el mail se abra en otro navegador o en la app de mail del
  celular) y también `?code=` (las plantillas por defecto de Supabase, que solo
  funcionan en el mismo navegador). Los links de mail siempre terminan en
  `/catalogo`.
- **`/auth/callback`** intercambia el `code` del OAuth por la sesión.
- Los errores vuelven a `/login?error=<código>` y se traducen en
  `src/lib/auth-errores.ts`.
- Crear cuenta con un email que ya existe responde lo mismo que una cuenta
  nueva ("Revisá tu email"), para no revelar qué emails están registrados.

## Desarrollo local

`supabase/config.toml` ya trae todo configurado: confirmación de email,
contraseña de 8 caracteres como mínimo, plantillas en español y redirect URLs de
`localhost:3000`. Los mails se ven en Mailpit: <http://127.0.0.1:54324>.

Usá `http://localhost:3000` y no `127.0.0.1:3000`: tiene que coincidir con el
`site_url` de los links de los mails, si no las cookies quedan en otro dominio.

Google en local (opcional):

1. Crear credenciales OAuth en Google Cloud (ver abajo) con la redirect URI
   `http://127.0.0.1:54321/auth/v1/callback`.
2. Crear `supabase/.env` (no se commitea) con
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...` y
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...`.
3. En `supabase/config.toml`, `[auth.external.google] enabled = true`, y
   reiniciar (`npx supabase stop && npm run db:start`).
4. `NEXT_PUBLIC_AUTH_GOOGLE=true` en `.env.local`.

## Producción (proyecto de Supabase + Vercel)

### 1. URLs (Authentication → URL Configuration)

- **Site URL**: `https://<tu-dominio>`
- **Redirect URLs**:
  - `https://<tu-dominio>/auth/callback`
  - `https://<tu-dominio>/auth/confirm`
  - Para los previews de Vercel: `https://*-<tu-equipo>.vercel.app/**`

### 2. Email (Authentication → Providers → Email, y Emails → Templates)

- Activar **Confirm email**, con un largo mínimo de contraseña de **8**.
- Copiar las plantillas de `supabase/templates/` en **Confirm signup**
  (`confirmacion.html`) y en **Magic link** (`link-magico.html`), con los
  mismos asuntos que figuran en `supabase/config.toml`.
- **SMTP propio** (Resend, Postmark, etc.): el SMTP que trae Supabase manda
  muy pocos mails por hora y es solo para pruebas.

### 3. Google

1. En Google Cloud Console → APIs & Services → Credentials, crear un
   **OAuth client ID** de tipo _Web application_.
   - Authorized JavaScript origins: `https://<tu-dominio>`
   - Authorized redirect URIs: `https://<proyecto>.supabase.co/auth/v1/callback`
2. Configurar la pantalla de consentimiento (nombre, logo, dominio).
3. En Supabase → Authentication → Providers → Google: activarlo y pegar el
   Client ID y el Client Secret.
4. En Vercel: `NEXT_PUBLIC_AUTH_GOOGLE=true`.

### 4. Invitados de las salas (Authentication → Sign In / Providers)

- Activar **Allow anonymous sign-ins**. Los invitados que entran a una sala
  por el QR son usuarios anónimos: sin esto, solo se puede jugar con cuenta.
- Límite por defecto: 30 invitados nuevos por hora y por IP (Authentication →
  Rate Limits). Alcanza para varias mesas en la misma red.
- Los anónimos quedan en `auth.users`. Conviene borrarlos de vez en cuando
  (pendiente: limpieza periódica de los de más de 30 días).

### 5. Variables en Vercel

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL=https://<tu-dominio>` y
`NEXT_PUBLIC_AUTH_GOOGLE`. En los previews se puede dejar `NEXT_PUBLIC_SITE_URL`
vacía: se usa `VERCEL_URL`.
