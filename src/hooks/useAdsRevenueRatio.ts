import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

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
}

/**
 * Calcule le ratio dépenses publicitaires Uber Eats / CA TTC.
 * - Ads: payout_adjustments.category = 'advertising' (ABS)
 * - CA TTC: orders.sales_incl_vat (Europe/Paris)
 * - Réseau = somme num/denom (jamais une moyenne de %)
 * V1 Uber Eats uniquement.
 */
export function useAdsRevenueRatio({
  restaurantIds,
  startDate,
  endDate,
  enabled = true,
}: UseAdsRevenueRatioParams): AdsRevenueRatioResult {
  const startKey = format(startDate, "yyyy-MM-dd");
  const endKey = format(endDate, "yyyy-MM-dd");

  // Bloque sur sentinel UUID '0000...' (multi-tenant ready guard)
  const ready =
    enabled &&
    restaurantIds.length > 0 &&
    !restaurantIds.includes("00000000-0000-0000-0000-000000000000");

  const { data, isLoading } = useQuery({
    queryKey: ["ads-revenue-ratio", restaurantIds, startKey, endKey],
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ads_revenue_ratio", {
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
        ads_spend: number;
        revenue_ttc: number;
        ads_pct: number | null;
      }>;
    },
  });

  return useMemo<AdsRevenueRatioResult>(() => {
    const map = new Map<string, AdsRatioByRestaurant>();
    let networkAds = 0;
    let networkRev = 0;

    (data ?? []).forEach((row) => {
      const ads = Number(row.ads_spend) || 0;
      const rev = Number(row.revenue_ttc) || 0;
      map.set(row.restaurant_id, {
        restaurantId: row.restaurant_id,
        adsSpend: ads,
        revenueTtc: rev,
        adsPct: row.ads_pct != null ? Number(row.ads_pct) : null,
      });
      networkAds += ads;
      networkRev += rev;
    });

    return {
      byRestaurant: map,
      networkAdsSpend: networkAds,
      networkRevenue: networkRev,
      networkPct: networkRev > 0 ? (networkAds / networkRev) * 100 : null,
      isLoading,
    };
  }, [data, isLoading]);
}
