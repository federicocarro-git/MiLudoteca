// URL pública de la app, para armar los links de OAuth y de los emails.
// En los previews de Vercel cae en VERCEL_URL (agregar el patrón de esas URLs
// a las Redirect URLs de Supabase, ver docs/AUTH.md).
export function urlDelSitio(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}
