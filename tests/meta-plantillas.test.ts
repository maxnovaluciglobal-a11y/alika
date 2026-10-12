import { describe, expect, it } from "vitest";

import {
  cifrarCredencial,
  descifrarCredencial,
  nuevoPinWhatsApp,
} from "@/lib/messaging/credenciales-whatsapp.server";
import {
  cuerpoConVariables,
  estadoPlantillaDesdeMeta,
  payloadPlantillaMeta,
  PLANTILLAS_META,
  type KindConPlantillaMeta,
} from "@/lib/messaging/meta-plantillas";
import { META_TEMPLATE_PARAM_ORDER } from "@/lib/messaging/whatsapp";

const VOSEO =
  /(?<!\p{L})(?:respondé|tenés|podés|escribinos|avisanos|contame|dejás|buscanos)(?!\p{L})/iu;

describe("plantillas de Meta", () => {
  const kinds = Object.keys(PLANTILLAS_META) as KindConPlantillaMeta[];

  it("hay una plantilla por cada kind con envío por API", () => {
    expect(kinds.sort()).toEqual(Object.keys(META_TEMPLATE_PARAM_ORDER).sort());
  });

  it.each(kinds)("%s cumple las reglas de Meta", (kind) => {
    const p = PLANTILLAS_META[kind];
    const variables = [...p.cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    // Una variable por parámetro, numeradas 1..n y en orden.
    expect(variables).toEqual(META_TEMPLATE_PARAM_ORDER[kind].map((_, i) => i + 1));
    expect(p.ejemplos).toHaveLength(variables.length);
    // Meta rechaza plantillas que empiezan o terminan con una variable.
    expect(p.cuerpo.trim()).not.toMatch(/^\{\{\d+\}\}/);
    expect(p.cuerpo.trim()).not.toMatch(/\{\{\d+\}\}[.!?]?$/);
    expect(p.nombre).toMatch(/^[a-z0-9_]{1,512}$/);
    expect(p.cuerpo.length).toBeLessThanOrEqual(1024);
    expect(p.cuerpo).not.toMatch(VOSEO);
  });

  it("los nombres no se repiten", () => {
    const nombres = kinds.map((k) => PLANTILLAS_META[k].nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("arma el payload de la Graph API", () => {
    const payload = payloadPlantillaMeta("payment_due");
    expect(payload).toMatchObject({
      name: "esmalia_saldo_pendiente_v1",
      language: "es",
      category: "UTILITY",
    });
    expect(payload.components[0].example.body_text[0]).toHaveLength(3);
  });

  it("traduce el texto a variables con nombre para el envío manual", () => {
    expect(cuerpoConVariables("payment_due")).toContain("{paciente}");
    expect(cuerpoConVariables("payment_due")).toContain("{saldo}");
    expect(cuerpoConVariables("payment_due")).not.toMatch(/\{\{\d+\}\}/);
  });

  it("mapea los estados que informa Meta", () => {
    expect(estadoPlantillaDesdeMeta("APPROVED")).toBe("approved");
    expect(estadoPlantillaDesdeMeta("REJECTED")).toBe("rejected");
    expect(estadoPlantillaDesdeMeta("PENDING")).toBe("pending");
  });
});

describe("credenciales de WhatsApp", () => {
  const env = {
    WHATSAPP_CREDENTIALS_KEY: Buffer.alloc(32, 7).toString("base64"),
  } as NodeJS.ProcessEnv;

  it("cifra y descifra sin dejar el texto a la vista", () => {
    const cifrado = cifrarCredencial("EAAB-token-de-prueba", env);
    expect(cifrado).not.toContain("EAAB");
    expect(descifrarCredencial(cifrado, env)).toBe("EAAB-token-de-prueba");
  });

  it("detecta una credencial alterada", () => {
    const partes = cifrarCredencial("otro-token", env).split(".");
    partes[3] = Buffer.from("manipulado").toString("base64url");
    expect(() => descifrarCredencial(partes.join("."), env)).toThrow();
  });

  it("rechaza una clave de largo incorrecto", () => {
    expect(() =>
      cifrarCredencial("x", { WHATSAPP_CREDENTIALS_KEY: "corta" } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("genera PIN de 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(nuevoPinWhatsApp()).toMatch(/^\d{6}$/);
  });
});
