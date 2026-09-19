import type { ReactNode } from "react";
import { PublicPageShell } from "@/components/site-chrome";

/**
 * Shell de las páginas de prosa (legal, quiénes somos): columna angosta
 * centrada con label + título + fecha. El header/footer/contenedor externo
 * vienen de `PublicPageShell`, compartido con el resto de las páginas
 * públicas (auditoría 19-sep-2026: antes esto armaba su propio
 * `<div><SiteHeader/>...<SiteFooter/></div>` en vez de reusar el patrón).
 */
export function LegalPage({
  label,
  title,
  updated,
  children,
}: {
  label: string;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <PublicPageShell mainClassName="max-w-2xl px-6 py-16 text-ink sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-clay-strong">{label}</p>
      <h1 className="font-precise mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      {updated ? <p className="mt-3 font-mono text-xs text-muted-foreground">{updated}</p> : null}
      <div className="mt-10">{children}</div>
    </PublicPageShell>
  );
}

export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-precise mt-10 text-xl font-bold tracking-tight first:mt-0">{children}</h2>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{children}</p>;
}

export function LegalUl({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink/80">{children}</ul>
  );
}

export function LegalLi({ children }: { children: ReactNode }) {
  return <li className="list-disc marker:text-clay-strong">{children}</li>;
}

/** Callout destacado — para aclaraciones importantes (equivalente al .notice de FinanceOS). */
export function LegalNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-clay-strong/25 bg-clay-soft p-4 text-sm leading-relaxed text-ink">
      {children}
    </div>
  );
}
