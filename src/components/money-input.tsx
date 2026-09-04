import { forwardRef, useState } from "react";

import { pasoDeMoneda } from "@/lib/finance";
import { centsATexto, textoACents, textoSincronizado } from "@/lib/money-input-sync";
import { cn } from "@/lib/utils";

/**
 * Input de dinero. Habla en cents —lo que guarda la base— y se encarga solo
 * de mostrarlos en la unidad que el usuario entiende.
 *
 * El texto crudo vive acá adentro a propósito. Si el valor se derivara de
 * `fromCents(toCents(texto))` en cada tecla, escribir "45." lo devolvería
 * como "45" y el punto decimal sería intipeable. No se nota en CLP, donde no
 * hay decimales; rompe en cualquier moneda que sí los tenga.
 *
 * También centraliza el `step`, que sin esto queda en el implícito de 1 y
 * hace que el navegador rechace "45.50" antes de que el código lo vea.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    /** ISO 4217 de la clínica. Decide el paso, el sufijo y el factor. */
    currency: string;
    /** Valor en cents, o `null` para "sin dato". */
    valueCents: number | null;
    onValueChange: (cents: number | null) => void;
    /** Sufijo con el código de moneda. Se apaga en inputs muy angostos. */
    mostrarMoneda?: boolean;
    className?: string;
  } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "step" | "defaultValue"
  >
>(function MoneyInput(
  { currency, valueCents, onValueChange, mostrarMoneda = true, className, ...rest },
  ref,
) {
  const [texto, setTexto] = useState(() => centsATexto(valueCents, currency));
  const [ultimo, setUltimo] = useState(valueCents);

  // Patrón de React para ajustar estado cuando cambia un prop, sin efecto ni
  // parpadeo. La regla de cuándo pisar el texto vive en `textoSincronizado`,
  // que es pura y está probada.
  if (valueCents !== ultimo) {
    setUltimo(valueCents);
    const siguiente = textoSincronizado(texto, valueCents, currency);
    if (siguiente !== null) setTexto(siguiente);
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step={pasoDeMoneda(currency)}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onValueChange(textoACents(e.target.value, currency));
        }}
        className={cn(
          "w-full rounded-lg border border-hairline bg-transparent py-2 pl-3 text-sm tabular-nums outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          mostrarMoneda ? "pr-14" : "pr-3",
          className,
        )}
        {...rest}
      />
      {mostrarMoneda && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
        >
          {currency.toUpperCase()}
        </span>
      )}
    </div>
  );
});
