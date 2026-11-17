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

describe("petits crédits et arrêt des prélèvements", () => {
  it("un petit crédit (0,56 €) n'est pas une régularisation", () => {
    expect(deduceUberDeclarationStatus({ refund: 0.56, charge: -1800.85, repStatus: "inscrit" })).toBe("a_declarer");
  });

  it("summarizeEcoFlows sépare vrais remboursements et petits crédits", () => {
    const s = summarizeEcoFlows([
      { amount: -40, payout_date: "2026-09-21" },
      { amount: 0.56, payout_date: "2026-09-28" },
      { amount: -38, payout_date: "2026-10-26" },
    ], "2026-11-09");
    expect(s).toMatchObject({ realRefund: 0, smallCredits: 0.56, charge: 78, lastChargeDate: "2026-10-26", chargesStopped: false });
    expect(deduceUberDeclarationStatus({ refund: s.realRefund, charge: s.charge, repStatus: "inscrit", chargesStopped: s.chargesStopped })).toBe("a_declarer");
  });

  it("prélèvements arrêtés depuis longtemps, sans remboursement : statut à part", () => {
    const s = summarizeEcoFlows([
      { amount: -120, payout_date: "2026-05-11" },
      { amount: 1.91, payout_date: "2026-06-08" },
    ], "2026-11-09");
    expect(s.chargesStopped).toBe(true);
    expect(deduceUberDeclarationStatus({ refund: s.realRefund, charge: s.charge, repStatus: "inscrit", chargesStopped: s.chargesStopped })).toBe("arrete_non_rembourse");
  });

  it("un vrai remboursement régularise, même s'il reste des prélèvements", () => {
    const s = summarizeEcoFlows([{ amount: -300, payout_date: "2026-03-02" }, { amount: 1074.91, payout_date: "2026-06-01" }], "2026-11-09");
    expect(s.realRefund).toBe(1074.91);
    expect(deduceUberDeclarationStatus({ refund: s.realRefund, charge: s.charge, repStatus: "inscrit" })).toBe("regularise");
  });
});
