import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import csLogo from "@/assets/cs-logo.jpeg";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 bg-background">
          <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-card px-6 shadow-sm">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-3 flex-1">
              <img src={csLogo} alt="CS Delivery Performance" className="h-10 w-10 rounded-full object-cover" />
              <h1 className="text-xl font-semibold text-foreground">CS Delivery Performance</h1>
            </div>
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
