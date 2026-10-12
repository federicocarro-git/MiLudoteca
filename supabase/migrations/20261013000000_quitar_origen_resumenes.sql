-- Los resúmenes se escriben siempre a mano: ya no se van a generar con IA a
-- partir del reglamento, así que se quita la columna que distinguía el origen
-- ('manual' / 'ia'). La restricción check se borra junto con la columna.

alter table public.resumenes drop column origen;
