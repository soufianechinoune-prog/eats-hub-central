import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

/**
 * Fetches pinned restaurants, filtered by selected chain if any.
 */
export function usePinnedRestaurants() {
  const { selectedChainId } = useAnalyticsContext();
  
  return useQuery({
    queryKey: ["pinned-restaurants-with-dates", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
        .eq("is_pinned", true)
        .eq("is_active", true)
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Fetches all active restaurants, filtered by selected chain if any.
 */
export function useActiveRestaurants() {
  const { selectedChainId } = useAnalyticsContext();
  
  return useQuery({
    queryKey: ["active-restaurants-with-dates", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, city, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
        .eq("is_active", true)
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
