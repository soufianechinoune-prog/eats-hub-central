import { addDays, endOfMonth, format, parseISO, startOfISOWeek, startOfMonth } from "date-fns";

export type Granularity = "day" | "week" | "month";

/** Granularité par défaut selon la longueur de la période. */
export function defaultGranularity(start: string, end: string): Granularity {
  const days = Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 86400000) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** Clé de regroupement (lundi ISO pour la semaine, 1er du mois pour le mois). */
export function bucketKey(day: string, g: Granularity): string {
  if (g === "day") return day;
  const d = parseISO(day);
  return format(g === "week" ? startOfISOWeek(d) : startOfMonth(d), "yyyy-MM-dd");
}

/** Un bucket est partiel si la période ne le couvre pas entièrement. */
export function isPartialBucket(key: string, g: Granularity, start: string, end: string): boolean {
  if (g === "day") return false;
  const s = parseISO(key);
  const e = g === "week" ? addDays(s, 6) : endOfMonth(s);
  return format(s, "yyyy-MM-dd") < start || format(e, "yyyy-MM-dd") > end;
}
