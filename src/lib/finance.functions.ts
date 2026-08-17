import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TOOTH_SURFACES } from "@/lib/odontogram";
import { filaYaCreada } from "@/lib/idempotency";
import {
  PAYMENT_METHODS,
  QUOTE_STATUSES,
  TREATMENT_ITEM_STATUSES,
  TREATMENT_PLAN_STATUSES,
  type Payment,
  type Procedure,
  type Quote,
  type QuoteItem,
  type TreatmentItem,
  type TreatmentPlan,
} from "@/lib/finance";

const SURFACE_ENUM = z.enum(TOOTH_SURFACES);
const TOOTH_NUMBER_OPT = z
  .number()
  .int()
  .refine(
    (n) =>
      (n >= 11 && n <= 18) ||
      (n >= 21 && n <= 28) ||
      (n >= 31 && n <= 38) ||
      (n >= 41 && n <= 48) ||
      (n >= 51 && n <= 55) ||
      (n >= 61 && n <= 65) ||
      (n >= 71 && n <= 75) ||
      (n >= 81 && n <= 85),
  )
  .optional();

// ─── PROCEDURES ──────────────────────────────────────────────────────────

const PROCEDURE_COLUMNS =
  "id, code, name, category, default_price_cents, currency, duration_min, is_active";

type ProcedureRow = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  default_price_cents: number;
  currency: string;
  duration_min: number | null;
  is_active: boolean;
};

function mapProcedure(row: ProcedureRow): Procedure {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    defaultPriceCents: row.default_price_cents,
    currency: row.currency,
    durationMin: row.duration_min,
    isActive: row.is_active,
  };
}

export const listProcedures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Procedure[]> => {
    const { data: rows, error } = await context.supabase
      .from("procedures")
      .select(PROCEDURE_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => mapProcedure(r as ProcedureRow));
  });

export const createProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        name: z.string().trim().min(1, "Nombre obligatorio."),
        code: z.string().trim().max(40).optional(),
        category: z.string().trim().max(80).optional(),
        defaultPriceCents: z.number().int().min(0).default(0),
        currency: z.string().length(3).default("CLP"),
        durationMin: z.number().int().min(0).max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: inserted, error } = await context.supabase
      .from("procedures")
      .insert({
        clinic_id: data.clinicId,
        name: data.name,
        code: data.code || null,
        category: data.category || null,
        default_price_cents: data.defaultPriceCents,
        currency: data.currency,
        duration_min: data.durationMin ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error("No tienes permisos para editar el catálogo. " + error.message);
    return { id: inserted.id };
  });

// ─── QUOTES ──────────────────────────────────────────────────────────────

const QUOTE_COLUMNS =
  "id, number, status, currency, subtotal_cents, discount_cents, total_cents, notes, valid_until, sent_at, accepted_at, rejected_at, accepted_by_name, created_at";
const QUOTE_ITEM_COLUMNS =
  "id, quote_id, procedure_id, name_snapshot, tooth_number, surface, quantity, unit_price_cents, discount_cents, total_cents, position, notes";

type QuoteRow = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  accepted_by_name: string | null;
  created_at: string;
};
type QuoteItemRow = {
  id: string;
  quote_id: string;
  procedure_id: string | null;
  name_snapshot: string;
  tooth_number: number | null;
  surface: string | null;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
  position: number;
  notes: string | null;
};

function mapQuoteItem(row: QuoteItemRow): QuoteItem {
  return {
    id: row.id,
    procedureId: row.procedure_id,
    nameSnapshot: row.name_snapshot,
    toothNumber: row.tooth_number,
    surface: row.surface as QuoteItem["surface"],
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    position: row.position,
    notes: row.notes,
  };
}

function mapQuote(row: QuoteRow, items: QuoteItem[]): Quote {
  return {
    id: row.id,
    number: row.number,
    status: row.status as Quote["status"],
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    notes: row.notes,
    validUntil: row.valid_until,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
    acceptedByName: row.accepted_by_name,
    createdAt: row.created_at,
    items,
  };
}

