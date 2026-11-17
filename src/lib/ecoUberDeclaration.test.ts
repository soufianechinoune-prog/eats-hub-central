import { describe, it, expect } from "vitest";
import { deduceUberDeclarationStatus, buildUberDeclarationUrl, summarizeEcoFlows } from "./ecoUberDeclaration";

describe("deduceUberDeclarationStatus", () => {
  it("un remboursement sur l'année vaut déclaration reçue", () => {
    expect(deduceUberDeclarationStatus({ refund: 1200, charge: -30, repStatus: "inscrit" })).toBe("regularise");
  });
  it("adhérent sans aucun prélèvement = régularisé", () => {
    expect(deduceUberDeclarationStatus({ refund: 0, charge: 0, repStatus: "inscrit" })).toBe("regularise");
  });
  it("adhérent encore prélevé sans remboursement = à déclarer", () => {
    expect(deduceUberDeclarationStatus({ refund: 0, charge: -20, repStatus: "inscrit" })).toBe("a_declarer");
  });
  it("non adhérent prélevé = non adhérent", () => {
    expect(deduceUberDeclarationStatus({ refund: 0, charge: -20, repStatus: "non_trouve" })).toBe("non_adherent");
  });
});

describe("buildUberDeclarationUrl", () => {
  it("pré-remplit UUID, SIRET, éco-organisme et IDU", () => {
    const url = new URL(buildUberDeclarationUrl({ uberStoreId: "abc", siret: "851 942 623 00014", org: "CITEO SA", idu: "FR123456_43PLRZ" }));
    expect(url.searchParams.get("entry.2050513664")).toBe("abc");
    expect(url.searchParams.get("entry.1480556332")).toBe("85194262300014");
    expect(url.searchParams.get("entry.489817209")).toBe("Citeo");
    expect(url.searchParams.get("entry.1636463119")).toBe("FR123456_43PLRZ");
  });
});

describe("régularisation jugée à la part rendue", () => {
  it("rien de rendu et encore prélevé : à déclarer", () => {
    const s = summarizeEcoFlows([{ amount: -40, payout_date: "2026-09-21" }, { amount: -38, payout_date: "2026-11-09" }], "2026-11-16");
    expect(s).toMatchObject({ refund: 0, charge: 78, remaining: 78, lastChargeDate: "2026-11-09", chargesStopped: false });
    expect(deduceUberDeclarationStatus({ ...s, repStatus: "inscrit" })).toBe("a_declarer");
  });

  it("prélèvements arrêtés depuis longtemps, rien de rendu : statut à part", () => {
    const s = summarizeEcoFlows([{ amount: -120, payout_date: "2026-05-11" }], "2026-11-16");
    expect(s.chargesStopped).toBe(true);
    expect(deduceUberDeclarationStatus({ ...s, repStatus: "inscrit" })).toBe("arrete_non_rembourse");
  });

  it("petit restaurant remboursé de quelques euros : régularisé quand même", () => {
    const s = summarizeEcoFlows([
      { amount: -3.66, payout_date: "2026-09-07" }, { amount: -1.83, payout_date: "2026-09-14" },
      { amount: 3.66, payout_date: "2026-10-26" }, { amount: 1.83, payout_date: "2026-10-26" },
    ], "2026-11-16");
    expect(s).toMatchObject({ refund: 5.49, charge: 5.49, remaining: 0 });
    expect(deduceUberDeclarationStatus({ ...s, repStatus: "inscrit" })).toBe("regularise");
  });

  it("une partie seulement rendue : remboursé en partie, avec le reste à réclamer", () => {
    const s = summarizeEcoFlows([
      { amount: -91.45, payout_date: "2026-07-06" }, { amount: -126.2, payout_date: "2026-07-27" }, { amount: -257.16, payout_date: "2026-08-24" },
      { amount: 91.45, payout_date: "2026-08-31" },
    ], "2026-11-16");
    expect(s.remaining).toBe(383.36);
    expect(deduceUberDeclarationStatus({ ...s, repStatus: "inscrit" })).toBe("rembourse_partiel");
  });

  it("remboursé puis prélevé de nouveau : on le voit", () => {
    const s = summarizeEcoFlows([
      { amount: -300, payout_date: "2026-03-02" }, { amount: 300, payout_date: "2026-10-26" }, { amount: -20, payout_date: "2026-11-09" },
    ], "2026-11-16");
    expect(s).toMatchObject({ lastRefundDate: "2026-10-26", chargedAfterRefund: 20 });
    expect(deduceUberDeclarationStatus({ ...s, repStatus: "inscrit" })).toBe("regularise");
  });
});
