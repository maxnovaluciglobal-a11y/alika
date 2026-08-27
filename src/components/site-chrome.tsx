import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { AlikaLogo } from "@/components/alika-logo";

/** Header compartido por la landing y las páginas de contenido (legal/FAQ/docs). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2">
          <AlikaLogo tone="ink" size={32} />
          <span className="font-precise text-xl font-bold tracking-tight text-ink">Alika</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <a
            href="/demo"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
          >
            Ver demo
          </a>
          <Link
            to="/auth"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink sm:block"
          >
            Entrar
          </Link>
          <Link
            to="/auth"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground transition-opacity hover:opacity-90"
          >
            Empieza gratis
          </Link>
        </div>
      </div>
    </header>
  );
}

type FooterLink =
  | {
      label: string;
      kind: "route";
      to: "/auth" | "/faq" | "/docs" | "/nosotros" | "/terminos" | "/privacidad";
    }
  | { label: string; kind: "external"; href: string };

const footerColumns: { t: string; links: FooterLink[] }[] = [
  {
    t: "Producto",
    links: [
      { label: "Ver demo", kind: "external", href: "/demo" },
      { label: "Empieza gratis", kind: "route", to: "/auth" },
    ],
  },
  {
    t: "Recursos",
    links: [
      { label: "Preguntas frecuentes", kind: "route", to: "/faq" },
      { label: "Documentación", kind: "route", to: "/docs" },
    ],
  },
  {
    t: "Empresa",
    links: [
      { label: "Quiénes somos", kind: "route", to: "/nosotros" },
      { label: "Contacto", kind: "external", href: "mailto:maxnovaluciglobal@gmail.com" },
      // TODO(walter): sin número de WhatsApp real documentado en el repo,
      // este link cae al mismo mailto de contacto como fallback consciente.
      // Cuando haya un número de soporte, cambiar a buildWaMeUrl(...) (ver
      // src/lib/messaging.ts) para abrir wa.me de verdad.
      {
        label: "WhatsApp",
        kind: "external",
        href: "mailto:maxnovaluciglobal@gmail.com",
      },
    ],
  },
  {
    t: "Legal",
    links: [
      { label: "Términos de servicio", kind: "route", to: "/terminos" },
      { label: "Política de privacidad", kind: "route", to: "/privacidad" },
    ],
  },
];

/** Footer compartido: a diferencia del footer mínimo original, estos links apuntan a páginas reales. */
export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
        {footerColumns.map((col) => (
          <div key={col.t}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {col.t}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.kind === "route" ? (
                    <Link
                      to={l.to}
                      className="text-sm text-ink/80 transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      className="text-sm text-ink/80 transition-colors hover:text-ink"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-hairline pt-6 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <AlikaLogo tone="ink" size={24} className="rounded-md" />
            <span className="font-precise font-bold text-ink">Alika</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            Software de gestión dental · Hecho para Latinoamérica
            <Lock className="size-3" /> tus datos son tuyos
          </span>
        </div>
      </div>
    </footer>
  );
}
