import { describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

import { citeoDaysLate, describeCiteoAccount, fetchCiteoAccounts, findCiteoAccount, summarizeCiteo, type CiteoAccount } from "./citeoStatus";

const base: CiteoAccount = {
  id: "a1", chain_id: "c1", company_name: "CS REIMS", contract_number: "50028167", idu: "FR418884_01FQUK",
  restaurant_id: null, adhesion_status: "adherent", unpaid_count: 0, unpaid_total_ttc: 0, oldest_due_date: null,
  invoices: [], einvoicing_missing: false, contract_effective_date: "2024-01-01", contract_label: "Contrat EMP_CG_2024 (V1)", contract_signed_date: "2024-12-04", siret: null, checked_at: "2026-11-17T12:35:00Z",
};
const now = new Date("2026-11-17T12:00:00Z");

describe("describeCiteoAccount", () => {
  it("à jour quand aucune facture n'est due", () => {
    expect(describeCiteoAccount(base, now)).toMatchObject({ tone: "ok", label: "À jour" });
  });

  it("urgent quand la plus ancienne facture a plus de 6 mois de retard", () => {
    const d = describeCiteoAccount({ ...base, unpaid_count: 3, unpaid_total_ttc: 324, oldest_due_date: "2025-01-31" }, now);
    expect(d.tone).toBe("danger");
    expect(d.label).toBe("3 factures à payer");
    expect(d.detail).toContain("324,00");
    expect(d.detail).toContain("31/01/2025");
  });

  it("simple alerte quand le retard est récent", () => {
    const d = describeCiteoAccount({ ...base, unpaid_count: 1, unpaid_total_ttc: 132, oldest_due_date: "2026-06-30" }, now);
    expect(d.tone).toBe("warning");
    expect(d.label).toBe("1 facture à payer");
  });

  it("l'adhésion non terminée passe avant tout le reste", () => {
    expect(describeCiteoAccount({ ...base, adhesion_status: "adhesion_a_valider" }, now).label).toBe("Adhésion à valider");
    expect(describeCiteoAccount({ ...base, adhesion_status: "adhesion_en_cours" }, now).tone).toBe("pending");
  });
});

describe("citeoDaysLate", () => {
  it("0 sans échéance ou si l'échéance est à venir", () => {
    expect(citeoDaysLate({ oldest_due_date: null }, now)).toBe(0);
    expect(citeoDaysLate({ oldest_due_date: "2027-02-28" }, now)).toBe(0);
  });
});

describe("findCiteoAccount", () => {
  const linked = { ...base, id: "a2", company_name: "FLT", idu: "FR418887_01DAJP", restaurant_id: "r2" };
  it("le lien direct gagne sur l'identifiant unique", () => {
    expect(findCiteoAccount([base, linked], "r2", ["FR418884_01FQUK"])?.id).toBe("a2");
  });
  it("à défaut, on retrouve par identifiant unique", () => {
    expect(findCiteoAccount([base, linked], "r1", ["FR418884_01FQUK"])?.id).toBe("a1");
  });
  it("une société déjà reliée à un autre restaurant n'est pas réattribuée", () => {
    expect(findCiteoAccount([linked], "r1", ["FR418887_01DAJP"])).toBeUndefined();
  });
});

describe("summarizeCiteo", () => {
  it("compte les impayés et garde à part les sociétés non reliées", () => {
    const unpaid = { ...base, id: "a3", unpaid_count: 2, unpaid_total_ttc: 228 };
    const pending = { ...base, id: "a4", adhesion_status: "adhesion_en_cours" as const, checked_at: "2026-11-18T08:00:00Z" };
    const s = summarizeCiteo([base, unpaid, pending], new Set(["a1"]));
    expect(s).toMatchObject({ total: 3, unpaidCompanies: 1, unpaidTotalTtc: 228, pendingAdhesions: 1, checkedAt: "2026-11-18T08:00:00Z" });
    expect(s.unlinked.map((a) => a.id)).toEqual(["a3", "a4"]);
  });
});

describe("fetchCiteoAccounts", () => {
  it("appelle le client sans lui faire perdre son contexte et filtre par enseigne", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [{ ...base, invoices: null }], error: null });
    const client = { marker: true, from(this: { marker: boolean }, t: string) { expect(this.marker).toBe(true); return { select: () => ({ order: () => ({ eq }) }) }; } };
    from.mockImplementation(function (this: unknown, t: string) { return client.from(t); });
    const rows = await fetchCiteoAccounts("c1");
    expect(eq).toHaveBeenCalledWith("chain_id", "c1");
    expect(rows[0].invoices).toEqual([]);
  });
});
