import { describe, expect, it } from "vitest";
import { tiposDesdeBgg } from "./tipos";

describe("tiposDesdeBgg", () => {
  it("traduce, quita repetidos, ordena y descarta lo desconocido", () => {
    expect(
      tiposDesdeBgg(["Fantasy", "Cooperative Game", "Horror", "Medical", "Card Game", "toString"]),
    ).toEqual(["cartas", "cooperativo", "temático"]);
  });

  it("devuelve [] si no hay nada mapeable", () => {
    expect(tiposDesdeBgg([])).toEqual([]);
    expect(tiposDesdeBgg(["Trains"])).toEqual([]);
  });
});
