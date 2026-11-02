import { describe, expect, it } from "vitest";
import type { PartidaBgg } from "@/lib/game-data/types";
import { armarPartidasParaImportar } from "./partidas";

const partida = (jugadores: PartidaBgg["jugadores"], bgg_id = 13): PartidaBgg => ({
  bgg_play_id: 9001,
  fecha: "2026-10-20",
  minutos: 60,
  bgg_id,
  nombre: "CATAN",
  jugadores,
});

const contexto = {
  yo: { id: "yo", usuarioBgg: "Fedesin" },
  amigos: new Map([["beto_bgg", "beto"]]),
  juegos: new Map([[13, "juego-catan"]]),
};

describe("armarPartidasParaImportar", () => {
  it("reconoce a quien importa y a los amigos por su usuario de BGG", () => {
    const [p] = armarPartidasParaImportar(
      [
        partida([
          { nombre: "Fede", usuario_bgg: "fedesin", puntos: 10, gano: true },
          { nombre: "Beto", usuario_bgg: "Beto_BGG", puntos: 8, gano: false },
          { nombre: "Abuela", usuario_bgg: null, puntos: 6, gano: false },
          { nombre: "Otro", usuario_bgg: "desconocido", puntos: null, gano: false },
        ]),
      ],
      contexto,
    );
    expect(p).toEqual({
      bgg_play_id: 9001,
      juego_id: "juego-catan",
      juego_nombre: "CATAN",
      jugado_en: "2026-10-20",
      minutos: 60,
      jugadores: [
        { user_id: "yo", nombre: "Fede", puntos: 10, gano: true },
        { user_id: "beto", nombre: "Beto", puntos: 8, gano: false },
        { user_id: null, nombre: "Abuela", puntos: 6, gano: false },
        { user_id: null, nombre: "Otro", puntos: null, gano: false },
      ],
    });
  });

  it("sin jugadores cargados, la partida es de quien importa", () => {
    const [p] = armarPartidasParaImportar([partida([], 999)], contexto);
    expect(p.juego_id).toBeNull();
    expect(p.jugadores).toEqual([{ user_id: "yo", nombre: "Yo", puntos: null, gano: false }]);
  });
});
