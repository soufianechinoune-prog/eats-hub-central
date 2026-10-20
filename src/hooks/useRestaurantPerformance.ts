import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Canaux V1 de la page performance (Dishop exclu, comme pour Mijo). */
export const PERF_CHANNELS = ["caisse", "uber_eats", "deliveroo", "chataigne"] as const;
export type PerfChannel = (typeof PERF_CHANNELS)[number];

export interface PerfKpiRow {
  canal: PerfChannel | "total";
  ca: number;
  versement: number;
  rentabilite_pct: number | null;
  commandes: number;
}

export interface PerfDailyRow {
  day: string;
  canal: PerfChannel;
  ca: number;
  commandes: number;
}

export interface PerfMonthlyRow {
  mois: string;
  canal: PerfChannel;
  ca: number;
  commandes: number;
}

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => { range: (a: number, b: number) => Promise<{ data: unknown; error: Error | null }> } & Promise<{
  data: unknown;
  error: Error | null;
}>;

/**
 * Source de vérité unique : fonctions mijo_* (multi-canal, Châtaigne déduite de la caisse).
 * Aucun recalcul métier ici, seulement de la mise en forme.
 */
export function useRestaurantPerformance(
  chainId: string | null,
  restaurantId: string | undefined,
  start: string,
  end: string,
  granularity: "day" | "week" | "month",
) {
  const enabled = !!chainId && !!restaurantId && chainId !== "00000000-0000-0000-0000-000000000000";
  const args = { p_chain_id: chainId, p_start: start, p_end: end, p_canal: "tous", p_restaurant_ids: [restaurantId] };

  const kpis = useQuery({
    queryKey: ["resto-perf-kpis", chainId, restaurantId, start, end],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("mijo_kpis_periode", args);
      if (error) throw error;
      return ((data ?? []) as PerfKpiRow[]).map((r) => ({
        ...r,
        ca: Number(r.ca) || 0,
        versement: Number(r.versement) || 0,
        commandes: Number(r.commandes) || 0,
        rentabilite_pct: r.rentabilite_pct == null ? null : Number(r.rentabilite_pct),
      }));
    },
  });

  const daily = useQuery({
    queryKey: ["resto-perf-daily", chainId, restaurantId, start, end],
    enabled: enabled && granularity !== "month",
    retry: false,
    queryFn: async () => {
      const all: PerfDailyRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await rpc("mijo_daily_base", args).range(from, from + 999);
        if (error) throw error;
        const rows = (data ?? []) as PerfDailyRow[];
        all.push(...rows.map((r) => ({ ...r, ca: Number(r.ca) || 0, commandes: Number(r.commandes) || 0 })));
        if (rows.length < 1000) break;
      }
      return all;
    },
  });

  const monthly = useQuery({
    queryKey: ["resto-perf-monthly", chainId, restaurantId, start, end],
    enabled: enabled && granularity === "month",
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("mijo_evolution_mensuelle", args);
      if (error) throw error;
      return ((data ?? []) as PerfMonthlyRow[]).map((r) => ({
        ...r,
        ca: Number(r.ca) || 0,
        commandes: Number(r.commandes) || 0,
      }));
    },
  });

  return { kpis, daily, monthly };
}
