import { describe, expect, it } from "vitest";
import { TABLA, aplicarFormato, type Edicion } from "./formato";

/** Arma una Edicion marcando la selección con ⟦ y ⟧ dentro del texto. */
function e(marcado: string): Edicion {
  const inicio = marcado.indexOf("⟦");
  const fin = marcado.indexOf("⟧") - 1;
  return { texto: marcado.replace("⟦", "").replace("⟧", ""), inicio, fin };
}

/** Lo contrario: muestra la selección resultante con ⟦ y ⟧. */
function marcar({ texto, inicio, fin }: Edicion) {
  return texto.slice(0, inicio) + "⟦" + texto.slice(inicio, fin) + "⟧" + texto.slice(fin);
}

describe("prefijos de línea", () => {
  it("título en la línea del cursor, cursor al final", () => {
    expect(marcar(aplicarFormato(e("uno\nd⟦⟧os\ntres"), "titulo"))).toBe("uno\n## dos⟦⟧\ntres");
  });

  it("si ya es título, lo saca", () => {
    expect(aplicarFormato(e("## d⟦⟧os"), "titulo").texto).toBe("dos");
  });

  it("lista sobre varias líneas seleccionadas (sin tocar las vacías)", () => {
    expect(marcar(aplicarFormato(e("⟦a\n\nb⟧\nc"), "lista"))).toBe("⟦- a\n\n- b⟧\nc");
  });

  it("si todas ya son lista, la saca", () => {
    expect(aplicarFormato(e("⟦- a\n- b⟧"), "lista").texto).toBe("a\nb");
  });

  it("convertir lista en checklist reemplaza el prefijo", () => {
    expect(aplicarFormato(e("- comprar⟦⟧"), "checklist").texto).toBe("- [ ] comprar");
    expect(aplicarFormato(e("1. paso⟦⟧"), "checklist").texto).toBe("- [ ] paso");
    expect(aplicarFormato(e("- [x] hecho⟦⟧"), "checklist").texto).toBe("hecho");
  });

  it("en texto vacío agrega el prefijo", () => {
    expect(marcar(aplicarFormato(e("⟦⟧"), "checklist"))).toBe("- [ ] ⟦⟧");
  });

  it("una selección que termina justo después de un salto no toma la línea siguiente", () => {
    expect(aplicarFormato(e("⟦a\n⟧b"), "lista").texto).toBe("- a\nb");
  });
});

describe("negrita", () => {
  it("envuelve la selección", () => {
    expect(marcar(aplicarFormato(e("hola ⟦mundo⟧ !"), "negrita"))).toBe("hola **⟦mundo⟧** !");
  });

  it("sin selección inserta un texto de ejemplo seleccionado", () => {
    expect(marcar(aplicarFormato(e("hola ⟦⟧"), "negrita"))).toBe("hola **⟦texto⟧**");
  });

  it("si ya está en negrita, la saca", () => {
    expect(marcar(aplicarFormato(e("hola **⟦mundo⟧**"), "negrita"))).toBe("hola ⟦mundo⟧");
  });
});

describe("tabla", () => {
  it("en un texto vacío", () => {
    const r = aplicarFormato(e("⟦⟧"), "tabla");
    expect(r.texto).toBe(TABLA);
    expect(r.texto.slice(r.inicio, r.fin)).toBe("Columna");
  });

  it("agrega líneas en blanco alrededor", () => {
    expect(aplicarFormato(e("antes⟦⟧después"), "tabla").texto).toBe(`antes\n\n${TABLA}\n\ndespués`);
    expect(aplicarFormato(e("antes\n⟦⟧\ndespués"), "tabla").texto).toBe(
      `antes\n\n${TABLA}\n\ndespués`,
    );
  });
});
