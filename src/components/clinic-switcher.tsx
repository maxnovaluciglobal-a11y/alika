import { useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { ACCESS_QUERY_KEY, type ClinicAccess } from "@/lib/access";
import { getMyAccess, setActiveClinic } from "@/lib/access.functions";

/**
 * Selector de clínica activa (progresivo #7, plan Carlos 05-sep-2026). Solo
 * se renderiza como <select> con 2+ membresías reales — con una sola clínica
 * (el caso de hoy para todos los usuarios reales) queda exactamente como
 * antes: el nombre en texto plano, sin ningún cambio visual.
 *
 * Límite conocido, no resuelto a propósito: si el usuario tiene 2 pestañas
 * abiertas y cambia de clínica en una, la otra sigue "creyendo" que la
 * clínica vieja es la activa hasta que su propio caché expire (5 min, ver
 * ACCESS_QUERY_KEY en _clinic/route.tsx) o navegue — RLS igual permite sus
 * escrituras porque sigue siendo miembro real de ambas clínicas, así que no
 * es un problema de seguridad, pero un alta/pago hecho en esa ventana queda
 * bajo la clínica que la pestaña vieja todavía tenía activa. Sin ningún
 * usuario real en 2+ clínicas hoy, no se justifica todavía sumar sincronía
 * entre pestañas (BroadcastChannel) para un caso sin caso real (revisión de
 * código, 06-sep-2026).
 */
export function ClinicSwitcher({ access }: { access: ClinicAccess }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const switchClinicFn = useServerFn(setActiveClinic);
  const getMyAccessFn = useServerFn(getMyAccess);

  // Defensivo: un ClinicAccess restaurado del caché offline (IndexedDB) de
  // antes de que este campo existiera no lo tiene — degradar a "sin
  // selector" en vez de romper la sección entera (revisión de código,
  // 06-sep-2026).
  const memberships = access.memberships ?? [];

  const mut = useMutation({
    mutationFn: async (clinicId: string) => {
      await switchClinicFn({ data: { clinicId } });
      // ensureQueryData (usado en el beforeLoad de _clinic/route.tsx) devuelve
      // el dato cacheado si existe, SIN mirar si está invalidado (confirmado
      // leyendo queryClient.js). fetchQuery con staleTime: 0 fuerza el fetch
      // real — a diferencia de removeQueries (lo que había acá antes), nunca
      // deja la entrada del caché vacía: si este fetch falla, la clínica
      // anterior sigue disponible para el fallback offline de
      // _clinic/route.tsx en vez de tumbar la sección entera con un error
      // (regresión de resiliencia encontrada en revisión de código, 06-sep-2026).
      await queryClient.fetchQuery({
        queryKey: ACCESS_QUERY_KEY,
        queryFn: () => getMyAccessFn({}),
        staleTime: 0,
      });
      await router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!access.clinic) return null;

  if (memberships.length < 2) {
    return <p className="mt-2 truncate text-xs text-muted-foreground">{access.clinic.name}</p>;
  }

  return (
    <label className="mt-2 block">
      <span className="sr-only">Clínica activa</span>
      <select
        value={access.clinic.id}
        onChange={(e) => {
          if (e.target.value !== access.clinic?.id) mut.mutate(e.target.value);
        }}
        className="w-full truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
      >
        {memberships.map((m) => (
          <option key={m.clinicId} value={m.clinicId}>
            {m.clinicName}
          </option>
        ))}
      </select>
    </label>
  );
}
