import { cn } from "@/lib/utils";

type AlikaLogoProps = {
  /** Tamaño del tile cuadrado en px. */
  size?: number;
  className?: string;
};

/**
 * Isotipo "Cúspide": la "A" de Alika reducida a un trazo asimétrico de
 * grosor uniforme, con las esquinas redondeadas — también el término
 * anatómico de la punta de una muela. Ver ronda de logo en memoria del proyecto.
 */
export function AlikaLogo({ size = 32, className }: AlikaLogoProps) {
  return (
    <span
      className={cn(
        // Una sola marca para la landing y la app: filete ocre, sin relleno.
        "grid shrink-0 place-items-center rounded-md border border-brand text-brand",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-[60%] w-[60%]"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M 55 23 L 73 71 L 28 73 Z" />
      </svg>
    </span>
  );
}
