# Deploy: Supabase + Vercel

Pasos para publicar MiLudoteca. Las claves se cargan directo en cada servicio:
nunca en el repo ni en un chat.

## 1. Proyecto de Supabase

1. Crear un proyecto en <https://supabase.com/dashboard> (región cercana, por
   ejemplo São Paulo). Guardar la contraseña de la base.
2. Desde tu compu, con el repo clonado:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>   # el ref está en la URL del dashboard
   npx supabase db push                                 # aplica supabase/migrations/
   ```

   Esto crea las tablas, la vista, las políticas RLS y el bucket
   `imagenes-juegos`. Cada vez que se mergean migraciones nuevas, volver a
   correr `npx supabase db push`.

   Las salas usan **Realtime Broadcast** desde la base (`realtime.send`) en
   canales públicos: no hay que activar nada, salvo que en Realtime →
   Settings se haya desactivado el acceso a canales públicos.

3. Opcional, para verificar las políticas en el proyecto real:
   `npx supabase test db --linked`.
4. **Auth**: seguir [`docs/AUTH.md`](AUTH.md), sección "Producción": URLs,
   plantillas de mail, SMTP propio y Google.
5. Claves en **Project Settings → API Keys**: la _publishable_
   (`sb_publishable_…`) y una _secret_ (`sb_secret_…`).

## 2. Vercel

1. En <https://vercel.com/new>, importar el repo de GitHub (el framework se
   detecta solo: Next.js).
2. **Environment Variables** (Production y Preview):

   | Variable                               | Valor                                                                    |
   | -------------------------------------- | ------------------------------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co`                                              |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`                                                       |
   | `SUPABASE_SECRET_KEY`                  | `sb_secret_…` (solo servidor)                                            |
   | `NEXT_PUBLIC_SITE_URL`                 | `https://<tu-dominio>` (solo Production; en Preview se usa `VERCEL_URL`) |
   | `NEXT_PUBLIC_AUTH_GOOGLE`              | `true` cuando Google esté configurado                                    |
   | `BGG_API_TOKEN`                        | cuando BGG apruebe el token (sin él, en producción no hay búsqueda)      |

   No definir `GAME_DATA_PROVIDER` en producción.

3. Deploy. Si después cambiás alguna variable, hay que **redeployar**: varias
   se leen al compilar (por ejemplo, si se muestra la búsqueda o el botón de Google).
4. Dominio propio (opcional): Settings → Domains. Actualizar `NEXT_PUBLIC_SITE_URL`
   y las URLs de Auth en Supabase.

## 3. Verificación después del deploy

- [ ] Crear una cuenta con email: llega el mail (revisar spam) y el link deja la sesión iniciada.
- [ ] Ingresar con Google (si está activado).
- [ ] Agregar un juego con foto desde el celular.
- [ ] Filtrar el catálogo y usar "¿A qué jugamos?".
- [ ] Escribir un resumen e imprimir la hoja de turno.
- [ ] Instalar la app ("Agregar a pantalla de inicio") y abrirla sin conexión: tiene que mostrar "Sin conexión".
- [ ] Con un segundo usuario, confirmar que no ve nada del primero.
- [ ] Agregar a ese usuario como amigo con el código.
- [ ] Crear una sala, abrir el QR con otro celular y entrar como invitado:
      los puntos se tienen que ver en vivo en los dos.

## 4. Cuando llegue el token de BGG

1. Correr `BGG_API_TOKEN=... npm run test:bgg-real` y completar la checklist
   "Pendiente de verificar con la API real" de `CLAUDE.md`.
2. Cargar `BGG_API_TOKEN` en Vercel y redeployar.
