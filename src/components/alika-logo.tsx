import { cn } from "@/lib/utils";

type AlikaLogoProps = {
  /** "brand" = teal de la app; "ink" = navy de la landing pública (paleta Nácar). */
  tone?: "brand" | "ink";
  /** Tamaño del tile cuadrado en px. */
  size?: number;
  className?: string;
};

/**
 * Isotipo "Estrato": tres barras de historial alineadas a la izquierda,
 * creciendo hacia la derecha — cada visita nueva extiende el registro,
 * ninguna barra anterior se mueve. Ver ronda de logo en memoria del proyecto.
 */
export function AlikaLogo({ tone = "brand", size = 32, className }: AlikaLogoProps) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg",
        tone === "ink" ? "bg-ink" : "bg-brand",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={cn("h-[60%] w-[60%]", tone === "ink" ? "text-mint" : "text-brand-foreground")}
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="34.4" y="32.6" width="15.6" height="8.4" rx="4.2" />
        <rect x="34.4" y="45.8" width="22.8" height="8.4" rx="4.2" />
        <rect x="34.4" y="59" width="30" height="8.4" rx="4.2" />
      </svg>
    </span>
  );
}
