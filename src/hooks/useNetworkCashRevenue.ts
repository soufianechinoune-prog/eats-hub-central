import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";


interface DailyRow {
  date: string;
  platform: string;
  revenue_ttc: number;
  revenue_ht: number;
  vat_amount: number;
  order_count: number;
}

export interface NetworkCashRevenueData {
  totalCash: number;
  totalCashHT: number;
  totalCashVAT: number;
  totalCashOrders: number;
  cashAvgBasket: number;
  totalGlobal: number;
  totalUber: number;
  totalDeliveroo: number;
  totalGlobalOrders: number;
  totalUberOrders: number;
  totalDeliverooOrders: number;
  cashShare: number; // % de la caisse dans le CA total réseau (global)
  daysWithData: number;
  previousPeriodCash: number | null;
  previousPeriodCashOrders: number | null;
  cashVariation: number | null; // en %
  ordersVariation: number | null; // en %
}

interface Params {
  startDate: Date;
  endDate: Date;
  chainId: string | null;
}

const PAGE_SIZE = 1000;

/**
 * Charge toutes les lignes Splash360 (granularité jour) sur une période donnée,
 * scopées à la chain, en excluant la ligne réseau agrégée (restaurant_splash_id = 0).
 */
async function fetchSplashRows(
  chainId: string | null,
  startStr: string,
  endStr: string,
): Promise<DailyRow[]> {
  const all: DailyRow[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("splash360_daily_sales")
      .select("date, platform, revenue_ttc, revenue_ht, vat_amount, order_count")
      .neq("restaurant_splash_id", 0)
      .eq("granularity", "day")
      .gte("date", startStr)
      .lte("date", endStr)
      .range(from, from + PAGE_SIZE - 1);
    // Quand chainId est null (vue Réseau global), RLS scope déjà aux chains accessibles.
    if (chainId) query = query.eq("chain_id", chainId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as DailyRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export function useNetworkCashRevenue({ startDate, endDate, chainId }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const prevStart = new Date(startDate);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prevEnd = new Date(endDate);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  const prevStartStr = format(prevStart, "yyyy-MM-dd");
  const prevEndStr = format(prevEnd, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["network-cash-revenue", chainId, startStr, endStr],
    enabled: !!chainId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<NetworkCashRevenueData | null> => {
      if (!chainId) return null;

      const [currentRows, prevRows] = await Promise.all([
        fetchSplashRows(chainId, startStr, endStr),
        fetchSplashRows(chainId, prevStartStr, prevEndStr),
      ]);

      const aggregated = aggregate(currentRows);
      const prev = aggregate(prevRows);

      const previousPeriodCash = prev.daysWithData > 0 ? prev.totalCash : null;
      const previousPeriodCashOrders = prev.daysWithData > 0 ? prev.totalCashOrders : null;

      const cashVariation =
        previousPeriodCash != null && previousPeriodCash > 0
          ? ((aggregated.totalCash - previousPeriodCash) / previousPeriodCash) * 100
          : null;

      const ordersVariation =
        previousPeriodCashOrders != null && previousPeriodCashOrders > 0
          ? ((aggregated.totalCashOrders - previousPeriodCashOrders) / previousPeriodCashOrders) * 100
          : null;

      const cashShare =
        aggregated.totalGlobal > 0
          ? (aggregated.totalCash / aggregated.totalGlobal) * 100
          : 0;

      const cashAvgBasket =
        aggregated.totalCashOrders > 0
          ? aggregated.totalCash / aggregated.totalCashOrders
          : 0;

      return {
        ...aggregated,
        cashShare,
        cashAvgBasket,
        previousPeriodCash,
        previousPeriodCashOrders,
        cashVariation,
        ordersVariation,
      };
    },
  });
}

function aggregate(rows: DailyRow[]) {
  // Somme par (date, platform), puis dérivation caisse jour par jour.
  type DayEntry = {
    global: number; uber: number; deliveroo: number;
    globalHT: number; uberHT: number; deliverooHT: number;
    globalVAT: number; uberVAT: number; deliverooVAT: number;
    globalOrders: number; uberOrders: number; deliverooOrders: number;
  };
  const empty = (): DayEntry => ({
    global: 0, uber: 0, deliveroo: 0,
    globalHT: 0, uberHT: 0, deliverooHT: 0,
    globalVAT: 0, uberVAT: 0, deliverooVAT: 0,
    globalOrders: 0, uberOrders: 0, deliverooOrders: 0,
  });
  const byDay = new Map<string, DayEntry>();
  for (const r of rows) {
    const entry = byDay.get(r.date) ?? empty();
    const ttc = Number(r.revenue_ttc) || 0;
    const ht = Number(r.revenue_ht) || 0;
    const vat = Number(r.vat_amount) || 0;
    const orders = Number(r.order_count) || 0;
    if (r.platform === "global") {
      entry.global += ttc; entry.globalHT += ht; entry.globalVAT += vat; entry.globalOrders += orders;
    } else if (r.platform === "uber_eats") {
      entry.uber += ttc; entry.uberHT += ht; entry.uberVAT += vat; entry.uberOrders += orders;
    } else if (r.platform === "deliveroo") {
      entry.deliveroo += ttc; entry.deliverooHT += ht; entry.deliverooVAT += vat; entry.deliverooOrders += orders;
    }
    byDay.set(r.date, entry);
  }

  let totalGlobal = 0, totalUber = 0, totalDeliveroo = 0;
  let totalCash = 0, totalCashHT = 0, totalCashVAT = 0;
  let totalGlobalOrders = 0, totalUberOrders = 0, totalDeliverooOrders = 0;
  let totalCashOrders = 0;
  let daysWithData = 0;
  for (const v of byDay.values()) {
    totalGlobal += v.global; totalUber += v.uber; totalDeliveroo += v.deliveroo;
    totalGlobalOrders += v.globalOrders;
    totalUberOrders += v.uberOrders;
    totalDeliverooOrders += v.deliverooOrders;
    totalCash += Math.max(0, v.global - v.uber - v.deliveroo);
    totalCashHT += Math.max(0, v.globalHT - v.uberHT - v.deliverooHT);
    totalCashVAT += Math.max(0, v.globalVAT - v.uberVAT - v.deliverooVAT);
    totalCashOrders += Math.max(0, v.globalOrders - v.uberOrders - v.deliverooOrders);
    if (v.global > 0 || v.uber > 0 || v.deliveroo > 0) daysWithData++;
  }

  return {
    totalGlobal, totalUber, totalDeliveroo,
    totalGlobalOrders, totalUberOrders, totalDeliverooOrders,
    totalCash, totalCashHT, totalCashVAT, totalCashOrders,
    daysWithData,
  };
}
