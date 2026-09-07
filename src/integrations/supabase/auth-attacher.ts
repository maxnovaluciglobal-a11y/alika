import { createMiddleware } from "@tanstack/react-start";

// Este archivo decía "automatically generated. Do not edit it directly", pero
// nada en el repo lo genera: es residuo del import original desde Lovable
// (`8d6205d`). Se puede editar.
//
// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    // Import diferido, y acá está la razón de fondo: este middleware es
    // GLOBAL, así que un `import` estático del cliente lo metía en el grafo de
    // entrada de TODA página — incluida la landing, que nunca llama a un
    // serverFn ni inicia sesión. El handler ya es async y sólo corre cuando de
    // verdad hay una llamada, así que diferirlo no cambia nada funcional.
    const { supabase } = await import("./client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
