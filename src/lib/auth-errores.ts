// Traduce los códigos de error de Supabase Auth (y los que usamos en
// /login?error=...) a mensajes para la UI.
const MENSAJES: Record<string, string> = {
  invalid_credentials: "El email o la contraseña no son correctos.",
  email_not_confirmed: "Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam).",
  weak_password: "La contraseña es muy débil. Probá con una más larga.",
  email_address_invalid: "Ese email no es válido.",
  over_email_send_rate_limit:
    "Mandamos demasiados emails seguidos. Esperá un rato y probá de nuevo.",
  over_request_rate_limit: "Demasiados intentos. Esperá un momento y probá de nuevo.",
  signup_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  email_provider_disabled: "El ingreso con email está desactivado.",
  provider_disabled: "Ese método de ingreso no está habilitado.",
  otp_expired: "El link venció o ya se usó. Pedí uno nuevo.",
  flow_state_expired: "El link venció. Probá ingresar de nuevo.",
  flow_state_not_found: "El link no es válido en este navegador. Pedí uno nuevo.",
  bad_code_verifier: "El link no es válido en este navegador. Pedí uno nuevo.",
  access_denied: "Cancelaste el ingreso.",
  link_invalido: "El link no es válido. Pedí uno nuevo.",
};

// Al entrar a una sala como invitado (signInAnonymously).
const MENSAJES_INVITADO: Record<string, string> = {
  anonymous_provider_disabled:
    "Entrar como invitado no está habilitado todavía. Ingresá con tu cuenta o avisale al anfitrión.",
  captcha_failed:
    "Entrar como invitado está bloqueado por la verificación anti-bots. Ingresá con tu cuenta.",
  over_request_rate_limit:
    "Entraron demasiados invitados desde esta red. Probá en un rato o ingresá con tu cuenta.",
};

export function mensajeDeErrorInvitado(codigo: string | null | undefined, status?: number): string {
  if (codigo && Object.hasOwn(MENSAJES_INVITADO, codigo)) return MENSAJES_INVITADO[codigo];
  if (status === 429) return MENSAJES_INVITADO.over_request_rate_limit;
  return "No se pudo entrar como invitado. Probá de nuevo.";
}

const GENERICO = "No pudimos completar el ingreso. Probá de nuevo.";

export function mensajeDeErrorAuth(codigo: string | null | undefined): string {
  return codigo && Object.hasOwn(MENSAJES, codigo) ? MENSAJES[codigo] : GENERICO;
}
