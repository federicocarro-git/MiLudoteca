import { describe, expect, it } from "vitest";
import { autorDeFoto, rutaFotoNueva } from "./fotos";

describe("fotos de partidas", () => {
  it("guarda el autor en el nombre del archivo", () => {
    const autor = "aaaaaaaa-0000-0000-0000-000000000001";
    const ruta = rutaFotoNueva("eeeeeeee-0000-0000-0000-000000000001", autor, "webp");
    expect(ruta).toMatch(/^eeeeeeee-0000-0000-0000-000000000001\/aaaaaaaa-.+_[0-9a-f-]{36}\.webp$/);
    expect(autorDeFoto(ruta.split("/")[1])).toBe(autor);
    expect(autorDeFoto("otra-cosa.webp")).toBeNull();
  });
});
