import { cn } from "@/lib/utils";

type AlikaLogoProps = {
  /** "brand" = teal de la app; "ink" = navy de la landing pública (paleta Nácar). */
  tone?: "brand" | "ink";
  /** Tamaño del tile cuadrado en px. */
  size?: number;
  className?: string;
};

/**
 * Isotipo "Cúspide": la "A" de Alika reducida a un trazo asimétrico de
 * grosor uniforme, con las esquinas redondeadas — también el término
 * anatómico de la punta de una muela. Ver ronda de logo en memoria del proyecto.
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
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M 55 23 L 73 71 L 28 73 Z" />
      </svg>
    </span>
  );
}
