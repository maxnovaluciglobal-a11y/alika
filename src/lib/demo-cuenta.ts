// Cuenta de la demo pública. No es un secreto: cualquiera puede entrar a la
// demo, ese es el punto (ver `routes/demo.tsx`). Justamente por eso nadie
// puede cambiarle la contraseña ni el email: el siguiente visitante quedaría
// afuera y el que la cambió se quedaría con la cuenta.
export const DEMO_EMAIL = "demo@alika.app";

export const MENSAJE_CUENTA_DEMO =
  "La cuenta de la demo es compartida: no se le puede cambiar la contraseña ni el email. Crea tu propia cuenta para eso.";

export function esCuentaDemo(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_EMAIL;
}
