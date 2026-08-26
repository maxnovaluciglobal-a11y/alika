import { useRef } from "react";

import { Label } from "@/components/ui/label";

/**
 * Canvas de firma manuscrita reutilizable. Emite el PNG como data URL en
 * cada trazo (o null al limpiar). Usado en consentimientos y en la
 * aprobación firmada de presupuestos.
 */
export function SignaturePad({
  label = "Firma",
  onChange,
}: {
  label?: string;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function ctx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const c = ctx();
    if (!c) return;
    const { x, y } = pointerPos(e);
    c.beginPath();
    c.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const { x, y } = pointerPos(e);
    c.lineWidth = 2;
    c.lineCap = "round";
    c.strokeStyle = "#16211D";
    c.lineTo(x, y);
    c.stroke();
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function end() {
    drawing.current = false;
  }

  function limpiar() {
    const c = ctx();
    const canvas = canvasRef.current;
    if (!c || !canvas) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={limpiar}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={460}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-lg border border-hairline bg-secondary/20"
      />
      <p className="text-[11px] text-muted-foreground">Firmá con el dedo o el mouse.</p>
    </div>
  );
}
