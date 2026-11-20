/**
 * Jours récents dont les ventes Uber ne sont pas encore toutes arrivées.
 *
 * Uber envoie les rapports restaurant par restaurant, avec un à deux jours de décalage. Tant qu'un jour
 * récent n'a reçu les ventes que d'une partie des restaurants, sa courbe chute (ex. Chicken Street,
 * 18/11/2026 consulté le 20/11 : 34 restaurants sur 103). Ce n'est pas une baisse réelle.
 *
 * Règle : un jour des 7 derniers jours est « en cours de remontée » s'il a moins de 90 % des restaurants
 * habituels. Le nombre habituel = le maximum observé sur les jours plus anciens de la période.
 */

export interface ConsolidationRow {
  date: string; // yyyy-MM-dd
  restaurant_id?: string | null;
  order_count?: number | string | null;
}

export interface ConsolidationInfo {
  /** Premier jour incomplet (yyyy-MM-dd) : la zone va de ce jour à la fin de la courbe. */
  start: string | null;
  /** Dernier jour avec des ventes reçues. */
  lastDataDate: string | null;
  /** Jours de la période, jusqu'à hier, sans aucune vente reçue après le dernier jour reçu. */
  missingDays: number;
}

const RECENT_DAYS = 7;
const SETTLED_AFTER_DAYS = 3;
const MIN_SHARE = 0.9;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function detectConsolidation(
  rows: ConsolidationRow[] | null | undefined,
  today: string,
  periodEnd?: string,
): ConsolidationInfo {
  const byDate = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    if (!r?.date || !(Number(r.order_count) > 0)) continue;
    const d = String(r.date).slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, new Set());
    byDate.get(d)!.add(r.restaurant_id ?? "_");
  }
  const dates = [...byDate.keys()].sort();
  const lastDataDate = dates.length ? dates[dates.length - 1] : null;

  const yesterday = addDays(today, -1);
  const until = periodEnd && periodEnd < yesterday ? periodEnd : yesterday;
  let missingDays = 0;
  if (lastDataDate && lastDataDate < until && lastDataDate >= addDays(today, -RECENT_DAYS)) {
    for (let d = addDays(lastDataDate, 1); d <= until; d = addDays(d, 1)) missingDays++;
  }

  const settledLimit = addDays(today, -SETTLED_AFTER_DAYS);
  const settled = dates.filter((d) => d < settledLimit);
  const reference = Math.max(0, ...(settled.length ? settled : dates).map((d) => byDate.get(d)!.size));
  const recentLimit = addDays(today, -RECENT_DAYS);
  // Uniquement la fin de la courbe : on remonte depuis le dernier jour tant que les jours sont incomplets.
  let start: string | null = null;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i];
    if (d < recentLimit || byDate.get(d)!.size >= MIN_SHARE * reference) break;
    start = d;
  }
  return { start, lastDataDate, missingDays };
}
