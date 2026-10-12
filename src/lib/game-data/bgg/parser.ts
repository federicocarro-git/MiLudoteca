import { XMLParser } from "fast-xml-parser";
import { decode } from "he";
import { tiposDesdeBgg } from "../tipos";
import { ErrorGameData, type DatosJuego, type ResultadoBusqueda } from "../types";

// Parser de las respuestas XML de la API2 de BGG (search y thing).
// La estructura está documentada en CLAUDE.md, en "Pendiente de verificar".

const SIEMPRE_ARRAY = new Set(["item", "name", "link", "error"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // Todo como texto: los números se convierten a mano con validación.
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (nombre) => SIEMPRE_ARRAY.has(nombre),
});

type Valor = { value?: string };
type Nombre = { type?: string; value?: string };
type Link = { type?: string; value?: string };
type ItemXml = {
  id?: string;
  type?: string;
  name?: Nombre[];
  yearpublished?: Valor;
  image?: string;
  thumbnail?: string;
  description?: string;
  minplayers?: Valor;
  maxplayers?: Valor;
  playingtime?: Valor;
  maxplaytime?: Valor;
  link?: Link[];
  statistics?: { ratings?: { averageweight?: Valor } };
};

function parsearDocumento(xml: string): ItemXml[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new ErrorGameData(
      "respuesta_invalida",
      "BGG devolvió una respuesta que no se pudo leer.",
    );
  }
  if ("errors" in doc || "error" in doc) {
    throw new ErrorGameData("no_disponible", "BGG devolvió un error.");
  }
  const items = doc.items as { item?: ItemXml[] } | "" | undefined;
  if (items === undefined) {
    throw new ErrorGameData("respuesta_invalida", "BGG devolvió una respuesta inesperada.");
  }
  return (typeof items === "object" && items.item) || [];
}

/** Texto de BGG: viene con entidades HTML (a veces doblemente escapadas). */
function texto(valor: string | undefined): string {
  return decode(valor ?? "").trim();
}

/** Entero positivo; BGG usa 0 para "sin dato". */
function enteroPositivo(valor: string | undefined): number | null {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nombrePrincipal(item: ItemXml): string {
  const nombres = item.name ?? [];
  const principal = nombres.find((n) => n.type === "primary") ?? nombres[0];
  return texto(principal?.value);
}

export function parsearBusqueda(xml: string): ResultadoBusqueda[] {
  const vistos = new Map<string, ResultadoBusqueda>();
  for (const item of parsearDocumento(xml)) {
    if (!item.id) continue;
    const nombre = nombrePrincipal(item);
    if (!nombre) continue;
    // Un mismo juego aparece una vez por cada nombre que coincide; nos
    // quedamos con la primera aparición, salvo que después venga el principal.
    const esPrincipal = item.name?.some((n) => n.type === "primary") ?? false;
    if (vistos.has(item.id) && !esPrincipal) continue;
    vistos.set(item.id, { id: item.id, nombre, anio: enteroPositivo(item.yearpublished?.value) });
  }
  return [...vistos.values()];
}

/** Complejidad 1-5 con dos decimales; 0 (sin votos) o fuera de rango → null. */
function complejidad(valor: string | undefined): number | null {
  const n = Number.parseFloat(valor ?? "");
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Descripción de `thing`: BGG la manda con los saltos como `&#10;` y el resto
 * de las entidades escapadas (a veces dos veces). Se decodifica todo, se
 * respetan los párrafos (línea en blanco) y los saltos simples, y se limpian
 * los espacios sobrantes al final de cada línea y las líneas en blanco de más.
 */
export function limpiarDescripcion(valor: string | undefined): string | null {
  const limpio = texto(valor)
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  return limpio ? limpio.slice(0, 20000) : null;
}

function imagen(item: ItemXml): string | null {
  const url = texto(item.image) || texto(item.thumbnail);
  return url.startsWith("https://") ? url : null;
}

export function parsearDetalle(xml: string): DatosJuego[] {
  return parsearDocumento(xml).flatMap((item): DatosJuego[] => {
    const bggId = enteroPositivo(item.id);
    const nombre = nombrePrincipal(item);
    if (!bggId || !nombre) return [];

    let min = enteroPositivo(item.minplayers?.value);
    let max = enteroPositivo(item.maxplayers?.value);
    if (min && max && min > max) [min, max] = [max, min];

    const links = item.link ?? [];
    const tipos = tiposDesdeBgg(
      links
        .filter((l) => l.type === "boardgamecategory" || l.type === "boardgamemechanic")
        .map((l) => texto(l.value)),
    );

    return [
      {
        bgg_id: bggId,
        nombre: nombre.slice(0, 200),
        imagen_url: imagen(item),
        jugadores_min: min,
        jugadores_max: max,
        duracion_min:
          enteroPositivo(item.playingtime?.value) ?? enteroPositivo(item.maxplaytime?.value),
        complejidad: complejidad(item.statistics?.ratings?.averageweight?.value),
        anio: enteroPositivo(item.yearpublished?.value),
        descripcion: limpiarDescripcion(item.description),
        tipos,
      },
    ];
  });
}
