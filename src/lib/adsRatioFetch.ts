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

export type AdsQuarterRow = AdsRatioRow & { q_year: number; quarter: number };

const qCacheKey = (year: number, ids: string[]) => `ads-quarters:${year}:${[...ids].sort().join(",").length}:${ids.length}:${[...ids].sort()[0] ?? ""}`;

/** Une seule requête pour Q4 N-1 + Q1..Q4 N (CA lu dans la table résumé journalière). */
export async function fetchAdsQuarters(year: number, ids: string[]): Promise<AdsQuarterRow[]> {
  const { data, error } = await supabase.rpc("get_ads_quarterly_summary", { p_year: year, p_restaurant_ids: ids });
  if (error) throw error;
  const rows = (data ?? []) as AdsQuarterRow[];
  try { localStorage.setItem(qCacheKey(year, ids), JSON.stringify(rows)); } catch { /* quota */ }
  return rows;
}

/** Trimestres clos affichés instantanément depuis le dernier calcul ; le trimestre en cours se rafraîchit. */
export function cachedAdsQuarters(year: number, ids: string[]): AdsQuarterRow[] | undefined {
  try { const v = localStorage.getItem(qCacheKey(year, ids)); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
}