/** Presupuestos del paciente, con sus ítems anidados. */
export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Quote[]> => {
    const { supabase } = context;

    const { data: quoteRows, error } = await supabase
      .from("quotes")
      .select(QUOTE_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const quotes = (quoteRows ?? []) as QuoteRow[];
    if (!quotes.length) return [];

    const { data: itemRows, error: itemsError } = await supabase
      .from("quote_items")
      .select(QUOTE_ITEM_COLUMNS)
      .in(
        "quote_id",
        quotes.map((q) => q.id),
      )
      .order("position", { ascending: true });

    if (itemsError) throw new Error(itemsError.message);

    const itemsByQuote = new Map<string, QuoteItem[]>();
    for (const it of (itemRows ?? []) as QuoteItemRow[]) {
      const arr = itemsByQuote.get(it.quote_id) ?? [];
      arr.push(mapQuoteItem(it));
      itemsByQuote.set(it.quote_id, arr);
    }
    return quotes.map((q) => mapQuote(q, itemsByQuote.get(q.id) ?? []));
  });

const QuoteItemInput = z.object({
  procedureId: z.string().uuid().optional(),
  nameSnapshot: z.string().trim().min(1, "Nombre del ítem obligatorio."),
  toothNumber: TOOTH_NUMBER_OPT,
  surface: SURFACE_ENUM.optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
  notes: z.string().trim().max(300).optional(),
});

/**
 * Crea un presupuesto con sus ítems. Genera un número correlativo por clínica
 * si no se especifica uno. Cada ítem calcula su total como
 * qty*unit - discount, y el subtotal/total del quote se derivan.
 */
export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        currency: z.string().length(3).default("CLP"),
        notes: z.string().trim().max(1000).optional(),
        validUntil: z.string().optional(),
        globalDiscountCents: z.number().int().min(0).default(0),
        items: z.array(QuoteItemInput).min(1, "Agrega al menos un ítem."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string; number: string }> => {
    const { supabase } = context;

    // Correlativo atómico via RPC SECURITY DEFINER. Reset por año en tz de
    // la clínica (evita que un quote creado a las 22:00 del 31-dic en Chile
    // lleve el año siguiente porque el server está en UTC).
    const { data: clinic } = await supabase
      .from("clinics")
      .select("timezone")
      .eq("id", data.clinicId)
      .maybeSingle();
    const tz = clinic?.timezone || "America/Santiago";
    const year = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric" }).format(new Date()),
    );

    const { data: nextValue, error: rpcErr } = await supabase.rpc("next_clinic_counter", {
      p_clinic_id: data.clinicId,
      p_kind: "quote",
      p_year: year,
    });
    if (rpcErr) throw new Error("No pudimos generar el número de presupuesto. " + rpcErr.message);
    const nextNumber = `P-${year}-${String(nextValue as number).padStart(4, "0")}`;

    const itemsWithTotals = data.items.map((it, i) => {
      const total = Math.max(0, it.quantity * it.unitPriceCents - it.discountCents);
      return { ...it, position: i, total };
    });
    const subtotal = itemsWithTotals.reduce((s, it) => s + it.total, 0);
    const total = Math.max(0, subtotal - data.globalDiscountCents);

    const { data: quoteRow, error: qErr } = await supabase
      .from("quotes")
      .insert({
        clinic_id: data.clinicId,
        patient_id: data.patientId,
        number: nextNumber,
        currency: data.currency,
        notes: data.notes || null,
        valid_until: data.validUntil || null,
        subtotal_cents: subtotal,
        discount_cents: data.globalDiscountCents,
        total_cents: total,
      })
      .select("id, number")
      .single();

    if (qErr) throw new Error("No pudimos crear el presupuesto. " + qErr.message);

    const { error: iErr } = await supabase.from("quote_items").insert(
      itemsWithTotals.map((it) => ({
        clinic_id: data.clinicId,
        quote_id: quoteRow.id,
        procedure_id: it.procedureId ?? null,
        name_snapshot: it.nameSnapshot,
        tooth_number: it.toothNumber ?? null,
        surface: it.surface ?? null,
        quantity: it.quantity,
        unit_price_cents: it.unitPriceCents,
        discount_cents: it.discountCents,
        total_cents: it.total,
        position: it.position,
        notes: it.notes || null,
      })),
    );

    if (iErr) {
      // Best-effort rollback manual (no hay transacciones cross-request en la
      // API PostgREST). Borrar el quote arrastra sus items por FK CASCADE si
      // los llegó a insertar.
      await supabase.from("quotes").delete().eq("id", quoteRow.id);
      throw new Error("No pudimos guardar los ítems del presupuesto. " + iErr.message);
    }

    return { id: quoteRow.id, number: quoteRow.number };
  });

