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
npm run test:db           # RLS con pgTAP (supabase/tests; necesita db:start)
npm run test:e2e          # Playwright (tests/e2e): compila y levanta la app en :3000
                          # PLAYWRIGHT_CHROMIUM_PATH=... para usar un Chromium ya instalado
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
- `lib/supabase/server.ts` hace `await connection()`: `supabase-js` usa
  `Date.now()` y Next no lo permite en el prerender de las rutas con sesión.
  Si aparece en los logs "encountered the unstable value `Date.now()`", es eso.
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
      jugar/                      pestaña Jugar: crear sala, unirse con código, en curso (+ actions.ts)
        nueva/                      elegir el juego de la sala nueva
        historial/                  partidas terminadas, filtros ?juego= y ?con=
        ranking/                    competitivo (victorias, cara a cara) y cooperativo (ganadas, duplas); ?modo= y ?juego=
        quien-lo-tiene/             juegos de los amigos (buscador y filtro por amigo)
        amigos/                     código de amigo, solicitudes y lista (+ actions.ts)
      cuenta/                     nombre visible, código de amigo, mostrar mis juegos, cerrar sesión (+ actions.ts)
      juegos/nuevo/               alta manual + panel de búsqueda
      juegos/[id]/
        (pestanas)/                 layout con encabezado + pestañas (una ruta por pestaña):
          page.tsx                    Ficha (catálogo: editar/quitar/agregar)
          como-se-juega/              Cómo se juega
          hoja-de-turno/              Hoja de turno (celular e impresión, pantalla encendida)
        editar/                     editar datos de un juego manual propio
        resumen/editar/             editor de resúmenes en markdown (+ actions.ts: guardarResumen)
        actions.ts                  actualizarCatalogo, agregarAlCatalogo, quitarDelCatalogo, actualizarJuego
    sala/[codigo]/                sala en vivo (fuera de (app): también para invitados; + actions.ts)
    partida/[id]/                 resultado, notas y fotos (fuera de (app), como la sala; + actions.ts)
    manifest.ts                   manifiesto de la PWA
  components/
    ui/                           componentes genéricos (Boton, Campo, ...)
    auth/                         formulario de login
    juegos/                       formulario de alta, buscador, selector e imagen de juego, enlace-bgg.tsx
    catalogo/                     grilla con filtros, panel de filtros, tarjeta y sorteo
    resumenes/                    editor de resúmenes
    amigos/                       código (copiar/compartir), agregar, lista de amigos, avatar
    salas/                        sala en vivo, marcador, hoja de puntos (rondas/categorías), cómo se anota,
                                  QR (svg en el servidor), invitar, agregar, terminar, sorteo de la mesa
    mesa/                         "¿Quién lo tiene?"
    partidas/                     tabla de resultado, notas, fotos, historial filtrado, ranking, borrar partida
    cuenta/                       formulario del nombre visible e interruptor "Mostrar mis juegos"
    layout/                       barra inferior, encabezado de página, enlace "volver"
    markdown.tsx                  render de resúmenes (react-markdown + remark-gfm; estilos .md en globals.css)
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
      bgg/                        BggProvider, parser XML, enlaces.ts (urlJuegoBgg), __fixtures__/*.xml
    validations/                  esquemas zod compartidos por formularios y acciones
    catalogo/
      filtros.ts                  leer/escribir filtros de la URL, filtrar, ordenar, sortear
      consultas.ts                obtenerMiCatalogo() (vista mi_catalogo; lee cookies)
    juegos/
      consultas.ts                obtenerJuego(id) y obtenerResumen(id), con cache() por request
      comparar.ts                 mismosDatos() (¿se editó lo que vino de BGG?) y escaparLike()
      storage.ts                  rutaImagenPropia(): qué fotos del bucket se pueden borrar
      valores-formulario.ts       valores del formulario de juego (alta y edición)
    amigos/
      consultas.ts                obtenerMiPerfil() y obtenerAmistades(), con cache() por request
    salas/
      consultas.ts                obtenerSala(codigo) (con anotaciones), vistaPreviaSala(codigo),
                                  obtenerMisSalasEnCurso(), obtenerHojaGuardada(juego)
      tipos.ts                    Sala, JugadorSala, puntajeMasAlto(), soltarConfirmados(), y de la hoja:
                                  filasDeLaHoja(), casillerosVisibles(), totalesDeLaHoja(), leerCategorias()
    partidas/
      consultas.ts                obtenerPartida(id), listarFotos(), obtenerHistorial(), resumenDePartidasDelJuego(),
                                  obtenerRevancha(id)
      resultado.ts                ganadoresPrevistos(), textoResultado(), duración, fecha, tiempoParaReabrir() (puras)
      historial.ts                opciones y filtros del historial (puras)
      ranking.ts                  calcularRanking(), calcularCaraACara(), duelo(), nemesis(),
                                  calcularRankingCooperativo(), calcularDuplas() (puras)
      fotos.ts                    bucket, máximo y nombre de archivo <partida>/<autor>_<uuid>
      borrar-fotos.ts             borrarFotosDePartida() antes de borrar o cancelar una partida
    mesa/
      juegos.ts                   agruparPorJuego(), claveDeJuego(), juegosParaLaMesa(), duenosDeLosJuegos(),
                                  filtrarPorDuenos(), filtros (puras)
      consultas.ts                obtenerJuegosDeAmigos() (rpc catalogo_de_amigos, con cache())
    resumenes/
      formato.ts                  barra de formato del editor (funciones puras) y plantillas
    formato.ts                    textos de jugadores, duración y peso; colorDeNombre() de los avatares
    navegacion.ts                 rutas de la barra inferior e itemActivo()
    imagenes.ts                   achica las fotos en el navegador (máx. 1200 px, WebP)
    auth.ts                       getUsuarioActual() (sin anónimos) y getSesionActual() (con anónimos, solo salas)
    auth-errores.ts               códigos de error de Supabase Auth → mensajes en español
    resultado.ts                  tipo Resultado<T> que devuelven las Server Actions
    sitio.ts                      urlDelSitio() para los links de OAuth y de los mails
    rutas.ts                      rutas públicas y validación de ?next= (anti open redirect)
  proxy.ts                        refresco de sesión + redirección a /login (chequeo optimista)
public/sw.js                      service worker (red primero; /offline sin conexión; nunca cachea datos)
public/icons/                     íconos de la PWA (los genera scripts/generar-iconos.mjs)
scripts/datos-de-prueba.mjs       crea/borra usuarios de prueba (@miludoteca.test) con juegos y amistades
supabase/
  migrations/                     SQL versionado; la fuente de verdad del esquema
  templates/                      plantillas de mail de Auth (copiarlas al dashboard en producción)
  config.toml                     Supabase local (Auth ya configurado, ver docs/AUTH.md)
  tests/rls.test.sql              tests pgTAP de RLS de la fase 1 (32 casos)
  tests/amigos.test.sql           perfiles y amistades (28 casos)
  tests/salas.test.sql            salas, jugadores e invitados anónimos (34 casos)
  tests/cierre.test.sql           terminar partidas, notas, fotos y borrar (28 casos)
  tests/mesa.test.sql             catálogos de amigos y de la mesa, cambiar el juego (16 casos)
  tests/puntaje.test.sql          rondas, categorías, anotar y hojas guardadas (26 casos)
  tests/revancha.test.sql         sala sin juego, revancha y reabrir (22 casos)
tests/e2e/                        Playwright: un spec por área + helpers.ts (usuarios, juegos, Mailpit)
.github/workflows/ci.yml          CI: lint/tipos/unitarios/build + pgTAP/integración/e2e con Supabase local
docs/PLAN.md                      plan por hitos y decisiones
docs/AUTH.md                      flujos de login y configuración de Auth en producción
docs/DEPLOY.md                    publicar en Supabase + Vercel y verificación posterior
```

### Modelo de datos

Ver `supabase/migrations/20261011000000_esquema_inicial.sql`.

- `juegos`: datos de cada juego. `origen = 'bgg'` es una **cache compartida**
  que solo escribe el servidor con la service role; `origen = 'manual'` es
  **privado de su creador** (`creado_por`). Un juego manual puede tener
  `bgg_id` como referencia; la unicidad de `bgg_id` aplica solo a filas `bgg`.
- `catalogo_usuario`: PK `(user_id, juego_id)`, con notas y puntuación (1 a 10).
- `resumenes`: uno por `(juego_id, autor_id)`, en markdown. Siempre se
  escriben a mano: no hay generación con IA (la columna `origen` que estaba
  preparada para eso se quitó en `20261013000000_quitar_origen_resumenes.sql`).
- `juegos.descripcion`: texto libre (hasta 20.000 caracteres). En los de BGG
  viene de `/thing`, ya decodificada y con los párrafos separados por una línea
  en blanco; en los manuales, la escribe quien carga el juego.
- Vista `mi_catalogo` (`security_invoker`): catálogo del usuario actual unido
  a los datos del juego. Es la fuente de la pantalla de catálogo y sus filtros.
- Storage `imagenes-juegos`: público para lectura; cada usuario escribe en
  `<user_id>/...`.
- `perfiles` (`20261015000000_perfiles_y_amigos.sql`): uno por cuenta, lo crea
  un trigger de `auth.users` (también cuando un anónimo deja de serlo). Nombre
  visible (el de Google o lo que va antes de la @, editable en Cuenta) y
  `codigo_amigo` de 6 caracteres sin I, O, 0 ni 1 (`generar_codigo()`). Cada
  uno ve el propio y los de sus amigos o solicitudes; solo se puede cambiar el
  `nombre` (grant por columna). Los anónimos no tienen perfil.
- `amistades`: una fila por par (índice único sobre el par ordenado), `estado`
  `pendiente` o `aceptada`. Se crean **solo** con la función
  `enviar_solicitud_amistad(codigo)` (security definer: busca por código sin
  abrir `perfiles`; si el otro ya había pedido, acepta). Aceptar = update de
  `estado` por el destinatario; borrar = rechazar, cancelar o dejar de ser
  amigos. `es_amigo(otro)` es para las políticas de las tablas que vengan.
- `partidas` (`20261016000000_salas.sql`): una por sala. `codigo` de 6 (único
  entre las `en_curso`), anfitrión y el juego **copiado** (`juego_nombre`,
  `juego_imagen_url`; `juego_id` queda como referencia con `on delete set
null`): así la ven todos aunque el juego sea manual y privado. Se crean con
  `crear_partida(juego)` y el anfitrión las cancela (delete) en curso.
- `partida_jugadores`: `user_id` (null = juega sin celular), `nombre`,
  `invitado` (sin cuenta: anónimo o sin celular; no suma al ranking) y
  `puntos` (total, ±1.000.000). Hasta 20 por sala (trigger). Con cuenta, el
  nombre sale del perfil. Cada uno cambia sus puntos (grant solo de `puntos`);
  el anfitrión, los de todos, agrega amigos o jugadores sin celular y saca a
  otros. Se entra con `unirse_a_partida(codigo, nombre)`; `ver_sala(codigo)`
  (también para `anon`) es la vista previa antes de entrar.
- **Invitados anónimos**: `signInAnonymously()`. Tienen `auth.uid()` pero no
  perfil, y una política **restrictiva** (`es_anonimo()`) les cierra juegos,
  catálogo, resúmenes, perfiles, amistades y el bucket de imágenes.
- Cierre (`20261017000000_cierre_de_partidas.sql`): `terminar_partida(partida,
modo, ganadores, ganamos)` (solo el anfitrión, en curso). Modos
  `mas_puntos`, `menos_puntos` (gana el mejor; empatados, todos), `manual`
  (los elegidos) y `cooperativo` (todos ganan o pierden). Guarda
  `partida_jugadores.gano` y `posicion` (`dense_rank`; null en cooperativos)
  y `partidas.modo_resultado`, `cooperativo_ganado`, `terminada_en`. Terminada,
  nadie cambia puntos ni jugadores. `partidas.notas`: solo el anfitrión (grant
  de la columna). El anfitrión borra partidas en curso (cancelar) o terminadas.
- Storage `fotos-partidas`: público, carpeta `<partida>/`, archivo
  `<autor>_<uuid>.webp`. Suben los jugadores con cuenta (hasta 12 por
  partida, `puede_subir_foto()`); ven los que jugaron (también invitados);
  borra el autor (`owner_id`) o el anfitrión.
- Catálogos de la mesa (`20261018000000_catalogos_de_la_mesa.sql`):
  `perfiles.catalogo_visible` (por defecto `true`; grant de la columna).
  `catalogo_de_amigos()` y `juegos_de_la_mesa(partida)` son security definer
  y devuelven **solo** datos del juego y de quién lo tiene (nunca notas ni
  puntuación); las tablas siguen cerradas por RLS. En la mesa entra el
  catálogo propio siempre y el de los demás si lo muestran; la consulta
  quien esté en la sala (también un invitado). `cambiar_juego_de_sala`: solo
  el anfitrión, en curso, por un juego de `juegos_de_la_mesa`.
- Puntaje (`20261019000000_puntaje_por_rondas.sql`): `partidas.tipo_puntaje`
  (`total`, `rondas`, `categorias`), `rondas` (1 a 50) y `categorias` (hasta
  20, copiadas en la sala). `partida_anotaciones` (`jugador_id`, `columna`,
  `puntos`): un casillero por ronda o categoría; se lee con RLS (los de la
  sala) y se escribe **solo** con `anotar_puntos(jugador, columna, puntos)`
  (cada uno los suyos, el anfitrión todos; `null` borra), que recalcula
  `partida_jugadores.puntos` como la suma: cierre, historial y ranking no
  cambian. Con rondas o categorías el total no se escribe a mano (la política
  de update exige `tipo_puntaje() = 'total'`). `configurar_puntaje` (solo el
  anfitrión y antes de que haya puntos; si no, `hint = 'ya_hay_puntos'`) y
  `agregar_ronda` (cualquiera de la sala). `hojas_de_puntuacion`: categorías
  guardadas por `(juego_id, autor_id)`, privadas como los resúmenes.
- Sala sin juego, revancha y reabrir
  (`20261020000000_sala_sin_juego_revancha_reabrir.sql`):
  `partidas.juego_nombre` puede ser null **solo en curso** (check
  `partidas_terminada_con_juego`); `crear_sala_sin_juego()` y
  `terminar_partida` exige juego (`hint = 'sin_juego'`). `revancha(partida)`
  (solo el anfitrión, terminada): sala nueva con el mismo juego, la misma
  forma de anotar y `revancha_de`; suma a los amigos con cuenta y a los
  jugadores sin celular (no a anónimos ni a quienes no son amigos); si ya hay
  una en curso, devuelve esa. `reabrir_partida(partida)` (solo el anfitrión,
  hasta 10 minutos después de terminar; si no, `hint = 'muy_tarde'`): vuelve
  a `en_curso`, borra el resultado (`gano`, `posicion`, modo) y conserva los
  puntos; si otra sala tomó el código, genera otro.

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
- "¿A qué jugamos hoy?" es una pizarra arriba de la búsqueda; "Sortear"
  elige entre los juegos visibles (con los filtros aplicados), con una
  animación corta que respeta `prefers-reduced-motion`.
  "Otro" nunca repite el anterior si hay alternativas.
- La búsqueda ignora tildes y mayúsculas (`normalizar`).

### Ficha del juego (`/juegos/[id]`)

- Las pestañas son rutas hermanas dentro del grupo `(pestanas)`, con un
  layout común (volver, nombre, pestañas). El layout **no** hace `await` de
  `params`: cada parte lo resuelve en su `<Suspense>`. `obtenerJuego` usa
  `cache()` para no repetir la consulta entre el layout y la página.
- Next 16 mantiene montadas (ocultas, con `<Activity>`) las pestañas ya
  visitadas, así que en el DOM puede haber más de una a la vez: tenerlo en
  cuenta en los tests.
- Quitar del catálogo un juego **manual propio** también borra el juego, sus
  resúmenes y su foto (nadie más lo ve). Un juego de BGG se conserva.
- Solo se editan los datos de juegos manuales propios (`editable`); los de BGG
  son compartidos (`/editar` da 404).
- Descripción en la Ficha, con los saltos de línea respetados
  (`whitespace-pre-line`). En los juegos de BGG (`origen = 'bgg'`) se atribuye
  con "Descripción: BoardGameGeek" y link a la página del juego. Un juego
  manual con `bgg_id` de referencia **no** se atribuye (la descripción pudo
  haberse editado), pero igual muestra "Ver en BoardGameGeek".
- "Ver en BoardGameGeek" (`EnlaceBgg`, `urlJuegoBgg`): en la Ficha y en las
  pestañas vacías de cualquier juego con `bgg_id`. Abre en otra pestaña.
- "Cómo se juega" y "Hoja de turno" son **opcionales** y se completan a mano.
  Vacías: con `bgg_id`, mensaje con link a BGG (reglamento y ayudas de la
  comunidad) y "Escribir" como opción secundaria; sin `bgg_id`, solo "Escribir".
- Hoja de turno: `.md-hoja` (letra de 18 px, fases con fondo), tablas con
  scroll propio en el celular, `@media print` en A4 sin navegación ni
  botones, y "Mantener pantalla encendida" con la Screen Wake Lock API.

### Editor de resúmenes (`/juegos/[id]/resumen/editar?seccion=...`)

- Un solo formulario con las dos secciones (Cómo se juega / Hoja de turno);
  cambiar de sección no pierde lo escrito. Escribir / Vista previa (el mismo
  `Markdown` de la ficha).
- Barra de formato (título, negrita, lista, checklist, tabla) con
  `aplicarFormato` (`lib/resumenes/formato.ts`): funciones puras que devuelven
  el texto y la selección nuevos. Plantillas para empezar.
- `guardarResumen`: upsert en `resumenes` por `(juego_id, autor_id)`. Vuelve a
  la pestaña editada con `?guardado=1`.
- Borrador en `localStorage` (`miludoteca:borrador-resumen:<juegoId>`) mientras
  hay cambios; al abrir, si difiere de lo guardado, ofrece Recuperar/Descartar.
- `useAvisoCambios`: confirma antes de salir con cambios (beforeunload y
  clicks en links, en fase de captura). El "atrás" del navegador no se puede
  frenar: para eso está el borrador.

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
  Decodifica entidades HTML (con `he`, incluidas las doblemente escapadas como
  `&amp;quot;`), y en la descripción (`limpiarDescripcion`) respeta los párrafos
  (`&#10;&#10;`) y los saltos simples, quita los espacios al final de cada línea
  y junta las líneas en blanco de más. Convierte los `0` de BGG en `null`,
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
imagen (no se hace pasar por BGG); varias descripciones tienen más de un
párrafo para probar cómo se muestran. En desarrollo agrega 300 ms de latencia para
que se vean los estados de carga.

#### Verificación con la API real

`BGG_API_TOKEN=... npm run test:bgg-real` (en Windows, cargar antes la
variable: `$env:BGG_API_TOKEN="..."` en PowerShell o `set BGG_API_TOKEN=...`
en cmd) verifica lo que se puede automatizar e imprime lo observado (códigos,
headers). Si algo no coincide, actualizar los fixtures con respuestas reales y
ajustar el parser o el cliente.

Verificado el 2026-10-28 con el token real:

- [x] `Authorization: Bearer` es el esquema que acepta BGG. Sin token o con un
      token inválido responde **401** (`Unauthorized. See
    https://boardgamegeek.com/using_the_xml_api`): el cliente lo trata como
      `no_autorizado`.
- [x] El dominio sin `www` responde 200 sin redirecciones.
- [x] `thing` acepta 20 ids en un pedido (un id que no existe simplemente no
      viene en la respuesta).
- [x] La estructura del XML coincide con los fixtures: Catan (id 13) se parsea
      completo (jugadores, duración, complejidad 2,28, año, categorías).
- [x] `description` llega sin entidades HTML después de decodificarla.
- [x] Las imágenes vienen de `cf.geekdo-images.com` (ya está en
      `images.remotePatterns`). Son las `__original`, pesadas: el optimizador
      de Next las achica.
- [x] `search` con `type=boardgame` incluye juegos derivados y expansiones de
      fans ("The 7 Wonders of Catan (fan expansion for Catan)"), y no viene
      ordenado por relevancia: el orden lo pone `bgg-provider` (exacto,
      empieza igual, el resto).
- [x] La duración es `playingtime` (Catan: 120 min).

Todavía sin observar:

- [ ] En qué endpoints aparece el 202 (no apareció en `search` ni en `thing`)
      y cómo es su cuerpo (el fixture `respuesta-202.xml` sigue siendo una
      suposición basada en `collection`).
- [ ] Límites reales de rate limit, si el 429 trae `Retry-After` y en qué formato.
- [ ] Si todos los nombres de categorías y mecánicas coinciden con los de
      `tipos.ts` (los de Catan sí: `eurogame`, `negociación`).
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

- Estética "café de juegos": papel crema, espresso, paño de mesa (primario),
  terracota (`acento`), `miel`, `pizarra`/`tiza`/`marco` y `nota` (post-it). El
  modo oscuro es un "café de noche". Colores siempre con los tokens de
  `globals.css` (`bg-fondo`, `bg-superficie`, `text-texto`, `text-texto-suave`,
  `bg-primario`, `bg-acento`, `border-borde`...), que ya resuelven el modo
  oscuro y la impresión. Íconos de `lucide-react`.
- Letras (`next/font` en `app/layout.tsx`): Nunito para el texto (`font-sans`),
  Fraunces para títulos y números grandes (`font-display`; los `h1` y `h2` ya
  la usan) y Caveat (`font-mano`) solo para detalles a mano (pizarra, notas).
- Botones redondeados (`rounded-full`) con "relieve": sombra dura abajo
  (utilidades `relieve`, `relieve-primario`, `relieve-acento`) que desaparece
  al apretar. `Boton` tiene las variantes `primario`, `secundario` y `acento`
  (acciones fuertes, como "Terminar partida"). Las tarjetas llevan `relieve`.
- Barra inferior: Estante · Jugar · (+ agregar, botón central) · Ranking ·
  Cuenta; se marca la ruta más larga que coincide (`itemActivo`,
  `lib/navegacion.ts`). El catálogo se llama "Tu estante" en la UI (la ruta
  sigue siendo `/catalogo`).
- Peso de un juego: Liviano (1–2), Mediano (2–3) y Pesado (3–5), igual en la
  Ficha, las tarjetas y el filtro (`nivelDeComplejidad`).
- Avatares como posavasos de color: `colorDeNombre` (siempre el mismo color
  para el mismo nombre).

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
- RLS: `supabase/tests/*.test.sql` (pgTAP, un archivo por área). Cada política nueva lleva su caso:
  lo que el dueño puede hacer **y** lo que otro usuario no. Los DELETE directos
  en `storage.objects` están bloqueados por Supabase: probarlos en los e2e.
- e2e: cada test crea sus usuarios y datos con la API admin
  (`tests/e2e/helpers.ts`: `prepararPerfil` fija el nombre y devuelve el
  código; `hacerAmigos`; `borrarUsuario` también borra sus salas y los
  invitados anónimos) y los borra al final; los tests que comparten filas
  de BGG van en `describe.configure({ mode: "serial" })`. Los e2e compilan con
  `GAME_DATA_PROVIDER=mock` y `NEXT_PUBLIC_AUTH_GOOGLE=true`, y la app tiene
  que correr en `localhost:3000` (el `site_url` de Auth).
- Selectores: preferir `getByRole`/`getByLabel` con `exact: true` (varios
  textos se repiten: "Nombre"/"Buscar por nombre", "8 juegos"/"Ver 8 juegos").
  Ojo con las pestañas visitadas que Next deja montadas y ocultas.
- Antes de escribir en un input controlado justo después de `goto`, esperar
  la hidratación (`waitForLoadState("networkidle")`): si no, React lo vacía.

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

## Fase 2: jugar con amigos (en curso)

Plan, decisiones e hitos en `docs/PLAN.md`. Hecho: hito 9 (perfiles y
amigos), hito 10 (salas en vivo), hito 11 (cierre, historial, notas y
fotos), hito 12 (ranking y cara a cara), hito 13 (catálogos de la mesa) y
hito 14 (puntuación por rondas y hojas de puntuación). La fase 2 está
completa. Después: elegir el juego de la sala de una lista con filtro por
dueño, salas sin juego ("Elegimos en la mesa"), revancha con los mismos
jugadores y reabrir una partida recién terminada. Importar la colección de BGG sigue pendiente aparte.

### Amigos (`/jugar/amigos`)

- Tu código con "Copiar" y "Compartir" (Web Share API; el link
  `/jugar/amigos?codigo=XXXXXX` completa el formulario, también después del
  login gracias a `?next=`).
- "Mandar solicitud" (`agregarAmigo`) acepta minúsculas, espacios y guiones
  (`normalizarCodigo`). Solicitudes recibidas (Aceptar/Rechazar), enviadas
  (Cancelar) y amigos (dejar de serlo, con confirmación).
- La tarjeta de Amigos en `/jugar` muestra cuántas solicitudes hay sin
  responder.

### Salas (`/jugar/nueva` → `/sala/<código>`)

- Se crea desde Jugar (elegir un juego del catálogo) o con "Jugar una
  partida" en la Ficha (`crearSala`). "Elegimos en la mesa" (en Jugar y en
  Nueva sala; `crearSala(null)`) la crea **sin juego**: el encabezado dice
  "Sin juego todavía" (`SIN_JUEGO`), un aviso lleva a "¿A qué jugamos?" y
  "Terminar partida" queda deshabilitado hasta que el anfitrión elige. Unirse: el QR o el link
  (`/sala/<código>`), o el código en Jugar (`irASala` valida que exista).
- `/sala/[codigo]` está fuera de `(app)` (sin barra inferior) y es **ruta
  pública** en `rutas.ts`. Sin sesión o como anónimo: vista previa y "Entrar
  como invitado" (`entrarComoInvitado`: `signInAnonymously` + unirse) o
  ingresar con la cuenta (`?next=`). Con cuenta: "Unirme a la sala".
- El proxy trata a un anónimo como **sin sesión**: fuera de `/sala` lo manda
  al login, y en el login puede usar su cuenta.
- En vivo (`SalaEnVivo`): un trigger manda un Broadcast (`realtime.send`) al
  canal `sala:<id>` en cada cambio, **sin datos**; el cliente vuelve a pedir
  los jugadores con RLS. Además recarga cada 15 s y al volver a la pestaña.
  No usamos `postgres_changes`: con RLS no entregaba los cambios (y los
  DELETE no se filtran). Si me sacan o se cancela la sala, RLS deja de
  devolver mi fila y se muestra "Ya no estás en esta sala".
- Puntos: +/− o escribir el número; se guarda el **valor final** 400 ms
  después del último toque (`actualizarPuntos`). Lo tocado (`pendientes`)
  manda sobre lo remoto hasta que llega una recarga **pedida después** de
  guardarlo (`soltarConfirmados`), y una recarga que salió antes que la
  última aplicada se descarta. Después del render inicial, los jugadores
  solo cambian con recargas: un `refresh()` de una acción puede traer datos
  más viejos. `key={sala.id}`: pasar de una sala a otra no arrastra estado. Corona para quien va
  ganando (`puntajeMasAlto`; nadie si están todos iguales).
- QR: `qrcode` genera el SVG en el servidor (negro sobre blanco, también en
  modo oscuro). El link usa `urlDelSitio()`.
- Terminar (`TerminarPartida`, solo el anfitrión): elegir el modo, ver quién
  gana (`ganadoresPrevistos`, la misma regla que la base) y confirmar;
  espera a que se guarden los puntos pendientes. `terminarPartida` redirige a
  `/partida/<id>`; a los demás los lleva la recarga al ver `terminada`.
- Cómo se anota (`ConfigurarPuntaje`, solo el anfitrión, antes de empezar):
  Total, Por rondas o Hoja de puntuación (categorías una por línea,
  `leerCategorias`; precarga la hoja guardada para ese juego y ofrece
  guardarla si el anfitrión ve el juego). Con rondas o categorías,
  `HojaDePuntos` reemplaza al marcador: una fila por ronda o categoría, una
  columna por jugador (scroll horizontal, primera columna fija) y el total
  abajo. Cada casillero se guarda como los puntos (400 ms, valor final,
  `anotarPuntos`), con sus propios pendientes; el total se calcula en el
  navegador con lo visible (`totalesDeLaHoja`). "Agregar ronda" para
  cualquiera. El resultado muestra la hoja de solo lectura.
- Supabase local levanta Realtime (`db:start` ya no lo excluye) y tiene
  `enable_anonymous_sign_ins = true`. En producción hay que activar los
  anónimos (ver `docs/AUTH.md`).

### Partidas terminadas (`/partida/<id>`, `/jugar/historial`)

- `/partida/[id]` está fuera de `(app)` y es ruta pública (los invitados ven
  el resultado y una invitación a crear cuenta); RLS decide si existe. Si
  sigue en curso, lleva a la sala.
- Resultado ("Ganó Beto", "Empate", "Perdieron todos": `textoResultado`),
  posiciones, duración, notas (`guardarNotas`, solo el anfitrión), fotos
  (subidas desde el navegador como las del alta, `borrarFoto`) y, para el
  anfitrión, "Revancha" y "Borrar partida" (`borrarPartida`, borra las
  fotos primero).
- Revancha y reabrir (`components/partidas/revancha.tsx`): "Revancha"
  (`armarRevancha`) lleva a la sala nueva con los mismos jugadores. "Reabrir
  partida" (`reabrirPartida`) aparece para el anfitrión durante 10 minutos
  (se decide en el navegador: `Date.now()` no va en el render del servidor).
  A los demás, `AvisoRevancha` (media hora después del cierre: aviso de la
  sala más una revisión cada 10 s) los vuelve a la sala si se reabre y les
  muestra "¡Hay revancha!" con el link si los sumaron.
- Historial: todas las terminadas del usuario; filtros en el navegador
  (`filtrarHistorial`) por juego (`juego_id`, o el nombre si el juego se
  borró) y por persona (`?con=`), en la query string con `replaceState`.
  Muestra "N partidas · ganaste X".
- Ficha del juego: "Jugar una partida" y "Lo jugaste N veces · la última, el
  ...", con link al historial filtrado.
- Ranking (`/jugar/ranking`): sin tablas nuevas; se calcula en el navegador
  con el historial (lo que RLS deja ver: las partidas que jugaste). Entran
  vos y tus amigos actuales (nombres del perfil), nunca invitados. Dos modos
  (`?modo=cooperativo`; el juego elegido sigue si también tiene partidas del
  otro tipo):
  - **Competitivo** (sin cooperativas): victorias, porcentaje, partidas.
    Cara a cara con cada amigo: en cada partida gana el duelo quien ganó o,
    si ninguno, la mejor posición (`duelo`); "némesis" = el amigo con más
    saldo en contra. Cada fila lleva al historial (`?con=&juego=`).
  - **Cooperativo**: partidas jugadas y ganadas por persona, y **duplas**
    (cada par de personas que jugó junto: "Vos y Beto: jugaron 10 partidas y
    ganaron 8"). Orden: ganadas, porcentaje, partidas.
- e2e: `crearPartidaTerminada` (helpers) arma partidas terminadas con la API
  admin, sin jugarlas.
- e2e: al pasar de una sala a otra, Next deja la anterior montada y oculta:
  filtrar con `.filter({ visible: true })`. Y esperar a que una `Hoja` se
  cierre antes de tocar la página (mientras está abierta, el resto es inerte).

### Catálogos de la mesa

- El mismo juego en distintos catálogos se junta por `bgg_id` o, si no
  tiene, por nombre normalizado (`claveDeJuego`). `agruparPorJuego` se queda
  con el nombre más repetido (empate: el que tiene mayúsculas) y completa los
  datos que falten con las otras copias.
- "¿Quién lo tiene?" (`/jugar/quien-lo-tiene`): buscador sin tildes y filtro
  por amigo, en el navegador. En la Ficha: "También lo tiene Beto y Caro".
- Cuenta → "Mostrar mis juegos" (`cambiarVisibilidadCatalogo`, optimista).
- Sala → "¿A qué jugamos?" (`SorteoMesa`): pide `juegos_de_la_mesa` desde
  el navegador al abrir. Dos modos: **Elegir** (desplegable con todos los
  juegos de la mesa, "Nombre · dueños") y **Al azar** (`elegirAlAzar`);
  cambiar de modo limpia la elección. Filtros comunes: chips por dueño
  (`filtrarPorDuenos`, varios a la vez; ninguno = todos), "Solo para N
  jugadores" (`juegosParaLaMesa`; sin el dato no entra, como en el
  catálogo) y duración máxima. El anfitrión puede "Jugar este"
  (`cambiarJuegoDeSala`); a los demás se les actualiza el
  encabezado porque la recarga nota el `juego_id` nuevo y hace
  `router.refresh()` (también cuando una sala sin juego recibe el primero).

Los resúmenes **no** se generan con IA (se descartó): "Cómo se juega" y "Hoja
de turno" se escriben a mano. No agregar integraciones con la API de Claude ni
código preparado para eso.
