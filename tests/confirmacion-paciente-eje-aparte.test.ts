import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoServicio, conectar, sembrarEscenario } from "./helpers/db";

/**
 * El aviso del PACIENTE vive en un eje aparte del visto bueno del PROFESIONAL.
 *
 * Estos tests fijan las dos cosas que hacen que ese eje no mienta:
 *   1. Escribir `patient_confirmed_at` NUNCA mueve `status`, `confirmed_at`
 *      ni `confirmed_by`. Fusionar los dos ejes es lo que obligó a remover la
 *      confirmación por WhatsApp en `505eb7d`.
 *   2. Si la cita se reagenda o se cancela, el aviso se borra solo. "El
 *      paciente dijo que viene" se refiere a UNA fecha; arrastrarlo a otra es
 *      peor que no tenerlo, porque la agenda mostraría un confirmado falso.
 */
describe("patient_confirmed_at — el aviso del paciente no toca la agenda del profesional", () => {
  let client: Client;
  let clinicId: string;
  let usuarios: Record<string, string>;
  let citaId: string;
  let manana: Date;

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

    const branch = await client.query<{ id: string }>(
      `INSERT INTO public.branches (clinic_id, name) VALUES ($1, 'Sucursal Test') RETURNING id`,
      [clinicId],
    );
    const prof = await client.query<{ id: string }>(
      `INSERT INTO public.professionals (clinic_id, full_name, user_id)
       VALUES ($1, 'Dra. Test', $2) RETURNING id`,
      [clinicId, usuarios.dentist],
    );
    const pac = await client.query<{ id: string }>(
      `INSERT INTO public.patients (clinic_id, full_name, phone, created_by)
       VALUES ($1, 'Paciente Test', '+56912345678', $2) RETURNING id`,
      [clinicId, usuarios.owner],
    );

    manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const cita = await client.query<{ id: string }>(
      `INSERT INTO public.appointments
         (clinic_id, branch_id, patient_id, professional_id, starts_at, ends_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        clinicId,
        branch.rows[0].id,
        pac.rows[0].id,
        prof.rows[0].id,
        manana,
        new Date(manana.getTime() + 30 * 60 * 1000),
        usuarios.owner,
      ],
    );
    citaId = cita.rows[0].id;
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  async function leerCita() {
    const r = await client.query(
      `SELECT status::text, confirmed_at, confirmed_by, patient_confirmed_at, patient_confirmed_via
         FROM public.appointments WHERE id = $1`,
      [citaId],
    );
    return r.rows[0];
  }

  it("el aviso del paciente no confirma la cita ni estampa al profesional", async () => {
    await client.query(
      `UPDATE public.appointments
          SET patient_confirmed_at = now(), patient_confirmed_via = 'whatsapp'
        WHERE id = $1`,
      [citaId],
    );

    const cita = await leerCita();
    expect(cita.patient_confirmed_at).not.toBeNull();
    expect(cita.patient_confirmed_via).toBe("whatsapp");
    // Lo que importa: el eje del profesional queda intacto.
    expect(cita.status).toBe("tentativa");
    expect(cita.confirmed_at).toBeNull();
    expect(cita.confirmed_by).toBeNull();
  });

  it("y al revés: que el profesional confirme no inventa un aviso del paciente", async () => {
    // Sin identidad: el trigger estampa confirmed_at igual y deja
    // confirmed_by en null. Alcanza para lo que se está probando, y evita
    // la FK a auth.users (los uuid del helper son sintéticos).
    await comoServicio(
      client,
      `UPDATE public.appointments SET status = 'confirmada' WHERE id = $1`,
      [citaId],
    );

    const cita = await leerCita();
    expect(cita.status).toBe("confirmada");
    expect(cita.confirmed_at).not.toBeNull();
    // El paciente nunca dijo nada. Que la agenda diga que sí sería mentir.
    expect(cita.patient_confirmed_at).toBeNull();
  });

  it("reagendar borra el aviso: se refería a la fecha vieja", async () => {
    await client.query(
      `UPDATE public.appointments
          SET patient_confirmed_at = now(), patient_confirmed_via = 'whatsapp'
        WHERE id = $1`,
      [citaId],
    );
    expect((await leerCita()).patient_confirmed_at).not.toBeNull();

    const pasado = new Date(manana.getTime() + 3 * 24 * 60 * 60 * 1000);
    await client.query(
      `UPDATE public.appointments SET starts_at = $2, ends_at = $3 WHERE id = $1`,
      [citaId, pasado, new Date(pasado.getTime() + 30 * 60 * 1000)],
    );

    const cita = await leerCita();
    expect(cita.patient_confirmed_at).toBeNull();
    expect(cita.patient_confirmed_via).toBeNull();
  });

  it("cancelar la cita también borra el aviso", async () => {
    await client.query(
      `UPDATE public.appointments
          SET patient_confirmed_at = now(), patient_confirmed_via = 'whatsapp'
        WHERE id = $1`,
      [citaId],
    );
    await client.query(`UPDATE public.appointments SET status = 'cancelada' WHERE id = $1`, [
      citaId,
    ]);

    expect((await leerCita()).patient_confirmed_at).toBeNull();
  });

  it("marcar la cita como ausente borra el aviso: no vino, no vale", async () => {
    await client.query(
      `UPDATE public.appointments
          SET patient_confirmed_at = now(), patient_confirmed_via = 'whatsapp'
        WHERE id = $1`,
      [citaId],
    );
    await client.query(`UPDATE public.appointments SET status = 'ausente' WHERE id = $1`, [citaId]);

    expect((await leerCita()).patient_confirmed_at).toBeNull();
  });

  it("un cambio cualquiera NO borra el aviso — solo reagendar o cancelar", async () => {
    // El riesgo del trigger es el opuesto al que arregla: que borre de más y
    // el aviso desaparezca porque alguien editó una nota.
    await client.query(
      `UPDATE public.appointments
          SET patient_confirmed_at = now(), patient_confirmed_via = 'whatsapp'
        WHERE id = $1`,
      [citaId],
    );
    await client.query(`UPDATE public.appointments SET notes = 'trae radiografía' WHERE id = $1`, [
      citaId,
    ]);

    expect((await leerCita()).patient_confirmed_at).not.toBeNull();
  });

  it("confirmar la cita después del aviso conserva los dos ejes a la vez", async () => {
    await client.query(
      `UPDATE public.appointments
          SET patient_confirmed_at = now(), patient_confirmed_via = 'whatsapp'
        WHERE id = $1`,
      [citaId],
    );
    await comoServicio(
      client,
      `UPDATE public.appointments SET status = 'confirmada' WHERE id = $1`,
      [citaId],
    );

    const cita = await leerCita();
    expect(cita.status).toBe("confirmada");
    expect(cita.confirmed_at).not.toBeNull();
    expect(cita.patient_confirmed_at).not.toBeNull();
  });

  it("solo acepta canales conocidos", async () => {
    await expect(
      client.query(
        `UPDATE public.appointments SET patient_confirmed_at = now(), patient_confirmed_via = 'paloma' WHERE id = $1`,
        [citaId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
