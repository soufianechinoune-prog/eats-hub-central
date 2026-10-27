import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { computeAdsRatio, type AdsRatioMode } from "@/lib/adsRatioModes";

export type AdsRatioRow = { restaurant_id: string; ads_spend_ht: number; revenue_net_ttc: number; revenue_net_ht: number };

export async function fetchAdsRatio(start: Date, end: Date, ids: string[]): Promise<AdsRatioRow[]> {
  const { data, error } = await supabase.rpc("get_ads_revenue_ratio_modes", {
    p_start_date: format(start, "yyyy-MM-dd"),
    p_end_date: format(end, "yyyy-MM-dd"),
    p_restaurant_ids: ids,
  });
  if (error) throw error;
  return (data ?? []) as AdsRatioRow[];
}

export function sumAdsRows(rows: AdsRatioRow[], mode: AdsRatioMode) {
  let adsHt = 0, revenueTtc = 0, revenueHt = 0;
  rows.forEach((r) => { adsHt += Number(r.ads_spend_ht) || 0; revenueTtc += Number(r.revenue_net_ttc) || 0; revenueHt += Number(r.revenue_net_ht) || 0; });
  return computeAdsRatio(mode, { adsHt, revenueTtc, revenueHt });
}
