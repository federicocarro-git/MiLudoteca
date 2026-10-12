import { describe, expect, it } from "vitest";
import { datosDesdeFormData, erroresPorCampo, juegoFormularioSchema } from "./juego";

function fd(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

const parse = (campos: Record<string, string | string[]>) =>
  juegoFormularioSchema.safeParse(datosDesdeFormData(fd(campos)));

describe("juegoFormularioSchema", () => {
  it("con solo el nombre, el resto queda en null", () => {
    const r = parse({ nombre: "  Catan  ", jugadores_min: "", complejidad: "" });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      nombre: "Catan",
      imagen_url: null,
      jugadores_min: null,
      jugadores_max: null,
      duracion_min: null,
      complejidad: null,
      anio: null,
      descripcion: null,
      tipos: [],
      puntuacion: null,
      notas: null,
      bgg_id: null,
      confirmar_duplicado: false,
    });
  });

  it("convierte números, acepta coma decimal y ordena tipos sin repetir", () => {
    const r = parse({
      nombre: "Pandemic",
      jugadores_min: "2",
      jugadores_max: "4",
      duracion_min: "45",
      complejidad: "2,456",
      anio: "2008",
      tipos: ["cooperativo", "cartas", "cooperativo"],
      puntuacion: "9",
      bgg_id: "30549",
      confirmar_duplicado: "1",
    });
    expect(r.data).toMatchObject({
      jugadores_min: 2,
      jugadores_max: 4,
      duracion_min: 45,
      complejidad: 2.46,
      anio: 2008,
      tipos: ["cartas", "cooperativo"],
      puntuacion: 9,
      bgg_id: 30549,
      confirmar_duplicado: true,
    });
  });

  it.each([
    [{ nombre: "" }, "nombre", "Ingresá el nombre."],
    [
      { nombre: "X", jugadores_min: "5", jugadores_max: "2" },
      "jugadores_max",
      /mayor que el máximo/,
    ],
    [{ nombre: "X", jugadores_min: "0" }, "jugadores_min", /mínimo es 1/],
    [{ nombre: "X", duracion_min: "1.5" }, "duracion_min", /entero/],
    [{ nombre: "X", complejidad: "6" }, "complejidad", /de 1 a 5/],
    [{ nombre: "X", complejidad: "mucha" }, "complejidad", /número/],
    [{ nombre: "X", puntuacion: "11" }, "puntuacion", /máximo es 10/],
    [{ nombre: "X", tipos: ["inventado"] }, "tipos", /no existe/],
    [{ nombre: "X", imagen_url: "http://otro.com/a.jpg" }, "imagen_url", /https/],
    [{ nombre: "X", imagen_url: "javascript:alert(1)" }, "imagen_url", /https/],
  ])("%o → error en %s", (campos, campo, mensaje) => {
    const r = parse(campos as Record<string, string>);
    expect(r.success).toBe(false);
    expect(erroresPorCampo(r.error!.issues)[campo as "nombre"]).toMatch(mensaje);
  });

  it("acepta imágenes https y del Storage local", () => {
    expect(parse({ nombre: "X", imagen_url: "https://cf.geekdo-images.com/a.jpg" }).success).toBe(
      true,
    );
    expect(
      parse({ nombre: "X", imagen_url: "http://127.0.0.1:54321/storage/v1/object/public/a.webp" })
        .success,
    ).toBe(true);
  });
});
