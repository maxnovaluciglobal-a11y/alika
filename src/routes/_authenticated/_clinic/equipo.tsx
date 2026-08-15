import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/route-guards";
import {
  CLINIC_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  hasPermission,
  permissionsForRole,
  type ClinicMember,
  type ClinicRole,
} from "@/lib/access";
import { listClinicMembers, removeMember, updateMemberRole } from "@/lib/access.functions";

export const Route = createFileRoute("/_authenticated/_clinic/equipo")({
  beforeLoad: requirePermission("team:view"),
  head: () => ({
    meta: [
      { title: "Equipo y permisos | Alika" },
      {
        name: "description",
        content: "Gestiona los integrantes de tu clínica y qué puede ver cada rol dentro de Alika.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EquipoPage,
});

function EquipoPage() {
  const { access } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useServerFn(listClinicMembers);
  const changeRole = useServerFn(updateMemberRole);
  const kickMember = useServerFn(removeMember);

  const clinicId = access.clinic!.id;
  const puedeGestionar = hasPermission(access.role, "team:manage");

  const membersQuery = useQuery({
    queryKey: ["clinic-members", clinicId],
    queryFn: () => fetchMembers({ data: { clinicId } }),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { memberId: string; role: ClinicRole }) => changeRole({ data: vars }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["clinic-members", clinicId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => kickMember({ data: { memberId } }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["clinic-members", clinicId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const members: ClinicMember[] = membersQuery.data ?? [];

  return (
    <AppShell title="Equipo y permisos" access={access}>
      <div className="space-y-8">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Integrantes de {access.clinic!.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {puedeGestionar
                ? "Cambia el rol de cada persona para ajustar qué secciones puede abrir."
                : "Solo propietario y administradores pueden modificar roles."}
            </p>
          </div>

          <div className="card-clinical divide-y divide-hairline">
            {membersQuery.isLoading && (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Cargando equipo…
              </p>
            )}
            {membersQuery.isError && (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No pudimos cargar el equipo.
              </p>
            )}
            {members.map((m) => {
              const esYo = m.userId === access.userId;
              const bloqueado = !puedeGestionar || esYo || m.role === "owner";
              return (
                <div
                  key={m.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[2fr_1.2fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.fullName ?? m.email ?? "Integrante"}
                      {esYo && <span className="ml-2 text-[10px] text-muted-foreground">(tú)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email ?? "—"}</p>
                  </div>

                  <label className="text-xs text-muted-foreground">
                    <span className="sr-only">Rol de {m.fullName ?? m.email ?? "integrante"}</span>
                    <select
                      value={m.role}
                      disabled={bloqueado || roleMutation.isPending}
                      onChange={(e) =>
                        roleMutation.mutate({ memberId: m.id, role: e.target.value as ClinicRole })
                      }
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                    >
                      {CLINIC_ROLES.map((r) => (
                        <option key={r} value={r} disabled={r === "owner"}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(m.id)}
                    disabled={bloqueado || removeMutation.isPending}
                    aria-label={`Quitar a ${m.fullName ?? m.email ?? "integrante"} del equipo`}
                    className="grid size-9 place-items-center justify-self-start rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 sm:justify-self-end"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Qué puede hacer cada rol</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CLINIC_ROLES.map((r) => (
              <article key={r} className="card-clinical p-5">
                <p className="font-display text-sm font-semibold">{ROLE_LABELS[r]}</p>
                <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {permissionsForRole(r).map((p) => (
                    <li
                      key={p}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
