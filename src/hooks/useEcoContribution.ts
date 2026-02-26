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
  const isUberEnabled = platform === "uber_eats" || platform === "global";
  const isDeliverooEnabled = platform === "deliveroo" || platform === "global";
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

  // Aggregate by year-month (Uber payouts + Deliveroo)
  const monthlyData = useMemo(() => {
    const byKey = new Map<string, { year: number; month: number; refund: number; charge: number; count: number }>();
    
    // Uber payouts
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

    // Deliveroo eco lines
    for (const line of deliverooDetailLines) {
      if (!line.payout_date) continue;
      const d = new Date(line.payout_date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m}`;
      const existing = byKey.get(key) || { year: y, month: m, refund: 0, charge: 0, count: 0 };
      const amount = line.amount;
      if (amount >= 0) {
        existing.refund += amount;
      } else {
        existing.charge += Math.abs(amount);
      }
      existing.count += 1;
      byKey.set(key, existing);
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
  }, [payoutsData, deliverooDetailLines]);

  // Aggregate by restaurant (Uber + Deliveroo)
  const byRestaurant = useMemo(() => {
    const byResto = new Map<string, { refund: number; charge: number; count: number }>();
    
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

    // Deliveroo
    for (const line of deliverooDetailLines) {
      const existing = byResto.get(line.restaurant_id) || { refund: 0, charge: 0, count: 0 };
      const amount = line.amount;
      if (amount >= 0) {
        existing.refund += amount;
      } else {
        existing.charge += Math.abs(amount);
      }
      existing.count += 1;
      byResto.set(line.restaurant_id, existing);
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
  }, [payoutsData, deliverooDetailLines]);

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

    // Deliveroo
    for (const line of deliverooDetailLines) {
      const amount = line.amount;
      if (amount >= 0) {
        refund += amount;
      } else {
        charge += Math.abs(amount);
      }
    }

    return {
      refund: Math.round(refund * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      net: Math.round((refund - charge) * 100) / 100,
      lineCount: allDetailLines.length,
    };
  }, [payoutsData, deliverooDetailLines, allDetailLines]);

  return {
    monthlyData,
    byRestaurant,
    totals,
    detailLines: allDetailLines,
    isLoading: loadingPayouts || loadingUberDetail || loadingDeliveroo,
  };
}
