// Genera los íconos PNG de la PWA a partir de un SVG.
// Uso: node scripts/generar-iconos.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const VERDE = "#2f5d50";

// Dado blanco con cinco puntos. `escala` achica el dado para el ícono
// maskable (zona segura del 80 %).
function svg({ redondeado, escala }) {
  const lado = 512 * escala;
  const origen = (512 - lado) / 2;
  const punto = (cx, cy) =>
    `<circle cx="${origen + cx * lado}" cy="${origen + cy * lado}" r="${lado * 0.075}" fill="${VERDE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${redondeado ? 112 : 0}" fill="${VERDE}"/>
  <rect x="${origen + lado * 0.2}" y="${origen + lado * 0.2}" width="${lado * 0.6}" height="${lado * 0.6}" rx="${lado * 0.12}" fill="#fffaf1"/>
  ${[
    [0.33, 0.33],
    [0.67, 0.33],
    [0.5, 0.5],
    [0.33, 0.67],
    [0.67, 0.67],
  ]
    .map(([x, y]) => punto(x, y))
    .join("\n  ")}
</svg>`;
}

const comun = svg({ redondeado: true, escala: 1 });
const maskable = svg({ redondeado: false, escala: 0.8 });

await writeFile("src/app/icon.svg", comun);
await sharp(Buffer.from(comun)).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(comun)).resize(512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(maskable)).resize(512).png().toFile("public/icons/icon-maskable-512.png");
await sharp(Buffer.from(svg({ redondeado: false, escala: 1 })))
  .resize(180)
  .png()
  .toFile("src/app/apple-icon.png");

console.log("Íconos generados.");
