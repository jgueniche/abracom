import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";
import { REGISTRATION_EMAIL, registrationMailto } from "@/lib/registration";

describe("registrationMailto", () => {
  it("writes to the registration address, subject and body encoded", () => {
    const href = registrationMailto("Ouverture de nos comptes", "Bonjour,\nÉcole :");
    expect(href.startsWith(`mailto:${REGISTRATION_EMAIL}?subject=`)).toBe(true);
    const query = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    expect(query.get("subject")).toBe("Ouverture de nos comptes");
    // mail clients expect CRLF line breaks in a mailto body (RFC 6068)
    expect(query.get("body")).toBe("Bonjour,\r\nÉcole :");
    expect(href).not.toContain(" ");
  });

  it("lays out what a registration needs", () => {
    const body = fr.auth.login.registrationBody;
    for (const part of ["Parent 1", "Parent 2", "Adresse e-mail", "Enfants", "classe"]) {
      expect(body).toContain(part);
    }
  });
});
