import { differenceInCalendarDays } from "date-fns";

/** A recency warning, not a guarantee of completeness after eight days. */
export function isAdsConsolidating(endDate: Date, today = new Date()): boolean {
  const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const [year, month, day] = parisDay.split("-").map(Number);
  return differenceInCalendarDays(new Date(year, month - 1, day), endDate) < 8;
}