/**
 * Cambia el estado de un presupuesto. Cuando se marca como 'accepted', el
 * trigger de base convierte el quote en un plan de tratamiento con sus ítems.
 */
export const setQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        quoteId: z.string().uuid(),
        status: z.enum(QUOTE_STATUSES),
        acceptedByName: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch = {
      status: data.status,
      ...(data.status === "sent" && { sent_at: now }),
      ...(data.status === "accepted" && { accepted_at: now }),
      ...(data.status === "accepted" &&
        data.acceptedByName && { accepted_by_name: data.acceptedByName }),
      ...(data.status === "rejected" && { rejected_at: now }),
    };

    const { error } = await context.supabase.from("quotes").update(patch).eq("id", data.quoteId);
    if (error) throw new Error("No tienes permisos para cambiar este presupuesto.");
    return { ok: true };
  });

// ─── TREATMENT PLANS ─────────────────────────────────────────────────────

const PLAN_COLUMNS =
  "id, quote_id, name, status, total_cents, currency, started_at, completed_at, notes, created_at";
const ITEM_COLUMNS =
  "id, procedure_id, quote_item_id, name_snapshot, tooth_number, surface, status, price_cents, position, professional_id, scheduled_appointment_id, completed_at, notes";

type PlanRow = {
  id: string;
  quote_id: string | null;
  name: string;
  status: string;
  total_cents: number;
  currency: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
};
type PlanItemRow = {
  id: string;
  procedure_id: string | null;
  quote_item_id: string | null;
  name_snapshot: string;
  tooth_number: number | null;
  surface: string | null;
  status: string;
  price_cents: number;
  position: number;
  professional_id: string | null;
  scheduled_appointment_id: string | null;
  completed_at: string | null;
  notes: string | null;
};

function mapPlanItem(row: PlanItemRow): TreatmentItem {
  return {
    id: row.id,
    procedureId: row.procedure_id,
    quoteItemId: row.quote_item_id,
    nameSnapshot: row.name_snapshot,
    toothNumber: row.tooth_number,
    surface: row.surface as TreatmentItem["surface"],
    status: row.status as TreatmentItem["status"],
    priceCents: row.price_cents,
    position: row.position,
    professionalId: row.professional_id,
    scheduledAppointmentId: row.scheduled_appointment_id,
    completedAt: row.completed_at,
    notes: row.notes,
  };
}

function mapPlan(row: PlanRow, items: TreatmentItem[]): TreatmentPlan {
  return {
    id: row.id,
    quoteId: row.quote_id,
    name: row.name,
    status: row.status as TreatmentPlan["status"],
    totalCents: row.total_cents,
    currency: row.currency,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
    createdAt: row.created_at,
    items,
  };
}

