import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export interface RestaurantAction {
  id: string;
  restaurant_id: string | null;
  restaurant_ids: string[] | null;
  category: string;
  action_type: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  impact_value: number | null;
  impact_unit: string | null;
  platform: string;
  change_context: any;
}

export function useRestaurantActions(
  year?: number,
  restaurantIds?: string[],
  platform?: string // 'uber_eats' | 'deliveroo' | 'all' | 'global'
) {
  const { selectedChainId } = useAnalyticsContext();

  return useQuery({
    queryKey: ["restaurant_actions_analytics", year, restaurantIds, platform, selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurant_actions")
        .select("*")
        .order("start_date", { ascending: true });

      // Filter by year if provided
      if (year) {
        query = query
          .gte("start_date", `${year}-01-01`)
          .lte("start_date", `${year}-12-31`);
      }

      // Filter by platform if not global
      if (platform && platform !== "global") {
        query = query.or(`platform.eq.${platform},platform.eq.all`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Resolve chain restaurant scope when a brand is active
      let chainRestaurantIds: string[] | null = null;
      if (selectedChainId) {
        const { data: chainRestaurants, error: chainError } = await supabase
          .from("restaurants")
          .select("id")
          .eq("chain_id", selectedChainId);

        if (chainError) throw chainError;
        chainRestaurantIds = (chainRestaurants || []).map((restaurant) => restaurant.id);
      }
      
      // Filter by restaurants client-side (since we need to check both restaurant_id and restaurant_ids array)
      let filteredData = (data as RestaurantAction[]).filter(action => {
        if (!chainRestaurantIds) return true;
        if (action.restaurant_ids && action.restaurant_ids.length > 0) {
          return action.restaurant_ids.some(id => chainRestaurantIds!.includes(id));
        }
        if (action.restaurant_id) {
          return chainRestaurantIds.includes(action.restaurant_id);
        }
        return false;
      });
      
      if (restaurantIds && restaurantIds.length > 0) {
        filteredData = filteredData.filter(action => {
          if (action.restaurant_ids && action.restaurant_ids.length > 0) {
            return restaurantIds.some(id => action.restaurant_ids!.includes(id));
          }
          if (action.restaurant_id) {
            return restaurantIds.includes(action.restaurant_id);
          }
          return false;
        });
      }
      
      return filteredData;
    },
    enabled: !!year,
  });
}

// Helper to get action month from start_date
export function getActionMonth(startDate: string): number {
  return new Date(startDate).getMonth() + 1;
}

// Category colors for markers
export const ACTION_CATEGORY_COLORS: Record<string, string> = {
  visuals: "#8b5cf6", // purple
  pricing: "#f59e0b", // amber
  promotions: "#ec4899", // pink
  marketing: "#3b82f6", // blue
  menu: "#10b981", // emerald
  operational: "#64748b", // slate
  events: "#059669", // emerald-600 for religious/cultural events
};

// Category icons (for reference in tooltips)
export const ACTION_CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
  events: "Événements",
};
