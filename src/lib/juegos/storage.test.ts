import { describe, expect, it } from "vitest";
import { rutaImagenPropia } from "./storage";

const USER = "11111111-1111-1111-1111-111111111111";
const base = "http://127.0.0.1:54321/storage/v1/object/public/imagenes-juegos/";

describe("rutaImagenPropia", () => {
  it("devuelve la ruta de una imagen propia", () => {
    expect(rutaImagenPropia(`${base}${USER}/abc.webp`, USER)).toBe(`${USER}/abc.webp`);
    expect(rutaImagenPropia(`${base}${USER}/abc.webp?t=1`, USER)).toBe(`${USER}/abc.webp`);
  });

  it.each([
    null,
    "https://cf.geekdo-images.com/pic.jpg",
    `${base}22222222-2222-2222-2222-222222222222/abc.webp`,
    `${base}${USER}/../otro/abc.webp`,
    `https://x.supabase.co/storage/v1/object/public/otro-bucket/${USER}/a.webp`,
  ])("ignora %s", (url) => {
    expect(rutaImagenPropia(url, USER)).toBeNull();
  });
});
