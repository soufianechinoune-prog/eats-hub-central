import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface EcoAggregated {
  restaurant_id: string;
  month: number;
  total_refund: number;
  total_charge: number;
  payout_count: number;
}

interface EcoDetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
}

export function useEcoContribution({
  restaurantIds,
  year,
  month,
}: {
  restaurantIds?: string[];
  year: number;
  month?: number | null;
}) {
  // Aggregated data from payouts table
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery({
    queryKey: ["eco_contribution_payouts", restaurantIds, year, month],
    queryFn: async () => {
      let query = supabase
        .from("payouts")
        .select("restaurant_id, payout_date, eco_contribution_refund, eco_contribution_charge")
        .gte("payout_date", `${year}-01-01`)
        .lte("payout_date", `${year}-12-31`);

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      if (month) {
        const monthStr = String(month).padStart(2, "0");
        query = query
          .gte("payout_date", `${year}-${monthStr}-01`)
          .lte("payout_date", `${year}-${monthStr}-31`);
      }

      const { data, error } = await query.limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  // Detail lines from payout_adjustments
  const { data: detailLines, isLoading: loadingDetail } = useQuery({
    queryKey: ["eco_contribution_detail", restaurantIds, year, month],
    queryFn: async () => {
      const allData: EcoDetailLine[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from("payout_adjustments")
          .select("id, restaurant_id, restaurant_name, payout_reference_id, payout_date, description, amount")
          .eq("category", "eco_contribution")
          .gte("payout_date", `${year}-01-01`)
          .lte("payout_date", `${year}-12-31`)
          .order("payout_date", { ascending: false });

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        if (month) {
          const monthStr = String(month).padStart(2, "0");
          query = query
            .gte("payout_date", `${year}-${monthStr}-01`)
            .lte("payout_date", `${year}-${monthStr}-31`);
        }

        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...(data as EcoDetailLine[]));
          if (data.length < batchSize) break;
          offset += batchSize;
        } else {
          break;
        }
      }

      return allData;
    },
  });

  // Aggregate by month
  const monthlyData = useMemo(() => {
    if (!payoutsData) return [];
    const byMonth = new Map<number, { refund: number; charge: number; count: number }>();
    
    for (const row of payoutsData) {
      const m = new Date(row.payout_date).getMonth() + 1;
      const existing = byMonth.get(m) || { refund: 0, charge: 0, count: 0 };
      existing.refund += Number(row.eco_contribution_refund) || 0;
      existing.charge += Number(row.eco_contribution_charge) || 0;
      existing.count += 1;
      byMonth.set(m, existing);
    }

    return Array.from(byMonth.entries())
      .map(([m, d]) => ({
        month: m,
        refund: Math.round(d.refund * 100) / 100,
        charge: Math.round(d.charge * 100) / 100,
        net: Math.round((d.refund - d.charge) * 100) / 100,
        count: d.count,
      }))
      .sort((a, b) => a.month - b.month);
  }, [payoutsData]);

  // Aggregate by restaurant
  const byRestaurant = useMemo(() => {
    if (!payoutsData) return [];
    const byResto = new Map<string, { refund: number; charge: number; count: number }>();
    
    for (const row of payoutsData) {
      const existing = byResto.get(row.restaurant_id) || { refund: 0, charge: 0, count: 0 };
      existing.refund += Number(row.eco_contribution_refund) || 0;
      existing.charge += Number(row.eco_contribution_charge) || 0;
      existing.count += 1;
      byResto.set(row.restaurant_id, existing);
    }

    return Array.from(byResto.entries())
      .map(([id, d]) => ({
        restaurant_id: id,
        refund: Math.round(d.refund * 100) / 100,
        charge: Math.round(d.charge * 100) / 100,
        net: Math.round((d.refund - d.charge) * 100) / 100,
        count: d.count,
      }))
      .sort((a, b) => b.net - a.net);
  }, [payoutsData]);

  // KPI totals
  const totals = useMemo(() => {
    if (!payoutsData) return { refund: 0, charge: 0, net: 0, lineCount: 0 };
    let refund = 0, charge = 0;
    for (const row of payoutsData) {
      refund += Number(row.eco_contribution_refund) || 0;
      charge += Number(row.eco_contribution_charge) || 0;
    }
    return {
      refund: Math.round(refund * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      net: Math.round((refund - charge) * 100) / 100,
      lineCount: detailLines?.length || 0,
    };
  }, [payoutsData, detailLines]);

  return {
    monthlyData,
    byRestaurant,
    totals,
    detailLines: detailLines || [],
    isLoading: loadingPayouts || loadingDetail,
  };
}
