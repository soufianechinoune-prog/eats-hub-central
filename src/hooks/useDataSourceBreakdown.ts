import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { DataSource } from "@/components/overview/DataSourceBadge";

export interface RestaurantDataSourceInfo {
  dominantSource: DataSource;
  uberRevenue: number;
  csvRevenue: number;
  uberShare: number;
}

interface Params {
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

export function useDataSourceBreakdown({ restaurantIds, startDate, endDate, enabled = true }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["data-source-breakdown", restaurantIds, startStr, endStr],
    enabled: enabled && restaurantIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_orders_data_source_breakdown", {
        restaurant_ids: restaurantIds,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      if (error) throw error;

      const map = new Map<string, RestaurantDataSourceInfo>();
      const acc = new Map<string, { uber: number; csv: number }>();

      for (const row of (data ?? []) as Array<{ restaurant_id: string; data_source: string; revenue: number }>) {
        const cur = acc.get(row.restaurant_id) ?? { uber: 0, csv: 0 };
        const rev = Number(row.revenue) || 0;
        if (row.data_source === "uber_api") cur.uber += rev;
        else cur.csv += rev;
        acc.set(row.restaurant_id, cur);
      }

      for (const [id, { uber, csv }] of acc) {
        const total = uber + csv;
        const uberShare = total > 0 ? uber / total : 0;
        let dominantSource: DataSource;
        if (uberShare >= 0.95) dominantSource = "uber_api";
        else if (uberShare <= 0.05) dominantSource = "csv_import";
        else dominantSource = "mixed";
        map.set(id, { dominantSource, uberRevenue: uber, csvRevenue: csv, uberShare });
      }

      return map;
    },
  });
}
