import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  documentosIniciales,
  type DocumentoPortal,
  type ReservaPortal,
} from "@/lib/portal-data";

const STORAGE_KEY = "oralia-portal-v1";

interface PortalState {
  reservas: ReservaPortal[];
  documentos: DocumentoPortal[];
}

interface PortalContextValue extends PortalState {
  agregarReserva: (reserva: Omit<ReservaPortal, "id" | "creadaEn">) => ReservaPortal;
  cancelarReserva: (id: string) => void;
  agregarDocumento: (doc: Omit<DocumentoPortal, "id" | "estado" | "fecha">) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

const estadoInicial: PortalState = { reservas: [], documentos: documentosIniciales };

export function PortalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalState>(estadoInicial);

  // Se hidrata en el cliente para evitar desajustes de SSR.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...estadoInicial, ...(JSON.parse(raw) as PortalState) });
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [state]);

  const agregarReserva = useCallback((reserva: Omit<ReservaPortal, "id" | "creadaEn">) => {
    const nueva: ReservaPortal = {
      ...reserva,
      id: `r-${Date.now()}`,
      creadaEn: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, reservas: [...prev.reservas, nueva] }));
    return nueva;
  }, []);

  const cancelarReserva = useCallback((id: string) => {
    setState((prev) => ({ ...prev, reservas: prev.reservas.filter((r) => r.id !== id) }));
  }, []);

  const agregarDocumento = useCallback((doc: Omit<DocumentoPortal, "id" | "estado" | "fecha">) => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    setState((prev) => ({
      ...prev,
      documentos: [{ ...doc, id: `d-${Date.now()}`, estado: "enviado", fecha }, ...prev.documentos],
    }));
  }, []);

  const value = useMemo(
    () => ({ ...state, agregarReserva, cancelarReserva, agregarDocumento }),
    [state, agregarReserva, cancelarReserva, agregarDocumento],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal debe usarse dentro de PortalProvider");
  return ctx;
}
