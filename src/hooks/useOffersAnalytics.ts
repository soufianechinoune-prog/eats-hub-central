import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface OffersRawRow {
  restaurant_id: string;
  month_key: string;
  total_orders: number;
  promo_orders: number;
  taxed_orders: number;
  total_offer_fees: number;
  total_promo_amount: number;
}

export interface RestaurantOfferStats {
  restaurantId: string;
  restaurantName: string;
  totalOrders: number;
  promoOrders: number;
  taxedOrders: number;
  promoPercent: number;
  taxedPercent: number; // taxed / promo
  totalFees: number;
  avgFeePerTaxed: number;
  isExempt: boolean;
}

export interface MonthlyOfferStats {
  monthKey: string;
  totalOrders: number;
  promoOrders: number;
  taxedOrders: number;
  totalFees: number;
  taxedPercent: number;
  byRestaurant: Record<string, { fees: number; taxedOrders: number; promoOrders: number }>;
}

export interface OfferAnomaly {
  restaurantId: string;
  restaurantName: string;
  type: "should_be_exempt" | "overcharged" | "confirmed_exempt";
  detail: string;
  value: number;
}

interface HeatmapCell {
  restaurantId: string;
  restaurantName: string;
  monthKey: string;
  promoPercent: number;
}

export interface OffersAnalyticsResult {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  kpis: {
    totalFees: number;
    totalFeesPrev: number;
    taxedOrdersCount: number;
    promoOrdersCount: number;
    taxedPercent: number;
    avgFeePerTaxed: number;
    promoRate: number;
    totalOrders: number;
  };
  restaurantStats: RestaurantOfferStats[];
  monthlyStats: MonthlyOfferStats[];
  heatmapData: HeatmapCell[];
  anomalies: OfferAnomaly[];
}

