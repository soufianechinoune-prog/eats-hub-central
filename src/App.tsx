import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AIAdvisorProvider } from "@/contexts/AIAdvisorContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Dashboard from "./pages/Dashboard";
import Restaurants from "./pages/Restaurants";
import RestaurantMenu from "./pages/RestaurantMenu";
import UberConnections from "./pages/UberConnections";
import UberCallback from "./pages/UberCallback";
import Exports from "./pages/Exports";
import Reports from "./pages/Reports";
import Disputes from "./pages/Disputes";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { AppLayout } from "./components/layout/AppLayout";
import UberNaming from "./pages/UberNaming";
import MenuEditor from "./pages/MenuEditor";
import DataEntry from "./pages/DataEntry";
import Analytics from "./pages/Analytics";
import RankingDetail from "./pages/RankingDetail";
import RestaurantDetail from "./pages/RestaurantDetail";
import MenuItems from "./pages/MenuItems";
import RestaurantActions from "./pages/RestaurantActions";
import MenuHistory from "./pages/MenuHistory";
import Messaging from "./pages/Messaging";
import Operations from "./pages/Operations";
import Cartography from "./pages/Cartography";
import ReportImport from "./pages/ReportImport";
import ImportGuide from "./pages/ImportGuide";
import ImportChecklist from "./pages/ImportChecklist";
import DowntimeComparison from "./pages/DowntimeComparison";
import RatingsComparison from "./pages/RatingsComparison";
import OpeningHoursComparison from "./pages/OpeningHoursComparison";
import PrepTimeComparison from "./pages/PrepTimeComparison";
import TotalDeliveryTimeComparison from "./pages/TotalDeliveryTimeComparison";
import InaccurateOrdersComparison from "./pages/InaccurateOrdersComparison";
import UberStoreMapping from "./pages/UberStoreMapping";
import DeliverooMatching from "./pages/DeliverooMatching";
import ItemSales from "./pages/ItemSales";
import MarketingAnalytics from "./pages/MarketingAnalytics";
import SuccessScore from "./pages/SuccessScore";
import { AnalyticsProvider } from "./contexts/AnalyticsContext";
import Reviews from "./pages/Reviews";
import Admin from "./pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <AIAdvisorProvider>
            <AnalyticsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth" element={<Navigate to="/login" replace />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/auth/uber/callback" element={<UberCallback />} />
                  <Route path="/uber-callback" element={<UberCallback />} />

                  {/* Protected routes */}
                  <Route path="/" element={<P><AppLayout><Overview /></AppLayout></P>} />
                  <Route path="/classements" element={<P><AppLayout><Dashboard /></AppLayout></P>} />
                  <Route path="/restaurants" element={<P><AppLayout><Restaurants /></AppLayout></P>} />
                  <Route path="/messaging" element={<P><AppLayout><Messaging /></AppLayout></P>} />
                  <Route path="/restaurants/:id" element={<P><AppLayout><RestaurantDetail /></AppLayout></P>} />
                  <Route path="/restaurants/:restaurantId/menu" element={<P><RestaurantMenu /></P>} />
                  <Route path="/uber-connections" element={<P><AppLayout><UberConnections /></AppLayout></P>} />
                  <Route path="/uber-naming" element={<P><AppLayout><UberNaming /></AppLayout></P>} />
                  <Route path="/exports" element={<P><AppLayout><Exports /></AppLayout></P>} />
                  <Route path="/reports" element={<P><Reports /></P>} />
                  <Route path="/menu-editor" element={<P><MenuEditor /></P>} />
                  <Route path="/disputes" element={<P><AppLayout><Disputes /></AppLayout></P>} />
                  <Route path="/data-entry" element={<P><AppLayout><DataEntry /></AppLayout></P>} />
                  <Route path="/data-entry/revenue" element={<Navigate to="/data-entry?tab=revenue" replace />} />
                  <Route path="/data-entry/conversion" element={<Navigate to="/data-entry?tab=conversion" replace />} />
                  <Route path="/data-entry/fees" element={<Navigate to="/data-entry?tab=fees" replace />} />
                  <Route path="/analytics" element={<Navigate to="/analytics/overview" replace />} />
                  <Route path="/analytics/:viewMode" element={<P><AppLayout><Analytics /></AppLayout></P>} />
                  <Route path="/analytics/ranking/:metric" element={<P><RankingDetail /></P>} />
                  <Route path="/menu-items" element={<P><AppLayout><MenuItems /></AppLayout></P>} />
                  <Route path="/actions" element={<P><AppLayout><RestaurantActions /></AppLayout></P>} />
                  <Route path="/menu-history" element={<P><AppLayout><MenuHistory /></AppLayout></P>} />
                  <Route path="/operations" element={<P><AppLayout><Operations /></AppLayout></P>} />
                  <Route path="/report-import" element={<P><AppLayout><ReportImport /></AppLayout></P>} />
                  <Route path="/cartography" element={<P><Cartography /></P>} />
                  <Route path="/import-guide" element={<P><AppLayout><ImportGuide /></AppLayout></P>} />
                  <Route path="/import-checklist" element={<P><AppLayout><ImportChecklist /></AppLayout></P>} />
                  <Route path="/compare/downtime" element={<P><AppLayout><DowntimeComparison /></AppLayout></P>} />
                  <Route path="/compare/ratings" element={<P><AppLayout><RatingsComparison /></AppLayout></P>} />
                  <Route path="/compare/opening-hours" element={<P><AppLayout><OpeningHoursComparison /></AppLayout></P>} />
                  <Route path="/compare/prep-time" element={<P><AppLayout><PrepTimeComparison /></AppLayout></P>} />
                  <Route path="/compare/total-delivery-time" element={<P><AppLayout><TotalDeliveryTimeComparison /></AppLayout></P>} />
                  <Route path="/compare/inaccurate-orders" element={<P><AppLayout><InaccurateOrdersComparison /></AppLayout></P>} />
                  <Route path="/compare/profitability" element={<Navigate to="/analytics/finances" replace />} />
                  <Route path="/item-sales" element={<P><ItemSales /></P>} />
                  <Route path="/marketing-analytics" element={<P><MarketingAnalytics /></P>} />
                  <Route path="/success-score" element={<P><AppLayout><SuccessScore /></AppLayout></P>} />
                  <Route path="/uber-mapping" element={<P><AppLayout><UberStoreMapping /></AppLayout></P>} />
                  <Route path="/deliveroo-matching" element={<P><AppLayout><DeliverooMatching /></AppLayout></P>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AnalyticsProvider>
          </AIAdvisorProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
