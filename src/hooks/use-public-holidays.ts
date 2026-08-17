import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getPublicHolidays } from "@/lib/holidays.functions";

/**
 * Feriados públicos (Nager.Date) del país de la clínica, para marcar
 * visualmente el selector de fecha del turno. `staleTime` largo: además del
 * cache en memoria del servidor, evita repetir el fetch en cada render.
 */
export function usePublicHolidays(country: string | null | undefined, years: number[]) {
  const fetchHolidays = useServerFn(getPublicHolidays);
  const uniqueYears = useMemo(() => [...new Set(years)].sort(), [years]);

  const results = useQueries({
    queries: uniqueYears.map((year) => ({
      queryKey: ["public-holidays", country, year],
      queryFn: () => fetchHolidays({ data: { country: country as string, year } }),
      enabled: Boolean(country),
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
    })),
  });

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of results) {
      for (const h of r.data ?? []) map.set(h.date, h.name);
    }
    return map;
  }, [results]);

  return {
    holidaysByDate,
    isLoading: results.some((r) => r.isLoading),
  };
}
