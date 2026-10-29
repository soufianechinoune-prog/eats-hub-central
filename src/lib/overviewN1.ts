import { format, subDays } from "date-fns";

/** Calendar dates in Paris; the 04:00 business cutoff is not evidence of import completeness. */
export function lastClosedParisDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  const parisDate = new Date(Number(part("year")), Number(part("month")) - 1, Number(part("day")), 12);
  return format(subDays(parisDate, Number(part("hour")) < 4 ? 2 : 1), "yyyy-MM-dd");
}

export function overviewN1Eligibility(mode: string, start: string, end: string, now = new Date()) {
  if (start === end || mode === "yesterday") return { allowed: false, reason: "N-1 indisponible sur une journée isolée : les jours de semaine diffèrent." };
  if (mode === "7d" || mode === "30d") return { allowed: false, reason: "N-1 indisponible sur les périodes glissantes incluant la journée en cours." };
  if (start > end || end > lastClosedParisDay(now)) return { allowed: false, reason: "La période inclut des jours non clôturés. Choisissez une période passée." };
  return { allowed: true, reason: "Comparaison sur les jours clôturés, sous réserve de complétude des remontées." };
}

export function revenueChange(current: number, previous: number | null | undefined): number | null {
  return previous != null && previous > 0 ? (current - previous) / previous * 100 : null;
}
/**
 * Le N-1 est une période de lancement si l'ouverture tombe dans la période N-1
 * ou moins de 3 mois avant son début : la base de comparaison n'est pas mature.
 */
export function isLaunchN1(openingDate: string | null | undefined, start: string, end: string): boolean {
  if (!openingDate || !start || !end) return false;
  const shift = (d: string, years: number, months = 0) => {
    const [y, m, day] = d.split("-").map(Number);
    return format(new Date(y + years, m - 1 + months, day, 12), "yyyy-MM-dd");
  };
  const prevEnd = shift(end, -1);
  const windowStart = shift(start, -1, -3);
  return openingDate > windowStart && openingDate <= prevEnd;
}
