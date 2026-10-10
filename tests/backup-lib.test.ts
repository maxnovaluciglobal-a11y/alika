import { describe, expect, it } from "vitest";
import {
  dumpAuthUsers,
  isSafeRelativePath,
  isStorageFolder,
  joinStoragePath,
  listBucketObjects,
  projectAuthUser,
} from "../scripts/backup-lib.mjs";

/**
 * Helpers del backup de auth.users y de Storage (scripts/backup-lib.mjs).
 * Ninguno toca la red: los clientes de Supabase se reemplazan por dobles.
 */

describe("projectAuthUser", () => {
  it("guarda lo necesario para recrear al usuario y nada secreto", () => {
    const out = projectAuthUser({
      id: "u1",
      email: "a@b.cl",
      phone: "",
      created_at: "2026-01-01T00:00:00Z",
      email_confirmed_at: "2026-01-02T00:00:00Z",
      last_sign_in_at: null,
      user_metadata: { full_name: "X" },
      app_metadata: { provider: "google", providers: ["google", "email"] },
      identities: [{ provider: "google" }, { provider: "email" }, { provider: "google" }],
      encrypted_password: "no-deberia-copiarse",
      factors: [{ id: "f" }],
    });

    expect(out.id).toBe("u1");
    expect(out.phone).toBeNull(); // GoTrue devuelve "" cuando no hay teléfono
    expect(out.identity_providers).toEqual(["email", "google"]);
    expect(out.user_metadata).toEqual({ full_name: "X" });
    expect(out).not.toHaveProperty("encrypted_password");
    expect(out).not.toHaveProperty("factors");
  });
});

describe("dumpAuthUsers", () => {
  function fakeAdmin(total: number, failOnPage?: number) {
    const calls: number[] = [];
    return {
      calls,
      auth: {
        admin: {
          async listUsers({ page, perPage }: { page: number; perPage: number }) {
            calls.push(page);
            if (page === failOnPage) return { data: { users: [] }, error: { message: "boom" } };
            const start = (page - 1) * perPage;
            const n = Math.max(0, Math.min(perPage, total - start));
            const users = Array.from({ length: n }, (_, i) => ({ id: `u${start + i}` }));
            return { data: { users }, error: null };
          },
        },
      },
    };
  }

  it("pagina hasta la última página incompleta", async () => {
    const admin = fakeAdmin(5);
    const users = await dumpAuthUsers(admin, 2);
    expect(users.map((u: { id: string }) => u.id)).toEqual(["u0", "u1", "u2", "u3", "u4"]);
    expect(admin.calls).toEqual([1, 2, 3]);
  });

  it("pide una página más cuando el total es múltiplo del tamaño", async () => {
    const admin = fakeAdmin(4);
    expect(await dumpAuthUsers(admin, 2)).toHaveLength(4);
    expect(admin.calls).toEqual([1, 2, 3]);
  });

  it("lanza si falla una página (no devuelve un backup a medias)", async () => {
    await expect(dumpAuthUsers(fakeAdmin(5, 2), 2)).rejects.toThrow(/página 2/);
  });
});

describe("rutas de Storage", () => {
  it("joinStoragePath", () => {
    expect(joinStoragePath("", "a")).toBe("a");
    expect(joinStoragePath("c1/p1", "x.pdf")).toBe("c1/p1/x.pdf");
    expect(joinStoragePath("c1/", "x.pdf")).toBe("c1/x.pdf");
  });

  it("isStorageFolder: carpeta = sin id", () => {
    expect(isStorageFolder({ id: null })).toBe(true);
    expect(isStorageFolder({ id: "abc" })).toBe(false);
  });

  it("isSafeRelativePath rechaza lo que escaparía del directorio", () => {
    expect(isSafeRelativePath("c1/p1/x.pdf")).toBe(true);
    expect(isSafeRelativePath("../etc/passwd")).toBe(false);
    expect(isSafeRelativePath("c1/../../x")).toBe(false);
    expect(isSafeRelativePath("/abs")).toBe(false);
    expect(isSafeRelativePath("a//b")).toBe(false);
    expect(isSafeRelativePath("")).toBe(false);
  });
});

describe("listBucketObjects", () => {
  // Árbol: c1/ → p1/ → {a.pdf, b.png}, c1/ → c.pdf; raíz → r.txt
  const tree: Record<string, Array<{ name: string; id: string | null; metadata?: object }>> = {
    "": [
      { name: "c1", id: null },
      { name: "r.txt", id: "1", metadata: { size: 3, mimetype: "text/plain" } },
    ],
    c1: [
      { name: "c.pdf", id: "2", metadata: { size: 10 } },
      { name: "p1", id: null },
    ],
    "c1/p1": [
      { name: "a.pdf", id: "3" },
      { name: "b.png", id: "4" },
    ],
  };

  function fakeStorage(failPrefix?: string) {
    return {
      from: () => ({
        async list(prefix: string, { limit, offset }: { limit: number; offset: number }) {
          if (prefix === failPrefix) return { data: null, error: { message: "denied" } };
          return { data: (tree[prefix] ?? []).slice(offset, offset + limit), error: null };
        },
      }),
    };
  }

  it("recorre carpetas y páginas", async () => {
    const files = await listBucketObjects(fakeStorage(), "b", 1);
    expect(files.map((f: { path: string }) => f.path).sort()).toEqual([
      "c1/c.pdf",
      "c1/p1/a.pdf",
      "c1/p1/b.png",
      "r.txt",
    ]);
    expect(files.find((f: { path: string }) => f.path === "r.txt")).toMatchObject({
      size: 3,
      mimetype: "text/plain",
    });
  });

  it("lanza si falla el listado de cualquier carpeta", async () => {
    await expect(listBucketObjects(fakeStorage("c1/p1"), "b", 10)).rejects.toThrow(/c1\/p1/);
  });
});
