import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewsOverview } from "@/components/reviews/ReviewsOverview";
import { ReviewsCustomerList } from "@/components/reviews/ReviewsCustomerList";
import { ReviewsMenuItems } from "@/components/reviews/ReviewsMenuItems";
import { useCustomerReviews, useMenuItemReviews } from "@/hooks/useReviews";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { PeriodSelector, PeriodOption, getDateRangeFromPeriod, getPeriodLabel } from "@/components/analytics/PeriodSelector";
import { Eye, Users, ChefHat, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Reviews() {
  const {
    selectedRestaurants,
    selectedPlatform,
  } = useAnalyticsContext();

  const [period, setPeriod] = useState<PeriodOption>("30d");

  // Get date range from selected period
  const { startDate, endDate } = getDateRangeFromPeriod(period);

  const restaurantIds =
    selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  const {
    data: customerReviews,
    isLoading: isLoadingCustomer,
  } = useCustomerReviews(restaurantIds, selectedPlatform, startDate, endDate);

  const {
    data: menuItemReviews,
    isLoading: isLoadingMenuItems,
  } = useMenuItemReviews(restaurantIds, selectedPlatform, startDate, endDate);

  const isLoading = isLoadingCustomer || isLoadingMenuItems;

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

  // Format period display
  const periodLabel = getPeriodLabel(period);
  const dateRangeLabel = `${format(startDate, "d MMM", { locale: fr })} - ${format(endDate, "d MMM yyyy", { locale: fr })}`;

  return (
    <div className="space-y-6">
      {/* Period selector header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <PeriodSelector 
              value={period} 
              onChange={setPeriod}
              className="w-[200px] bg-background border-border"
            />
            <span className="text-sm text-muted-foreground">
              ({dateRangeLabel})
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
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
            Plats du Menu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ReviewsOverview reviews={customerReviews || []} />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <ReviewsCustomerList reviews={customerReviews || []} />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <ReviewsMenuItems reviews={menuItemReviews || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
