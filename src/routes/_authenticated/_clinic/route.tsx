import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getMyAccess } from "@/lib/access.functions";
import type { ClinicAccess } from "@/lib/access";
import { leerRolSimulado, puedeSimular } from "@/lib/role-simulation";

export const Route = createFileRoute("/_authenticated/_clinic")({
  beforeLoad: async (): Promise<{ access: ClinicAccess }> => {
    const access = await getMyAccess({});
    if (!access.clinic || !access.role) {
      throw redirect({ to: "/onboarding" });
    }

    // Simulación de rol: solo cambia lo que ve la interfaz. La autorización real
    // sigue viviendo en las políticas RLS con el rol verdadero del usuario.
    const simulado = puedeSimular(access.role) ? leerRolSimulado() : null;

    return {
      access: {
        ...access,
        realRole: access.role,
        simulatedRole: simulado,
        role: simulado ?? access.role,
      },
    };
  },
  component: () => <Outlet />,
});
