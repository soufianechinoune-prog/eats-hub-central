import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewsOverview } from "@/components/reviews/ReviewsOverview";
import { ReviewsCustomerList } from "@/components/reviews/ReviewsCustomerList";
import { ReviewsMenuItems } from "@/components/reviews/ReviewsMenuItems";
import { useCustomerReviews, useMenuItemReviews } from "@/hooks/useReviews";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Eye, Users, ChefHat } from "lucide-react";

export default function Reviews() {
  const {
    selectedRestaurants,
    selectedPlatform,
    dateRange,
  } = useAnalyticsContext();

  // Use dateRange from context for period filtering
  const startDate = dateRange?.from;
  const endDate = dateRange?.to;

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

  return (
    <div className="space-y-6">
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
