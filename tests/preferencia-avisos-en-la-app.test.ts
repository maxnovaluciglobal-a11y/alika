import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { conectar, sembrarEscenario } from "./helpers/db";

/**
 * El interruptor "Avisos dentro de Alika" apaga los avisos de verdad.
 *
 * Antes, `notification_preferences.inapp_enabled` sólo lo leía y escribía su
 * propia pantalla: ningún camino lo consultaba antes de insertar, así que el
 * switch no hacía nada.
 *
 * El control vive en un trigger y no en la app por una razón concreta: la RLS
 * de `notification_preferences` es `user_id = auth.uid()`, o sea que **quien
 * escribe un aviso para otra persona no puede leer la preferencia de esa
 * persona**. En la app el dato es ilegible por diseño.
 */
describe("preferencia de avisos en la app", () => {
  let client: Client;
  let clinicId: string;
  let usuarios: Record<string, string>;

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
    await client.query(`SELECT set_config('request.jwt.claims', '', true)`);
    // `notification_preferences.user_id` tiene FK a auth.users y los usuarios
    // del escenario son uuids sintéticos. Se registran acá; el ROLLBACK del
    // afterEach los limpia.
    await client.query(
      `INSERT INTO auth.users (id) SELECT unnest($1::uuid[]) ON CONFLICT (id) DO NOTHING`,
      [Object.values(usuarios)],
    );
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  const preferir = (userId: string, inapp: boolean) =>
    client.query(
      `INSERT INTO public.notification_preferences (user_id, inapp_enabled)
       VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET inapp_enabled = EXCLUDED.inapp_enabled`,
      [userId, inapp],
    );

  const avisar = (userId: string, kind = "inbound_message") =>
    client.query(
      `INSERT INTO public.notifications (clinic_id, recipient_id, actor_id, kind, title)
       VALUES ($1,$2,NULL,$3,'Un paciente te escribió')`,
      [clinicId, userId, kind],
    );

  const cuantos = async (userId: string) =>
    Number(
      (
        await client.query<{ n: string }>(
          `SELECT count(*) AS n FROM public.notifications WHERE recipient_id = $1`,
          [userId],
        )
      ).rows[0].n,
    );

  it("con el interruptor APAGADO no se guarda el aviso", async () => {
    await preferir(usuarios.dentist, false);
    await avisar(usuarios.dentist);
    expect(await cuantos(usuarios.dentist)).toBe(0);
  });

  it("con el interruptor ENCENDIDO se guarda", async () => {
    await preferir(usuarios.dentist, true);
    await avisar(usuarios.dentist);
    expect(await cuantos(usuarios.dentist)).toBe(1);
  });

  it("sin fila de preferencias se avisa: es opt-OUT, no opt-in", async () => {
    // El default de la app es `inappEnabled: true`. Si la ausencia de fila
    // silenciara, todo el que nunca entró a Preferencias dejaría de recibir
    // avisos — el bug contrario y peor.
    await avisar(usuarios.reception);
    expect(await cuantos(usuarios.reception)).toBe(1);
  });

  it("apagarlo es POR PERSONA, no por clínica", async () => {
    await preferir(usuarios.dentist, false);
    await avisar(usuarios.dentist);
    await avisar(usuarios.owner);
    expect(await cuantos(usuarios.dentist)).toBe(0);
    expect(await cuantos(usuarios.owner)).toBe(1);
  });

  it("silencia CUALQUIER tipo de aviso, sin excepciones ocultas", async () => {
    // La pantalla promete sin matices, y el canal de email queda aparte. Dejar
    // pasar algunos tipos haría que el interruptor mintiera de otra forma.
    await preferir(usuarios.dentist, false);
    for (const kind of [
      "inbound_message",
      "review_requested",
      "patient_opt_out",
      "daily_digest",
      "appointment_request",
    ]) {
      await avisar(usuarios.dentist, kind);
    }
    expect(await cuantos(usuarios.dentist)).toBe(0);
  });

  it("un insert de varios destinatarios filtra fila por fila", async () => {
    // `notifyClinicStaff` inserta a todo el equipo de una vez; el trigger es
    // FOR EACH ROW, así que apagar uno no debe silenciar a los demás.
    await preferir(usuarios.dentist, false);
    await client.query(
      `INSERT INTO public.notifications (clinic_id, recipient_id, actor_id, kind, title)
       SELECT $1, u, NULL, 'daily_digest', 'Resumen'
         FROM unnest($2::uuid[]) AS u`,
      [clinicId, [usuarios.owner, usuarios.dentist, usuarios.reception]],
    );
    expect(await cuantos(usuarios.dentist)).toBe(0);
    expect(await cuantos(usuarios.owner)).toBe(1);
    expect(await cuantos(usuarios.reception)).toBe(1);
  });
});
