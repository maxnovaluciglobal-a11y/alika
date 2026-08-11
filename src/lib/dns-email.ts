/**
 * Asistente de autenticación de dominio de email (SPF, DKIM y DMARC).
 *
 * Este módulo es client-safe: define los pasos, evalúa las respuestas DNS y
 * guarda el resultado de la última verificación, que es la que habilita (o no)
 * el paso a producción en el sandbox de email.
 */

export type DnsCheckId = "spf" | "dkim" | "dmarc";

export type DnsCheckState = "pass" | "warn" | "fail";

export type DnsCheckResult = {
  id: DnsCheckId;
  /** Nombre consultado en DNS. */
  name: string;
  state: DnsCheckState;
  /** Explicación en lenguaje claro de lo que se encontró. */
  detalle: string;
  /** Registros TXT encontrados en ese nombre. */
  records: string[];
  /** Qué hacer si no pasa. */
  sugerencia: string | null;
};

export type DnsVerification = {
  domain: string;
  dkimSelector: string;
  checkedAt: string;
  durationMs: number;
  results: DnsCheckResult[];
  /** true solo si SPF, DKIM y DMARC están correctos (warn permitido en DMARC p=none). */
  aprobado: boolean;
};

export const PASOS_ASISTENTE: {
  id: DnsCheckId;
  titulo: string;
  porQue: string;
  comoSeArregla: string;
}[] = [
  {
    id: "spf",
    titulo: "SPF — quién puede enviar por ti",
    porQue:
      "Declara qué servidores están autorizados a enviar correo con tu dominio. Sin SPF, los proveedores tratan tus avisos clínicos como sospechosos.",
    comoSeArregla:
      "Publica un único registro TXT en la raíz del dominio con `v=spf1` e incluye el servicio de envío. Nunca publiques dos registros SPF: uno solo, con todos los `include:` necesarios.",
  },
  {
    id: "dkim",
    titulo: "DKIM — firma criptográfica del mensaje",
    porQue:
      "Firma cada email con una clave privada; el receptor la valida con la clave pública publicada en DNS. Es lo que evita que alguien suplante tus notificaciones.",
    comoSeArregla:
      "Publica el TXT del selector que te dé tu servicio de envío en `<selector>._domainkey.tudominio.com`, con la clave pública (`p=...`) completa y sin saltos de línea.",
  },
  {
    id: "dmarc",
    titulo: "DMARC — política y reportes",
    porQue:
      "Le dice al receptor qué hacer cuando SPF o DKIM fallan y a dónde enviar los reportes. Es el requisito que más frena la entregabilidad cuando falta.",
    comoSeArregla:
      "Publica un TXT en `_dmarc.tudominio.com` con `v=DMARC1; p=quarantine; rua=mailto:dmarc@tudominio.com`. Empieza en `p=none` para observar y sube a `quarantine` o `reject` cuando los reportes estén limpios.",
  },
];

export function normalizarDominio(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^@/, "");
}

