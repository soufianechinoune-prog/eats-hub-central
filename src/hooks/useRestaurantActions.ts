import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantAction {
  id: string;
  restaurant_id: string | null;
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
  return useQuery({
    queryKey: ["restaurant_actions_analytics", year, restaurantIds, platform],
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

      // Filter by restaurants if provided
      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      // Filter by platform if not global
      if (platform && platform !== "global") {
        query = query.or(`platform.eq.${platform},platform.eq.all`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RestaurantAction[];
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
};

// Category icons (for reference in tooltips)
export const ACTION_CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
};
