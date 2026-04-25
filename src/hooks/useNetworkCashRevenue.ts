import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const CHICKEN_STREET_CHAIN_ID = "110e05b8-5136-45cc-a385-265360104844";

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

/**
 * Calcule le CA "Caisse" (sur place / hors plateformes de livraison)
 * pour le réseau Chicken Street à partir des données Splash360.
 *
 * Formule : caisse = global - uber_eats - deliveroo (par jour, sommé sur la période).
 * Source : table splash360_daily_sales, restaurant_splash_id = 0 (réseau global).
 *
 * Retourne null si la marque active n'est pas Chicken Street (seule marque
 * pour laquelle Splash360 est branché actuellement).
 */
export function useNetworkCashRevenue({ startDate, endDate, chainId }: Params) {
  const isChickenStreet = chainId === CHICKEN_STREET_CHAIN_ID;
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Période précédente : même plage exactement, décalée d'un an en arrière
  // (N-1). Cohérent avec le toggle "Afficher N-1" du tableau Comparatif et
  // pertinent pour la saisonnalité (mêmes mois civils).
  const days = Math.max(1, differenceInDays(endDate, startDate) + 1);
  const prevStart = new Date(startDate);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prevEnd = new Date(endDate);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  const prevStartStr = format(prevStart, "yyyy-MM-dd");
  const prevEndStr = format(prevEnd, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["network-cash-revenue", chainId, startStr, endStr],
    enabled: isChickenStreet,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<NetworkCashRevenueData | null> => {
      // Période courante
      const { data: currentRows, error } = await supabase
        .from("splash360_daily_sales")
        .select("date, platform, revenue_ttc")
        .eq("restaurant_splash_id", 0)
        .eq("granularity", "day")
        .gte("date", startStr)
        .lte("date", endStr);

      if (error) throw error;

      const aggregated = aggregate(currentRows ?? []);

      // Période précédente (caisse uniquement)
      const { data: prevRows } = await supabase
        .from("splash360_daily_sales")
        .select("date, platform, revenue_ttc")
        .eq("restaurant_splash_id", 0)
        .eq("granularity", "day")
        .gte("date", prevStartStr)
        .lte("date", prevEndStr);

      const prev = aggregate(prevRows ?? []);
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
  const byDay = new Map<string, { global: number; uber: number; deliveroo: number }>();
  for (const r of rows) {
    const entry = byDay.get(r.date) ?? { global: 0, uber: 0, deliveroo: 0 };
    if (r.platform === "global") entry.global += Number(r.revenue_ttc) || 0;
    else if (r.platform === "uber_eats") entry.uber += Number(r.revenue_ttc) || 0;
    else if (r.platform === "deliveroo") entry.deliveroo += Number(r.revenue_ttc) || 0;
    byDay.set(r.date, entry);
  }

  let totalGlobal = 0;
  let totalUber = 0;
  let totalDeliveroo = 0;
  let totalCash = 0;
  for (const v of byDay.values()) {
    totalGlobal += v.global;
    totalUber += v.uber;
    totalDeliveroo += v.deliveroo;
    // La caisse = global - uber - deliveroo (par jour, pour éviter les
    // jours où un canal manque).
    totalCash += Math.max(0, v.global - v.uber - v.deliveroo);
  }

  return {
    totalGlobal,
    totalUber,
    totalDeliveroo,
    totalCash,
    daysWithData: byDay.size,
  };
}
