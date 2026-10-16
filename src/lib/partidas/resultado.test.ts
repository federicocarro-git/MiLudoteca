import { describe, expect, it } from "vitest";
import {
  ganadoresPrevistos,
  minutosDePartida,
  textoResultado,
  tiempoParaReabrir,
  unirNombres,
} from "./resultado";

const jugadores = [
  { id: "a", puntos: 10 },
  { id: "b", puntos: 15 },
  { id: "c", puntos: 15 },
  { id: "d", puntos: 3 },
];

describe("ganadoresPrevistos", () => {
  it("más puntos: gana el más alto, con empates", () => {
    expect(ganadoresPrevistos(jugadores, "mas_puntos")).toEqual(new Set(["b", "c"]));
  });

  it("menos puntos: gana el más bajo", () => {
    expect(ganadoresPrevistos(jugadores, "menos_puntos")).toEqual(new Set(["d"]));
  });

  it("a mano: los elegidos que están en la partida", () => {
    expect(ganadoresPrevistos(jugadores, "manual", { elegidos: ["a", "x"] })).toEqual(
      new Set(["a"]),
    );
    expect(ganadoresPrevistos(jugadores, "manual").size).toBe(0);
  });

  it("cooperativo: todos o nadie", () => {
    expect(ganadoresPrevistos(jugadores, "cooperativo", { ganamos: true }).size).toBe(4);
    expect(ganadoresPrevistos(jugadores, "cooperativo", { ganamos: false }).size).toBe(0);
  });
});

describe("textoResultado", () => {
  const conGanadores = (...ganan: string[]) => ({
    modo_resultado: "mas_puntos",
    cooperativo_ganado: null,
    jugadores: ["Ana", "Beto", "Caro"].map((nombre) => ({ nombre, gano: ganan.includes(nombre) })),
  });

  it("describe el resultado", () => {
    expect(textoResultado(conGanadores("Ana"))).toBe("Ganó Ana");
    expect(textoResultado(conGanadores("Beto", "Caro"))).toBe("Ganaron Beto y Caro");
    expect(textoResultado(conGanadores("Ana", "Beto", "Caro"))).toBe("Empate");
    expect(textoResultado(conGanadores())).toBe("Nadie ganó");
    expect(
      textoResultado({ modo_resultado: "cooperativo", cooperativo_ganado: false, jugadores: [] }),
    ).toBe("Perdieron todos");
  });
});

describe("unirNombres y minutosDePartida", () => {
  it("une nombres en castellano", () => {
    expect(unirNombres(["Ana", "Beto", "Caro"])).toBe("Ana, Beto y Caro");
  });

  it("calcula la duración en minutos", () => {
    expect(minutosDePartida("2026-10-15T20:00:00Z", "2026-10-15T21:35:20Z")).toBe(95);
    expect(minutosDePartida("2026-10-15T20:00:00Z", "2026-10-15T20:00:10Z")).toBe(1);
    expect(minutosDePartida("2026-10-15T20:00:00Z", null)).toBeNull();
  });
});

describe("tiempoParaReabrir", () => {
  const terminada = "2026-10-16T20:00:00.000Z";
  const t = Date.parse(terminada);

  it("cuenta lo que falta para los 10 minutos", () => {
    expect(tiempoParaReabrir(terminada, t + 4 * 60_000)).toBe(6 * 60_000);
  });

  it("después de los 10 minutos ya no se puede", () => {
    expect(tiempoParaReabrir(terminada, t + 10 * 60_000)).toBe(0);
    expect(tiempoParaReabrir(terminada, t + 60 * 60_000)).toBe(0);
  });

  it("sin fecha de cierre no se puede", () => {
    expect(tiempoParaReabrir(null, t)).toBe(0);
  });
});
