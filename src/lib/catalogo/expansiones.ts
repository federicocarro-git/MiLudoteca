import type { JuegoCatalogo } from "./filtros";

// Las expansiones van adentro de su juego base: en el estante se ve el juego
// con "+N expansiones" y las expansiones, en su Ficha. Una expansión cuyo
// juego base no está en el estante se muestra sola (marcada como expansión).

export type JuegoEstante = JuegoCatalogo & {
  /** Cuántas expansiones de este juego hay en el estante. */
  expansiones: number;
};

/** ¿Esta expansión es de alguno de estos juegos base (por bgg_id)? */
export function esExpansionDe(
  juego: Pick<JuegoCatalogo, "es_expansion" | "expande">,
  basesBggIds: ReadonlySet<number>,
): boolean {
  return juego.es_expansion && juego.expande.some((id) => basesBggIds.has(id));
}

/** El estante a mostrar: los juegos base con su cantidad de expansiones. */
export function organizarEstante(juegos: JuegoCatalogo[]): JuegoEstante[] {
  const bases = new Set(
    juegos.flatMap((j) => (!j.es_expansion && j.bgg_id !== null ? [j.bgg_id] : [])),
  );
  const porBase = new Map<number, number>();
  for (const j of juegos) {
    if (!esExpansionDe(j, bases)) continue;
    for (const id of new Set(j.expande)) {
      if (bases.has(id)) porBase.set(id, (porBase.get(id) ?? 0) + 1);
    }
  }
  return juegos
    .filter((j) => !esExpansionDe(j, bases))
    .map((j) => ({
      ...j,
      expansiones: !j.es_expansion && j.bgg_id !== null ? (porBase.get(j.bgg_id) ?? 0) : 0,
    }));
}
