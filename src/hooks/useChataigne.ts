import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChataigneOverview {
  ca_brut: number;
  commandes: number;
  panier_moyen: number;
  restos_actifs: number;
  derniere_sync: string | null;
}

export interface ChataigneMonth {
  mois: string;
  restos_actifs: number;
  commandes: number;
  ca_brut: number;
}

export interface ChataigneRestaurant {
  restaurant_id: string;
  restaurant_name: string | null;
  city: string | null;
  commandes: number;
  ca_brut: number;
  panier_moyen: number;
  dernier_jour: string | null;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export type RestaurantScope = string[] | null | undefined;

/** null = tout le réseau accessible ; undefined = scope pas encore résolu (query désactivée) */
const scopeKey = (ids: RestaurantScope) => (ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(","));

export function useChataigneOverview(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-overview", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneOverview | null> => {
      const { data, error } = await supabase.rpc("get_chataigne_overview" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      const row = (data as unknown as ChataigneOverview[] | null)?.[0];
      if (!row) return null;
      return {
        ca_brut: num(row.ca_brut),
        commandes: num(row.commandes),
        panier_moyen: num(row.panier_moyen),
        restos_actifs: num(row.restos_actifs),
        derniere_sync: row.derniere_sync ?? null,
      };
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneMonthly(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-monthly", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneMonth[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_monthly" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneMonth[] | null) ?? []).map((r) => ({
        mois: r.mois,
        restos_actifs: num(r.restos_actifs),
        commandes: num(r.commandes),
        ca_brut: num(r.ca_brut),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneByRestaurant(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-by-restaurant", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneRestaurant[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_by_restaurant" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneRestaurant[] | null) ?? []).map((r) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        city: r.city,
        commandes: num(r.commandes),
        ca_brut: num(r.ca_brut),
        panier_moyen: num(r.panier_moyen),
        dernier_jour: r.dernier_jour ?? null,
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export interface ChataigneProduct {
  item_name: string;
  commandes: number;
  quantite: number;
  ca_estime: number;
  pu_moyen: number;
}

export interface ChataignePromo {
  promo: string;
  utilisations: number;
  montant_total: number;
  remise_moyenne: number;
}

export interface ChataigneBreakdown {
  dimension: "heure" | "service_type" | "canal" | string;
  valeur: string;
  commandes: number;
  ca: number;
  panier_moyen: number;
}

export function useChataigneProducts(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-products", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneProduct[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_products" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneProduct[] | null) ?? []).map((r) => ({
        item_name: r.item_name,
        commandes: num(r.commandes),
        quantite: num(r.quantite),
        ca_estime: num(r.ca_estime),
        pu_moyen: num(r.pu_moyen),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataignePromos(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-promos", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataignePromo[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_promos" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataignePromo[] | null) ?? []).map((r) => ({
        promo: r.promo,
        utilisations: num(r.utilisations),
        montant_total: num(r.montant_total),
        remise_moyenne: num(r.remise_moyenne),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneBreakdown(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-breakdown", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneBreakdown[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_orders_breakdown" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneBreakdown[] | null) ?? []).map((r) => ({
        dimension: r.dimension,
        valeur: String(r.valeur),
        commandes: num(r.commandes),
        ca: num(r.ca),
        panier_moyen: num(r.panier_moyen),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}
