import { redirect } from "@tanstack/react-router";

import { hasPermission, type ClinicAccess, type Permission } from "@/lib/access";

/**
 * Guard de ruta por permiso. El contexto `access` lo provee el layout
 * `_authenticated/_clinic`. La autorización de datos siempre vive en RLS;
 * esto solo evita mostrar pantallas que el rol no puede usar.
 */
export function requirePermission(permission: Permission) {
  return ({ context }: { context: { access: ClinicAccess } }) => {
    if (!hasPermission(context.access.role, permission)) {
      throw redirect({ to: "/sin-acceso" });
    }
  };
}
