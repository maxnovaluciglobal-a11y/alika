import { describe, expect, it } from "vitest";

import { destinatariosStaff } from "@/lib/marketing/notify-lead.server";

describe("destinatarios del aviso de lead", () => {
  it("usa LEADS_NOTIFY_EMAILS aunque la allowlist de /admin tenga más correos", () => {
    expect(
      destinatariosStaff({
        ALIKA_STAFF_EMAILS: "personal@gmail.com, empresa@gmail.com",
        LEADS_NOTIFY_EMAILS: "empresa@gmail.com",
      }),
    ).toEqual(["empresa@gmail.com"]);
  });

  it("sin la variable propia, cae a ALIKA_STAFF_EMAILS", () => {
    expect(destinatariosStaff({ ALIKA_STAFF_EMAILS: "a@x.com,b@x.com" })).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
    expect(
      destinatariosStaff({ ALIKA_STAFF_EMAILS: "a@x.com", LEADS_NOTIFY_EMAILS: "  " }),
    ).toEqual(["a@x.com"]);
  });
});
