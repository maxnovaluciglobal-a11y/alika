import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // `getSession()` lee la sesión de localStorage sin tocar la red.
    // `getUser()` sí pega contra Supabase para revalidar el token, y por eso
    // durante un corte de internet echaba al usuario al login aunque tuviera
    // una sesión perfectamente válida guardada.
    //
    // Esto es un guard de interfaz, no la frontera de seguridad: quién puede
    // leer qué lo siguen decidiendo las políticas RLS contra el JWT, del lado
    // del servidor. Un token adulterado acá no abre ningún dato.
    // Import diferido: `routeTree.gen.ts` importa TODOS los módulos de ruta
    // de forma eager, así que un import estático acá metía el cliente de
    // Supabase (~200 KB) en el chunk de entrada — lo descargaba también quien
    // sólo abre la landing. `beforeLoad` ya es async, así que diferirlo no
    // cambia el orden de nada.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
