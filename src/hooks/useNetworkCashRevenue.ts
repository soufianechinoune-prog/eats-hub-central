import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";


interface DailyRow {
  date: string;
  platform: string;
  revenue_ttc: number;
}

export interface NetworkCashRevenueData {
  totalCash: number;
  totalGlobal: number;
  totalUber: number;
  totalDeliveroo: number;
  cashShare: number; // % de la caisse dans le CA total réseau (global)
  daysWithData: number;
  previousPeriodCash: number | null;
  cashVariation: number | null; // en %
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
 *
 * On préfère agréger nous-mêmes à partir des restaurants individuels car le backfill
 * historique a été fait resto par resto — la ligne réseau (id=0) n'est peuplée que
 * pour le mois en cours via la sync standard.
 */
async function fetchSplashRows(
  chainId: string,
  startStr: string,
  endStr: string,
): Promise<DailyRow[]> {
  const all: DailyRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("splash360_daily_sales")
      .select("date, platform, revenue_ttc")
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
  return all;
}

/**
 * Calcule le CA "Caisse" (sur place / hors plateformes de livraison)
 * pour le réseau à partir des données Splash360.
 *
 * Formule par jour : caisse = max(0, global - uber_eats - deliveroo)
 * Sources : table splash360_daily_sales, agrégée à partir de tous les restaurants
 * de la marque (restaurant_splash_id != 0).
 */
export function useNetworkCashRevenue({ startDate, endDate, chainId }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Période N-1 : même plage exactement, décalée d'un an.
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

      const cashVariation =
        previousPeriodCash != null && previousPeriodCash > 0
          ? ((aggregated.totalCash - previousPeriodCash) / previousPeriodCash) * 100
          : null;

      const cashShare =
        aggregated.totalGlobal > 0
          ? (aggregated.totalCash / aggregated.totalGlobal) * 100
          : 0;

      return {
        ...aggregated,
        cashShare,
        previousPeriodCash,
        cashVariation,
      };
    },
  });
}

function aggregate(rows: DailyRow[]) {
  // Somme par (date, platform) à travers tous les restaurants, puis on dérive la caisse jour par jour.
  const byDay = new Map<string, { global: number; uber: number; deliveroo: number }>();
  for (const r of rows) {
    const entry = byDay.get(r.date) ?? { global: 0, uber: 0, deliveroo: 0 };
    const v = Number(r.revenue_ttc) || 0;
    if (r.platform === "global") entry.global += v;
    else if (r.platform === "uber_eats") entry.uber += v;
    else if (r.platform === "deliveroo") entry.deliveroo += v;
    byDay.set(r.date, entry);
  }

  let totalGlobal = 0;
  let totalUber = 0;
  let totalDeliveroo = 0;
  let totalCash = 0;
  let daysWithData = 0;
  for (const v of byDay.values()) {
    totalGlobal += v.global;
    totalUber += v.uber;
    totalDeliveroo += v.deliveroo;
    totalCash += Math.max(0, v.global - v.uber - v.deliveroo);
    if (v.global > 0 || v.uber > 0 || v.deliveroo > 0) daysWithData++;
  }

  return {
    totalGlobal,
    totalUber,
    totalDeliveroo,
    totalCash,
    daysWithData,
  };
}
