-- Permite URLs http de localhost en juegos.imagen_url: el Storage del
-- Supabase local sirve las imágenes por http://127.0.0.1:54321. En producción
-- las URLs siguen siendo https (lo valida también la app).

alter table public.juegos drop constraint juegos_imagen_url_check;

alter table public.juegos add constraint juegos_imagen_url_check check (
  imagen_url is null
  or imagen_url ~ '^https://'
  or imagen_url ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/'
);
