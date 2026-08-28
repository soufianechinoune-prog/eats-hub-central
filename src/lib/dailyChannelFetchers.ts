import { supabase } from "@/integrations/supabase/client";
import type { DailyRow } from "@/components/analytics/DailyComparisonCharts";

async function callDailyRpc(
  fn: string,
  start: string,
  end: string,
  restaurantIds: string[] | null
): Promise<DailyRow[]> {
  const { data, error } = await (supabase.rpc as any)(fn, {
    p_start_date: start,
    p_end_date: end,
    p_restaurant_ids: restaurantIds && restaurantIds.length > 0 ? restaurantIds : null,
  });
  if (error) throw error;
  return (data ?? []) as DailyRow[];
}

/** CA caisse (Splash) par restaurant / jour */
export const fetchDailyOnsite = (start: string, end: string, restaurantIds: string[] | null) =>
  callDailyRpc("get_daily_onsite_from_splash", start, end, restaurantIds);

/** CA Chataigne par restaurant / jour */
export const fetchDailyChataigne = (start: string, end: string, restaurantIds: string[] | null) =>
  callDailyRpc("get_daily_chataigne", start, end, restaurantIds);
