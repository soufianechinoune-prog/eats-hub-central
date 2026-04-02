import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import csLogo from "@/assets/cs-logo.jpeg";
import { AIAdvisorWidget } from "@/components/ai/AIAdvisorWidget";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { selectedChainId } = useAnalyticsContext();

  // Fetch active chain name
  const { data: chainData } = useQuery({
    queryKey: ["chain-name-header", selectedChainId],
    queryFn: async () => {
      if (!selectedChainId) return null;
      const { data } = await supabase
        .from("chains")
        .select("name, logo_url")
        .eq("id", selectedChainId)
        .single();
      return data || null;
    },
    enabled: !!selectedChainId,
  });

  const displayName = chainName || "CS Delivery Performance";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 bg-background">
          <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-card px-6 shadow-sm">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-3 flex-1">
              {!selectedChainId && (
                <img src={csLogo} alt="CS Delivery Performance" className="h-10 w-10 rounded-full object-cover" />
              )}
              <h1 className="text-xl font-semibold text-foreground">{displayName}</h1>
            </div>
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
        <AIAdvisorWidget />
      </div>
    </SidebarProvider>
  );
};
