import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface DailyRow {
  restaurant_id: string | null;
  date: string;
  platform: string;
  revenue_ttc: number;
  order_count: number;
  n1_revenue_ttc: number | null;
  n1_order_count: number | null;
}

export interface RestaurantCashStats {
  cashRevenue: number;
  cashOrders: number;
  cashAvgBasket: number;
  globalRevenue: number;
  cashShare: number; // % de la caisse dans le CA total du resto
  prevCashRevenue: number | null;
  cashVariation: number | null;
  prevCashOrders: number | null;
  ordersVariation: number | null;
  daysWithData: number;
}

interface Params {
  startDate: Date;
  endDate: Date;
  chainId: string | null;
}

const PAGE_SIZE = 1000;

/**
 * Calcule les stats Caisse par restaurant à partir de splash360_daily_sales.
 * Formule par jour & par resto : caisse = max(0, global - uber_eats - deliveroo).
 * N-1 = colonne `n1_revenue_ttc` / `n1_order_count` fournie par Splash sur la même journée.
 * Retourne une Map<restaurantId, RestaurantCashStats>.
 */
export function useRestaurantCashRevenue({ startDate, endDate, chainId }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["restaurant-cash-revenue", chainId ?? "all", startStr, endStr],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, RestaurantCashStats>> => {
      const all: DailyRow[] = [];
      let from = 0;
      while (true) {
        let query = supabase
          .from("splash360_daily_sales")
          .select("restaurant_id, date, platform, revenue_ttc, order_count, n1_revenue_ttc, n1_order_count")
          .neq("restaurant_splash_id", 0)
          .eq("granularity", "day")
          .gte("date", startStr)
          .lte("date", endStr)
          .range(from, from + PAGE_SIZE - 1);
        // chainId null → RLS scope déjà aux chains accessibles
        if (chainId) query = query.eq("chain_id", chainId);
        const { data, error } = await query;
        if (error) throw error;
        const rows = (data ?? []) as DailyRow[];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      type DayEntry = {
        global: number; uber: number; deliveroo: number;
        globalOrders: number; uberOrders: number; deliverooOrders: number;
        n1Global: number; n1Uber: number; n1Deliveroo: number;
        n1GlobalOrders: number; n1UberOrders: number; n1DeliverooOrders: number;
      };
      const empty = (): DayEntry => ({
        global: 0, uber: 0, deliveroo: 0,
        globalOrders: 0, uberOrders: 0, deliverooOrders: 0,
        n1Global: 0, n1Uber: 0, n1Deliveroo: 0,
        n1GlobalOrders: 0, n1UberOrders: 0, n1DeliverooOrders: 0,
      });

      const byRestoDay = new Map<string, Map<string, DayEntry>>();
      for (const r of all) {
        if (!r.restaurant_id) continue;
        let dayMap = byRestoDay.get(r.restaurant_id);
        if (!dayMap) {
          dayMap = new Map();
          byRestoDay.set(r.restaurant_id, dayMap);
        }
        const entry = dayMap.get(r.date) ?? empty();
        const ttc = Number(r.revenue_ttc) || 0;
        const orders = Number(r.order_count) || 0;
        const n1Ttc = Number(r.n1_revenue_ttc) || 0;
        const n1Orders = Number(r.n1_order_count) || 0;
        if (r.platform === "global") {
          entry.global += ttc; entry.globalOrders += orders;
          entry.n1Global += n1Ttc; entry.n1GlobalOrders += n1Orders;
        } else if (r.platform === "uber_eats") {
          entry.uber += ttc; entry.uberOrders += orders;
          entry.n1Uber += n1Ttc; entry.n1UberOrders += n1Orders;
        } else if (r.platform === "deliveroo") {
          entry.deliveroo += ttc; entry.deliverooOrders += orders;
          entry.n1Deliveroo += n1Ttc; entry.n1DeliverooOrders += n1Orders;
        }
        dayMap.set(r.date, entry);
      }

      const result = new Map<string, RestaurantCashStats>();
      for (const [restoId, dayMap] of byRestoDay) {
        let cash = 0, cashOrders = 0, globalRev = 0;
        let n1Cash = 0, n1CashOrders = 0;
        let hasN1Cash = false, hasN1Orders = false;
        let daysWithData = 0;
        for (const v of dayMap.values()) {
          // La ligne `global` de Splash = Caisse uniquement (pas le total resto).
          cash += v.global;
          cashOrders += v.globalOrders;
          globalRev += v.global + v.uber + v.deliveroo;
          const dayN1Cash = v.n1Global;
          const dayN1Orders = v.n1GlobalOrders;
          n1Cash += dayN1Cash;
          n1CashOrders += dayN1Orders;
          if (v.n1Global > 0) hasN1Cash = true;
          if (v.n1GlobalOrders > 0) hasN1Orders = true;
          if (v.global > 0 || v.uber > 0 || v.deliveroo > 0) daysWithData++;
        }
        const prevCash = hasN1Cash ? n1Cash : null;
        const prevCashOrders = hasN1Orders ? n1CashOrders : null;
        result.set(restoId, {
          cashRevenue: cash,
          cashOrders,
          cashAvgBasket: cashOrders > 0 ? cash / cashOrders : 0,
          globalRevenue: globalRev,
          cashShare: globalRev > 0 ? (cash / globalRev) * 100 : 0,
          prevCashRevenue: prevCash,
          cashVariation: prevCash != null && prevCash > 0
            ? ((cash - prevCash) / prevCash) * 100
            : null,
          prevCashOrders,
          ordersVariation: prevCashOrders != null && prevCashOrders > 0
            ? ((cashOrders - prevCashOrders) / prevCashOrders) * 100
            : null,
          daysWithData,
        });
      }
      return result;
    },
  });
}
