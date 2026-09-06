// Exporta todas las filas de todas las tablas de negocio a un único JSON
// gzipeado. El esquema (tablas, columnas, triggers, RLS) ya vive versionado
// en supabase/migrations/ — lo que este script respalda es la DATA, que no
// está en git.
//
// Deliberadamente usa la API REST de Supabase (service role, bypassa RLS) en
// vez de pg_dump: no depende de la contraseña directa de Postgres (rota sin
// aviso, ver alika_backups_offsite en memoria), corre desde cualquier lado
// (CI, laptop) sin más que la URL + service role key, y esas dos ya son
// secretos de despliegue existentes (Vercel), no uno nuevo.
//
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-data.mjs > backup.json.gz
import { createClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";

// Mantener sincronizada con las migraciones — agregar acá cuando una
// migración nueva cree una tabla de negocio.
const TABLES = [
  "agreement_coverage",
  "agreements",
  "appointment_requests",
  "appointment_statuses",
  "appointments",
  "branches",
  "clinic_counters",
  "clinic_members",
  "clinical_note_audit",
  "clinical_note_entities",
  "clinical_note_reviews",
  "clinical_note_versions",
  "clinical_notes",
  "clinics",
  "commission_rules",
  "commission_settlements",
  "consent_templates",
  "email_sandbox_config",
  "expenses",
  "inventory_items",
  "inventory_movements",
  "inventory_stock",
  "lab_orders",
  "labs",
  "message_templates",
  "messages",
  "notification_preferences",
  "notifications",
  "odontogram_marks",
  "operatories",
  "patient_consents",
  "patient_documents",
  "patient_medical_history",
  "patient_medical_history_audit",
  "patients",
  "payment_methods",
  "payments",
  "periodontal_charts",
  "periodontal_measurements",
  "portal_access_log",
  "procedures",
  "professional_schedules",
  "professionals",
  "profiles",
  "quote_items",
  "quotes",
  "specialties",
  "stripe_events",
  "subscriptions",
  "treatment_items",
  "treatment_plans",
  "waitlist_entries",
  "warehouses",
  "whatsapp_accounts",
  "whatsapp_leads",
];

const PAGE_SIZE = 1000;

async function dumpTable(admin, table) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const dump = { exportedAt: new Date().toISOString(), tables: {} };
  let totalRows = 0;

  for (const table of TABLES) {
    dump.tables[table] = await dumpTable(admin, table);
    totalRows += dump.tables[table].length;
  }

  process.stderr.write(`Respaldadas ${TABLES.length} tablas, ${totalRows} filas totales.\n`);
  process.stdout.write(gzipSync(Buffer.from(JSON.stringify(dump))));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
