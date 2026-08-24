import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantScope } from "@/hooks/useChataigne";

export type GrowthGranularity = "day" | "week" | "month";

export interface ChataigneCustomerEvolutionRow {
  periode: string;
  nouveaux: number;
  recurrents: number;
  actifs: number;
  ca_nouveaux: number;
  ca_recurrents: number;
  commandes: number;
}

export interface ChataigneCohortRow {
  cohorte: string;
  taille_cohorte: number;
  mois_offset: number;
  clients_actifs: number;
  taux_pct: number;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export function useChataigneCustomerEvolution(
  start: string,
  end: string,
  granularity: GrowthGranularity,
  restaurantIds: RestaurantScope = null
) {
  return useQuery({
    queryKey: ["chataigne-customer-evolution", start, end, granularity, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneCustomerEvolutionRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_customer_evolution" as never, {
        p_start: start,
        p_end: end,
        p_granularity: granularity,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneCustomerEvolutionRow[] | null) ?? []).map((r) => ({
        periode: String(r.periode),
        nouveaux: num(r.nouveaux),
        recurrents: num(r.recurrents),
        actifs: num(r.actifs),
        ca_nouveaux: num(r.ca_nouveaux),
        ca_recurrents: num(r.ca_recurrents),
        commandes: num(r.commandes),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneCohortRetention(restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-cohort-retention", scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneCohortRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_cohort_retention" as never, {
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneCohortRow[] | null) ?? []).map((r) => ({
        cohorte: String(r.cohorte),
        taille_cohorte: num(r.taille_cohorte),
        mois_offset: num(r.mois_offset),
        clients_actifs: num(r.clients_actifs),
        taux_pct: num(r.taux_pct),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}
