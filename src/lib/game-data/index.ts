import "server-only";
import { BggProvider } from "./bgg/bgg-provider";
import { CacheSupabase } from "./bgg/cache-supabase";
import { ClienteBgg } from "./bgg/cliente";
import { MockProvider } from "./mock/mock-provider";
import type { GameDataProvider, ProviderId } from "./types";

export type { DatosJuego, GameDataProvider, ResultadoBusqueda } from "./types";
export { ErrorGameData } from "./types";

type Entorno = {
  BGG_API_TOKEN?: string;
  GAME_DATA_PROVIDER?: string;
  NODE_ENV?: string;
};

/**
 * Qué provider usar:
 * 1. GAME_DATA_PROVIDER=mock → mock (para e2e contra un build de producción).
 * 2. Con BGG_API_TOKEN → bgg.
 * 3. Sin token, fuera de producción → mock.
 * 4. Sin token en producción → null: la UI oculta la búsqueda.
 */
export function elegirProvider(env: Entorno): ProviderId | null {
  if (env.GAME_DATA_PROVIDER === "mock") return "mock";
  if (env.BGG_API_TOKEN?.trim()) return "bgg";
  if (env.NODE_ENV !== "production") return "mock";
  return null;
}

export function getGameDataProvider(env: Entorno = process.env): GameDataProvider | null {
  switch (elegirProvider(env)) {
    case "bgg":
      return new BggProvider({
        cliente: new ClienteBgg({ token: env.BGG_API_TOKEN!.trim() }),
        cache: new CacheSupabase(),
      });
    case "mock":
      // Un poco de latencia en desarrollo para ver los estados de carga.
      return new MockProvider({ latenciaMs: env.NODE_ENV === "development" ? 300 : 0 });
    default:
      return null;
  }
}
