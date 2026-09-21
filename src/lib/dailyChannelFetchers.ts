import { supabase } from "@/integrations/supabase/client";
import type { DailyRow } from "@/components/analytics/DailyComparisonCharts";

async function callDailyRpc(
  fn: string,
  start: string,
  end: string,
  restaurantIds: string[] | null
): Promise<DailyRow[]> {
  // Les RPC renvoient une ligne par restaurant et par jour : au-delà de 1000 lignes
  // la réponse est tronquée côté API → on pagine explicitement.
  const PAGE_SIZE = 1000;
  const all: DailyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await (supabase.rpc as any)(fn, {
      p_start_date: start,
      p_end_date: end,
      p_restaurant_ids: restaurantIds && restaurantIds.length > 0 ? restaurantIds : null,
    }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as DailyRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/** CA caisse (Splash) par restaurant / jour */
export const fetchDailyOnsite = (start: string, end: string, restaurantIds: string[] | null) =>
  callDailyRpc("get_daily_onsite_from_splash", start, end, restaurantIds);

/** CA Chataigne par restaurant / jour */
export const fetchDailyChataigne = (start: string, end: string, restaurantIds: string[] | null) =>
  callDailyRpc("get_daily_chataigne", start, end, restaurantIds);
