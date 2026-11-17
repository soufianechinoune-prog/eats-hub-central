import { supabase } from "@/integrations/supabase/client";

/**
 * Suivi CITEO : état de chaque société dans l'espace client CITEO (adhésion, factures à payer).
 * Les données viennent d'un relevé périodique de l'espace client ; `checked_at` dit de quand elles datent.
 * Une facture impayée trop longtemps peut conduire CITEO à radier l'adhérent.
 */
export interface CiteoInvoice {
  label: string;
  due: string;
  ttc: number;
}

export type CiteoAdhesionStatus = "adherent" | "adhesion_en_cours" | "adhesion_a_valider";

export interface CiteoAccount {
  id: string;
  chain_id: string;
  company_name: string;
  contract_number: string | null;
  idu: string | null;
  restaurant_id: string | null;
  adhesion_status: CiteoAdhesionStatus;
  unpaid_count: number;
  unpaid_total_ttc: number;
  oldest_due_date: string | null;
  invoices: CiteoInvoice[];
  einvoicing_missing: boolean;
  /** Prise d'effet du contrat, telle qu'affichée par CITEO (toujours un 1er janvier). */
  contract_effective_date: string | null;
  contract_label: string | null;
  /** Jour où le contrat a été signé (lu une fois dans le contrat lui-même). */
  contract_signed_date: string | null;
  checked_at: string;
}

export type CiteoTone = "ok" | "warning" | "danger" | "pending";

export interface CiteoDisplay {
  tone: CiteoTone;
  label: string;
  detail: string;
}

const DAY_MS = 86_400_000;
/** Au-delà de ce retard, on affiche la facture comme urgente (risque de radiation). */
export const CITEO_URGENT_DAYS = 180;

const eur = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const dateFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");

/** Nombre de jours de retard de la plus ancienne facture (0 si rien en retard). */
export function citeoDaysLate(account: Pick<CiteoAccount, "oldest_due_date">, now: Date = new Date()): number {
  if (!account.oldest_due_date) return 0;
  const due = new Date(`${account.oldest_due_date}T23:59:59`).getTime();
  return Math.max(0, Math.floor((now.getTime() - due) / DAY_MS));
}

/** Ce qu'on affiche pour une société : couleur, libellé court, explication. */
export function describeCiteoAccount(account: CiteoAccount, now: Date = new Date()): CiteoDisplay {
  if (account.adhesion_status === "adhesion_a_valider") {
    return { tone: "pending", label: "Adhésion à valider", detail: "Contrat signé, en attente de validation par CITEO." };
  }
  if (account.adhesion_status === "adhesion_en_cours") {
    return { tone: "pending", label: "Adhésion en cours", detail: "L'inscription chez CITEO n'est pas terminée." };
  }
  if (account.unpaid_count > 0) {
    const late = citeoDaysLate(account, now);
    const n = account.unpaid_count;
    const label = `${n} facture${n > 1 ? "s" : ""} à payer`;
    const since = account.oldest_due_date ? ` La plus ancienne devait être payée le ${dateFr(account.oldest_due_date)}.` : "";
    return {
      tone: late > CITEO_URGENT_DAYS ? "danger" : "warning",
      label,
      detail: `${eur(Number(account.unpaid_total_ttc))} TTC à régler chez CITEO.${since} Une facture impayée peut entraîner la radiation.`,
    };
  }
  return { tone: "ok", label: "À jour", detail: "Aucune facture à payer chez CITEO." };
}

/** Retrouve la société CITEO d'un restaurant : lien direct d'abord, identifiant unique ensuite. */
export function findCiteoAccount(
  accounts: CiteoAccount[],
  restaurantId: string,
  idus: string[] = [],
): CiteoAccount | undefined {
  return (
    accounts.find((a) => a.restaurant_id === restaurantId) ??
    accounts.find((a) => !a.restaurant_id && !!a.idu && idus.includes(a.idu))
  );
}

export interface CiteoSummary {
  total: number;
  unpaidCompanies: number;
  unpaidTotalTtc: number;
  pendingAdhesions: number;
  /** Sociétés qu'on n'a pas su rattacher à un restaurant affiché : à montrer à part, jamais à cacher. */
  unlinked: CiteoAccount[];
  checkedAt: string | null;
}

export function summarizeCiteo(accounts: CiteoAccount[], linkedAccountIds: Set<string>): CiteoSummary {
  const unpaid = accounts.filter((a) => a.unpaid_count > 0);
  return {
    total: accounts.length,
    unpaidCompanies: unpaid.length,
    unpaidTotalTtc: unpaid.reduce((s, a) => s + Number(a.unpaid_total_ttc), 0),
    pendingAdhesions: accounts.filter((a) => a.adhesion_status !== "adherent").length,
    unlinked: accounts.filter((a) => !linkedAccountIds.has(a.id)),
    checkedAt: accounts.reduce<string | null>((max, a) => (!max || a.checked_at > max ? a.checked_at : max), null),
  };
}

export async function fetchCiteoAccounts(chainId?: string | null): Promise<CiteoAccount[]> {
  // Table ajoutée par la migration 20261117140000 (pas encore dans les types générés).
  // On garde l'appel sur l'objet client : extraire ses méthodes leur fait perdre leur contexte.
  type Result = PromiseLike<{ data: CiteoAccount[] | null; error: Error | null }>;
  type Query = Result & { eq: (k: string, v: string) => Result };
  const client = supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string) => Query } } };
  const query = client.from("citeo_accounts").select("*").order("company_name");
  const { data, error } = await (chainId ? query.eq("chain_id", chainId) : query);
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, invoices: Array.isArray(a.invoices) ? a.invoices : [] }));
}
