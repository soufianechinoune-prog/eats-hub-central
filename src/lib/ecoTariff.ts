/**
 * Barème éco-contribution Uber Eats (TTC par commande), constaté sur relevés réels.
 * Une ligne « Autres frais » n'est validée comme éco-contribution que si son montant
 * est un multiple entier du barème de l'année (tolérance 1 centime d'arrondi).
 */
export const ECO_TARIFF_TTC: Record<number, number> = {
  2024: 0.113,
  2025: 0.1363,
  2026: 0.1829,
};

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
  return { valid: n >= 1 && residual <= ECO_TOLERANCE, rate, orders: n, residual };
}

/** Teste le montant contre le barème de l'année, puis les autres années (chevauchements). */
export function matchEcoMultiple(amount: number, year?: number): EcoMultipleMatch {
  const abs = Math.abs(amount || 0);
  const years = Object.keys(ECO_TARIFF_TTC).map(Number);
  const order = year && ECO_TARIFF_TTC[year] ? [year, ...years.filter(y => y !== year)] : years;
  let best: EcoMultipleMatch = { valid: false, rate: null, orders: 0, residual: abs };
  for (const y of order) {
    const m = matchRate(abs, ECO_TARIFF_TTC[y]);
    if (m.valid) return m;
    if (m.residual < best.residual) best = { ...m, valid: false };
  }
  return best;
}
