/**
 * Estimation du manque à gagner « titres restaurant » par émetteur non accepté.
 * Méthode prudente : pour chaque émetteur, part médiane qu'il représente dans le
 * CA Uber des restaurants qui l'acceptent déjà ; appliquée au CA Uber du
 * restaurant qui ne l'accepte pas. Hypothèse : ce CA est aujourd'hui perdu
 * (le client paie ailleurs), donc l'estimation reste indicative.
 */
export interface PotentialInputRow {
  restaurantId: string;
  uberRevenueTTC: number;
  byProvider: Record<string, { amount: number }>;
}

/** Nombre minimum de restaurants acceptant l'émetteur pour estimer une médiane. */
export const MIN_SAMPLE = 3;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Part médiane (0–1) du CA Uber par émetteur, calculée sur les restaurants qui l'acceptent. */
export function providerMedianShares(rows: PotentialInputRow[], providers: readonly string[]) {
  const out: Record<string, number> = {};
  for (const p of providers) {
    const shares = rows
      .filter((r) => r.uberRevenueTTC > 0 && (r.byProvider[p]?.amount ?? 0) > 0)
      .map((r) => r.byProvider[p].amount / r.uberRevenueTTC);
    out[p] = shares.length >= MIN_SAMPLE ? median(shares) : 0;
  }
  return out;
}

/** Potentiel non capté (€ TTC) par émetteur manquant pour un restaurant. */
export function restaurantPotential(
  row: PotentialInputRow,
  medianShares: Record<string, number>,
): { total: number; byProvider: Record<string, number> } {
  const byProvider: Record<string, number> = {};
  let total = 0;
  if (row.uberRevenueTTC <= 0) return { total, byProvider };
  for (const [p, share] of Object.entries(medianShares)) {
    if ((row.byProvider[p]?.amount ?? 0) > 0 || share <= 0) continue;
    const v = row.uberRevenueTTC * share;
    byProvider[p] = v;
    total += v;
  }
  return { total, byProvider };
}