export function esDominioValido(valor: string) {
  return /^(?=.{4,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(normalizarDominio(valor));
}

/* ------------------------------ Evaluadores ------------------------------ */

export function evaluarSpf(name: string, records: string[]): DnsCheckResult {
  const spf = records.filter((r) => r.toLowerCase().startsWith("v=spf1"));

  if (spf.length === 0) {
    return {
      id: "spf",
      name,
      state: "fail",
      detalle: "No se encontró ningún registro SPF en la raíz del dominio.",
      records,
      sugerencia: "Publica un TXT que empiece por `v=spf1` y termine en `~all` o `-all`.",
    };
  }

  if (spf.length > 1) {
    return {
      id: "spf",
      name,
      state: "fail",
      detalle: `Hay ${spf.length} registros SPF. Con más de uno la validación falla siempre.`,
      records: spf,
      sugerencia: "Combina todos los `include:` en un único registro TXT.",
    };
  }

  const valor = spf[0];
  if (!/\b(-all|~all)\b/.test(valor)) {
    return {
      id: "spf",
      name,
      state: "warn",
      detalle: "El SPF existe pero no termina en `-all` ni `~all`, así que no rechaza suplantaciones.",
      records: spf,
      sugerencia: "Cierra el registro con `~all` (o `-all` cuando estés seguro del listado).",
    };
  }

  return {
    id: "spf",
    name,
    state: "pass",
    detalle: "SPF publicado correctamente y con política de cierre.",
    records: spf,
    sugerencia: null,
  };
}

export function evaluarDkim(name: string, records: string[]): DnsCheckResult {
  const dkim = records.filter((r) => /(^|;|\s)p=/.test(r));

  if (records.length === 0) {
    return {
      id: "dkim",
      name,
      state: "fail",
      detalle: "No hay ningún registro en el selector DKIM indicado.",
      records,
      sugerencia: "Revisa que el selector sea el que te entregó tu servicio de envío.",
    };
  }

  if (dkim.length === 0) {
    return {
      id: "dkim",
      name,
      state: "fail",
      detalle: "El selector existe pero no contiene una clave pública (`p=`).",
      records,
      sugerencia: "Vuelve a copiar el valor completo del registro, sin cortes ni espacios.",
    };
  }

  const clave = dkim[0].match(/p=([A-Za-z0-9+/=]+)/)?.[1] ?? "";
  if (clave.length < 100) {
    return {
      id: "dkim",
      name,
      state: "warn",
      detalle: "La clave pública parece truncada.",
      records: dkim,
      sugerencia: "Pega el valor completo; muchos paneles cortan el TXT a 255 caracteres.",
    };
  }

  return {
    id: "dkim",
    name,
    state: "pass",
    detalle: "DKIM publicado con clave pública válida.",
    records: dkim,
    sugerencia: null,
  };
}

export function evaluarDmarc(name: string, records: string[]): DnsCheckResult {
  const dmarc = records.filter((r) => r.toLowerCase().startsWith("v=dmarc1"));

  if (dmarc.length === 0) {
    return {
      id: "dmarc",
      name,
      state: "fail",
      detalle: "No hay política DMARC publicada.",
      records,
      sugerencia: "Publica `v=DMARC1; p=quarantine; rua=mailto:dmarc@tudominio.com` en `_dmarc`.",
    };
  }

  const valor = dmarc[0];
  const politica = valor.match(/\bp=(none|quarantine|reject)\b/i)?.[1]?.toLowerCase();

  if (!politica) {
    return {
      id: "dmarc",
      name,
      state: "fail",
      detalle: "El registro DMARC no declara una política `p=`.",
      records: dmarc,
      sugerencia: "Añade `p=none` para observar o `p=quarantine` para proteger.",
    };
  }

  if (politica === "none") {
    return {
      id: "dmarc",
      name,
      state: "warn",
      detalle: "DMARC está en modo observación (`p=none`): no protege todavía, pero es válido para arrancar.",
      records: dmarc,
      sugerencia: "Cuando los reportes estén limpios, sube a `p=quarantine`.",
    };
  }

  return {
    id: "dmarc",
    name,
    state: "pass",
    detalle: `DMARC activo con política \`p=${politica}\`.`,
    records: dmarc,
    sugerencia: null,
  };
}

/** Un dominio pasa cuando ningún control falla; los avisos no bloquean. */
export function calcularAprobado(results: DnsCheckResult[]) {
  return results.length === 3 && results.every((r) => r.state !== "fail");
}

/* --------------------------- Estado persistido --------------------------- */

const STORAGE_KEY = "oralia:email-dns-verification";

export function leerVerificacion(): DnsVerification | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(STORAGE_KEY);
    return crudo ? (JSON.parse(crudo) as DnsVerification) : null;
  } catch {
    return null;
  }
}

export function guardarVerificacion(verificacion: DnsVerification) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(verificacion));
}

/** Horas tras las cuales una verificación se considera caducada. */
export const VIGENCIA_HORAS = 24;

export function verificacionVigente(v: DnsVerification | null): boolean {
  if (!v || !v.aprobado) return false;
  const edadHoras = (Date.now() - new Date(v.checkedAt).getTime()) / 3_600_000;
  return edadHoras < VIGENCIA_HORAS;
}

/**
 * Puerta de producción: sin verificación DNS vigente y aprobada, el sandbox no
 * puede desactivarse.
 */
export function puedeActivarProduccion(v: DnsVerification | null): {
  permitido: boolean;
  motivo: string;
} {
  if (!v) {
    return {
      permitido: false,
      motivo:
        "Aún no has verificado SPF, DKIM y DMARC. Ejecuta el asistente de dominio antes de activar producción.",
    };
  }
  if (!v.aprobado) {
    const fallidos = v.results.filter((r) => r.state === "fail").map((r) => r.id.toUpperCase());
    return {
      permitido: false,
      motivo: `La última verificación de ${v.domain} falló en ${fallidos.join(", ")}. Corrige el DNS y vuelve a validar.`,
    };
  }
  if (!verificacionVigente(v)) {
    return {
      permitido: false,
      motivo: `La verificación de ${v.domain} tiene más de ${VIGENCIA_HORAS} h. Vuelve a validar el dominio antes de enviar en producción.`,
    };
  }
  return {
    permitido: true,
    motivo: `Dominio ${v.domain} verificado: SPF, DKIM y DMARC en regla.`,
  };
}
