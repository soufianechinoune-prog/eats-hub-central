import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface DailyRow {
  restaurant_id: string | null;
  date: string;
  platform: string;
  revenue_ttc: number;
}

interface Params {
  startDate: Date;
  endDate: Date;
  chainId: string | null;
}

const PAGE_SIZE = 1000;

/**
 * Calcule le CA "Caisse" par restaurant à partir de splash360_daily_sales.
 * Formule par jour & par resto : caisse = max(0, global - uber_eats - deliveroo)
 * Retourne une Map<restaurantId, totalCash>.
 */
export function useRestaurantCashRevenue({ startDate, endDate, chainId }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["restaurant-cash-revenue", chainId, startStr, endStr],
    enabled: !!chainId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, number>> => {
      if (!chainId) return new Map();

      const all: DailyRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("splash360_daily_sales")
          .select("restaurant_id, date, platform, revenue_ttc")
          .eq("chain_id", chainId)
          .neq("restaurant_splash_id", 0)
          .eq("granularity", "day")
          .gte("date", startStr)
          .lte("date", endStr)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = (data ?? []) as DailyRow[];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Group by (restaurant_id, date)
      const byRestoDay = new Map<string, Map<string, { global: number; uber: number; deliveroo: number }>>();
      for (const r of all) {
        if (!r.restaurant_id) continue;
        let dayMap = byRestoDay.get(r.restaurant_id);
        if (!dayMap) {
          dayMap = new Map();
          byRestoDay.set(r.restaurant_id, dayMap);
        }
        const entry = dayMap.get(r.date) ?? { global: 0, uber: 0, deliveroo: 0 };
        const v = Number(r.revenue_ttc) || 0;
        if (r.platform === "global") entry.global += v;
        else if (r.platform === "uber_eats") entry.uber += v;
        else if (r.platform === "deliveroo") entry.deliveroo += v;
        dayMap.set(r.date, entry);
      }

      const result = new Map<string, number>();
      for (const [restoId, dayMap] of byRestoDay) {
        let total = 0;
        for (const v of dayMap.values()) {
          total += Math.max(0, v.global - v.uber - v.deliveroo);
        }
        result.set(restoId, total);
      }
      return result;
    },
  });
}
