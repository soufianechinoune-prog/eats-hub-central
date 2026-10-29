import { format, parseISO, subDays } from "date-fns";

export interface RatingAggregate {
  restaurant_id: string;
  avg_rating: number;
  review_count: number;
  platform: string;
}

export function uberRatingWindow(now = new Date()) {
  const end = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { start: format(subDays(parseISO(end), 89), "yyyy-MM-dd"), end };
}

export function summarizeUberRatings(rows: RatingAggregate[], ids?: string[]) {
  const allowed = ids ? new Set(ids) : null;
  const selected = rows.filter(r => r.platform === "uber_eats" && (!allowed || allowed.has(r.restaurant_id)) && r.review_count > 0 && Number.isFinite(r.avg_rating));
  const count = selected.reduce((sum, r) => sum + r.review_count, 0);
  return { rating: count ? selected.reduce((sum, r) => sum + r.avg_rating * r.review_count, 0) / count : null, count };
}