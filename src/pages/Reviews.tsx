import { useMemo } from "react";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewsOverview } from "@/components/reviews/ReviewsOverview";
import { ReviewsCustomerList } from "@/components/reviews/ReviewsCustomerList";
import { ReviewsMenuItems } from "@/components/reviews/ReviewsMenuItems";
import { ReviewsCorrelation } from "@/components/reviews/ReviewsCorrelation";
import { WeatherCorrelation } from "@/components/reviews/WeatherCorrelation";
import { useCustomerReviews, useMenuItemReviews } from "@/hooks/useReviews";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Eye, Users, ChefHat, TrendingUp, Cloud } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Reviews() {
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();

  // Calculer les dates de filtrage selon le mode de période
  const { startDate, endDate } = useMemo(() => {
    const usesContextRange =
      (periodMode === "range" ||
        periodMode === "previous_week" ||
        periodMode === "7d" ||
        periodMode === "30d" ||
        periodMode === "current_month") &&
      dateRange?.from &&
      dateRange?.to;

    if (usesContextRange) {
      return { startDate: dateRange!.from!, endDate: dateRange!.to! };
    } else if (periodMode === "month") {
      const monthDate = new Date(selectedYear, selectedMonth - 1, 1);
      return {
        startDate: startOfMonth(monthDate),
        endDate: endOfMonth(monthDate),
      };
    } else {
      // periodMode === "year" or default
      const yearDate = new Date(selectedYear, 0, 1);
      return {
        startDate: startOfYear(yearDate),
        endDate: endOfYear(yearDate),
      };
    }
  }, [periodMode, dateRange, selectedYear, selectedMonth]);

  // Date étendue pour le calcul de la moyenne glissante 90 jours
  const extendedStartDate = useMemo(() => {
    const extended = new Date(startDate);
    extended.setDate(extended.getDate() - 89); // 89 jours avant = fenêtre de 90 jours incluant startDate
    return extended;
  }, [startDate]);

  const restaurantIds =
    selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  // Fetch restaurants data
  const { data: restaurantsData } = useQuery({
    queryKey: ["restaurants-for-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Filter restaurants based on selection
  const filteredRestaurants = useMemo(() => {
    if (!restaurantsData) return [];
    if (!restaurantIds || restaurantIds.length === 0) return restaurantsData;
    return restaurantsData.filter((r) => restaurantIds.includes(r.id));
  }, [restaurantsData, restaurantIds]);

  const {
    data: customerReviews,
    isLoading: isLoadingCustomer,
  } = useCustomerReviews(restaurantIds, selectedPlatform, startDate, endDate);

  // Avis étendus pour le calcul de la moyenne glissante 90 jours
  const {
    data: allReviewsForRolling,
    isLoading: isLoadingExtended,
  } = useCustomerReviews(restaurantIds, selectedPlatform, extendedStartDate, endDate);

  const {
    data: menuItemReviews,
    isLoading: isLoadingMenuItems,
  } = useMenuItemReviews(restaurantIds, selectedPlatform, startDate, endDate);

  const isLoading = isLoadingCustomer || isLoadingMenuItems || isLoadingExtended;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement des avis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Plats
          </TabsTrigger>
          <TabsTrigger value="correlation" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Corrélation
          </TabsTrigger>
          <TabsTrigger value="weather" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Météo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ReviewsOverview 
            reviews={customerReviews || []} 
            allReviewsForRolling={allReviewsForRolling || []}
          />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <ReviewsCustomerList reviews={customerReviews || []} />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <ReviewsMenuItems reviews={menuItemReviews || []} restaurants={filteredRestaurants} />
        </TabsContent>

        <TabsContent value="correlation" className="mt-6">
          <ReviewsCorrelation 
            reviews={customerReviews || []} 
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>

        <TabsContent value="weather" className="mt-6">
          <WeatherCorrelation 
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
