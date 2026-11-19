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

/**
 * Range les lignes d'un onglet annuel dans l'année qu'elles concernent.
 * - versée l'année Y, taux de Y (ou ambigu) → reste dans Y ;
 * - versée l'année Y avec le taux d'une année antérieure → sort de Y (movedOut), elle s'affiche dans son année ;
 * - versée plus tard avec le taux de Y → entre dans Y, rangée au 31/12 de Y, date réelle gardée dans paid_on.
 * Les montants ne changent pas ; seule l'année d'affichage change, et uniquement pour les lignes au taux sûr.
 */
export function assignEcoLinesToYear<T extends { amount: number; payout_date: string | null }>(
  lines: T[], year: number,
): { kept: (T & { paid_on?: string })[]; movedOut: T[] } {
  const kept: (T & { paid_on?: string })[] = [];
  const movedOut: T[] = [];
  for (const l of lines) {
    const payoutYear = l.payout_date ? Number(l.payout_date.slice(0, 4)) : null;
    const prior = priorYearOf(l);
    if (payoutYear === year) {
      if (prior === null) kept.push(l); else movedOut.push(l);
    } else if (prior === year && l.payout_date) {
      kept.push({ ...l, payout_date: `${year}-12-31`, paid_on: l.payout_date });
    }
  }
  return { kept, movedOut };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const sumSides = (lines: { amount: number }[]) => {
  let charge = 0, refund = 0;
  for (const l of lines) { const a = Number(l.amount) || 0; if (a < 0) charge += -a; else refund += a; }
  return { charge: r2(charge), refund: r2(refund) };
};
const sides = (s: { charge: number; refund: number }, fmt: (v: number) => string) =>
  [s.charge > 0.005 ? `${fmt(s.charge)} prélevés` : null, s.refund > 0.005 ? `${fmt(s.refund)} remboursés` : null].filter(Boolean).join(" et ");

/**
 * Rappels affichés dans un onglet annuel : ce qui y est rangé alors qu'Uber l'a versé l'année suivante,
 * et ce qui a été versé cette année mais rangé dans l'année antérieure qu'il concerne.
 */
export function crossYearNotes(
  kept: { amount: number; paid_on?: string }[],
  movedOut: { amount: number; payout_date: string | null }[],
  year: number,
  fmt: (v: number) => string,
): string[] {
  const notes: string[] = [];
  const movedIn = kept.filter((l) => l.paid_on);
  if (movedIn.length) {
    const s = sumSides(movedIn);
    const paidYear = Math.max(...movedIn.map((l) => Number(l.paid_on!.slice(0, 4))));
    if (s.charge + s.refund > 0.005) notes.push(`Dont ${sides(s, fmt)} en ${paidYear}, concernant ${year}`);
  }
  if (movedOut.length) {
    const s = sumSides(movedOut);
    const toYear = Math.max(...movedOut.map((l) => priorYearOf(l) ?? year - 1));
    if (s.charge + s.refund > 0.005) notes.push(`+ ${sides(s, fmt)} en ${year} pour ${toYear} : voir l'onglet ${toYear}`);
  }
  return notes;
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
