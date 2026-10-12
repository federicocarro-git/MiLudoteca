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

const GENERICO = "No pudimos completar el ingreso. Probá de nuevo.";

export function mensajeDeErrorAuth(codigo: string | null | undefined): string {
  return codigo && Object.hasOwn(MENSAJES, codigo) ? MENSAJES[codigo] : GENERICO;
}
