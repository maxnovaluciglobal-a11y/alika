import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
