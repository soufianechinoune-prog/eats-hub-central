import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantScope } from "@/hooks/useChataigne";
import type { GrowthGranularity } from "@/hooks/useChataigneGrowth";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export interface ReferralAcquisitionRow {
  periode: string;
  filleuls: number;
  parrains: number;
  nouveaux_clients: number;
  part_parrainage: number;
  viralite: number;
  cout_filleul: number;
  cout_parrain: number;
  cac: number;
  panier_moyen_filleul: number;
  offert_count: number;
  offert_vente: number;
}

export function useChataigneReferralAcquisition(
  start: string,
  end: string,
  granularity: GrowthGranularity,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-referral-acquisition", start, end, granularity, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ReferralAcquisitionRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_acquisition" as never, {
        p_start: start,
        p_end: end,
        p_granularity: granularity,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ReferralAcquisitionRow[] | null) ?? []).map((r) => ({
        periode: String(r.periode),
        filleuls: num(r.filleuls),
        parrains: num(r.parrains),
        nouveaux_clients: num(r.nouveaux_clients),
        part_parrainage: num(r.part_parrainage),
        viralite: num(r.viralite),
        cout_filleul: num(r.cout_filleul),
        cout_parrain: num(r.cout_parrain),
        cac: num(r.cac),
        panier_moyen_filleul: num(r.panier_moyen_filleul),
        offert_count: num(r.offert_count),
        offert_vente: num(r.offert_vente),
      }));
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}

export interface ReferralPaybackRow {
  basis: "rank" | "days";
  x: number;
  clients: number;
  contribution_moy: number | null;
  contribution_cumul: number;
  cac: number;
  filleuls_total: number;
}

export function useChataigneReferralPayback(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-referral-payback", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ReferralPaybackRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_payback" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ReferralPaybackRow[] | null) ?? []).map((r) => ({
        basis: (String(r.basis) === "days" ? "days" : "rank") as "rank" | "days",
        x: num(r.x),
        clients: num(r.clients),
        contribution_moy: numOrNull(r.contribution_moy),
        contribution_cumul: num(r.contribution_cumul),
        cac: num(r.cac),
        filleuls_total: num(r.filleuls_total),
      }));
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}

export interface ReferralRetentionRow {
  segment: string;
  cohorte: string;
  mois_offset: number;
  taille_cohorte: number;
  clients_actifs: number;
  taux_pct: number;
}

export function useChataigneReferralRetention(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-referral-retention", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ReferralRetentionRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_retention" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ReferralRetentionRow[] | null) ?? []).map((r) => ({
        segment: String(r.segment),
        cohorte: String(r.cohorte),
        mois_offset: num(r.mois_offset),
        taille_cohorte: num(r.taille_cohorte),
        clients_actifs: num(r.clients_actifs),
        taux_pct: num(r.taux_pct),
      }));
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}

export interface ReferralSegmentRow {
  segment: string;
  ordre: number;
  clients: number;
  taux_reachat: number;
  commandes_moy: number;
  panier_moyen: number;
  contribution_moy: number;
}

export function useChataigneReferralSegments(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-referral-segments", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ReferralSegmentRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_segments" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ReferralSegmentRow[] | null) ?? [])
        .map((r) => ({
          segment: String(r.segment),
          ordre: num(r.ordre),
          clients: num(r.clients),
          taux_reachat: num(r.taux_reachat),
          commandes_moy: num(r.commandes_moy),
          panier_moyen: num(r.panier_moyen),
          contribution_moy: num(r.contribution_moy),
        }))
        .sort((a, b) => a.ordre - b.ordre);
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}

export interface ReferralLtvRow {
  segment: string;
  cohorte: string;
  mois_offset: number;
  taille_cohorte: number;
  clients_actifs: number;
  commandes: number;
  ca_cumul_par_client: number;
  contribution_cumul_par_client: number;
  cac: number;
  mois_observes: number;
}

export function useChataigneReferralLtv(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-referral-ltv", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ReferralLtvRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_referral_ltv" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ReferralLtvRow[] | null) ?? []).map((r) => ({
        segment: String(r.segment),
        cohorte: String(r.cohorte),
        mois_offset: num(r.mois_offset),
        taille_cohorte: num(r.taille_cohorte),
        clients_actifs: num(r.clients_actifs),
        commandes: num(r.commandes),
        ca_cumul_par_client: num(r.ca_cumul_par_client),
        contribution_cumul_par_client: num(r.contribution_cumul_par_client),
        cac: num(r.cac),
        mois_observes: num(r.mois_observes),
      }));
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}
