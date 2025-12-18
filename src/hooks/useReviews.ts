import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Format date as YYYY-MM-DD without UTC conversion to avoid timezone issues
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

const PAGE_SIZE = 1000;

// Helper to fetch all pages of customer reviews
async function fetchAllCustomerReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CustomerReview[]> {
  const allData: CustomerReview[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("customer_reviews")
      .select("*")
      .order("review_date", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (restaurantIds && restaurantIds.length > 0) {
      query = query.in("restaurant_id", restaurantIds);
    }

    if (platform && platform !== "global") {
      query = query.eq("platform", platform);
    }

    if (startDate) {
      query = query.gte("review_date", formatDateLocal(startDate));
    }

    if (endDate) {
      query = query.lte("review_date", formatDateLocal(endDate));
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as CustomerReview[]));
      // If we got less than PAGE_SIZE, we've reached the end
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// Helper to fetch all pages of menu item reviews
async function fetchAllMenuItemReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date
): Promise<MenuItemReview[]> {
  const allData: MenuItemReview[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("menu_item_reviews")
      .select("*")
      .order("review_date", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (restaurantIds && restaurantIds.length > 0) {
      query = query.in("restaurant_id", restaurantIds);
    }

    if (platform && platform !== "global") {
      query = query.eq("platform", platform);
    }

    if (startDate) {
      query = query.gte("review_date", formatDateLocal(startDate));
    }

    if (endDate) {
      query = query.lte("review_date", formatDateLocal(endDate));
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as MenuItemReview[]));
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export function useCustomerReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["customer_reviews", restaurantIds, platform, startDate, endDate],
    queryFn: () => fetchAllCustomerReviews(restaurantIds, platform, startDate, endDate),
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
    queryFn: () => fetchAllMenuItemReviews(restaurantIds, platform, startDate, endDate),
  });
}
