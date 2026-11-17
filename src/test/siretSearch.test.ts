import { describe, expect, it } from "vitest";
import { mapCompanySearch, type Company } from "../../supabase/functions/validate-siret/companySearch";

const annecy: Company = {
  siren: "106309677",
  nom_raison_sociale: "TASTY CROUSTY ANNECY",
  siege: {
    siret: "10630967700016", adresse: "5 RUE DE L'INDUSTRIE 74000 ANNECY",
    code_postal: "74000", libelle_commune: "ANNECY", etat_administratif: "A",
  },
  dirigeants: [{ denomination: "FORK CAPITAL" }],
};

describe("official SIRET search", () => {
  it("returns Annecy's exact establishment and corporate director", () => {
    expect(mapCompanySearch([annecy], "10630967700016")).toMatchObject({
      valid: true, denomination: "TASTY CROUSTY ANNECY", etat: "Actif",
      rue: "5 RUE DE L'INDUSTRIE", codePostal: "74000", ville: "ANNECY",
      dirigeant: { nom: "FORK CAPITAL" },
    });
  });
  it("does not substitute the head office for a nonexistent SIRET", () => {
    expect(mapCompanySearch([annecy], "10630967799999")).toEqual({ valid: false });
  });
  it("uses the requested branch's closed status even when the head office is active", () => {
    const company = { ...annecy, matching_etablissements: [{
      siret: "10630967700024", etat_administratif: "F", adresse: "8 RUE TEST 75001 PARIS",
    }] };
    expect(mapCompanySearch([company], "10630967700024")).toMatchObject({
      valid: true, etat: "Fermé", codePostal: "75001", ville: "PARIS",
    });
  });
  it("rejects a different company returned by search", () => {
    expect(mapCompanySearch([annecy], "83770284400015")).toEqual({ valid: false });
  });
});