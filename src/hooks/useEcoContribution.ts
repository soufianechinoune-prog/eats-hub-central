import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface EcoDetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
  platform: "uber_eats" | "deliveroo";
}

export function useEcoContribution({
  restaurantIds,
  year,
  month,
  platform = "global",
}: {
  restaurantIds?: string[];
  year: number | null;
  month?: number | null;
  platform?: "uber_eats" | "deliveroo" | "global";
}) {
  // Empty array = no restaurants in scope → disable all queries
  const hasEmptyScope = restaurantIds !== undefined && restaurantIds.length === 0;
  const isUberEnabled = !hasEmptyScope && (platform === "uber_eats" || platform === "global");
  const isDeliverooEnabled = !hasEmptyScope && (platform === "deliveroo" || platform === "global");
  // ── Uber Eats: payouts table ──
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery({
    queryKey: ["eco_contribution_payouts", restaurantIds, year, month, platform],
    queryFn: async () => {
      const allData: { restaurant_id: string; payout_date: string; eco_contribution_refund: number | null; eco_contribution_charge: number | null }[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from("payouts")
          .select("restaurant_id, payout_date, eco_contribution_refund, eco_contribution_charge");

        if (year) {
          query = query.gte("payout_date", `${year}-01-01`).lte("payout_date", `${year}-12-31`);
        }

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        if (month && year) {
          const monthStr = String(month).padStart(2, "0");
          query = query
            .gte("payout_date", `${year}-${monthStr}-01`)
            .lte("payout_date", `${year}-${monthStr}-31`);
        }

        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          if (data.length < batchSize) break;
          offset += batchSize;
        } else {
          break;
        }
      }

      return allData;
    },
    enabled: isUberEnabled,
  });

  // ── Uber Eats: payout_adjustments detail lines ──
  const { data: uberDetailLines, isLoading: loadingUberDetail } = useQuery({
    queryKey: ["eco_contribution_detail", restaurantIds, year, month, platform],
    queryFn: async () => {
      const allData: EcoDetailLine[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from("payout_adjustments")
          .select("id, restaurant_id, restaurant_name, payout_reference_id, payout_date, description, amount")
          .eq("category", "eco_contribution")
          .order("payout_date", { ascending: false });

        if (year) {
          query = query.gte("payout_date", `${year}-01-01`).lte("payout_date", `${year}-12-31`);
        }

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        if (month && year) {
          const monthStr = String(month).padStart(2, "0");
          query = query
            .gte("payout_date", `${year}-${monthStr}-01`)
            .lte("payout_date", `${year}-${monthStr}-31`);
        }

        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data.map(d => ({ ...d, platform: "uber_eats" as const })));
          if (data.length < batchSize) break;
          offset += batchSize;
        } else {
          break;
        }
      }

      return allData;
    },
    enabled: isUberEnabled,
  });

  // ── Deliveroo: deliveroo_orders with eco-contribution type ──
  const { data: deliverooEcoData, isLoading: loadingDeliveroo } = useQuery({
    queryKey: ["eco_contribution_deliveroo", restaurantIds, year, month, platform],
    queryFn: async () => {
      const allData: {
        id: string;
        restaurant_id: string | null;
        restaurant_name: string;
        delivery_datetime: string | null;
        total_payable: number | null;
        note: string | null;
        statement_file: string | null;
      }[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from("deliveroo_orders")
          .select("id, restaurant_id, restaurant_name, delivery_datetime, total_payable, note, statement_file")
          .like("history_type", "Eco-contribution%")
          .order("delivery_datetime", { ascending: false });

        if (year) {
          query = query.gte("delivery_datetime", `${year}-01-01`).lte("delivery_datetime", `${year}-12-31`);
        }

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        if (month && year) {
          const monthStr = String(month).padStart(2, "0");
          query = query
            .gte("delivery_datetime", `${year}-${monthStr}-01`)
            .lte("delivery_datetime", `${year}-${monthStr}-31`);
        }

        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          if (data.length < batchSize) break;
          offset += batchSize;
        } else {
          break;
        }
      }

      return allData;
    },
    enabled: isDeliverooEnabled,
  });

  // Convert Deliveroo data to detail lines format
  const deliverooDetailLines: EcoDetailLine[] = useMemo(() => {
    if (!deliverooEcoData) return [];
    return deliverooEcoData
      .filter(d => d.restaurant_id)
      .map(d => ({
        id: d.id,
        restaurant_id: d.restaurant_id!,
        restaurant_name: d.restaurant_name,
        payout_reference_id: d.statement_file,
        payout_date: d.delivery_datetime,
        description: d.note || "Eco-contribution Deliveroo",
        amount: Number(d.total_payable) || 0,
        platform: "deliveroo" as const,
      }));
  }, [deliverooEcoData]);

  // Merge all detail lines
  const allDetailLines = useMemo(() => {
    return [...(uberDetailLines || []), ...deliverooDetailLines];
  }, [uberDetailLines, deliverooDetailLines]);

  // Fallback: use Uber detail lines (payout_adjustments) only for restaurants
  // that have NO aggregated payouts row, to avoid double-counting when both sources exist.
  const uberDetailFallbackLines = useMemo(() => {
    if (!uberDetailLines) return [];
    const restaurantsWithPayouts = new Set(
      (payoutsData || []).map(p => p.restaurant_id)
    );
    return uberDetailLines.filter(
      line => line.restaurant_id && !restaurantsWithPayouts.has(line.restaurant_id)
    );
  }, [uberDetailLines, payoutsData]);

  // Aggregate by year-month (Uber payouts + Uber detail fallback + Deliveroo)
  const monthlyData = useMemo(() => {
    const byKey = new Map<string, { year: number; month: number; refund: number; charge: number; count: number }>();
    
    const addLineByDate = (dateStr: string | null, amount: number) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m}`;
      const existing = byKey.get(key) || { year: y, month: m, refund: 0, charge: 0, count: 0 };
      if (amount >= 0) {
        existing.refund += amount;
      } else {
        existing.charge += Math.abs(amount);
      }
      existing.count += 1;
      byKey.set(key, existing);
    };

    // Uber payouts (aggregated)
    if (payoutsData) {
      for (const row of payoutsData) {
        const d = new Date(row.payout_date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `${y}-${m}`;
        const existing = byKey.get(key) || { year: y, month: m, refund: 0, charge: 0, count: 0 };
        existing.refund += Number(row.eco_contribution_refund) || 0;
        existing.charge += Number(row.eco_contribution_charge) || 0;
        existing.count += 1;
        byKey.set(key, existing);
      }
    }

    // Uber detail fallback (payout_adjustments for restaurants without aggregated payouts)
    for (const line of uberDetailFallbackLines) {
      addLineByDate(line.payout_date, Number(line.amount) || 0);
    }

    // Deliveroo eco lines
    for (const line of deliverooDetailLines) {
      addLineByDate(line.payout_date, line.amount);
    }

    return Array.from(byKey.values())
      .map(d => ({
        year: d.year,
        month: d.month,
        refund: Math.round(d.refund * 100) / 100,
        charge: Math.round(d.charge * 100) / 100,
        net: Math.round((d.refund - d.charge) * 100) / 100,
        count: d.count,
      }))
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }, [payoutsData, uberDetailFallbackLines, deliverooDetailLines]);

  // Aggregate by restaurant (Uber payouts + Uber detail fallback + Deliveroo)
  const byRestaurant = useMemo(() => {
    const byResto = new Map<string, { refund: number; charge: number; count: number }>();
    
    const addToResto = (restaurantId: string, amount: number) => {
      const existing = byResto.get(restaurantId) || { refund: 0, charge: 0, count: 0 };
      if (amount >= 0) {
        existing.refund += amount;
      } else {
        existing.charge += Math.abs(amount);
      }
      existing.count += 1;
      byResto.set(restaurantId, existing);
    };

    // Uber payouts
    if (payoutsData) {
      for (const row of payoutsData) {
        const existing = byResto.get(row.restaurant_id) || { refund: 0, charge: 0, count: 0 };
        existing.refund += Number(row.eco_contribution_refund) || 0;
        existing.charge += Number(row.eco_contribution_charge) || 0;
        existing.count += 1;
        byResto.set(row.restaurant_id, existing);
      }
    }

    // Uber detail fallback
    for (const line of uberDetailFallbackLines) {
      addToResto(line.restaurant_id, Number(line.amount) || 0);
    }

    // Deliveroo
    for (const line of deliverooDetailLines) {
      addToResto(line.restaurant_id, line.amount);
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
  }, [payoutsData, uberDetailFallbackLines, deliverooDetailLines]);

  // KPI totals
  const totals = useMemo(() => {
    let refund = 0, charge = 0;

    // Uber payouts
    if (payoutsData) {
      for (const row of payoutsData) {
        refund += Number(row.eco_contribution_refund) || 0;
        charge += Number(row.eco_contribution_charge) || 0;
      }
    }

    // Uber detail fallback
    for (const line of uberDetailFallbackLines) {
      const amount = Number(line.amount) || 0;
      if (amount >= 0) refund += amount;
      else charge += Math.abs(amount);
    }

    // Deliveroo
    for (const line of deliverooDetailLines) {
      const amount = line.amount;
      if (amount >= 0) refund += amount;
      else charge += Math.abs(amount);
    }

    return {
      refund: Math.round(refund * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      net: Math.round((refund - charge) * 100) / 100,
      lineCount: allDetailLines.length,
    };
  }, [payoutsData, uberDetailFallbackLines, deliverooDetailLines, allDetailLines]);

  return {
    monthlyData,
    byRestaurant,
    totals,
    detailLines: allDetailLines,
    isLoading: loadingPayouts || loadingUberDetail || loadingDeliveroo,
  };
}
