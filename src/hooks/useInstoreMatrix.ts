import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export interface MatrixProduct {
  key: string;
  label: string;
  prices: Record<string, number>;
}

export interface ImportRow {
  restaurant_id: string;
  product_key: string;
  product_label: string;
  price: number;
}

export const productKey = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export function useInstoreMatrix() {
  const { selectedChainId } = useAnalyticsContext();
  return useQuery({
    queryKey: ["instore-matrix", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async (): Promise<MatrixProduct[]> => {
      const { data, error } = await supabase.rpc("get_instore_price_matrix" as never, {
        p_chain_id: selectedChainId,
      } as never);
      if (error) throw error;
      return ((data as unknown as MatrixProduct[] | null) ?? []).map((p) => ({
        ...p,
        prices: Object.fromEntries(Object.entries(p.prices ?? {}).map(([k, v]) => [k, Number(v)])),
      }));
    },
  });
}

export function useSetRestaurantPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { restaurant_id: string; product_key: string; product_label: string; price: number }) => {
      const { error } = await supabase.rpc("set_instore_restaurant_price" as never, {
        p_restaurant_id: v.restaurant_id,
        p_product_key: v.product_key,
        p_product_label: v.product_label,
        p_price: v.price,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instore-matrix"] }),
  });
}

export function useImportRestaurantPrices() {
  const qc = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();
  return useMutation({
    mutationFn: async (rows: ImportRow[]) => {
      let total = 0;
      for (let i = 0; i < rows.length; i += 2000) {
        const { data, error } = await supabase.rpc("import_instore_restaurant_prices" as never, {
          p_chain_id: selectedChainId,
          p_rows: rows.slice(i, i + 2000),
        } as never);
        if (error) throw error;
        total += Number(data ?? 0);
      }
      return total;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instore-matrix"] }),
  });
}
