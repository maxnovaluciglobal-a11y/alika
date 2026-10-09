import { cn } from "@/lib/utils";

/*
 * Patty es el nombre de la IA dentro de Esmalia (decisión del 09-oct-2026).
 * Principio: "Patty propone, el profesional decide": nunca firma, nunca le
 * escribe sola a un paciente, nunca toca la agenda.
 *
 * La firma visual es el arco de esmalte del logo (el mismo trazado que
 * `WORDMARK_ARCO` en esmalia-logo.tsx) con un punto debajo, en el violeta
 * ciruela del token `ai`. Ese color significa una sola cosa en la app:
 * "esto lo hizo la IA".
 *
 * No llamarla "asistente" en la interfaz: "asistente" ya es un rol humano
 * (role `assistant`).
 */

const ARCO =
  "M1047 0c4 24 10.6 40.1 31.3 54.8a72 72 0 0 0 54.7 12.1 67 67 0 0 0 43.5-28c8.8-13 10.8-23.3 13.6-38.1a103 103 0 0 1 7.7 39 83 83 0 0 1-44.3 73.6c-43 22-77.4 3.2-103.1-32.3A121 121 0 0 1 1040 24a108 108 0 0 1 7-24";
// Caja del arco: x 1039,8–1197,8 · y 0–122,8. El punto va centrado debajo.
const VIEWBOX = "1022 -12 194 194";

type PattyMarkProps = {
  /** Lado en px. */
  size?: number;
  className?: string;
};

/**
 * Marca de Patty: arco + punto, en `currentColor` (por defecto `text-ai`).
 * Es decorativa: el texto que la acompaña lleva el significado.
 */
export function PattyMark({ size = 16, className }: PattyMarkProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={VIEWBOX}
      width={size}
      height={size}
      fill="currentColor"
      className={cn("shrink-0 text-ai", className)}
    >
      <path d={ARCO} />
      <circle cx={1118.8} cy={158} r={19} />
    </svg>
  );
}

type PattyLabelProps = {
  /** Texto después del nombre, p. ej. "(IA)". */
  suffix?: string;
  /** Muestra la marca antes del nombre. */
  mark?: boolean;
  className?: string;
};

/** "Patty" en Cormorant itálica, con la marca y un sufijo opcional. */
export function PattyLabel({ suffix, mark = true, className }: PattyLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ai", className)}>
      {mark && <PattyMark size={14} />}
      <span>
        <span className="font-display text-[1.15em] italic leading-none">Patty</span>
        {suffix ? <span className="ml-1">{suffix}</span> : null}
      </span>
    </span>
  );
}
