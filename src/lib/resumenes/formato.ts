// Acciones de la barra de formato del editor de resúmenes. Funciones puras:
// reciben el texto y la selección, y devuelven el texto nuevo y dónde dejar
// el cursor.

export type Edicion = { texto: string; inicio: number; fin: number };

export type Formato = "titulo" | "negrita" | "lista" | "checklist" | "tabla";

const PREFIJOS = { titulo: "## ", lista: "- ", checklist: "- [ ] " } as const;
/** Qué cuenta como "ya tiene este formato" (un ítem tildado también es checklist). */
const PATRONES = {
  titulo: /^## /,
  lista: /^[-*+] (?!\[[ xX]\] )/,
  checklist: /^- \[[ xX]\] /,
} as const;
const PREFIJO_CUALQUIERA = /^(#{1,6} |- \[[ xX]\] |[-*+] |\d+\. )/;

export const TABLA = `| Columna | Columna |
| --- | --- |
| Dato | Dato |`;

/** Rango de líneas completas que toca la selección. */
function lineasSeleccionadas(texto: string, inicio: number, fin: number) {
  const desde = texto.lastIndexOf("\n", inicio - 1) + 1;
  const finAjustado = fin > inicio && texto[fin - 1] === "\n" ? fin - 1 : fin;
  const corte = texto.indexOf("\n", finAjustado);
  const hasta = corte === -1 ? texto.length : corte;
  return { desde, hasta };
}

/**
 * Pone (o saca, si ya lo tienen todas) un prefijo de línea. Reemplaza otros
 * prefijos de bloque: convertir una lista en checklist no deja "- - [ ] ".
 */
function alternarPrefijo(e: Edicion, formato: keyof typeof PREFIJOS): Edicion {
  const prefijo = PREFIJOS[formato];
  const { desde, hasta } = lineasSeleccionadas(e.texto, e.inicio, e.fin);
  const lineas = e.texto.slice(desde, hasta).split("\n");
  const conTexto = lineas.filter((l) => l.trim() !== "");
  const todasTienen = conTexto.length > 0 && conTexto.every((l) => PATRONES[formato].test(l));
  const nuevas = lineas.map((linea) => {
    if (linea.trim() === "" && lineas.length > 1) return linea;
    const sinPrefijo = linea.replace(PREFIJO_CUALQUIERA, "");
    return todasTienen ? sinPrefijo : prefijo + sinPrefijo;
  });
  const bloque = nuevas.join("\n");
  const texto = e.texto.slice(0, desde) + bloque + e.texto.slice(hasta);
  // Con una sola línea y sin selección, el cursor queda al final de la línea.
  if (e.inicio === e.fin && lineas.length === 1) {
    const cursor = desde + bloque.length;
    return { texto, inicio: cursor, fin: cursor };
  }
  return { texto, inicio: desde, fin: desde + bloque.length };
}

function alternarNegrita(e: Edicion): Edicion {
  const seleccion = e.texto.slice(e.inicio, e.fin);
  const antes = e.texto.slice(0, e.inicio);
  const despues = e.texto.slice(e.fin);
  // Ya está en negrita (los ** quedan justo afuera de la selección): se sacan.
  if (antes.endsWith("**") && despues.startsWith("**")) {
    return {
      texto: antes.slice(0, -2) + seleccion + despues.slice(2),
      inicio: e.inicio - 2,
      fin: e.fin - 2,
    };
  }
  const contenido = seleccion || "texto";
  return {
    texto: `${antes}**${contenido}**${despues}`,
    inicio: e.inicio + 2,
    fin: e.inicio + 2 + contenido.length,
  };
}

function insertarTabla(e: Edicion): Edicion {
  const antes = e.texto.slice(0, e.inicio);
  const despues = e.texto.slice(e.fin);
  // Una tabla necesita líneas en blanco alrededor para que markdown la reconozca.
  const separadorAntes =
    antes === "" ? "" : antes.endsWith("\n\n") ? "" : antes.endsWith("\n") ? "\n" : "\n\n";
  const separadorDespues =
    despues === "" || despues.startsWith("\n\n") ? "" : despues.startsWith("\n") ? "\n" : "\n\n";
  const inicioTabla = antes.length + separadorAntes.length;
  return {
    texto: antes + separadorAntes + TABLA + separadorDespues + despues,
    // Deja seleccionado el primer "Columna" para escribir encima.
    inicio: inicioTabla + 2,
    fin: inicioTabla + 2 + "Columna".length,
  };
}

export function aplicarFormato(e: Edicion, formato: Formato): Edicion {
  switch (formato) {
    case "negrita":
      return alternarNegrita(e);
    case "tabla":
      return insertarTabla(e);
    default:
      return alternarPrefijo(e, formato);
  }
}

export const PLANTILLAS = {
  como_se_juega: `## Objetivo
Qué hay que lograr para ganar.

## Preparación
1. Paso uno
2. Paso dos

## Turno
- Qué se hace en cada turno

## Fin de la partida
Cuándo termina y cómo se cuentan los puntos.

## Ojo con
- Reglas que siempre se olvidan
`,
  hoja_de_turno: `## 1. Primera fase
- [ ] Acción
- [ ] Acción

## 2. Segunda fase
- [ ] Acción

## Fin del turno
- [ ] Pasarle el turno al de la izquierda

## Referencia rápida
| Acción | Costo |
| --- | --- |
| Algo | 1 recurso |
`,
} as const;
