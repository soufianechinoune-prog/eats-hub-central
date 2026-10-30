/**
 * Déduction du statut de déclaration IDU auprès d'Uber Eats, sur une année civile,
 * à partir des flux financiers d'éco-contribution et de l'adhésion REP (ADEME).
 * Un remboursement ou l'absence de prélèvement vaut preuve qu'Uber a reçu la déclaration.
 */
export type UberDeclarationStatus =
  | "regularise"      // remboursement reçu OU adhérent sans aucun prélèvement : Uber a reçu le formulaire
  | "a_declarer"      // adhérent REP (IDU connu) mais toujours prélevé, sans remboursement
  | "non_adherent"    // prélevé et aucune adhésion REP connue
  | "inconnu";        // REP non vérifié ou aucune donnée

export function deduceUberDeclarationStatus(input: {
  refund: number;
  charge: number;
  repStatus?: string;
}): UberDeclarationStatus {
  const refund = Math.max(0, input.refund || 0);
  const charged = Math.abs(input.charge || 0) > 0.005;
  if (input.repStatus === "inscrit") {
    if (refund > 0.005) return "regularise";
    return charged ? "a_declarer" : "regularise";
  }
  if (input.repStatus === "non_trouve" || input.repStatus === "sans_siret") return charged ? "non_adherent" : "inconnu";
  return "inconnu";
}

const FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLSeWiQ3q86ODQSuscS3P1TV_d8TsZCAwMlAXronRMvim16agOA/viewform";

const ORGS = ["Adelphe", "Citeo", "Leko"] as const;

export function normalizeEcoOrg(org?: string | null): string | null {
  if (!org) return null;
  const n = org.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ORGS.find(o => n.includes(o.toLowerCase())) ?? null;
}

export function buildUberDeclarationUrl(p: {
  uberStoreId?: string | null;
  name?: string | null;
  postalCode?: string | null;
  legalName?: string | null;
  siret?: string | null;
  org?: string | null;
  idu?: string | null;
}): string {
  const params = new URLSearchParams({ usp: "pp_url" });
  const set = (k: string, v?: string | null) => { if (v && v.trim()) params.set(k, v.trim()); };
  set("entry.2050513664", p.uberStoreId);
  set("entry.403765346", p.name);
  set("entry.775652654", p.postalCode);
  set("entry.112980423", p.legalName);
  set("entry.1480556332", p.siret?.replace(/\s/g, ""));
  set("entry.489817209", normalizeEcoOrg(p.org));
  set("entry.1636463119", p.idu);
  return `${FORM_BASE}?${params.toString()}`;
}
