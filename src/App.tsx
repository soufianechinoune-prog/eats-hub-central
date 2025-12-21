import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AIAdvisorProvider } from "@/contexts/AIAdvisorContext";
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
import DowntimeComparison from "./pages/DowntimeComparison";
import RatingsComparison from "./pages/RatingsComparison";
import OpeningHoursComparison from "./pages/OpeningHoursComparison";
import { AnalyticsProvider } from "./contexts/AnalyticsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

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
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route
                path="/"
                element={
                  <AppLayout>
                    <Overview />
                  </AppLayout>
                }
              />
              <Route
                path="/classements"
                element={
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                }
              />
              <Route
                path="/restaurants"
                element={
                  <AppLayout>
                    <Restaurants />
                  </AppLayout>
                }
              />
              <Route
                path="/messaging"
                element={
                  <AppLayout>
                    <Messaging />
                  </AppLayout>
                }
              />
              <Route
                path="/restaurants/:id"
                element={
                  <AppLayout>
                    <RestaurantDetail />
                  </AppLayout>
                }
              />
              <Route
                path="/restaurants/:restaurantId/menu"
                element={<RestaurantMenu />}
              />
              <Route
                path="/uber-connections"
                element={
                  <AppLayout>
                    <UberConnections />
                  </AppLayout>
                }
              />
              <Route
                path="/uber-naming"
                element={
                  <AppLayout>
                    <UberNaming />
                  </AppLayout>
                }
              />
              <Route
                path="/exports"
                element={
                  <AppLayout>
                    <Exports />
                  </AppLayout>
                }
              />
              <Route path="/reports" element={<Reports />} />
              <Route path="/menu-editor" element={<MenuEditor />} />
              <Route
                path="/disputes"
                element={
                  <AppLayout>
                    <Disputes />
                  </AppLayout>
                }
              />
              <Route path="/auth/uber/callback" element={<UberCallback />} />
              <Route path="/uber-callback" element={<UberCallback />} />
              <Route
                path="/data-entry"
                element={
                  <AppLayout>
                    <DataEntry />
                  </AppLayout>
                }
              />
              <Route
                path="/data-entry/revenue"
                element={<Navigate to="/data-entry?tab=revenue" replace />}
              />
              <Route
                path="/data-entry/conversion"
                element={<Navigate to="/data-entry?tab=conversion" replace />}
              />
              <Route
                path="/data-entry/fees"
                element={<Navigate to="/data-entry?tab=fees" replace />}
              />
              <Route
                path="/analytics"
                element={<Navigate to="/analytics/overview" replace />}
              />
              <Route
                path="/analytics/:viewMode"
                element={
                  <AppLayout>
                    <Analytics />
                  </AppLayout>
                }
              />
              <Route
                path="/analytics/ranking/:metric"
                element={<RankingDetail />}
              />
              <Route
                path="/menu-items"
                element={
                  <AppLayout>
                    <MenuItems />
                  </AppLayout>
                }
              />
              <Route
                path="/actions"
                element={
                  <AppLayout>
                    <RestaurantActions />
                  </AppLayout>
                }
              />
              <Route
                path="/menu-history"
                element={
                  <AppLayout>
                    <MenuHistory />
                  </AppLayout>
                }
              />
              <Route
                path="/operations"
                element={
                  <AppLayout>
                    <Operations />
                  </AppLayout>
                }
              />
              <Route
                path="/report-import"
                element={
                  <AppLayout>
                    <ReportImport />
                  </AppLayout>
                }
              />
              <Route path="/cartography" element={<Cartography />} />
              <Route
                path="/import-guide"
                element={
                  <AppLayout>
                    <ImportGuide />
                  </AppLayout>
                }
              />
              <Route
                path="/compare/downtime"
                element={
                  <AppLayout>
                    <DowntimeComparison />
                  </AppLayout>
                }
              />
              <Route
                path="/compare/ratings"
                element={
                  <AppLayout>
                    <RatingsComparison />
                  </AppLayout>
                }
              />
              <Route
                path="/compare/opening-hours"
                element={
                  <AppLayout>
                    <OpeningHoursComparison />
                  </AppLayout>
                }
              />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
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