export function useOffersAnalytics(
  restaurantIds: string[],
  startDate: string,
  endDate: string,
  restaurants: { id: string; name: string }[],
  successScores?: { restaurant_id: string; score_tier: string }[]
): OffersAnalyticsResult {
  // Current period
  const { data: rawData, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["offers-analytics", restaurantIds, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_offers_analytics", {
        p_restaurant_ids: restaurantIds.length > 0 ? restaurantIds : null,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data || []) as OffersRawRow[];
    },
    enabled: !!startDate && !!endDate,
  });

  // Previous year for comparison
  const prevStart = useMemo(() => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, [startDate]);
  const prevEnd = useMemo(() => {
    if (!endDate) return "";
    const d = new Date(endDate);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, [endDate]);

  const { data: prevData } = useQuery({
    queryKey: ["offers-analytics-prev", restaurantIds, prevStart, prevEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_offers_analytics", {
        p_restaurant_ids: restaurantIds.length > 0 ? restaurantIds : null,
        p_start_date: prevStart,
        p_end_date: prevEnd,
      });
      if (error) throw error;
      return (data || []) as OffersRawRow[];
    },
    enabled: !!prevStart && !!prevEnd,
  });

  // Success scores - scoped to the provided restaurantIds
  const { data: scores } = useQuery({
    queryKey: ["success-scores-latest", restaurantIds],
    queryFn: async () => {
      let query = supabase
        .from("success_scores")
        .select("restaurant_id, score_tier, score_month")
        .order("score_month", { ascending: false });
      if (restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      // Keep latest per restaurant
      const map = new Map<string, string>();
      (data || []).forEach((s) => {
        if (!map.has(s.restaurant_id)) map.set(s.restaurant_id, s.score_tier);
      });
      return map;
    },
  });

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    restaurants.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [restaurants]);

  return useMemo(() => {
    const rows = rawData || [];
    const prevRows = prevData || [];

    // KPIs
    let totalFees = 0, totalOrders = 0, promoOrders = 0, taxedOrders = 0;
    rows.forEach((r) => {
      totalFees += Number(r.total_offer_fees);
      totalOrders += Number(r.total_orders);
      promoOrders += Number(r.promo_orders);
      taxedOrders += Number(r.taxed_orders);
    });
    let totalFeesPrev = 0;
    prevRows.forEach((r) => { totalFeesPrev += Number(r.total_offer_fees); });

    const kpis = {
      totalFees,
      totalFeesPrev,
      taxedOrdersCount: taxedOrders,
      promoOrdersCount: promoOrders,
      taxedPercent: promoOrders > 0 ? (taxedOrders / promoOrders) * 100 : 0,
      avgFeePerTaxed: taxedOrders > 0 ? totalFees / taxedOrders : 0,
      promoRate: totalOrders > 0 ? (promoOrders / totalOrders) * 100 : 0,
      totalOrders,
    };

    // Restaurant stats
    const rMap = new Map<string, { total: number; promo: number; taxed: number; fees: number }>();
    rows.forEach((r) => {
      const cur = rMap.get(r.restaurant_id) || { total: 0, promo: 0, taxed: 0, fees: 0 };
      cur.total += Number(r.total_orders);
      cur.promo += Number(r.promo_orders);
      cur.taxed += Number(r.taxed_orders);
      cur.fees += Number(r.total_offer_fees);
      rMap.set(r.restaurant_id, cur);
    });

    const restaurantStats: RestaurantOfferStats[] = Array.from(rMap.entries())
      .map(([id, s]) => ({
        restaurantId: id,
        restaurantName: nameMap.get(id) || id.slice(0, 8),
        totalOrders: s.total,
        promoOrders: s.promo,
        taxedOrders: s.taxed,
        promoPercent: s.total > 0 ? (s.promo / s.total) * 100 : 0,
        taxedPercent: s.promo > 0 ? (s.taxed / s.promo) * 100 : 0,
        totalFees: s.fees,
        avgFeePerTaxed: s.taxed > 0 ? s.fees / s.taxed : 0,
        isExempt: s.promo > 0 && s.taxed === 0,
      }))
      .sort((a, b) => b.totalFees - a.totalFees);

    // Monthly stats
    const mMap = new Map<string, MonthlyOfferStats>();
    rows.forEach((r) => {
      const cur = mMap.get(r.month_key) || {
        monthKey: r.month_key,
        totalOrders: 0,
        promoOrders: 0,
        taxedOrders: 0,
        totalFees: 0,
        taxedPercent: 0,
        byRestaurant: {},
      };
      cur.totalOrders += Number(r.total_orders);
      cur.promoOrders += Number(r.promo_orders);
      cur.taxedOrders += Number(r.taxed_orders);
      cur.totalFees += Number(r.total_offer_fees);
      cur.byRestaurant[r.restaurant_id] = {
        fees: Number(r.total_offer_fees),
        taxedOrders: Number(r.taxed_orders),
        promoOrders: Number(r.promo_orders),
      };
      mMap.set(r.month_key, cur);
    });
    const monthlyStats = Array.from(mMap.values())
      .map((m) => ({ ...m, taxedPercent: m.promoOrders > 0 ? (m.taxedOrders / m.promoOrders) * 100 : 0 }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Heatmap
    const heatmapData: HeatmapCell[] = rows.map((r) => ({
      restaurantId: r.restaurant_id,
      restaurantName: nameMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8),
      monthKey: r.month_key,
      promoPercent: Number(r.total_orders) > 0 ? (Number(r.promo_orders) / Number(r.total_orders)) * 100 : 0,
    }));

    // Anomalies
    const anomalies: OfferAnomaly[] = [];
    const scoresMap = scores || new Map<string, string>();
    restaurantStats.forEach((rs) => {
      const tier = scoresMap.get(rs.restaurantId);
      const isGoldPlat = tier === "Gold" || tier === "Platinum";
      if (rs.totalFees > 0 && isGoldPlat) {
        anomalies.push({
          restaurantId: rs.restaurantId,
          restaurantName: rs.restaurantName,
          type: "should_be_exempt",
          detail: `Score ${tier} mais ${rs.totalFees.toFixed(0)}€ de frais facturés`,
          value: rs.totalFees,
        });
      }
      if (rs.avgFeePerTaxed > 1.0 && rs.taxedOrders > 10) {
        anomalies.push({
          restaurantId: rs.restaurantId,
          restaurantName: rs.restaurantName,
          type: "overcharged",
          detail: `Frais moyen ${rs.avgFeePerTaxed.toFixed(2)}€ > 0.89€`,
          value: rs.avgFeePerTaxed,
        });
      }
      if (rs.isExempt && rs.promoOrders > 50) {
        anomalies.push({
          restaurantId: rs.restaurantId,
          restaurantName: rs.restaurantName,
          type: "confirmed_exempt",
          detail: `${rs.promoOrders} commandes promo, 0€ de frais → exonéré`,
          value: 0,
        });
      }
    });

    return { isLoading, isError, errorMessage: queryError?.message || null, kpis, restaurantStats, monthlyStats, heatmapData, anomalies };
  }, [rawData, prevData, nameMap, scores, isLoading, isError, queryError]);
}

