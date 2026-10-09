import { describe, expect, it } from "vitest";

import {
  debeDesviarANuevaClave,
  esLimitePorCuenta,
  leerRetornoDeRecuperacion,
  mensajeDeErrorDeClave,
  validarNuevaClave,
} from "@/lib/recuperar-clave";

describe("leerRetornoDeRecuperacion", () => {
  it("reconoce el flujo implícito (hash con type=recovery)", () => {
    expect(
      leerRetornoDeRecuperacion("", "#access_token=abc&refresh_token=x&type=recovery"),
    ).toEqual({ tipo: "hash" });
  });

  it("no toma como recuperación un hash de login común", () => {
    expect(leerRetornoDeRecuperacion("", "#access_token=abc&type=signup")).toEqual({
      tipo: "nada",
    });
  });

  it("reconoce el código PKCE", () => {
    expect(leerRetornoDeRecuperacion("?code=123", "")).toEqual({ tipo: "codigo", code: "123" });
  });

  it("reconoce el token_hash de una plantilla propia", () => {
    expect(leerRetornoDeRecuperacion("?token_hash=th&type=recovery", "")).toEqual({
      tipo: "token_hash",
      tokenHash: "th",
      otp: "recovery",
    });
  });

  it("reconoce el enlace de invitación al equipo", () => {
    expect(leerRetornoDeRecuperacion("?token_hash=th&type=invite", "")).toEqual({
      tipo: "token_hash",
      tokenHash: "th",
      otp: "invite",
    });
  });

  it("no acepta otros tipos de token en esta pantalla", () => {
    expect(leerRetornoDeRecuperacion("?token_hash=th&type=signup", "")).toEqual({ tipo: "nada" });
  });

  it("detecta el enlace vencido, venga en el hash o en la query", () => {
    expect(
      leerRetornoDeRecuperacion(
        "",
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
      ),
    ).toEqual({ tipo: "error", codigo: "otp_expired" });
    expect(leerRetornoDeRecuperacion("?error=access_denied", "")).toEqual({
      tipo: "error",
      codigo: "access_denied",
    });
  });

  it("sin nada en la URL no hay enlace", () => {
    expect(leerRetornoDeRecuperacion("", "")).toEqual({ tipo: "nada" });
  });
});

describe("debeDesviarANuevaClave", () => {
  it("desvía un enlace de recuperación que cayó en otra página", () => {
    expect(debeDesviarANuevaClave("/", "#access_token=a&type=recovery")).toBe(true);
  });

  it("no desvía si ya está en la pantalla correcta ni con otros hashes", () => {
    expect(debeDesviarANuevaClave("/auth/nueva-clave", "#access_token=a&type=recovery")).toBe(
      false,
    );
    expect(debeDesviarANuevaClave("/auth", "#access_token=a")).toBe(false);
    expect(debeDesviarANuevaClave("/", "#precios")).toBe(false);
  });
});

describe("validarNuevaClave", () => {
  it("exige el mismo mínimo que el alta de cuenta", () => {
    expect(validarNuevaClave("corta", "corta")).toMatch(/al menos 8/);
  });

  it("exige que coincidan", () => {
    expect(validarNuevaClave("unaClaveLarga1", "otraClaveLarga1")).toMatch(/no coinciden/);
  });

  it("acepta una contraseña válida", () => {
    expect(validarNuevaClave("unaClaveLarga1", "unaClaveLarga1")).toBeNull();
  });
});

describe("errores de Supabase", () => {
  it("el límite por cuenta no se muestra (revelaría que el correo existe)", () => {
    expect(
      esLimitePorCuenta(
        new Error("For security purposes, you can only request this after 37 seconds."),
      ),
    ).toBe(true);
    expect(esLimitePorCuenta(new Error("email rate limit exceeded"))).toBe(false);
  });

  it("traduce los rechazos de updateUser", () => {
    const misma = Object.assign(
      new Error("New password should be different from the old password."),
      { code: "same_password" },
    );
    expect(mensajeDeErrorDeClave(misma)).toMatch(/distinta de la anterior/);
    expect(mensajeDeErrorDeClave(new Error("Password should be at least 6 characters."))).toMatch(
      /débil/,
    );
    expect(mensajeDeErrorDeClave(new Error("otra cosa"))).toBeNull();
  });
});
