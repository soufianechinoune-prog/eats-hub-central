import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DateMode = "review" | "order";

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
  order_date?: string;
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

// Columns needed for customer reviews (avoids select("*"))
const CUSTOMER_REVIEW_COLUMNS = "id, restaurant_id, overall_rating, food_rating, delivery_rating, review_date, order_date, customer_name, customer_type, customer_comment, order_total, response_status, response_text, tags, platform";

// Columns needed for menu item reviews
const MENU_ITEM_REVIEW_COLUMNS = "id, restaurant_id, item_id, item_title, rating, thumb_up, thumb_down, comment, review_date, tags, platform";

const PAGE_SIZE = 1000;

// Helper to fetch all pages of customer reviews
async function fetchAllCustomerReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date,
  dateMode: DateMode = "review"
): Promise<CustomerReview[]> {
  const allData: CustomerReview[] = [];
  let page = 0;
  let hasMore = true;

  // Determine which column to filter on
  const dateColumn = dateMode === "order" ? "order_date" : "review_date";

  // Empty array means "no restaurants selected" → return empty
  if (restaurantIds && restaurantIds.length === 0) return allData;

  while (hasMore) {
    let query = supabase
      .from("customer_reviews")
      .select(CUSTOMER_REVIEW_COLUMNS)
      .order("review_date", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (restaurantIds && restaurantIds.length > 0) {
      query = query.in("restaurant_id", restaurantIds);
    }

    if (platform && platform !== "global") {
      query = query.eq("platform", platform);
    }

    if (startDate) {
      query = query.gte(dateColumn, formatDateLocal(startDate));
    }

    if (endDate) {
      query = query.lte(dateColumn, formatDateLocal(endDate));
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

  // Empty array means "no restaurants selected" → return empty
  if (restaurantIds && restaurantIds.length === 0) return allData;

  while (hasMore) {
    let query = supabase
      .from("menu_item_reviews")
      .select(MENU_ITEM_REVIEW_COLUMNS)
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
  endDate?: Date,
  dateMode: DateMode = "review",
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["customer_reviews", restaurantIds, platform, startDate, endDate, dateMode],
    queryFn: () => fetchAllCustomerReviews(restaurantIds, platform, startDate, endDate, dateMode),
    enabled,
  });
}

export function useMenuItemReviews(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["menu_item_reviews", restaurantIds, platform, startDate, endDate],
    queryFn: () => fetchAllMenuItemReviews(restaurantIds, platform, startDate, endDate),
    enabled,
  });
}

// New hook: fetch overview stats via RPC (aggregated, no individual rows)
export interface ReviewsOverviewStats {
  avg_rating: number | null;
  total_count: number;
  tag_rate: number | null;
  comment_rate: number | null;
  rating_distribution: Record<string, number> | null;
  day_stats: Array<{ day_index: number; avg_rating: number; count: number }> | null;
  tag_counts: Array<{ tag: string; count: number }> | null;
  monthly_evolution: Array<{ year: number; month: number; avg_rating: number; count: number }> | null;
  daily_evolution: Array<{ date: string; avg_rating: number; count: number }> | null;
  previous_period: { avg_rating: number | null; total_count: number } | null;
}

export function useReviewsOverviewStats(
  restaurantIds?: string[],
  platform?: string,
  startDate?: Date,
  endDate?: Date,
  dateMode: DateMode = "review",
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["reviews_overview_stats", restaurantIds, platform, startDate, endDate, dateMode],
    queryFn: async (): Promise<ReviewsOverviewStats> => {
      if (!restaurantIds || restaurantIds.length === 0) {
        return { avg_rating: null, total_count: 0, tag_rate: null, comment_rate: null, rating_distribution: null, day_stats: null, tag_counts: null };
      }
      const { data, error } = await supabase.rpc("get_reviews_overview_stats", {
        p_restaurant_ids: restaurantIds,
        p_platform: platform || "global",
        p_start_date: startDate ? formatDateLocal(startDate) : "2020-01-01",
        p_end_date: endDate ? formatDateLocal(endDate) : "2099-12-31",
        p_date_mode: dateMode,
      });
      if (error) throw error;
      return (data as unknown as ReviewsOverviewStats) || { avg_rating: null, total_count: 0, tag_rate: null, comment_rate: null, rating_distribution: null, day_stats: null, tag_counts: null };
    },
    enabled,
  });
}