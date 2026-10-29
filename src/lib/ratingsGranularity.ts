import { differenceInCalendarDays, startOfMonth, startOfWeek, format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { fr } from "date-fns/locale";

export type RatingsGranularity = "day" | "week" | "month";

/** ≤ 35 jours → jour ; ≤ 120 jours → semaine ; au-delà → mois. */
export function pickGranularity(start: Date, end: Date): RatingsGranularity {
  const days = differenceInCalendarDays(end, start) + 1;
  if (days <= 35) return "day";
  if (days <= 120) return "week";
  return "month";
}

export interface RatingBucket {
  date: string; // ISO début du bucket
  label: string;
  fullDate: string;
  rating: number | null;
  count: number;
}

const bucketStart = (d: Date, g: RatingsGranularity) =>
  g === "day" ? d : g === "week" ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d);

/** Moyenne pondérée par avis (somme des notes / nombre d'avis) dans chaque bucket. */
export function bucketRatings(
  reviews: { review_date: string | null; overall_rating: number | null }[],
  start: Date,
  end: Date,
  g: RatingsGranularity,
): RatingBucket[] {
  const acc: Record<string, { sum: number; count: number }> = {};
  for (const r of reviews) {
    if (!r.review_date || !r.overall_rating) continue;
    const key = format(bucketStart(parseISO(r.review_date), g), "yyyy-MM-dd");
    (acc[key] ??= { sum: 0, count: 0 });
    acc[key].sum += r.overall_rating;
    acc[key].count += 1;
  }
  const starts =
    g === "day"
      ? eachDayOfInterval({ start, end })
      : g === "week"
        ? eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
        : eachMonthOfInterval({ start, end });
  return starts.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const a = acc[key];
    return {
      date: key,
      label: g === "day" ? format(d, "d") : g === "week" ? format(d, "d MMM", { locale: fr }) : format(d, "MMM", { locale: fr }),
      fullDate: g === "day" ? format(d, "d MMM yyyy", { locale: fr }) : g === "week" ? `Semaine du ${format(d, "d MMM yyyy", { locale: fr })}` : format(d, "MMMM yyyy", { locale: fr }),
      rating: a && a.count ? parseFloat((a.sum / a.count).toFixed(2)) : null,
      count: a?.count ?? 0,
    };
  });
}
