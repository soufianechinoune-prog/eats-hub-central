import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export const CHANNELS = [
  { key: "uber", label: "Uber Eats" },
  { key: "deliveroo", label: "Deliveroo" },
  { key: "dishop", label: "Dishop" },
  { key: "chataigne", label: "Châtaigne" },
] as const;
export type PriceChannel = typeof CHANNELS[number]["key"];
export interface ChannelPriceProduct {
  key: string;
  label: string;
  channel: PriceChannel;
  prices: Record<string, number>;
}
export interface ChannelImportRow {
  restaurant_id: string;
  channel: PriceChannel;
  product_key: string;
  product_label: string;
  price: number;
}

export function useChannelPriceMatrix() {
  const { selectedChainId } = useAnalyticsContext();
  return useQuery({
    queryKey: ["channel-price-matrix", selectedChainId],
    enabled: !!selectedChainId && selectedChainId !== "00000000-0000-0000-0000-000000000000",
    queryFn: async (): Promise<ChannelPriceProduct[]> => {
      const { data, error } = await supabase.rpc("get_channel_price_matrix", { p_chain_id: selectedChainId });
      if (error) throw error;
      return ((data as unknown as ChannelPriceProduct[] | null) ?? []).map((item) => ({
        ...item,
        prices: Object.fromEntries(Object.entries(item.prices ?? {}).map(([id, value]) => [id, Number(value)])),
      }));
    },
  });
}

export function useSetChannelPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: ChannelImportRow) => {
      const { error } = await supabase.rpc("set_channel_restaurant_price", {
        p_restaurant_id: row.restaurant_id,
        p_channel: row.channel,
        p_product_key: row.product_key,
        p_product_label: row.product_label,
        p_price: row.price,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel-price-matrix"] }),
  });
}

export function useImportChannelPrices() {
  const { selectedChainId } = useAnalyticsContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ChannelImportRow[]) => {
      if (!selectedChainId) throw new Error("Enseigne introuvable");
      let total = 0;
      for (let i = 0; i < rows.length; i += 2000) {
        const { data, error } = await supabase.rpc("import_channel_restaurant_prices", {
          p_chain_id: selectedChainId,
          p_rows: rows.slice(i, i + 2000) as unknown as import("@/integrations/supabase/types").Json,
        });
        if (error) throw error;
        total += Number(data ?? 0);
      }
      return total;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel-price-matrix"] }),
  });
}