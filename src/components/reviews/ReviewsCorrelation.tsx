import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { CorrelationKPI } from "./CorrelationKPI";
import { RatingRevenueChart } from "./RatingRevenueChart";
import { CorrelationScatterPlot } from "./CorrelationScatterPlot";
import { CorrelationSummaryTable } from "./CorrelationSummaryTable";

interface CustomerReview {
  id: string;
  review_date: string | null;
  overall_rating: number | null;
  restaurant_id: string;
}

interface ReviewsCorrelationProps {
  reviews: CustomerReview[];
  startDate: Date;
  endDate: Date;
}

export function ReviewsCorrelation({ reviews, startDate, endDate }: ReviewsCorrelationProps) {
  const { selectedRestaurants, selectedPlatform } = useAnalyticsContext();

  const restaurantIds = selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  // Fetch sales data
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["sales-for-correlation", restaurantIds, selectedPlatform, startDate, endDate],
    queryFn: async () => {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      let query = supabase
        .from("daily_sales_uber")
        .select("date, revenue_ttc, order_count, average_basket, restaurant_id, platform")
        .gte("date", startStr)
        .lte("date", endStr);

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform === "uber_eats" ? "uber_eats" : "deliveroo");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate data by date
  const correlationData = useMemo(() => {
    if (!salesData) return [];

    // Group reviews by date
    const reviewsByDate = new Map<string, { sum: number; count: number }>();
    reviews.forEach((review) => {
      if (!review.review_date || review.overall_rating === null) return;
      const date = review.review_date.split("T")[0];
      const current = reviewsByDate.get(date) || { sum: 0, count: 0 };
      reviewsByDate.set(date, {
        sum: current.sum + review.overall_rating,
        count: current.count + 1,
      });
    });

    // Group sales by date
    const salesByDate = new Map<string, { revenue: number; orders: number; avgBasket: number; count: number }>();
    salesData.forEach((sale) => {
      const date = sale.date;
      const current = salesByDate.get(date) || { revenue: 0, orders: 0, avgBasket: 0, count: 0 };
      salesByDate.set(date, {
        revenue: current.revenue + (sale.revenue_ttc || 0),
        orders: current.orders + (sale.order_count || 0),
        avgBasket: current.avgBasket + (sale.average_basket || 0),
        count: current.count + 1,
      });
    });

    // Combine data - only include dates that have both reviews and sales
    const combined: {
      date: string;
      avgRating: number;
      revenue: number;
      orders: number;
      avgBasket: number;
    }[] = [];

    // Get all unique dates from sales (more complete than reviews)
    const allDates = new Set([...salesByDate.keys()]);

    allDates.forEach((date) => {
      const reviewData = reviewsByDate.get(date);
      const saleData = salesByDate.get(date);

      if (saleData) {
        combined.push({
          date,
          avgRating: reviewData ? reviewData.sum / reviewData.count : 0,
          revenue: saleData.revenue,
          orders: saleData.orders,
          avgBasket: saleData.count > 0 ? saleData.avgBasket / saleData.count : 0,
        });
      }
    });

    // Sort by date
    return combined.sort((a, b) => a.date.localeCompare(b.date));
  }, [reviews, salesData]);

  // Filter data that has both ratings and sales for correlation calculation
  const dataWithRatings = useMemo(() => {
    return correlationData.filter((d) => d.avgRating > 0);
  }, [correlationData]);

  const ratings = dataWithRatings.map((d) => d.avgRating);
  const revenues = dataWithRatings.map((d) => d.revenue);
  const orders = dataWithRatings.map((d) => d.orders);

  // Prepare scatter plot data
  const scatterRevenueData = dataWithRatings.map((d) => ({
    avgRating: d.avgRating,
    value: d.revenue,
    date: format(new Date(d.date), "d MMM yyyy"),
  }));

  const scatterOrdersData = dataWithRatings.map((d) => ({
    avgRating: d.avgRating,
    value: d.orders,
    date: format(new Date(d.date), "d MMM yyyy"),
  }));

  if (isLoadingSales) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground text-sm">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (dataWithRatings.length < 3) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-muted-foreground">
            Pas assez de données pour calculer la corrélation.
          </p>
          <p className="text-sm text-muted-foreground">
            Il faut au moins 3 jours avec des avis et des ventes sur la période sélectionnée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CorrelationKPI ratings={ratings} values={revenues} label="CA" />
        <CorrelationKPI ratings={ratings} values={orders} label="Commandes" />
      </div>

      {/* Combined Chart */}
      <RatingRevenueChart data={correlationData} />

      {/* Scatter Plots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CorrelationScatterPlot
          data={scatterRevenueData}
          valueLabel="CA (€)"
          valueFormatter={(v) => `${(v / 1000).toFixed(1)}k€`}
        />
        <CorrelationScatterPlot
          data={scatterOrdersData}
          valueLabel="Commandes"
          valueFormatter={(v) => v.toString()}
        />
      </div>

      {/* Summary Table */}
      <CorrelationSummaryTable data={correlationData} />
    </div>
  );
}
