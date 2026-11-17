/**
 * Déduction du statut de déclaration IDU auprès d'Uber Eats, sur une année civile,
 * à partir des flux financiers d'éco-contribution et de l'adhésion REP (ADEME).
 * Un remboursement ou l'absence de prélèvement vaut preuve qu'Uber a reçu la déclaration.
 */
export type UberDeclarationStatus =
  | "regularise"      // vrai remboursement reçu OU adhérent sans aucun prélèvement : Uber a reçu le formulaire
  | "arrete_non_rembourse" // Uber ne prélève plus, mais n'a pas remboursé ce qu'il a déjà pris
  | "a_declarer"      // adhérent REP (IDU connu) mais toujours prélevé, sans remboursement
  | "non_adherent"    // prélevé et aucune adhésion REP connue
  | "inconnu";        // REP non vérifié ou aucune donnée

/**
 * Montant à partir duquel une ligne positive est un vrai remboursement d'Uber.
 * Constat sur 2026 (toutes enseignes) : les vrais remboursements font tous plus de 89 € (une seule ligne
 * par restaurant, plusieurs semaines de prélèvements d'un coup) ; les petits crédits hebdomadaires
 * (quelques centimes à 38 €) ne sont pas une régularisation et ne prouvent rien.
 */
export const ECO_REAL_REFUND_MIN = 50;
/** Sans prélèvement depuis ce nombre de jours, on considère qu'Uber a arrêté de prélever. */
export const ECO_CHARGE_STOPPED_DAYS = 35;

export interface EcoLineLike {
  amount: number;
  payout_date: string | null;
}

export interface EcoFlowSummary {
  /** Somme des vrais remboursements (lignes d'au moins ECO_REAL_REFUND_MIN). */
  realRefund: number;
  /** Petits crédits qui ne sont pas une régularisation. */
  smallCredits: number;
  charge: number;
  lastChargeDate: string | null;
  /** Vrai si le dernier prélèvement est ancien par rapport à la dernière semaine connue. */
  chargesStopped: boolean;
}

/** Résume les lignes d'éco-contribution d'un restaurant. `referenceDate` = dernière semaine connue du réseau. */
export function summarizeEcoFlows(lines: EcoLineLike[], referenceDate: string | null): EcoFlowSummary {
  let realRefund = 0, smallCredits = 0, charge = 0;
  let lastChargeDate: string | null = null;
  for (const l of lines) {
    const amount = Number(l.amount) || 0;
    if (amount >= ECO_REAL_REFUND_MIN) realRefund += amount;
    else if (amount > 0) smallCredits += amount;
    else if (amount < 0) {
      charge += -amount;
      if (l.payout_date && (!lastChargeDate || l.payout_date > lastChargeDate)) lastChargeDate = l.payout_date;
    }
  }
  let chargesStopped = false;
  if (lastChargeDate && referenceDate) {
    const days = (new Date(`${referenceDate.slice(0, 10)}T12:00:00`).getTime() - new Date(`${lastChargeDate.slice(0, 10)}T12:00:00`).getTime()) / 86_400_000;
    chargesStopped = days >= ECO_CHARGE_STOPPED_DAYS;
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  return { realRefund: round(realRefund), smallCredits: round(smallCredits), charge: round(charge), lastChargeDate, chargesStopped };
}

export function deduceUberDeclarationStatus(input: {
  /** Vrais remboursements uniquement (voir summarizeEcoFlows) : les petits crédits ne comptent pas. */
  refund: number;
  charge: number;
  repStatus?: string;
  chargesStopped?: boolean;
}): UberDeclarationStatus {
  const refund = Math.max(0, input.refund || 0);
  const charged = Math.abs(input.charge || 0) > 0.005;
  if (input.repStatus === "inscrit") {
    if (refund >= ECO_REAL_REFUND_MIN) return "regularise";
    if (!charged) return "regularise";
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
