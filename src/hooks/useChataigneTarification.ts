import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RestaurantScope = string[] | null | undefined;

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export interface PriceAlertRow {
  restaurant_id: string;
  restaurant_name: string | null;
  version: string | null;
  item_name: string;
  prix_emport_observe: number;
  prix_grille: number;
  ecart: number;
}

export function useChataignePriceAlerts(restaurantIds: RestaurantScope) {
  return useQuery({
    queryKey: ["chataigne-price-alerts", scopeKey(restaurantIds)],
    enabled: restaurantIds !== undefined,
    queryFn: async (): Promise<PriceAlertRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_price_alerts" as never, {
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as PriceAlertRow[] | null) ?? []).map((r) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        version: r.version,
        item_name: r.item_name,
        prix_emport_observe: num(r.prix_emport_observe),
        prix_grille: num(r.prix_grille),
        ecart: num(r.ecart),
      }));
    },
  });
}

export interface MarkupRow {
  restaurant_id: string;
  restaurant_name: string | null;
  item_name: string;
  prix_emport: number;
  prix_livraison: number;
  markup_pct: number;
  nb_livraison: number;
}

export function useChataigneMarkup(restaurantIds: RestaurantScope) {
  return useQuery({
    queryKey: ["chataigne-markup", scopeKey(restaurantIds)],
    enabled: restaurantIds !== undefined,
    queryFn: async (): Promise<MarkupRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_markup" as never, {
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as MarkupRow[] | null) ?? []).map((r) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        item_name: r.item_name,
        prix_emport: num(r.prix_emport),
        prix_livraison: num(r.prix_livraison),
        markup_pct: num(r.markup_pct),
        nb_livraison: num(r.nb_livraison),
      }));
    },
  });
}
