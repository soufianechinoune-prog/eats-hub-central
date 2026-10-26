import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { computeAdsRatio, type AdsRatioMode } from "@/lib/adsRatioModes";

export interface AdsRatioByRestaurant {
  restaurantId: string;
  adsSpend: number;
  revenueTtc: number;
  adsPct: number | null;
}

export interface AdsRevenueRatioResult {
  byRestaurant: Map<string, AdsRatioByRestaurant>;
  networkAdsSpend: number;
  networkRevenue: number;
  networkPct: number | null;
  isLoading: boolean;
}

interface UseAdsRevenueRatioParams {
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
  mode?: AdsRatioMode;
}

/**
 * Ratio dépenses pub Uber Eats / CA net (ventes + promos articles), selon 3 modes :
 * Uber officiel (HT/TTC), Comptable (HT/HT), Trésorerie (TTC/TTC).
 */
export function useAdsRevenueRatio({
  restaurantIds,
  startDate,
  endDate,
  enabled = true,
  mode = "uber",
}: UseAdsRevenueRatioParams): AdsRevenueRatioResult {
  const startKey = format(startDate, "yyyy-MM-dd");
  const endKey = format(endDate, "yyyy-MM-dd");
  const ready =
    enabled &&
    restaurantIds.length > 0 &&
    !restaurantIds.includes("00000000-0000-0000-0000-000000000000");

  const { data, isLoading } = useQuery({
    queryKey: ["ads-revenue-ratio-modes", restaurantIds, startKey, endKey],
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ads_revenue_ratio_modes", {
        p_start_date: startKey,
        p_end_date: endKey,
        p_restaurant_ids: restaurantIds,
      });
      if (error) {
        console.error("Error fetching ads revenue ratio:", error);
        return [];
      }
      return (data ?? []) as Array<{
        restaurant_id: string;
        ads_spend_ht: number;
        revenue_net_ttc: number;
        revenue_net_ht: number;
      }>;
    },
  });

  return useMemo<AdsRevenueRatioResult>(() => {
    const map = new Map<string, AdsRatioByRestaurant>();
    let adsHt = 0, ttc = 0, ht = 0;
    (data ?? []).forEach((row) => {
      const i = {
        adsHt: Number(row.ads_spend_ht) || 0,
        revenueTtc: Number(row.revenue_net_ttc) || 0,
        revenueHt: Number(row.revenue_net_ht) || 0,
      };
      const r = computeAdsRatio(mode, i);
      map.set(row.restaurant_id, {
        restaurantId: row.restaurant_id,
        adsSpend: r.ads,
        revenueTtc: r.revenue,
        adsPct: r.pct,
      });
      adsHt += i.adsHt; ttc += i.revenueTtc; ht += i.revenueHt;
    });
    const net = computeAdsRatio(mode, { adsHt, revenueTtc: ttc, revenueHt: ht });
    return {
      byRestaurant: map,
      networkAdsSpend: net.ads,
      networkRevenue: net.revenue,
      networkPct: net.pct,
      isLoading,
    };
  }, [data, isLoading, mode]);
}
