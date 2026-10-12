// Vocabulario de "tipos" para el filtro del catálogo. Los juegos de BGG traen
// categorías y mecánicas en inglés: acá se traducen a este vocabulario y se
// descarta lo que no tiene equivalente, para que el filtro no se llene de ruido.

export const TIPOS = [
  "abstracto",
  "cartas",
  "construcción de mazo",
  "cooperativo",
  "dados",
  "deducción",
  "eurogame",
  "faroleo",
  "familiar",
  "infantil",
  "legacy",
  "losetas",
  "negociación",
  "palabras",
  "party",
  "por equipos",
  "roles ocultos",
  "solitario",
  "temático",
  "trivia",
  "wargame",
] as const;

export type Tipo = (typeof TIPOS)[number];

const DESDE_BGG: Record<string, Tipo> = {
  // Categorías
  "Abstract Strategy": "abstracto",
  "Card Game": "cartas",
  Dice: "dados",
  Deduction: "deducción",
  Economic: "eurogame",
  Bluffing: "faroleo",
  "Children's Game": "infantil",
  Negotiation: "negociación",
  "Word Game": "palabras",
  "Party Game": "party",
  Trivia: "trivia",
  Wargame: "wargame",
  Adventure: "temático",
  Fantasy: "temático",
  Horror: "temático",
  "Science Fiction": "temático",
  // Mecánicas
  "Cooperative Game": "cooperativo",
  "Deck, Bag, and Pool Building": "construcción de mazo",
  "Legacy Game": "legacy",
  "Tile Placement": "losetas",
  "Team-Based Game": "por equipos",
  "Hidden Roles": "roles ocultos",
  "Traitor Game": "roles ocultos",
  "Solo / Solitaire Game": "solitario",
};

/** Traduce categorías/mecánicas de BGG a tipos propios (sin repetidos, ordenados). */
export function tiposDesdeBgg(valores: string[]): Tipo[] {
  const tipos = new Set<Tipo>();
  for (const valor of valores) {
    if (Object.hasOwn(DESDE_BGG, valor)) tipos.add(DESDE_BGG[valor]);
  }
  return [...tipos].sort((a, b) => a.localeCompare(b, "es"));
}
