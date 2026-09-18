import { ReactNode, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { OverviewChannelSidebar } from "@/components/overview/OverviewChannelSidebar";
import { useChannelAvailability } from "@/hooks/useChannelAvailability";

/**
 * Enveloppe les pages analytiques avec la navigation par canal :
 * colonne permanente sur grand écran, panneau ouvrable sur petit écran.
 * Purement de la navigation — aucun impact sur les données de la page.
 */
export function ChannelNavShell({ children }: { children: ReactNode }) {
  const available = useChannelAvailability();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex gap-0 -m-6">
      <aside className="hidden lg:block w-60 shrink-0 border-r border-border/50 bg-card/40 backdrop-blur-xl">
        <div className="sticky top-16">
          <OverviewChannelSidebar available={available} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 p-6 space-y-4">
        <div className="lg:hidden">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setMobileOpen(true)}>
            <Layers className="h-4 w-4" />
            Canaux
          </Button>
        </div>
        {children}
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation par canal</SheetTitle>
          <OverviewChannelSidebar available={available} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
