import type { AdsEfficiencyRow } from "@/lib/adsEfficiency";

/**
 * Analyse incrémentale de la pub par appariement de « jumeaux ».
 *
 * Méthode : pour chaque restaurant, on prend les 5 restaurants les plus
 * proches en taille (CA de la période précédente), on calcule la médiane de
 * la croissance de leur VERSEMENT (pas du CA — l'indicateur porte sur le
 * versement), puis on compare le versement réel du restaurant au
 * contrefactuel « ce qu'il aurait versé en grandissant au rythme médian de
 * ses jumeaux ».
 *
 *   contrefactuel = versement_prev × (1 + g_jumeaux)
 *   incrémental   = versement − contrefactuel
 *   ROAS incr.    = incrémental ÷ pub HT
 *
 * Le jumeau unique est évité (médiane de 5) pour qu'un témoin atypique ne
 * fasse pas basculer le résultat.
 */

export const TWIN_COUNT = 5;
export const MIN_TWINS = 3;

export type IncrementalResult = {
  restaurantId: string;
  twins: string[];
  /** Médiane de la croissance du versement des jumeaux (ex. 0.08 = +8 %). */
  twinsGrowth: number | null;
  /** Versement attendu sans effet pub. */
  counterfactual: number | null;
  /** Versement réel − contrefactuel (€). */
  incremental: number | null;
  /** Incrémental ÷ pub HT (€ de versement gagné par € de pub). */
  roas: number | null;
};

/** Croissance du versement entre les deux périodes. */
export function payoutGrowth(r: AdsEfficiencyRow): number | null {
  const prev = Number(r.payout_prev) || 0;
  const cur = Number(r.payout) || 0;
  return prev > 0 ? cur / prev - 1 : null;
}

/** Restaurant exploitable comme traité ou témoin : versement sur les deux périodes et CA de référence. */
export const isTwinEligible = (r: AdsEfficiencyRow) =>
  Number(r.payout) > 0 && Number(r.payout_prev) > 0 && Number(r.rev_prev_ttc) > 0;

/** Les k restaurants les plus proches en taille (CA de la période précédente, échelle log). */
export function findTwins(rows: AdsEfficiencyRow[], targetId: string, k = TWIN_COUNT): AdsEfficiencyRow[] {
  const target = rows.find((r) => r.restaurant_id === targetId);
  if (!target || !isTwinEligible(target)) return [];
  const ref = Math.log(Number(target.rev_prev_ttc));
  return rows
    .filter((r) => r.restaurant_id !== targetId && isTwinEligible(r))
    .map((r) => ({ r, d: Math.abs(Math.log(Number(r.rev_prev_ttc)) - ref) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.r);
}

function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Calcul incrémental d'un restaurant face à ses jumeaux. */
export function computeIncremental(rows: AdsEfficiencyRow[], targetId: string, k = TWIN_COUNT): IncrementalResult {
  const target = rows.find((r) => r.restaurant_id === targetId);
  const base: IncrementalResult = { restaurantId: targetId, twins: [], twinsGrowth: null, counterfactual: null, incremental: null, roas: null };
  if (!target || !isTwinEligible(target)) return base;
  const twins = findTwins(rows, targetId, k);
  const growths = twins.map(payoutGrowth).filter((g): g is number => g != null);
  if (growths.length < MIN_TWINS) return { ...base, twins: twins.map((t) => t.restaurant_id) };
  const g = medianOf(growths)!;
  const counterfactual = Number(target.payout_prev) * (1 + g);
  const incremental = Number(target.payout) - counterfactual;
  const ads = Number(target.ads_ht) || 0;
  return {
    restaurantId: targetId,
    twins: twins.map((t) => t.restaurant_id),
    twinsGrowth: g,
    counterfactual,
    incremental,
    roas: ads > 0 ? incremental / ads : null,
  };
}

/** Calcul incrémental pour tout le réseau. */
export function computeIncrementalAll(rows: AdsEfficiencyRow[], k = TWIN_COUNT): Map<string, IncrementalResult> {
  const out = new Map<string, IncrementalResult>();
  rows.forEach((r) => out.set(r.restaurant_id, computeIncremental(rows, r.restaurant_id, k)));
  return out;
}
