import { describe, expect, it, vi } from "vitest";

// Evita crear el cliente admin de verdad (necesita variables de Supabase).
vi.mock("./bgg/cache-supabase", () => ({ CacheSupabase: class {} }));

const { elegirProvider, getGameDataProvider } = await import("./index");

describe("elegirProvider", () => {
  it.each([
    [{ BGG_API_TOKEN: "t", NODE_ENV: "production" }, "bgg"],
    [{ BGG_API_TOKEN: "t", NODE_ENV: "development" }, "bgg"],
    [{ NODE_ENV: "development" }, "mock"],
    [{ NODE_ENV: "test" }, "mock"],
    [{ NODE_ENV: "production" }, null],
    [{ BGG_API_TOKEN: "   ", NODE_ENV: "production" }, null],
    [{ GAME_DATA_PROVIDER: "mock", NODE_ENV: "production" }, "mock"],
    [{ GAME_DATA_PROVIDER: "mock", BGG_API_TOKEN: "t", NODE_ENV: "production" }, "mock"],
  ])("%o → %s", (env, esperado) => {
    expect(elegirProvider(env)).toBe(esperado);
  });
});

describe("getGameDataProvider", () => {
  it("crea la implementación elegida", () => {
    expect(getGameDataProvider({ BGG_API_TOKEN: "t", NODE_ENV: "production" })?.id).toBe("bgg");
    expect(getGameDataProvider({ NODE_ENV: "development" })?.id).toBe("mock");
    expect(getGameDataProvider({ NODE_ENV: "production" })).toBeNull();
  });
});
