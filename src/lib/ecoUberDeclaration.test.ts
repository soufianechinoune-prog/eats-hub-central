import { describe, it, expect } from "vitest";
import { deduceUberDeclarationStatus, buildUberDeclarationUrl } from "./ecoUberDeclaration";

describe("deduceUberDeclarationStatus", () => {
  it("un remboursement sur l'année vaut déclaration reçue", () => {
    expect(deduceUberDeclarationStatus({ refund: 12, charge: -30, repStatus: "inscrit" })).toBe("regularise");
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
