import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getMySubscription,
} from "@/lib/billing.functions";
import { SUBSCRIPTION_STATUS_LABELS, isSubscriptionActive, trialDaysLeft } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/_clinic/suscripcion")({
  head: () => ({
    meta: [{ title: "Suscripción | Alika" }, { name: "robots", content: "noindex" }],
  }),
  component: BillingPage,
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function BillingPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic!.id;

  const cargar = useServerFn(getMySubscription);
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createBillingPortalSession);

  const { data: sub, isLoading } = useQuery({
    queryKey: ["my-subscription", clinicId],
    queryFn: () => cargar({ data: { clinicId } }),
  });

  const startCheckout = useMutation({
    mutationFn: async () => {
      const origin = window.location.origin;
      const { url } = await checkout({
        data: {
          clinicId,
          successUrl: `${origin}/suscripcion?checkout=success`,
          cancelUrl: `${origin}/suscripcion?checkout=cancel`,
        },
      });
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPortal = useMutation({
    mutationFn: async () => {
      const origin = window.location.origin;
      const { url } = await portal({
        data: {
          clinicId,
          returnUrl: `${origin}/suscripcion`,
        },
      });
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const daysLeft = trialDaysLeft(sub ?? null);
  const active = isSubscriptionActive(sub ?? null);
  const hasCustomer = Boolean(sub?.stripeCustomerId);

  return (
    <AppShell title="Suscripción" access={access}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 text-primary" />
            <div className="flex-1">
              <h2 className="font-heading text-base font-semibold">Plan actual</h2>
              <p className="text-sm text-muted-foreground">
                Alika Clínica — <span className="font-medium">US$49 / mes</span> · trial de 14 días.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          ) : sub ? (
            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Estado</dt>
                <dd className="mt-1 text-sm font-medium">
                  {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                </dd>
              </div>
              {sub.status === "trialing" && daysLeft !== null && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Días de trial restantes
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {daysLeft} {daysLeft === 1 ? "día" : "días"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Próxima renovación
                </dt>
                <dd className="mt-1 text-sm">{formatDate(sub.currentPeriodEnd)}</dd>
              </div>
              {sub.cancelAtPeriodEnd && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Aviso</dt>
                  <dd className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    Cancelada — vence el {formatDate(sub.currentPeriodEnd)}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Aún no tenés una suscripción activa. Empezá tu trial de 14 días abajo — no cobramos
              hasta que termine.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-base font-semibold">Acciones</h2>
          <p className="text-sm text-muted-foreground">
            {hasCustomer
              ? "Gestioná método de pago, descargá facturas o cancelá desde el portal seguro de Stripe."
              : "Al activar la suscripción vas a Stripe para dejar el método de pago. Podés cancelar durante el trial y no te cobramos."}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {!active ? (
              <button
                type="button"
                onClick={() => startCheckout.mutate()}
                disabled={startCheckout.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {startCheckout.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Redirigiendo…
                  </>
                ) : hasCustomer ? (
                  "Reactivar suscripción"
                ) : (
                  "Activar suscripción · US$49/mes"
                )}
              </button>
            ) : null}

            {hasCustomer && (
              <button
                type="button"
                onClick={() => openPortal.mutate()}
                disabled={openPortal.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
              >
                {openPortal.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                Gestionar facturación
              </button>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Los pagos los procesa Stripe. Alika nunca ve el número de tarjeta.
        </p>
      </div>
    </AppShell>
  );
}
