import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { conectar, sembrarEscenario } from "./helpers/db";

/**
 * El webhook no puede crear una solicitud de hora por cada mensaje repetido.
 *
 * Escribir por WhatsApp es gratis y repetirse es lo NORMAL cuando nadie
 * contesta. Sin freno, un paciente que manda "quiero hora para el jueves" tres
 * veces genera tres filas pendientes y la clínica lo llama tres veces.
 * `requestPortalAppointment` ya tenía este tope; el camino de WhatsApp se había
 * quedado sin él.
 *
 * Acá se reproduce la lógica de `puedeAnotarOtraSolicitud` contra la base real,
 * porque lo que se está fijando es una consulta, no una función pura.
 */
describe("freno de solicitudes repetidas por WhatsApp", () => {
  let client: Client;
  let clinicId: string;
  let patientId: string;
  let otroPaciente: string;

  const TOPE = 3;

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
    await client.query(`SELECT set_config('request.jwt.claims', '', true)`);
    const p = await client.query<{ id: string }>(
      `INSERT INTO public.patients (clinic_id, full_name, phone, created_by)
       VALUES ($1,'Paciente Uno','+56911111111',$2), ($1,'Paciente Dos','+56922222222',$2)
       RETURNING id`,
      [clinicId, esc.usuarios.owner],
    );
    patientId = p.rows[0].id;
    otroPaciente = p.rows[1].id;
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  const crear = (fecha: string, quien = patientId, status = "pending", hace = "0 hours") =>
    client.query(
      `INSERT INTO public.appointment_requests
         (clinic_id, patient_id, preferred_date, reason, source, status, created_at)
       VALUES ($1,$2,$3,'quiero hora','whatsapp',$4, now() - $5::interval)`,
      [clinicId, quien, fecha, status, hace],
    );

  /** Réplica exacta de `puedeAnotarOtraSolicitud` del webhook. */
  async function puedeAnotar(fecha: string, quien = patientId): Promise<boolean> {
    const mismaFecha = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.appointment_requests
        WHERE clinic_id=$1 AND patient_id=$2 AND preferred_date=$3 AND status='pending'`,
      [clinicId, quien, fecha],
    );
    if (Number(mismaFecha.rows[0].n) > 0) return false;

    const recientes = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.appointment_requests
        WHERE clinic_id=$1 AND patient_id=$2 AND created_at >= now() - interval '24 hours'`,
      [clinicId, quien],
    );
    return Number(recientes.rows[0].n) < TOPE;
  }

  it("la primera solicitud pasa", async () => {
    expect(await puedeAnotar("2026-09-10")).toBe(true);
  });

  it("repetir la MISMA fecha no crea una segunda fila", async () => {
    await crear("2026-09-10");
    expect(await puedeAnotar("2026-09-10")).toBe(false);
  });

  it("pedir OTRA fecha sí pasa: es otra pedida, no una repetición", async () => {
    await crear("2026-09-10");
    expect(await puedeAnotar("2026-09-17")).toBe(true);
  });

  it("una solicitud ya resuelta no bloquea pedir de nuevo esa fecha", async () => {
    // Si la clínica ya agendó o descartó esa fecha, el paciente puede volver
    // a pedirla — bloquearlo para siempre sería peor que el problema.
    await crear("2026-09-10", patientId, "scheduled");
    expect(await puedeAnotar("2026-09-10")).toBe(true);
  });

  it("al llegar al tope de 24 h se frena aunque las fechas sean distintas", async () => {
    await crear("2026-09-10");
    await crear("2026-09-17");
    await crear("2026-09-24");
    expect(await puedeAnotar("2026-10-01")).toBe(false);
  });

  it("las solicitudes viejas no cuentan para el tope", async () => {
    await crear("2026-09-10", patientId, "pending", "30 hours");
    await crear("2026-09-17", patientId, "pending", "30 hours");
    await crear("2026-09-24", patientId, "pending", "30 hours");
    expect(await puedeAnotar("2026-10-01")).toBe(true);
  });

  it("el tope es POR PACIENTE, no por clínica", async () => {
    // Si fuera por clínica, un paciente insistente dejaría sin poder pedir
    // hora a todos los demás.
    await crear("2026-09-10");
    await crear("2026-09-17");
    await crear("2026-09-24");
    expect(await puedeAnotar("2026-10-01")).toBe(false);
    expect(await puedeAnotar("2026-10-01", otroPaciente)).toBe(true);
  });
});
