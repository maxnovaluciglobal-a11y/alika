// Navegación de 6 destinos (rediseño, fase 3). Lógica pura: no toca Postgres.
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CLINIC_ROLES, hasPermission, type Permission } from "@/lib/access/access";
import {
  AJUSTES,
  AJUSTES_SOLO_DUENO,
  DESTINOS,
  ajustesVisibles,
  destinoDeRuta,
  destinosVisibles,
} from "@/lib/access/navegacion";
import { limpiarTerminoDeBusqueda } from "@/lib/patients/buscar-pacientes.functions";

const DIR = "src/routes/_authenticated/_clinic";
const todas = [
  ...DESTINOS.flatMap((d) => d.pestanas),
  ...AJUSTES.flatMap((g) => g.items),
  ...AJUSTES_SOLO_DUENO,
];

function archivoDeRuta(to: string) {
  const base = to.replace(/^\//, "");
  const candidatos = [
    `${DIR}/${base}.tsx`,
    `${DIR}/${base}.index.tsx`,
    `src/routes/_authenticated/${base}.tsx`,
  ];
  return candidatos.find((c) => existsSync(c)) ?? null;
}

/** Permisos que exige el `beforeLoad` de la ruta, o null si no tiene guard. */
function permisosDelGuard(archivo: string): Permission[] | null {
  const src = readFileSync(archivo, "utf8");
  const m = src.match(/beforeLoad:\s*require(?:Any)?Permission\(([^)]*)\)/);
  if (!m) return null;
  return [...m[1].matchAll(/"([a-z:-]+)"/g)].map((x) => x[1] as Permission);
}

describe("navegación por destinos", () => {
  it("ningún rol ve más de 7 entradas (6 destinos + Ajustes)", () => {
    for (const rol of CLINIC_ROLES) {
      expect(destinosVisibles(rol).length + 1).toBeLessThanOrEqual(7);
    }
  });

  it("cada pestaña apunta a una ruta que existe", () => {
    for (const p of todas) expect(archivoDeRuta(p.to), p.to).not.toBeNull();
  });

  it("cada pestaña pide los mismos permisos que el beforeLoad de su ruta", () => {
    for (const p of todas) {
      const guard = permisosDelGuard(archivoDeRuta(p.to)!);
      if (guard === null) continue; // ruta sin guard propio (ej. /suscripcion)
      expect([...p.permisos].sort(), p.to).toEqual([...guard].sort());
    }
  });

  it("nunca ofrece una pestaña que termine en /sin-acceso", () => {
    for (const rol of CLINIC_ROLES) {
      for (const d of destinosVisibles(rol)) {
        for (const p of d.pestanas) {
          expect(
            p.permisos.some((perm) => hasPermission(rol, perm)),
            `${rol} ${p.to}`,
          ).toBe(true);
        }
      }
    }
  });

  it("las herramientas de email son solo del dueño", () => {
    const rutas = (rol: (typeof CLINIC_ROLES)[number]) =>
      ajustesVisibles(rol).flatMap((g) => g.items.map((i) => i.to));
    expect(rutas("owner")).toContain("/dominio-email");
    expect(rutas("admin")).not.toContain("/dominio-email");
  });

  it("ubica cada ruta en su destino, incluidas las de detalle", () => {
    const ds = destinosVisibles("owner");
    expect(destinoDeRuta("/pacientes/abc", ds)?.id).toBe("pacientes");
    expect(destinoDeRuta("/mi-agenda", ds)?.id).toBe("agenda");
    expect(destinoDeRuta("/recordatorios", ds)?.id).toBe("mensajes");
    expect(destinoDeRuta("/equipo", ds)).toBeNull();
  });
});

describe("limpiarTerminoDeBusqueda", () => {
  it("no deja pasar separadores ni comodines del filtro de PostgREST", () => {
    expect(limpiarTerminoDeBusqueda("ana),id.eq.1")).toBe("ana id eq 1");
    expect(limpiarTerminoDeBusqueda("50%_*")).toBe("50");
    expect(limpiarTerminoDeBusqueda("  María   José ")).toBe("María José");
  });
});
