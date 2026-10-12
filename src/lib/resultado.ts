// Lo que devuelven las Server Actions: nunca hacen throw hacia la UI.
export type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
