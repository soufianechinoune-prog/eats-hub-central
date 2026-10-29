import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uberRatingWindow, type RatingAggregate } from "@/lib/uberRatings";

export function useUberRecentRatings(restaurantIds: string[], enabled: boolean) {
  const window = uberRatingWindow();
  const query = useQuery({
    queryKey: ["overview-reviews", restaurantIds, window.start, window.end],
    enabled: enabled && restaurantIds.length > 0 && !restaurantIds.includes("00000000-0000-0000-0000-000000000000"),
    queryFn: async (): Promise<RatingAggregate[]> => {
      const { data, error } = await supabase.rpc("get_network_ratings_summary", {
        p_restaurant_ids: restaurantIds, p_start_date: window.start, p_end_date: window.end,
      });
      if (error) throw error;
      return (data ?? []).map(row => ({ ...row, avg_rating: Number(row.avg_rating), review_count: Number(row.review_count) }));
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return { ...query, window };
}