/** Planes de tratamiento del paciente con sus ítems. */
export const listTreatmentPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<TreatmentPlan[]> => {
    const { supabase } = context;

    const { data: planRows, error } = await supabase
      .from("treatment_plans")
      .select(PLAN_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const plans = (planRows ?? []) as PlanRow[];
    if (!plans.length) return [];

    const { data: itemRows, error: itemsError } = await supabase
      .from("treatment_items")
      .select("plan_id, " + ITEM_COLUMNS)
      .in(
        "plan_id",
        plans.map((p) => p.id),
      )
      .order("position", { ascending: true });

    if (itemsError) throw new Error(itemsError.message);

    const itemsByPlan = new Map<string, TreatmentItem[]>();
    for (const it of (itemRows ?? []) as unknown as (PlanItemRow & { plan_id: string })[]) {
      const arr = itemsByPlan.get(it.plan_id) ?? [];
      arr.push(mapPlanItem(it));
      itemsByPlan.set(it.plan_id, arr);
    }
    return plans.map((p) => mapPlan(p, itemsByPlan.get(p.id) ?? []));
  });

/** Listado a nivel clínica para la vista /tratamientos. No trae los items
 * enteros — solo el conteo + completados para computar avance. Esto lo hace
 * viable con volumen alto (evita traer miles de items para pintar barras de
 * progreso). Si necesitas el detalle de un plan, el usuario abre la ficha
 * del paciente y ahí sí se hidrata con listTreatmentPlans(patientId).
 *
 * treatment_plans no tiene professional_id ni branch_id en el schema —
 * la asignación es a nivel item — así que la vista solo filtra por
 * estado, fecha y búsqueda de texto en nombre del plan o del paciente.
 */
export const listClinicTreatmentPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      Array<{
        id: string;
        name: string;
        patientId: string;
        patientName: string;
        patientDocument: string | null;
        status: TreatmentPlan["status"];
        currency: string;
        createdAt: string;
        startedAt: string | null;
        totalCents: number;
        itemsCount: number;
        itemsCompleted: number;
      }>
    > => {
      const { supabase } = context;

      const { data: planRows, error } = await supabase
        .from("treatment_plans")
        .select("id, name, patient_id, status, total_cents, currency, started_at, created_at")
        .eq("clinic_id", data.clinicId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw new Error(error.message);
      const plans = planRows ?? [];
      if (!plans.length) return [];

      const patientIds = [...new Set(plans.map((p) => p.patient_id))];
      const planIds = plans.map((p) => p.id);

      const [{ data: patients, error: pErr }, { data: items, error: iErr }] = await Promise.all([
        supabase
          .from("patients")
          .select("id, full_name, document_id")
          .eq("clinic_id", data.clinicId)
          .in("id", patientIds),
        supabase
          .from("treatment_items")
          .select("plan_id, status")
          .eq("clinic_id", data.clinicId)
          .in("plan_id", planIds),
      ]);
      if (pErr) throw new Error(pErr.message);
      if (iErr) throw new Error(iErr.message);

      const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

      const countsByPlan = new Map<string, { total: number; completed: number }>();
      for (const it of items ?? []) {
        const c = countsByPlan.get(it.plan_id) ?? { total: 0, completed: 0 };
        c.total += 1;
        if (it.status === "completed") c.completed += 1;
        countsByPlan.set(it.plan_id, c);
      }

      return plans.map((p) => {
        const patient = patientById.get(p.patient_id);
        const counts = countsByPlan.get(p.id) ?? { total: 0, completed: 0 };
        return {
          id: p.id,
          name: p.name,
          patientId: p.patient_id,
          patientName: patient?.full_name ?? "Paciente",
          patientDocument: patient?.document_id ?? null,
          status: p.status as TreatmentPlan["status"],
          currency: p.currency,
          createdAt: p.created_at,
          startedAt: p.started_at,
          totalCents: p.total_cents,
          itemsCount: counts.total,
          itemsCompleted: counts.completed,
        };
      });
    },
  );

export const setTreatmentItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemId: z.string().uuid(), status: z.enum(TREATMENT_ITEM_STATUSES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const isCompleted = data.status === "completed";
    // Al completar registramos quién y cuándo. Al des-completar limpiamos
    // ambos campos para no dejar auditoría inconsistente.
    const patch = isCompleted
      ? { status: data.status, completed_at: new Date().toISOString(), completed_by: userId }
      : { status: data.status, completed_at: null, completed_by: null };
    const { error } = await context.supabase
      .from("treatment_items")
      .update(patch)
      .eq("id", data.itemId);
    if (error) throw new Error("No pudimos actualizar el ítem.");
    return { ok: true };
  });

