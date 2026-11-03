import { describe, expect, it } from "vitest";
import { ordenarNombresParaEspanol } from "./nombres";

describe("ordenarNombresParaEspanol", () => {
  it("primero los que parecen en español, los de otros alfabetos al final", () => {
    expect(
      ordenarNombresParaEspanol([
        "Колонизаторы",
        "Die Siedler von Catan",
        "Los Colonos de Catán",
        "卡坦岛",
        "Catán",
        "Catán",
      ]),
    ).toEqual(["Catán", "Los Colonos de Catán", "Die Siedler von Catan", "Колонизаторы", "卡坦岛"]);
  });
});
