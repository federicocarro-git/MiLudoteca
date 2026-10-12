import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Tests e2e contra la app compilada y el Supabase local (npm run db:start).
// Uso: npm run test:e2e (compila y levanta la app en :3000 si no está corriendo).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    // Tiene que ser localhost:3000: es el site_url de Auth (links de los mails).
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
    // Para usar un Chromium ya instalado (por ejemplo, en contenedores).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/offline",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Se leen al compilar: búsqueda con datos de prueba y botón de Google visible.
    env: { GAME_DATA_PROVIDER: "mock", NEXT_PUBLIC_AUTH_GOOGLE: "true" },
  },
});
