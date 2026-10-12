import { describe, expect, it } from "vitest";
import { urlJuegoBgg } from "./enlaces";

describe("urlJuegoBgg", () => {
  it("arma la URL de la página del juego (sin www)", () => {
    expect(urlJuegoBgg(13)).toBe("https://boardgamegeek.com/boardgame/13");
  });
});
