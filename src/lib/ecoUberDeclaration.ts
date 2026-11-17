/**
 * Déduction du statut de déclaration IDU auprès d'Uber Eats, sur une année civile,
 * à partir des flux financiers d'éco-contribution et de l'adhésion REP (ADEME).
 * Un remboursement d'Uber est le miroir exact d'un prélèvement (même période, même nombre de commandes) :
 * on juge donc la régularisation à la part rendue, jamais à un montant minimum.
 */
export type UberDeclarationStatus =
  | "regularise"           // Uber a rendu ce qu'il a pris (ou n'a jamais rien pris)
  | "rembourse_partiel"    // Uber a rendu une partie seulement : le reste est à réclamer
  | "arrete_non_rembourse" // Uber ne prélève plus, mais n'a rien rendu
  | "a_declarer"           // adhérent REP (IDU connu) mais toujours prélevé, sans remboursement
  | "non_adherent"         // prélevé et aucune adhésion REP connue
  | "inconnu";             // REP non vérifié ou aucune donnée

/**
 * Part des prélèvements qu'Uber doit avoir rendue pour parler de régularisation.
 * C'est une proportion, pas un montant : la règle vaut pour un gros restaurant comme pour un petit
 * ou pour un lancement. (Les lignes reçues sont déjà triées en base : seuls les remboursements
 * miroirs d'un prélèvement arrivent ici, voir la vue eco_contribution_lines.)
 */
export const ECO_FULL_REFUND_SHARE = 0.9;
/** Sans prélèvement depuis ce nombre de jours, on considère qu'Uber a arrêté de prélever. */
export const ECO_CHARGE_STOPPED_DAYS = 35;

export interface EcoLineLike {
  amount: number;
  payout_date: string | null;
}

export interface EcoFlowSummary {
  /** Remboursements d'éco-contribution reçus. */
  refund: number;
  charge: number;
  /** Ce qu'Uber a pris et pas rendu (jamais négatif). */
  remaining: number;
  lastChargeDate: string | null;
  lastRefundDate: string | null;
  /** Vrai si le dernier prélèvement est ancien par rapport à la dernière semaine connue. */
  chargesStopped: boolean;
  /** Prélèvements postérieurs au dernier remboursement : Uber a recommencé à prélever. */
  chargedAfterRefund: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();

/** Résume les lignes d'éco-contribution d'un restaurant. `referenceDate` = dernière semaine connue du réseau. */
export function summarizeEcoFlows(lines: EcoLineLike[], referenceDate: string | null): EcoFlowSummary {
  let refund = 0, charge = 0;
  let lastChargeDate: string | null = null, lastRefundDate: string | null = null;
  for (const l of lines) {
    const amount = Number(l.amount) || 0;
    if (amount > 0) {
      refund += amount;
      if (l.payout_date && (!lastRefundDate || l.payout_date > lastRefundDate)) lastRefundDate = l.payout_date;
    } else if (amount < 0) {
      charge += -amount;
      if (l.payout_date && (!lastChargeDate || l.payout_date > lastChargeDate)) lastChargeDate = l.payout_date;
    }
  }
  let chargedAfterRefund = 0;
  if (lastRefundDate) {
    for (const l of lines) {
      const amount = Number(l.amount) || 0;
      if (amount < 0 && l.payout_date && l.payout_date > lastRefundDate) chargedAfterRefund += -amount;
    }
  }
  const chargesStopped = !!lastChargeDate && !!referenceDate
    && (day(referenceDate) - day(lastChargeDate)) / 86_400_000 >= ECO_CHARGE_STOPPED_DAYS;
  return {
    refund: round2(refund), charge: round2(charge), remaining: round2(Math.max(0, charge - refund)),
    lastChargeDate, lastRefundDate, chargesStopped, chargedAfterRefund: round2(chargedAfterRefund),
  };
}

export function deduceUberDeclarationStatus(input: {
  refund: number;
  charge: number;
  repStatus?: string;
  chargesStopped?: boolean;
}): UberDeclarationStatus {
  const refund = Math.max(0, input.refund || 0);
  const charge = Math.abs(input.charge || 0);
  const charged = charge > 0.005;
  if (input.repStatus === "inscrit") {
    if (!charged) return "regularise";
    if (refund >= ECO_FULL_REFUND_SHARE * charge) return "regularise";
    if (refund > 0.005) return "rembourse_partiel";
    return input.chargesStopped ? "arrete_non_rembourse" : "a_declarer";
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

/** « le 17/11/2026 à 12:30 » à l'heure de Paris. */
export function formatDeclarationDate(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);
  return `le ${day} à ${time}`;
}

/** Nombre de jours pleins écoulés depuis la déclaration. */
export function daysSinceDeclaration(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000));
}
