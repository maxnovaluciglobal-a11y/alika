// src/components/marketing/lead-form.tsx
//
// Formulario reusable de captación (calculadora, checklist, benchmark — Tasks
// 7 y 13). Ver spec §5.1.5 y §5.1.6: honeypot, consentimiento separado por
// canal y mensaje de éxito honesto NO son negociables, sólo el estilo visual.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { submitMarketingLead } from "@/lib/marketing/leads.functions";
import { TEXTO_CONSENTIMIENTO, type MetaLead, type PaisCaptacion } from "@/lib/marketing/leads";
import { registrarEvento } from "@/lib/marketing/eventos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CLAVES_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function leerUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const clave of CLAVES_UTM) {
    const valor = params.get(clave);
    if (valor) utm[clave] = valor.slice(0, 100);
  }
  if (document.referrer) utm.referrer = document.referrer.slice(0, 100);
  return utm;
}

export function LeadForm({
  source,
  pais,
  meta,
  tituloExito,
}: {
  source: "calculadora" | "checklist" | "benchmark";
  pais: PaisCaptacion;
  meta?: MetaLead;
  tituloExito: string;
}) {
  const enviar = useServerFn(submitMarketingLead);
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);

    if (f.get("consent") !== "on") {
      setError("Necesitamos tu autorización para poder enviarte el material.");
      return;
    }

    const email = String(f.get("email") ?? "").trim();
    const phone = String(f.get("phone") ?? "").trim();
    if (!email && !phone) {
      // Mismo mensaje que el .refine() del server (EsquemaLead en
      // leads.functions.ts) — cubrimos acá el caso más común para evitar el
      // round-trip, pero el server sigue siendo la red de seguridad real.
      setError("Dejanos un email o un WhatsApp para poder enviarte el material.");
      return;
    }

    setEstado("enviando");
    try {
      await enviar({
        data: {
          email: email || undefined,
          phone: phone || undefined,
          name: String(f.get("name") ?? "").trim() || undefined,
          clinicName: String(f.get("clinicName") ?? "").trim() || undefined,
          countryCode: pais,
          source,
          consent: true,
          consentText: TEXTO_CONSENTIMIENTO,
          consentWhatsapp: f.get("consentWhatsapp") === "on",
          meta,
          utm: leerUtm(),
          company: String(f.get("company") ?? ""), // honeypot
        },
      });
      registrarEvento("lead_enviado", { source, pais });
      setEstado("ok");
    } catch (err) {
      setEstado("idle");
      setError(err instanceof Error ? err.message : "No pudimos guardar tus datos.");
    }
  }

  if (estado === "ok") {
    // NUNCA decir "te lo mandamos": hoy no hay RESEND_API_KEY y prometer un
    // envío que no ocurre es exactamente el modo de falla que tiene DypOS.
    return (
      <div className="rounded-2xl border border-mint/25 bg-mint-soft p-6">
        <p className="font-semibold">{tituloExito}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Guardamos tus datos. Nos vamos a poner en contacto para acompañarte con esto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Honeypot: fuera de pantalla, no display:none (algunos bots lo detectan).
          Sin tabIndex ni autocomplete para que ningún humano lo alcance. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="company">No completar</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Tu nombre</Label>
          <Input id="name" name="name" type="text" maxLength={120} autoComplete="name" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clinicName">Nombre de la clínica</Label>
          <Input
            id="clinicName"
            name="clinicName"
            type="text"
            maxLength={120}
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" maxLength={254} autoComplete="email" />
        </div>

        <div className="space-y-1.5">
          {/* Opcional por minimización (art. 14 quáter de la Ley 21.719): sólo
              pedimos como obligatorio lo estrictamente necesario. */}
          <Label htmlFor="phone">
            WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
        {/* No premarcado y obligatorio. */}
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 size-4 shrink-0 rounded-sm border-input"
          />
          <span>
            {TEXTO_CONSENTIMIENTO}{" "}
            <a href="/privacidad" className="underline underline-offset-2 hover:text-ink">
              Cómo tratamos tus datos
            </a>
            .
          </span>
        </label>

        {/* Separado: el número dado "para recibir el material" no habilita
            prospección comercial — es otra finalidad. */}
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="consentWhatsapp"
            className="mt-0.5 size-4 shrink-0 rounded-sm border-input"
          />
          <span>Quiero recibir novedades comerciales por WhatsApp.</span>
        </label>
      </div>

      {error && (
        <p id="lead-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={estado === "enviando"}
        aria-describedby={error ? "lead-error" : undefined}
        className="w-full bg-ink text-ink-foreground hover:bg-ink/90 sm:w-auto"
        size="lg"
      >
        {estado === "enviando" ? "Guardando…" : "Quiero recibirlo"}
      </Button>
    </form>
  );
}
