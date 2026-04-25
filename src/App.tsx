import React, { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AIAdvisorProvider } from "@/contexts/AIAdvisorContext";
import { AnalyticsProvider } from "./contexts/AnalyticsContext";
import { useUserRole } from "./hooks/useUserRole";
import { useToast } from "./hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Static imports (critical for startup)
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ResetPassword from "./pages/ResetPassword";
import UberCallback from "./pages/UberCallback";
import { AppLayout } from "./components/layout/AppLayout";

// Lazy-loaded pages
const Overview = React.lazy(() => import("./pages/Overview"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Restaurants = React.lazy(() => import("./pages/Restaurants"));
const RestaurantMenu = React.lazy(() => import("./pages/RestaurantMenu"));
const UberConnections = React.lazy(() => import("./pages/UberConnections"));
const Exports = React.lazy(() => import("./pages/Exports"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Disputes = React.lazy(() => import("./pages/Disputes"));
const UberNaming = React.lazy(() => import("./pages/UberNaming"));
const MenuEditor = React.lazy(() => import("./pages/MenuEditor"));
const DataEntry = React.lazy(() => import("./pages/DataEntry"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const RankingDetail = React.lazy(() => import("./pages/RankingDetail"));
const RestaurantDetail = React.lazy(() => import("./pages/RestaurantDetail"));
const MenuItems = React.lazy(() => import("./pages/MenuItems"));
const RestaurantActions = React.lazy(() => import("./pages/RestaurantActions"));
const MenuHistory = React.lazy(() => import("./pages/MenuHistory"));
const Messaging = React.lazy(() => import("./pages/Messaging"));
const Operations = React.lazy(() => import("./pages/Operations"));
const Cartography = React.lazy(() => import("./pages/Cartography"));
const ReportImport = React.lazy(() => import("./pages/ReportImport"));
const ImportGuide = React.lazy(() => import("./pages/ImportGuide"));
const ImportChecklist = React.lazy(() => import("./pages/ImportChecklist"));
const DowntimeComparison = React.lazy(() => import("./pages/DowntimeComparison"));
const RatingsComparison = React.lazy(() => import("./pages/RatingsComparison"));
const OpeningHoursComparison = React.lazy(() => import("./pages/OpeningHoursComparison"));
const PrepTimeComparison = React.lazy(() => import("./pages/PrepTimeComparison"));
const TotalDeliveryTimeComparison = React.lazy(() => import("./pages/TotalDeliveryTimeComparison"));
const InaccurateOrdersComparison = React.lazy(() => import("./pages/InaccurateOrdersComparison"));
const UberStoreMapping = React.lazy(() => import("./pages/UberStoreMapping"));
const DeliverooMatching = React.lazy(() => import("./pages/DeliverooMatching"));
const ItemSales = React.lazy(() => import("./pages/ItemSales"));
const MarketingAnalytics = React.lazy(() => import("./pages/MarketingAnalytics"));
const SuccessScore = React.lazy(() => import("./pages/SuccessScore"));
const Reviews = React.lazy(() => import("./pages/Reviews"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Account = React.lazy(() => import("./pages/Account"));
const Integrations = React.lazy(() => import("./pages/Integrations"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const ImportRoute = ({ children }: { children: React.ReactNode }) => {
  const { data: role, isLoading } = useUserRole();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && role !== "super_admin" && role !== "importer") {
      toast({ title: "Accès restreint", description: "Vous n'avez pas accès à cette section.", variant: "destructive" });
    }
  }, [isLoading, role]);

  if (isLoading) return null;
  if (role !== "super_admin" && role !== "importer") return <Navigate to="/overview" replace />;
  return <>{children}</>;
};

const SmartHome = () => {
  const [session, setSession] = useState<null | "loading" | "authed" | "anon">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ? "authed" : "anon");
    });
  }, []);

  if (session === "loading") {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (session === "authed") return <Navigate to="/overview" replace />;
  return <Landing />;
};

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
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<SmartHome />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth" element={<Navigate to="/login" replace />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth/uber/callback" element={<UberCallback />} />
                    <Route path="/uber-callback" element={<UberCallback />} />

                    {/* Protected routes */}
                    <Route path="/overview" element={<P><AppLayout><Overview /></AppLayout></P>} />
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
                    <Route path="/data-entry" element={<P><ImportRoute><AppLayout><DataEntry /></AppLayout></ImportRoute></P>} />
                    <Route path="/data-entry/revenue" element={<Navigate to="/data-entry?tab=revenue" replace />} />
                    <Route path="/data-entry/conversion" element={<Navigate to="/data-entry?tab=conversion" replace />} />
                    <Route path="/data-entry/fees" element={<Navigate to="/data-entry?tab=fees" replace />} />
                    <Route path="/analytics" element={<Navigate to="/analytics/overview" replace />} />
                    <Route path="/analytics/:viewMode" element={<P><AppLayout><Analytics /></AppLayout></P>} />
                    <Route path="/analytics/ranking/:metric" element={<P><RankingDetail /></P>} />
                    <Route path="/menu-items" element={<P><ImportRoute><AppLayout><MenuItems /></AppLayout></ImportRoute></P>} />
                    <Route path="/actions" element={<P><AppLayout><RestaurantActions /></AppLayout></P>} />
                    <Route path="/menu-history" element={<P><ImportRoute><AppLayout><MenuHistory /></AppLayout></ImportRoute></P>} />
                    <Route path="/operations" element={<P><AppLayout><Operations /></AppLayout></P>} />
                    <Route path="/report-import" element={<P><ImportRoute><AppLayout><ReportImport /></AppLayout></ImportRoute></P>} />
                    <Route path="/cartography" element={<P><Cartography /></P>} />
                    <Route path="/import-guide" element={<P><ImportRoute><AppLayout><ImportGuide /></AppLayout></ImportRoute></P>} />
                    <Route path="/import-checklist" element={<P><ImportRoute><AppLayout><ImportChecklist /></AppLayout></ImportRoute></P>} />
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
                    <Route path="/uber-mapping" element={<P><ImportRoute><AppLayout><UberStoreMapping /></AppLayout></ImportRoute></P>} />
                    <Route path="/deliveroo-matching" element={<P><ImportRoute><AppLayout><DeliverooMatching /></AppLayout></ImportRoute></P>} />
                    <Route path="/admin" element={<P><AppLayout><Admin /></AppLayout></P>} />
                    <Route path="/account" element={<P><AppLayout><Account /></AppLayout></P>} />
                    <Route path="/reviews" element={<P><AppLayout><Reviews /></AppLayout></P>} />
                    <Route path="/settings/integrations" element={<P><AppLayout><Integrations /></AppLayout></P>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AnalyticsProvider>
          </AIAdvisorProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
