import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  UserPlus,
  Unplug,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/route-guards";
import { normalizeToWaMe } from "@/lib/messaging";
import {
  completeWhatsAppEmbeddedSignup,
  disconnectWhatsAppAccount,
  getWhatsAppAccountStatus,
  listWhatsAppLeads,
  updateWhatsAppLeadStatus,
  type WhatsAppLead,
} from "@/lib/whatsapp.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/whatsapp")({
  beforeLoad: requirePermission("team:manage"),
  head: () => ({
    meta: [
      { title: "WhatsApp | Alika" },
      {
        name: "description",
        content:
          "Conectá el WhatsApp de tu clínica para mandar recordatorios y avisos automáticos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WhatsAppPage,
});

// Config de plataforma expuesta al navegador — no son secretos (el App
// Secret y el System User token nunca salen del server). Sin esto seteado,
// la página muestra el estado "todavía no habilitado" en vez de un botón roto.
const WHATSAPP_APP_ID = import.meta.env.VITE_WHATSAPP_APP_ID as string | undefined;
const WHATSAPP_CONFIG_ID = import.meta.env.VITE_WHATSAPP_CONFIG_ID as string | undefined;
const WHATSAPP_API_VERSION =
  (import.meta.env.VITE_WHATSAPP_API_VERSION as string | undefined) || "v21.0";

declare global {
  interface Window {
    FB?: {
      init: (opts: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        opts: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras: { setup: Record<string, never>; sessionInfoVersion: string };
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

/** Carga el SDK de Facebook una sola vez y llama FB.init. */
function useFacebookSdk(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!WHATSAPP_APP_ID) return;
    if (window.FB) {
      setReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: WHATSAPP_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: WHATSAPP_API_VERSION,
      });
      setReady(true);
    };
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return ready;
}

interface EmbeddedSignupPayload {
  wabaId: string;
  phoneNumberId: string;
  displayPhone?: string;
}

/** Escucha el postMessage que manda Meta con el waba_id/phone_number_id conectado. */
function useEmbeddedSignupResult(onResult: (payload: EmbeddedSignupPayload) => void) {
  useEffect(() => {
    function handler(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "WA_EMBEDDED_SIGNUP" && parsed.event === "FINISH") {
          const d = parsed.data ?? {};
          if (d.waba_id && d.phone_number_id) {
            onResult({
              wabaId: d.waba_id,
              phoneNumberId: d.phone_number_id,
              displayPhone: d.display_phone_number,
            });
          }
        }
      } catch {
        // No es el mensaje que esperamos (Meta manda otros postMessage también) — ignorar.
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onResult]);
}

function WhatsAppPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic?.id;
  const queryClient = useQueryClient();

  const fetchStatus = useServerFn(getWhatsAppAccountStatus);
  const { data: account, isLoading } = useQuery({
    queryKey: ["whatsapp-account", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchStatus({ data: { clinicId: clinicId! } }),
  });

  const complete = useServerFn(completeWhatsAppEmbeddedSignup);
  const disconnect = useServerFn(disconnectWhatsAppAccount);

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ["whatsapp-account", clinicId] });

  const completeMutation = useMutation({
    mutationFn: (payload: EmbeddedSignupPayload & { code: string }) =>
      complete({
        data: {
          clinicId: clinicId!,
          code: payload.code,
          wabaId: payload.wabaId,
          phoneNumberId: payload.phoneNumberId,
          displayPhone: payload.displayPhone,
        },
      }),
    onSuccess: () => {
      toast.success("WhatsApp conectado. Ya puedes mandar mensajes automáticos.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect({ data: { clinicId: clinicId! } }),
    onSuccess: () => {
      toast.success("WhatsApp desconectado. Los envíos vuelven a wa.me manual.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sdkReady = useFacebookSdk();
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEmbeddedSignupResult((payload) => {
    if (!pendingCode) return;
    completeMutation.mutate({ ...payload, code: pendingCode });
    setPendingCode(null);
  });

  function launchSignup() {
    if (!window.FB || !WHATSAPP_CONFIG_ID) return;
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) setPendingCode(code);
      },
      {
        config_id: WHATSAPP_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      },
    );
  }

  const platformConfigured = Boolean(WHATSAPP_APP_ID && WHATSAPP_CONFIG_ID);

  return (
    <AppShell title="WhatsApp" access={access}>
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Conectá el WhatsApp de tu clínica para mandar recordatorios, recall y avisos de saldo
          automáticamente. Cada clínica usa su propio número — nunca compartimos uno entre clínicas.
        </p>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {!isLoading && !platformConfigured && (
          <div className="card-clinical p-6">
            <p className="text-sm font-medium">WhatsApp todavía no está habilitado.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Esto lo activa el equipo de Alika una vez enrolados como proveedor técnico ante Meta.
              Mientras tanto, los recordatorios y avisos siguen funcionando por wa.me manual desde
              /recordatorios y la ficha del paciente.
            </p>
          </div>
        )}

        {!isLoading && platformConfigured && account?.status === "connected" && (
          <div className="card-clinical flex items-center justify-between gap-4 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <p className="text-sm font-medium">
                  Conectado {account.displayPhone ? `· ${account.displayPhone}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {account.qualityRating
                    ? `Calidad reportada por Meta: ${account.qualityRating}`
                    : "Los recordatorios y avisos se mandan automáticamente."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50",
              )}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Unplug className="size-3.5" />
              )}
              Desconectar
            </button>
          </div>
        )}

        {!isLoading && account?.status === "connected" && account.displayPhone && (
          <WaMeLinkCard displayPhone={account.displayPhone} />
        )}

        {!isLoading && account?.status === "connected" && clinicId && (
          <LeadsSection clinicId={clinicId} />
        )}

        {!isLoading && platformConfigured && account?.status !== "connected" && (
          <div className="card-clinical p-6">
            <p className="text-sm font-medium">Sin número conectado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vas a elegir o verificar el WhatsApp de tu clínica en una ventana de Meta. Toma entre
              5 y 15 minutos.
            </p>
            <button
              type="button"
              onClick={launchSignup}
              disabled={!sdkReady || completeMutation.isPending}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {completeMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MessageCircle className="size-3.5" />
              )}
              Conectar WhatsApp
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Link fijo para pegar en un QR o en la bio de Instagram — no genera imagen, cualquier generador de QR gratis sirve con este link. */
function WaMeLinkCard({ displayPhone }: { displayPhone: string }) {
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const normalized = normalizeToWaMe(displayPhone);
  const link = normalized ? `https://wa.me/${normalized}` : null;
  if (!link) return null;

  async function copy() {
    await navigator.clipboard.writeText(link!);
    setCopiedAt(Date.now());
    setTimeout(() => setCopiedAt(null), 2000);
    toast.success("Link copiado al portapapeles");
  }

  return (
    <div className="card-clinical p-6">
      <p className="text-sm font-medium">Link para captar pacientes nuevos</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pegalo en la bio de Instagram, en un QR en la clínica, o en cualquier anuncio — quien lo
        abra te escribe directo a este WhatsApp.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs text-foreground/80">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "shrink-0 rounded-lg border border-hairline bg-background p-1.5 text-muted-foreground hover:text-foreground",
            copiedAt && "text-brand",
          )}
          aria-label="Copiar link"
        >
          {copiedAt ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

// Si pasó esto desde que se creó el lead y `autoRepliedAt` sigue null, algo
// falló mandando la auto-respuesta (ver el catch en api.whatsapp-webhook.ts,
// que ahora reporta a Sentry) — se lo marcamos al staff en vez de dejar que
// se entere solo revisando Sentry.
const AUTO_REPLY_STALE_MS = 5 * 60 * 1000;

function isAutoReplyStale(lead: Pick<WhatsAppLead, "createdAt" | "autoRepliedAt">): boolean {
  if (lead.autoRepliedAt) return false;
  return Date.now() - new Date(lead.createdAt).getTime() > AUTO_REPLY_STALE_MS;
}

/** Desconocidos que escribieron por primera vez (Fase 3) — capturados y auto-respondidos por el webhook, sin plantilla. */
function LeadsSection({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const fetchLeads = useServerFn(listWhatsAppLeads);
  const updateStatus = useServerFn(updateWhatsAppLeadStatus);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["whatsapp-leads", clinicId],
    queryFn: () => fetchLeads({ data: { clinicId } }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: "converted" | "discarded" }) =>
      updateStatus({ data: { clinicId, id: vars.id, status: vars.status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-leads", clinicId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || leads.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold">
        Leads nuevos
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
          {leads.length}
        </span>
      </h2>
      <div className="card-clinical divide-y divide-hairline overflow-hidden">
        {leads.map((lead: WhatsAppLead) => (
          <div key={lead.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {lead.name || lead.phone}
                {isAutoReplyStale(lead) && (
                  <span
                    title="La auto-respuesta no se pudo mandar — contactalo a mano."
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                  >
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Sin auto-respuesta
                  </span>
                )}
              </p>
              {lead.name && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
              <p className="mt-1 truncate text-xs text-muted-foreground">{lead.firstMessage}</p>
              {lead.referredByName && (
                <p className="mt-1 text-[11px] font-medium text-brand">
                  Referido por {lead.referredByName}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => mutation.mutate({ id: lead.id, status: "converted" })}
                disabled={mutation.isPending}
                title="Convertir en paciente"
                className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <UserPlus className="size-3.5" /> Convertir
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate({ id: lead.id, status: "discarded" })}
                disabled={mutation.isPending}
                title="Descartar"
                aria-label="Descartar"
                className="inline-flex size-7 items-center justify-center rounded-md border border-hairline text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
