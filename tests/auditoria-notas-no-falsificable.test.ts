import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, conectar, esperaError, sembrarEscenario } from "./helpers/db";

/**
 * La auditoría de notas clínicas no se puede falsificar.
 *
 * Antes, `note_audit_insert_members` dejaba que cualquier miembro insertara
 * filas con `action` y `detail` arbitrarios. Alguien podía fabricar un
 * "firmó" o un "aprobó la revisión" que nunca pasó — y un registro en el que
 * cualquiera escribe lo que quiere no sirve como registro.
 *
 * Lo que fijan estos tests:
 *   1. Los hechos que la base conoce los escribe un TRIGGER, no la app.
 *   2. Ningún usuario puede insertar directamente en la tabla (control
 *      negativo: es lo único que hace que 1 valga de algo).
 *   3. Los hechos que la base NO puede ver pasan por una puerta angosta que
 *      sólo acepta ese vocabulario y estampa el actor ella misma.
 */
describe("clinical_note_audit — la escribe la base, no el usuario", () => {
  let client: Client;

  /** Ejecuta sin identidad JWT (rol de servicio) y devuelve las filas.
   * `comoServicio` del helper no devuelve nada, y acá hace falta el id. */
  async function servicio<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    await client.query(`SELECT set_config('request.jwt.claims', '', true)`);
    const res = await client.query(sql, params);
    return res.rows as T[];
  }

  let clinicId: string;
  let usuarios: Record<string, string>;
  let noteId: string;

  beforeAll(async () => {
    client = await conectar();
  });
  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query("BEGIN");
    const esc = await sembrarEscenario(client);
    clinicId = esc.clinicId;
    usuarios = esc.usuarios;

    const nota = await servicio<{ id: string }>(
      `INSERT INTO public.clinical_notes
         (clinic_id, patient_ref, patient_name, title, content, status, created_by, updated_by)
       VALUES ($1, 'PAC-1', 'Paciente Test', 'Control', 'texto', 'draft', $2, $2)
       RETURNING id`,
      [clinicId, usuarios.dentist],
    );
    noteId = nota[0].id;
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  const auditoria = async () =>
    (await servicio(
      `SELECT action, detail, actor_id FROM public.clinical_note_audit
       WHERE note_id = $1 ORDER BY created_at, action`,
      [noteId],
    )) as { action: string; detail: string | null; actor_id: string }[];

  // ── 1. Los hechos de la base los escribe un trigger ──────────────────────

  it("guardar la primera versión deja 'create' sin que la app escriba nada", async () => {
    await servicio(
      `INSERT INTO public.clinical_note_versions
         (note_id, clinic_id, version, title, content, ai_assisted, author_id)
       VALUES ($1, $2, 1, 'Control', 'texto', false, $3)`,
      [noteId, clinicId, usuarios.dentist],
    );

    const filas = await auditoria();
    expect(filas).toHaveLength(1);
    expect(filas[0].action).toBe("create");
    expect(filas[0].detail).toBe("v1");
    expect(filas[0].actor_id).toBe(usuarios.dentist);
  });

  it("la segunda versión es 'edit' y delata la asistencia de IA", async () => {
    for (const [v, ia] of [
      [1, false],
      [2, true],
    ] as const) {
      await servicio(
        `INSERT INTO public.clinical_note_versions
           (note_id, clinic_id, version, title, content, ai_assisted, author_id)
         VALUES ($1, $2, $3, 'Control', 'texto', $4, $5)`,
        [noteId, clinicId, v, ia, usuarios.dentist],
      );
    }

    const filas = await auditoria();
    expect(filas.map((f) => f.action)).toEqual(["create", "edit"]);
    expect(filas[1].detail).toBe("v2 · con asistencia de IA");
  });

  it("una reversión se distingue de un guardado normal", async () => {
    await servicio(
      `INSERT INTO public.clinical_note_versions
         (note_id, clinic_id, version, title, content, author_id)
       VALUES ($1, $2, 1, 'Control', 'texto', $3)`,
      [noteId, clinicId, usuarios.dentist],
    );
    await servicio(
      `INSERT INTO public.clinical_note_versions
         (note_id, clinic_id, version, title, content, author_id, origin, origin_version)
       VALUES ($1, $2, 2, 'Control', 'texto viejo', $3, 'revert', 1)`,
      [noteId, clinicId, usuarios.dentist],
    );

    const filas = await auditoria();
    expect(filas.map((f) => f.action)).toEqual(["create", "revert"]);
    expect(filas[1].detail).toBe("Revirtió a v1 como nuevo borrador v2");
  });

  it("una reversión sin decir de dónde vino no se puede guardar", async () => {
    const msg = await esperaError(client, () =>
      servicio(
        `INSERT INTO public.clinical_note_versions
           (note_id, clinic_id, version, title, content, author_id, origin)
         VALUES ($1, $2, 1, 'Control', 'texto', $3, 'revert')`,
        [noteId, clinicId, usuarios.dentist],
      ),
    );
    expect(msg).toMatch(/origin_coherente/);
  });

  it("firmar y reabrir quedan registrados solos", async () => {
    await servicio(`UPDATE public.clinical_notes SET status='signed', updated_by=$2 WHERE id=$1`, [
      noteId,
      usuarios.dentist,
    ]);
    await servicio(`UPDATE public.clinical_notes SET status='draft', updated_by=$2 WHERE id=$1`, [
      noteId,
      usuarios.dentist,
    ]);

    expect((await auditoria()).map((f) => f.action).sort()).toEqual(["reopen", "sign"]);
  });

  it("un UPDATE que no toca el estado no ensucia el historial", async () => {
    await servicio(`UPDATE public.clinical_notes SET title='Otro' WHERE id=$1`, [noteId]);
    expect(await auditoria()).toHaveLength(0);
  });

  it("las acciones de revisión se auditan desde la revisión misma", async () => {
    await servicio(
      `INSERT INTO public.clinical_note_reviews
         (note_id, clinic_id, patient_ref, action, comment, actor_id)
       VALUES ($1, $2, 'PAC-1', 'approved', 'todo bien', $3)`,
      [noteId, clinicId, usuarios.owner],
    );

    const filas = await auditoria();
    expect(filas).toHaveLength(1);
    expect(filas[0].action).toBe("review_approved");
    expect(filas[0].detail).toBe("todo bien");
    expect(filas[0].actor_id).toBe(usuarios.owner);
  });

  // ── 2. Control negativo: sin esto, nada de lo anterior vale ──────────────

  it("NADIE puede insertar una fila de auditoría a mano", async () => {
    // Ojo: la conexión de los tests es `postgres`, dueña de la tabla, y un
    // dueño SALTEA la RLS. Sin asumir el rol `authenticated` —el que usa
    // PostgREST de verdad— este test pasaría siempre y no probaría nada.
    for (const rol of ["owner", "admin", "dentist"] as const) {
      await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: usuarios[rol], role: "authenticated" }),
      ]);
      await client.query("SAVEPOINT sp_rls");
      await client.query("SET LOCAL ROLE authenticated");

      let fallo = "";
      try {
        await client.query(
          `INSERT INTO public.clinical_note_audit
             (note_id, clinic_id, patient_ref, action, detail, actor_id)
           VALUES ($1, $2, 'PAC-1', 'sign', 'inventado', $3)`,
          [noteId, clinicId, usuarios[rol]],
        );
      } catch (e) {
        fallo = (e as Error).message;
      }
      await client.query("ROLLBACK TO SAVEPOINT sp_rls");

      expect(fallo).toMatch(/row-level security|permission denied/i);
    }
    expect(await auditoria()).toHaveLength(0);
  });

  it("tampoco se puede fabricar una acción que no existe", async () => {
    const msg = await esperaError(client, () =>
      servicio(
        `INSERT INTO public.clinical_note_audit
           (note_id, clinic_id, patient_ref, action, actor_id)
         VALUES ($1, $2, 'PAC-1', 'firmadisimo', $3)`,
        [noteId, clinicId, usuarios.dentist],
      ),
    );
    expect(msg).toMatch(/action_check/);
  });

  // ── 3. Los hechos que la base no puede ver, por la puerta angosta ────────

  it("la app puede registrar un choque de la cola offline", async () => {
    await comoUsuario(
      client,
      usuarios.dentist,
      `SELECT public.registrar_evento_de_nota(
         p_clinic_id => $2, p_action => 'conflict', p_note_id => $1,
         p_patient_ref => 'PAC-1', p_detail => 'v3 chocó con v4')`,
      [noteId, clinicId],
    );

    const filas = await auditoria();
    expect(filas).toHaveLength(1);
    expect(filas[0].action).toBe("conflict");
    expect(filas[0].actor_id).toBe(usuarios.dentist);
  });

  it("esa puerta RECHAZA las acciones que escribe un trigger", async () => {
    for (const accion of ["sign", "revert", "review_approved"]) {
      const msg = await esperaError(client, () =>
        comoUsuario(
          client,
          usuarios.dentist,
          `SELECT public.registrar_evento_de_nota(
            p_clinic_id => $2, p_action => $3, p_note_id => $1,
            p_patient_ref => 'PAC-1', p_detail => 'inventado')`,
          [noteId, clinicId, accion],
        ),
      );
      expect(msg).toMatch(/la escribe un trigger/);
    }
    expect(await auditoria()).toHaveLength(0);
  });

  it("el actor lo estampa la función: no se puede culpar a otro", async () => {
    await comoUsuario(
      client,
      usuarios.dentist,
      `SELECT public.registrar_evento_de_nota(
         p_clinic_id => $2, p_action => 'ai_draft', p_note_id => $1,
         p_patient_ref => 'PAC-1', p_detail => '120 caracteres')`,
      [noteId, clinicId],
    );
    // No hay parámetro de actor: aunque el dentist quisiera atribuírselo al
    // owner, la fila sale con su propia identidad.
    expect((await auditoria())[0].actor_id).toBe(usuarios.dentist);
  });

  it("un extraño a la clínica no puede registrar nada", async () => {
    const msg = await esperaError(client, () =>
      comoUsuario(
        client,
        usuarios.externo,
        `SELECT public.registrar_evento_de_nota(
          p_clinic_id => $2, p_action => 'ai_draft', p_note_id => $1,
          p_patient_ref => 'PAC-1', p_detail => 'x')`,
        [noteId, clinicId],
      ),
    );
    expect(msg).toMatch(/sin permiso/);
  });

  // ── 4. La auditoría registra, no bloquea ────────────────────────────────

  describe("acciones sin persona detrás", () => {
    it("una acción del sistema se registra con actor vacío, no falla", async () => {
      // `actor_id` era NOT NULL y el trigger le pasaba auth.uid() = null cuando
      // no hay identidad (rol de servicio, cascada, script). La fila de
      // auditoría fallaba y ARRASTRABA la operación entera.
      await servicio(
        `UPDATE public.clinical_notes SET status='signed', updated_by=NULL WHERE id=$1`,
        [noteId],
      );
      const filas = await auditoria();
      expect(filas).toHaveLength(1);
      expect(filas[0].action).toBe("sign");
      expect(filas[0].actor_id).toBeNull();
    });

    it("se puede borrar una nota que tiene entidades", async () => {
      // El caso grave: la cascada borra las entidades, eso dispara el trigger,
      // y anotar la auditoría apuntando a la nota que se está borrando violaba
      // la FK. `clinical_notes` cascadea desde `clinics`, así que esto rompía
      // el borrado de una CLÍNICA entera.
      const kind = (
        await servicio<{ enumlabel: string }>(
          `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
            WHERE t.typname='clinical_entity_kind' ORDER BY enumsortorder LIMIT 1`,
        )
      )[0].enumlabel;
      await servicio(
        `INSERT INTO public.clinical_note_entities
           (note_id, clinic_id, patient_ref, kind, term, created_by)
         VALUES ($1,$2,'PAC-1',$3::public.clinical_entity_kind,'caries',$4)`,
        [noteId, clinicId, kind, usuarios.dentist],
      );

      await servicio(`DELETE FROM public.clinical_notes WHERE id=$1`, [noteId]);

      // La entidad borrada queda registrada, pero sin apuntar a una nota que
      // ya no existe: perderlo en silencio sería peor que anotarlo sin ella.
      const huerfanas = await servicio<{ action: string; note_id: string | null }>(
        `SELECT action, note_id FROM public.clinical_note_audit
          WHERE clinic_id=$1 AND action='entity_delete'`,
        [clinicId],
      );
      expect(huerfanas).toHaveLength(1);
      expect(huerfanas[0].note_id).toBeNull();
    });
  });
});
