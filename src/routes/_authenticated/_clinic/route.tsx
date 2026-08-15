import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getMyAccess } from "@/lib/access.functions";
import type { ClinicAccess } from "@/lib/access";
import { getMySubscription } from "@/lib/billing.functions";
import { isSubscriptionActive } from "@/lib/billing";
import { leerRolSimulado, puedeSimular } from "@/lib/role-simulation";

export const Route = createFileRoute("/_authenticated/_clinic")({
  beforeLoad: async ({ location }): Promise<{ access: ClinicAccess }> => {
    const access = await getMyAccess({});
    if (!access.clinic || !access.role) {
      throw redirect({ to: "/onboarding" });
    }

    // Gate de suscripción: sin trial/activa, solo se puede navegar a billing.
    // Se hace acá (no en la ruta individual) para que aplique a toda la app
    // de clínica de una. El propio endpoint `getMySubscription` falla suave
    // si aún no hay Stripe wireado y devuelve null → el gate lo trata como
    // "sin suscripción" y bloquea al owner al banner de activación.
    const enBilling = location.pathname === "/suscripcion";
    if (!enBilling) {
      let sub = null;
      try {
        sub = await getMySubscription({ data: { clinicId: access.clinic.id } });
      } catch {
        // Sin tabla o error transitorio: no bloqueamos — Stripe puede
        // no estar wireado todavía en dev.
      }
      // Solo el owner ve el gate real; el resto del equipo sigue trabajando
      // aunque la sub esté vencida (la clínica es responsabilidad del owner).
      if (access.role === "owner" && sub && !isSubscriptionActive(sub)) {
        throw redirect({ to: "/suscripcion" });
      }
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
