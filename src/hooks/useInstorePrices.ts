import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export const GRID_VERSIONS = ["V2","V4","V4BIS","V5","VRE"] as const;
export type GridVersion = (typeof GRID_VERSIONS)[number];

export interface GridPriceRow {
  version: string;
  product_label: string;
  product_key: string;
  price: number;
}

export function useInstoreGridPrices() {
  const { selectedChainId } = useAnalyticsContext();
  return useQuery({
    queryKey: ["instore-grid-prices", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async (): Promise<GridPriceRow[]> => {
      const { data, error } = await supabase.rpc("get_instore_price_grid" as never, {
        p_chain_id: selectedChainId,
      } as never);
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

export function useSetInstoreGridPrice() {
  const qc = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();
  return useMutation({
    mutationFn: async (v: { version: string; product_key: string; price: number }) => {
      const { error } = await supabase.rpc("set_instore_grid_price" as never, {
        p_chain_id: selectedChainId,
        p_version: v.version,
        p_product_key: v.product_key,
        p_price: v.price,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instore-grid-prices"] });
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
}

export function useRestaurantPriceVersions() {
  const { selectedChainId } = useAnalyticsContext();
  return useQuery({
    queryKey: ["restaurant-price-versions", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async (): Promise<VersionRestaurantRow[]> => {
      const { data, error } = await supabase.rpc("get_restaurant_price_versions" as never, {
        p_chain_id: selectedChainId,
      } as never);
      if (error) throw error;
      return ((data as unknown as VersionRestaurantRow[] | null) ?? []).map((r) => ({
        version: r.version,
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        city: r.city,
        method: r.method,
      }));
    },
  });
}

export function useSetRestaurantPriceVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { restaurant_id: string; version: string }) => {
      const { error } = await supabase.rpc("set_restaurant_price_version" as never, {
        p_restaurant_id: v.restaurant_id,
        p_version: v.version,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-price-versions"] });
      qc.invalidateQueries({ queryKey: ["chataigne-price-alerts"] });
    },
  });
}
