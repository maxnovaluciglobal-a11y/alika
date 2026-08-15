import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Clock } from "lucide-react";

import { getMySubscription } from "@/lib/billing.functions";
import { isSubscriptionActive, trialDaysLeft } from "@/lib/billing";

/**
 * Banner top-of-app con estado de suscripción.
 *
 * - Trialing → días restantes + CTA a activar tarjeta.
 * - Vencida (past_due / canceled / no sub) → bloqueo suave con CTA fuerte.
 * - Active → no renderiza nada.
 */
export function TrialBanner({ clinicId }: { clinicId: string }) {
  const fn = useServerFn(getMySubscription);
  const { data: sub } = useQuery({
    queryKey: ["my-subscription", clinicId],
    queryFn: () => fn({ data: { clinicId } }),
    staleTime: 60 * 1000,
  });

  if (!sub) return null;

  const active = isSubscriptionActive(sub);
  const daysLeft = trialDaysLeft(sub);

  // Sub activa full → sin banner.
  if (active && sub.status === "active") return null;

  // Trialing → recordatorio suave.
  if (sub.status === "trialing" && daysLeft !== null) {
    const urgente = daysLeft <= 3;
    return (
      <div
        className={
          urgente
            ? "flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm dark:border-amber-800/50 dark:bg-amber-950/30 sm:px-8"
            : "flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-2 text-sm sm:px-8"
        }
      >
        <div className="flex items-center gap-2">
          <Clock className={urgente ? "size-4 text-amber-600" : "size-4 text-muted-foreground"} />
          <span>
            {daysLeft === 0
              ? "Tu trial vence hoy."
              : `Tu trial vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}.`}
          </span>
        </div>
        <Link
          to="/suscripcion"
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Activar suscripción
        </Link>
      </div>
    );
  }

  // Vencida / no sub / past_due → banner rojo.
  return (
    <div className="flex items-center justify-between gap-3 border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-sm sm:px-8">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 text-destructive" />
        <span className="font-medium">
          {sub.status === "past_due"
            ? "Tu último cobro falló. Actualizá el método de pago para no perder acceso."
            : "Tu suscripción está inactiva."}
        </span>
      </div>
      <Link
        to="/suscripcion"
        className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
      >
        Reactivar
      </Link>
    </div>
  );
}
