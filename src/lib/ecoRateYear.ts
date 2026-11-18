/**
 * Année concernée par une ligne d'éco-contribution Uber, d'après son taux.
 *
 * Uber prélève avec une ou deux semaines de retard : les dernières semaines de 2025 sont tombées dans des
 * versements de janvier 2026. Le relevé Uber le dit (« Éco-contribution du 22/12/2025 au 28/12/2025 :
 * 2543 commandes x 0,1363 EUR »), mais l'export CSV ne garde que le montant. Le taux suffit à retrouver
 * l'année : 0,1829 € en 2026, 0,1381 € puis 0,1363 € en 2025.
 *
 * On ne tranche que quand un seul taux colle : environ un montant sur dix tombe par hasard sur un multiple
 * des deux, et ceux-là ne sont pas marqués.
 */
const ECO_RATES_BY_YEAR: { year: number; rates: number[] }[] = [
  { year: 2026, rates: [0.1829] },
  { year: 2025, rates: [0.1381, 0.1363] },
];

const fitsRate = (abs: number, rate: number) => {
  const n = Math.round(abs / rate);
  return n >= 1 && Math.abs(abs - n * rate) <= 0.0051;
};

/** Année dont le taux explique ce montant, ou null si aucun ou plusieurs. */
export function ecoRateYear(amount: number): number | null {
  const abs = Math.abs(Number(amount) || 0);
  if (abs < 0.005) return null;
  const years = ECO_RATES_BY_YEAR.filter((y) => y.rates.some((r) => fitsRate(abs, r))).map((y) => y.year);
  return years.length === 1 ? years[0] : null;
}

/** Année antérieure concernée, si la ligne a été versée une année plus tard que la semaine qu'elle couvre. */
export function priorYearOf(line: { amount: number; payout_date: string | null }): number | null {
  if (!line.payout_date) return null;
  const rateYear = ecoRateYear(line.amount);
  const payoutYear = Number(line.payout_date.slice(0, 4));
  return rateYear !== null && rateYear < payoutYear ? rateYear : null;
}

export interface PriorYearShare {
  /** Année antérieure concernée (la plus récente s'il y en a plusieurs), null si aucune ligne. */
  year: number | null;
  charge: number;
  refund: number;
}

/** Part des lignes qui concernent une année antérieure à celle du versement. */
export function priorYearShare(lines: { amount: number; payout_date: string | null }[]): PriorYearShare {
  let year: number | null = null, charge = 0, refund = 0;
  for (const l of lines) {
    const y = priorYearOf(l);
    if (y === null) continue;
    year = year === null ? y : Math.max(year, y);
    const a = Number(l.amount) || 0;
    if (a < 0) charge += -a; else refund += a;
  }
  return { year, charge: Math.round(charge * 100) / 100, refund: Math.round(refund * 100) / 100 };
}
