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

export interface ChataigneBasketSegmentRow {
  segment: string;
  ordre: number;
  commandes: number;
  panier_moyen: number;
  ca: number;
}

export function useChataigneBasketSegments(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null
) {
  return useQuery({
    queryKey: ["chataigne-basket-segments", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneBasketSegmentRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_basket_segments" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneBasketSegmentRow[] | null) ?? [])
        .map((r) => ({
          segment: String(r.segment),
          ordre: num(r.ordre),
          commandes: num(r.commandes),
          panier_moyen: num(r.panier_moyen),
          ca: num(r.ca),
        }))
        .sort((a, b) => a.ordre - b.ordre);
    },
    enabled: restaurantIds !== undefined,
  });
}

export interface ChataigneReferralSummary {
  filleuls: number;
  conversions: number;
  cout_total: number;
  panier_moyen_filleul: number;
  filleuls_revenus: number;
  taux_reachat: number;
}


export function useChataigneReferralSummary(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null
) {
  return useQuery({
    queryKey: ["chataigne-referral-summary", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneReferralSummary> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_summary" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      const raw = data as unknown;
      const row = (Array.isArray(raw) ? raw[0] : raw) as ChataigneReferralSummary | undefined;
      return {
        filleuls: num(row?.filleuls),
        conversions: num(row?.conversions),
        cout_total: num(row?.cout_total),
        panier_moyen_filleul: num(row?.panier_moyen_filleul),
        filleuls_revenus: num(row?.filleuls_revenus),
        taux_reachat: num(row?.taux_reachat),
      };
    },
    enabled: restaurantIds !== undefined,
  });
}

export interface ChataigneReferralEvolutionRow {
  periode: string;
  filleuls: number;
  parrains_convertis: number;
  cout: number;
  panier_moyen_filleuls: number;
}

export function useChataigneReferralEvolution(
  start: string,
  end: string,
  granularity: GrowthGranularity,
  restaurantIds: RestaurantScope = null
) {
  return useQuery({
    queryKey: ["chataigne-referral-evolution", start, end, granularity, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneReferralEvolutionRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_evolution" as never, {
        p_start: start,
        p_end: end,
        p_granularity: granularity,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneReferralEvolutionRow[] | null) ?? []).map((r) => ({
        periode: String(r.periode),
        filleuls: num(r.filleuls),
        parrains_convertis: num(r.parrains_convertis),
        cout: num(r.cout),
        panier_moyen_filleuls: num(r.panier_moyen_filleuls),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}
