import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Dashboard from "./pages/Dashboard";
import Restaurants from "./pages/Restaurants";
import RestaurantMenu from "./pages/RestaurantMenu";
import UberConnections from "./pages/UberConnections";
import UberCallback from "./pages/UberCallback";
import Exports from "./pages/Exports";
import Reports from "./pages/Reports";
import Disputes from "./pages/Disputes";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { AppLayout } from "./components/layout/AppLayout";
import UberNaming from "./pages/UberNaming";
import MenuEditor from "./pages/MenuEditor";
import DataEntryRevenue from "./pages/DataEntryRevenue";
import DataEntryConversion from "./pages/DataEntryConversion";
import DataEntryFees from "./pages/DataEntryFees";
import DataEntry from "./pages/DataEntry";
import Analytics from "./pages/Analytics";
import RestaurantDetail from "./pages/RestaurantDetail";
import MenuItems from "./pages/MenuItems";
import RestaurantActions from "./pages/RestaurantActions";
import MenuHistory from "./pages/MenuHistory";
import Messaging from "./pages/Messaging";
import Operations from "./pages/Operations";
import Cartography from "./pages/Cartography";

const queryClient = new QueryClient();

// TEMPORAIREMENT DÉSACTIVÉ - Authentification bypassée pour le développement
const ProtectedRoute = ({ children, session }: { children: React.ReactNode; session: Session | null }) => {
  // Bypass auth temporairement
  return <>{children}</>;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Chargement...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
{/* Auth temporairement désactivé */}
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route
              path="/"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurants"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Restaurants />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messaging"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Messaging />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurants/:id"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <RestaurantDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurants/:restaurantId/menu"
              element={
                <ProtectedRoute session={session}>
                  <RestaurantMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/uber-connections"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <UberConnections />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/uber-naming"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <UberNaming />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/exports"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Exports />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute session={session}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu-editor"
              element={
                <ProtectedRoute session={session}>
                  <MenuEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/disputes"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Disputes />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auth/uber/callback"
              element={<UberCallback />}
            />
            <Route
              path="/data-entry"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <DataEntry />
                  </AppLayout>
                </ProtectedRoute>
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
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Analytics />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu-items"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <MenuItems />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/actions"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <RestaurantActions />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu-history"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <MenuHistory />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operations"
              element={
                <ProtectedRoute session={session}>
                  <AppLayout>
                    <Operations />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cartography"
              element={
                <ProtectedRoute session={session}>
                  <Cartography />
                </ProtectedRoute>
              }
            />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
