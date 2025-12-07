import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerReview {
  id: string;
  restaurant_id: string;
  overall_rating: number;
  food_rating: number;
  delivery_rating: number;
  review_date: string;
  customer_name: string;
  customer_type: string;
  customer_comment: string | null;
  order_total: number;
  response_status: string | null;
  response_text: string | null;
  tags: string[] | null;
  platform: string;
}

export interface MenuItemReview {
  id: string;
  restaurant_id: string;
  item_id: string;
  item_title: string;
  rating: number;
  thumb_up: number;
  thumb_down: number;
  comment: string | null;
  review_date: string;
  tags: string[] | null;
  platform: string;
}

export function useCustomerReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["customer_reviews", restaurantIds, platform, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_reviews")
        .select("*", { count: "exact" })
        .order("review_date", { ascending: false })
        .limit(50000);

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      if (platform && platform !== "global") {
        query = query.eq("platform", platform);
      }

      if (startDate) {
        query = query.gte("review_date", startDate.toISOString().split("T")[0]);
      }

      if (endDate) {
        query = query.lte("review_date", endDate.toISOString().split("T")[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CustomerReview[];
    },
  });
}

export function useMenuItemReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["menu_item_reviews", restaurantIds, platform, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("menu_item_reviews")
        .select("*")
        .order("review_date", { ascending: false })
        .limit(50000);

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      if (platform && platform !== "global") {
        query = query.eq("platform", platform);
      }

      if (startDate) {
        query = query.gte("review_date", startDate.toISOString().split("T")[0]);
      }

      if (endDate) {
        query = query.lte("review_date", endDate.toISOString().split("T")[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MenuItemReview[];
    },
  });
}
