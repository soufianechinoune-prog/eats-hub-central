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

/** Années dont un taux explique ce montant. */
function fittingYears(amount: number): number[] {
  const abs = Math.abs(Number(amount) || 0);
  if (abs < 0.005) return [];
  return ECO_RATES_BY_YEAR.filter((y) => y.rates.some((r) => fitsRate(abs, r))).map((y) => y.year);
}

/** Année d'une date de commande Uber (« 29/12/2025 » ou « 2025-12-29 »), ou null. */
function orderDateYear(orderDate?: string | null): number | null {
  if (!orderDate) return null;
  const m = /(\d{4})/.exec(orderDate);
  return m ? Number(m[1]) : null;
}

/**
 * Année dont le taux explique ce montant, ou null si aucun.
 * Si les deux taux collent, on tranche avec la date de commande de la ligne quand elle désigne l'une des deux
 * années (Chevilly-Larue : −42,25 € = 310 × 0,1363 et 231 × 0,1829, commande du 29/12/2025 → 2025).
 */
export function ecoRateYear(amount: number, orderDate?: string | null): number | null {
  const years = fittingYears(amount);
  if (years.length === 1) return years[0];
  if (years.length > 1) {
    const y = orderDateYear(orderDate);
    if (y !== null && years.includes(y)) return y;
  }
  return null;
}

type EcoYearLine = { amount: number; payout_date: string | null; order_date?: string | null };

/** Année antérieure concernée, si la ligne a été versée une année plus tard que la semaine qu'elle couvre. */
export function priorYearOf(line: EcoYearLine): number | null {
  if (!line.payout_date) return null;
  // La date de commande d'un remboursement est celle du remboursement : on ne s'en sert que pour un prélèvement.
  const rateYear = ecoRateYear(line.amount, line.amount < 0 ? line.order_date : null);
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
export function assignEcoLinesToYear<T extends EcoYearLine & { restaurant_id?: string }>(
  lines: T[], year: number,
): { kept: (T & { paid_on?: string })[]; movedOut: T[] } {
  const kept: (T & { paid_on?: string })[] = [];
  const movedOut: T[] = [];
  // Un remboursement au taux ambigu suit le prélèvement qu'il rembourse (même restaurant, même montant).
  const key = (l: T) => `${l.restaurant_id ?? ""}|${Math.round(Math.abs(l.amount) * 100)}`;
  const chargeYear = new Map<string, number>();
  for (const l of lines) {
    if (l.amount >= 0) continue;
    const y = priorYearOf(l);
    if (y !== null) chargeYear.set(key(l), y);
  }
  const yearOf = (l: T) => {
    const y = priorYearOf(l);
    if (y !== null || l.amount <= 0 || fittingYears(l.amount).length < 2) return y;
    const c = chargeYear.get(key(l));
    return c !== undefined && l.payout_date && c < Number(l.payout_date.slice(0, 4)) ? c : null;
  };
  for (const l of lines) {
    const payoutYear = l.payout_date ? Number(l.payout_date.slice(0, 4)) : null;
    const prior = yearOf(l);
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
