/**
 * Montants par commande observés sur les exemples de relevés (non certifiés).
 * Une correspondance à 1 centime près est un indice, pas une preuve comptable :
 * le nombre de commandes est estimé, non rapproché d'un relevé identifié.
 */
export const ECO_TARIFF_TTC: Record<number, number> = {
  2024: 0.113,
  2025: 0.1363,
  2026: 0.1829,
};

/** Barèmes additionnels observés (ex. 0,1381 € fin 2025, relevé Angers). */
export const ECO_EXTRA_RATES: Record<number, number[]> = { 2025: [0.1381] };

export const ECO_TOLERANCE = 0.01;

export interface EcoMultipleMatch {
  valid: boolean;
  rate: number | null;
  orders: number;
  residual: number;
}

function matchRate(abs: number, rate: number): EcoMultipleMatch {
  const n = Math.round(abs / rate);
  const residual = Math.abs(abs - n * rate);
  return { valid: n >= 1 && residual <= ECO_TOLERANCE + 1e-9, rate, orders: n, residual };
}

/** Teste le montant contre le barème de l'année, puis les autres années (chevauchements). */
export function matchEcoMultiple(amount: number, year?: number): EcoMultipleMatch {
  if (!Number.isFinite(amount)) return { valid: false, rate: null, orders: 0, residual: Infinity };
  const abs = Math.abs(amount || 0);
  const years = Object.keys(ECO_TARIFF_TTC).map(Number);
  const order = year && ECO_TARIFF_TTC[year] ? [year, ...years.filter(y => y !== year)] : years;
  let best: EcoMultipleMatch = { valid: false, rate: null, orders: 0, residual: abs };
  for (const y of order) {
    for (const rate of [ECO_TARIFF_TTC[y], ...(ECO_EXTRA_RATES[y] ?? [])]) {
      const m = matchRate(abs, rate);
      if (m.valid) return m;
      if (m.residual < best.residual) best = { ...m, valid: false };
    }
  }
  return best;
}