export const setTreatmentPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.string().uuid(), status: z.enum(TREATMENT_PLAN_STATUSES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      status: data.status,
      ...(data.status === "completed" && { completed_at: new Date().toISOString() }),
    };
    const { error } = await context.supabase
      .from("treatment_plans")
      .update(patch)
      .eq("id", data.planId);
    if (error) throw new Error("No pudimos actualizar el plan.");
    return { ok: true };
  });

// ─── PAYMENTS ────────────────────────────────────────────────────────────

const PAYMENT_COLUMNS =
  "id, amount_cents, currency, method, reference, paid_at, notes, treatment_plan_id, treatment_item_id, created_by";

type PaymentRow = {
  id: string;
  amount_cents: number;
  currency: string;
  method: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  treatment_plan_id: string | null;
  treatment_item_id: string | null;
  created_by: string;
};

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    method: row.method as Payment["method"],
    reference: row.reference,
    paidAt: row.paid_at,
    notes: row.notes,
    treatmentPlanId: row.treatment_plan_id,
    treatmentItemId: row.treatment_item_id,
    createdById: row.created_by,
  };
}

/** Pagos del paciente ordenados del más reciente al más viejo. */
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Payment[]> => {
    const { data: rows, error } = await context.supabase
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .order("paid_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => mapPayment(r as PaymentRow));
  });

export const registerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // Igual que en `createAppointment`: lo genera el equipo al capturar
        // sin conexión, para que reintentar la cola no cobre dos veces.
        id: z.string().uuid().optional(),
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        amountCents: z.number().int().positive("El monto debe ser mayor a cero."),
        currency: z.string().length(3).default("CLP"),
        method: z.enum(PAYMENT_METHODS).default("cash"),
        reference: z.string().trim().max(120).optional(),
        paidAt: z
          .string()
          .optional()
          .refine((s) => !s || !Number.isNaN(new Date(s).getTime()), "Fecha de pago inválida.")
          .refine(
            (s) => !s || new Date(s) <= new Date(),
            "No se puede registrar un pago con fecha futura.",
          ),
        notes: z.string().trim().max(500).optional(),
        treatmentPlanId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: inserted, error } = await context.supabase
      .from("payments")
      .insert({
        ...(data.id ? { id: data.id } : {}),
        clinic_id: data.clinicId,
        patient_id: data.patientId,
        amount_cents: data.amountCents,
        currency: data.currency,
        method: data.method,
        reference: data.reference || null,
        // ⚠️ Este `new Date()` es la hora del SERVIDOR al procesar. Un cobro
        // capturado sin conexión a las 10:00 que sincroniza a las 15:00
        // quedaría con la hora equivocada y rompería el cierre de caja del
        // día. Por eso la cola offline SIEMPRE manda `paidAt` sellado en la
        // captura; este default es solo para el camino online.
        paid_at: data.paidAt ?? new Date().toISOString(),
        notes: data.notes || null,
        treatment_plan_id: data.treatmentPlanId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      const yaEstaba = await filaYaCreada(
        context.supabase,
        "payments",
        data.id,
        data.clinicId,
        error,
      );
      if (yaEstaba) return { id: yaEstaba };
      throw new Error("No tienes permisos para registrar pagos. " + error.message);
    }
    return { id: inserted.id };
  });

// getPatientBalance eliminado: era dead code. El cálculo del saldo del
// paciente vive en dos lugares —server-side en `getPatient` (para el header
// de la ficha) y client-side en FinanceSection (sobre listPayments +
// listTreatmentPlans). Ambos aplican la misma regla: excluir planes
// cancelados. Si en el futuro necesitamos exponer el balance como endpoint
// separado (portal del paciente, dashboard financiero), reintroducir aquí.
