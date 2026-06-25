import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UberLiveTodayStats {
  revenueInclVat: number;
  orderCount: number;
  averageBasket: number;
  consolidated: boolean;
  lastEventAt: string | null;
}

interface Args {
  restaurantIds: string[];
  /** "today" or "yesterday" — UTC day boundaries based on Europe/Paris is overkill for a live counter, we use server-side timestamptz */
  scope: "today" | "yesterday";
  enabled?: boolean;
}

export function useUberLiveToday({ restaurantIds, scope, enabled = true }: Args) {
  return useQuery({
    queryKey: ["uber-live-today", scope, restaurantIds.slice().sort()],
    enabled: enabled && restaurantIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<UberLiveTodayStats> => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      if (scope === "yesterday") start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase
        .from("uber_live_orders")
        .select("gross_amount_incl_vat, consolidated, last_event_at, order_placed_at")
        .in("restaurant_id", restaurantIds)
        .gte("order_placed_at", start.toISOString())
        .lt("order_placed_at", end.toISOString());

      if (error) throw error;

      const rows = data ?? [];
      const revenueInclVat = rows.reduce(
        (acc, r) => acc + Number(r.gross_amount_incl_vat ?? 0),
        0,
      );
      const orderCount = rows.length;
      const consolidated =
        orderCount > 0 && rows.every((r) => r.consolidated === true);
      const lastEventAt = rows.reduce<string | null>((acc, r) => {
        const t = r.last_event_at as string | null;
        if (!t) return acc;
        return !acc || t > acc ? t : acc;
      }, null);

      return {
        revenueInclVat,
        orderCount,
        averageBasket: orderCount > 0 ? revenueInclVat / orderCount : 0,
        consolidated,
        lastEventAt,
      };
    },
  });
}
