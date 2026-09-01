import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getMyAccess } from "@/lib/access.functions";
import type { ClinicAccess } from "@/lib/access";
import { getMySubscription } from "@/lib/billing.functions";
import { isSubscriptionActive } from "@/lib/billing";
import { leerRolSimulado, puedeSimular } from "@/lib/role-simulation";
import { ensureOfflineCacheHydrated } from "@/lib/offline-cache";

/** Quién soy y en qué clínica: cambia poquísimo, y sin esto no se abre ninguna pantalla. */
const ACCESS_KEY = ["my-access"] as const;

export const Route = createFileRoute("/_authenticated/_clinic")({
  beforeLoad: async ({ location, context }): Promise<{ access: ClinicAccess }> => {
    const { queryClient, user } = context;

    // Restaura del disco lo que se guardó en visitas anteriores. Antes esto
    // se esperaba ANTES de arrancar `getMyAccess`, en serie — sumaba una
    // vuelta completa al round-trip de red que ya de por sí cruza de Vercel
    // (EE.UU.) a Supabase (São Paulo). No hace falta esperarlo para *iniciar*
    // el pedido de red: arranca en paralelo, y solo se espera explícitamente
    // más abajo, en el catch, para el caso offline (auditoría de
    // performance, 31-ago — medido en producción: ~6-13s de hueco antes de
    // esto).
    const hydratePromise = ensureOfflineCacheHydrated(queryClient, user.id);

    // Va por el cache de React Query en vez de llamar directo: durante un
    // corte, este `await` era lo que tumbaba toda la app de clínica de una,
    // porque cada navegación lo vuelve a ejecutar.
    let access: ClinicAccess;
    try {
      access = await queryClient.ensureQueryData({
        queryKey: ACCESS_KEY,
        queryFn: () => getMyAccess({}),
        staleTime: 5 * 60 * 1000,
      });
    } catch (err) {
      // Si ya sabíamos quién es, seguimos con eso: perder internet no debería
      // sacar a la clínica de la aplicación. La primera carga sí necesita red.
      // Hay que esperar la restauración acá (no antes): si todavía está en
      // vuelo, `getQueryData` daría un falso "no hay nada" y mandaría al
      // login a alguien con una sesión offline perfectamente válida.
      await hydratePromise;
      const conocido = queryClient.getQueryData<ClinicAccess>(ACCESS_KEY);
      if (!conocido) throw err;
      access = conocido;
    }

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
