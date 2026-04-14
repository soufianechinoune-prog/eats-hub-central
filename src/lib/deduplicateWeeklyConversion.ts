import { startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Deduplicate daily_conversion rows that contain identical weekly data repeated per day.
 * Keeps only one row per (restaurant_id, week_start) combination.
 */
export function deduplicateWeeklyConversion<T extends { date: string; restaurant_id?: string }>(
  data: T[]
): T[] {
  const seen = new Map<string, T>();

  for (const row of data) {
    if (!row.date) continue;
    const weekStart = startOfWeek(new Date(row.date), { locale: fr });
    const weekKey = weekStart.toISOString().split("T")[0];
    const restaurantKey = row.restaurant_id || "_global";
    const compositeKey = `${restaurantKey}|${weekKey}`;

    if (!seen.has(compositeKey)) {
      seen.set(compositeKey, row);
    }
  }

  return Array.from(seen.values());
}
