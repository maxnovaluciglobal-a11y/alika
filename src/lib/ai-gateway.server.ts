/**
 * Capa de IA del servidor. Requiere una API key propia:
 *
 *   1. GEMINI_API_KEY   → Google AI (endpoint compatible con OpenAI)
 *   2. OPENAI_API_KEY   → OpenAI
 *
 * Se puede forzar el proveedor con AI_PROVIDER=gemini|openai y el modelo con
 * AI_MODEL (o GEMINI_MODEL / OPENAI_MODEL). Si no hay ninguna clave cargada,
 * `resolverProveedorIa()` devuelve null y las features de IA quedan apagadas.
 */

export type AiProvider = "gemini" | "openai";

type ProviderConfig = {
  provider: AiProvider;
  apiKey: string;
  url: string;
  headers: Record<string, string>;
  model: string;
};

const DEFAULTS: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
};

/** Normaliza un id con prefijo de vendor (`vendor/modelo`) a un modelo directo. */
function sinPrefijo(model: string) {
  return model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
}

/** Proveedor disponible según las variables de entorno (se lee en runtime). */
export function resolverProveedorIa(modelSolicitado?: string): ProviderConfig | null {
  const forzado = process.env.AI_PROVIDER as AiProvider | undefined;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const modelEnv = process.env.AI_MODEL;

  const usar = (p: AiProvider): ProviderConfig | null => {
    if (p === "gemini" && geminiKey) {
      return {
        provider: "gemini",
        apiKey: geminiKey,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: { Authorization: `Bearer ${geminiKey}` },
        model: sinPrefijo(
          process.env.GEMINI_MODEL ?? modelEnv ?? modelSolicitado ?? DEFAULTS.gemini,
        ),
      };
    }
    if (p === "openai" && openaiKey) {
      return {
        provider: "openai",
        apiKey: openaiKey,
        url: "https://api.openai.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${openaiKey}` },
        model: sinPrefijo(process.env.OPENAI_MODEL ?? modelEnv ?? DEFAULTS.openai),
      };
    }
    return null;
  };

  if (forzado) return usar(forzado);
  return usar("gemini") ?? usar("openai");
}

/** Diagnóstico legible para la UI/configuración, sin exponer valores de claves. */
export function estadoProveedorIa() {
  const cfg = resolverProveedorIa();
  return cfg
    ? { configurado: true as const, provider: cfg.provider, model: cfg.model }
    : { configurado: false as const, provider: null, model: null };
}

/** Llamada mínima de chat completions, agnóstica del proveedor. */
export async function gatewayChat(options: {
  system: string;
  user: string;
  model?: string;
  json?: boolean;
}): Promise<string> {
  const cfg = resolverProveedorIa(options.model);
  if (!cfg) {
    throw new Error("No hay IA configurada. Define GEMINI_API_KEY o OPENAI_API_KEY.");
  }

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cfg.headers,
    },
    body: JSON.stringify({
      model: cfg.model,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    console.error("AI auth error", cfg.provider, res.status);
    throw new Error(
      `La clave de IA de ${cfg.provider} fue rechazada. Revisa la variable de entorno correspondiente.`,
    );
  }
  if (res.status === 429) {
    throw new Error("La IA está recibiendo muchas solicitudes. Intenta en unos segundos.");
  }
  if (res.status === 402) {
    throw new Error("Tu cuenta del proveedor de IA no tiene saldo disponible.");
  }
  if (!res.ok) {
    const detail = await res.text();
    console.error("AI provider error", cfg.provider, res.status, detail);
    throw new Error("No pudimos generar el texto con IA en este momento.");
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("La IA devolvió una respuesta vacía.");
  return text;
}
