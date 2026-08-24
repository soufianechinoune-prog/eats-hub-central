import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RestaurantScope = string[] | null | undefined;

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export const GRID_VERSIONS = ["V2", "V4", "V4bis", "V5"] as const;
export type GridVersion = (typeof GRID_VERSIONS)[number];

export interface GridPriceRow {
  version: string;
  product_label: string;
  product_key: string;
  price: number;
}

export function useChataigneGridPrices() {
  return useQuery({
    queryKey: ["chataigne-grid-prices"],
    queryFn: async (): Promise<GridPriceRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_grid_prices" as never);
      if (error) throw error;
      return ((data as unknown as GridPriceRow[] | null) ?? []).map((r) => ({
        version: r.version,
        product_label: r.product_label,
        product_key: r.product_key,
        price: num(r.price),
      }));
    },
  });
}

export function useSetGridPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { version: string; product_key: string; price: number }) => {
      const { error } = await supabase.rpc("set_chataigne_grid_price" as never, {
        p_version: v.version,
        p_product_key: v.product_key,
        p_price: v.price,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chataigne-grid-prices"] });
      qc.invalidateQueries({ queryKey: ["chataigne-price-alerts"] });
    },
  });
}

export interface VersionRestaurantRow {
  version: string;
  restaurant_id: string;
  restaurant_name: string | null;
  city: string | null;
  method: string | null;
  nb_commandes: number;
}

export function useChataigneVersionRestaurants() {
  return useQuery({
    queryKey: ["chataigne-version-restaurants"],
    queryFn: async (): Promise<VersionRestaurantRow[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_version_restaurants" as never);
      if (error) throw error;
      return ((data as unknown as VersionRestaurantRow[] | null) ?? []).map((r) => ({
        version: r.version,
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        city: r.city,
        method: r.method,
        nb_commandes: num(r.nb_commandes),
      }));
    },
  });
}

export function useSetRestaurantVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { restaurant_id: string; version: string }) => {
      const { error } = await supabase.rpc("set_chataigne_restaurant_version" as never, {
        p_restaurant_id: v.restaurant_id,
        p_version: v.version,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chataigne-version-restaurants"] });
      qc.invalidateQueries({ queryKey: ["chataigne-price-alerts"] });
    },
  });
}

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
