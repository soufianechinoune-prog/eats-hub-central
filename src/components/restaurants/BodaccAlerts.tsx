import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileText, Loader2, RotateCcw, Scale, ShieldAlert } from "lucide-react";
import { useBodaccDismissals, getAnnonceKey } from "@/hooks/useBodaccDismissals";

interface BodaccAnnonce {
  date: string | null;
  type: string;
  typeLabel: string;
  description: string;
  tribunal: string | null;
  lienBodacc: string | null;
  numeroBodacc: string | null;
}

const typeBadgeConfig: Record<string, { className: string; icon: React.ReactNode }> = {
  procedure_collective: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  radiation: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  cession: {
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    icon: <Scale className="h-3 w-3" />,
  },
  modification: {
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: <FileText className="h-3 w-3" />,
  },
  depot_comptes: {
    className: "bg-muted text-muted-foreground border-border",
    icon: <FileText className="h-3 w-3" />,
  },
  autre: {
    className: "bg-muted text-muted-foreground border-border",
    icon: <FileText className="h-3 w-3" />,
  },
};

export function BodaccAlerts({ siren, restaurantId }: { siren: string | null | undefined; restaurantId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isDismissed, dismiss, restore } = useBodaccDismissals(restaurantId || null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bodacc", siren],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-bodacc", {
        body: { siren },
      });
      if (error) throw error;
      return data as { annonces: BodaccAnnonce[]; error?: string };
    },
    enabled: !!siren && /^\d{9}$/.test(siren.replace(/\s/g, "")),
    staleTime: 1000 * 60 * 30,
  });

  if (!siren || !/^\d{9}$/.test(siren.replace(/\s/g, ""))) return null;

  const annonces = data?.annonces || [];
  const activeAnnonces = annonces.filter(a => !isDismissed(a as any));
  const hasCritical = activeAnnonces.some(
    (a) => a.type === "procedure_collective" || a.type === "radiation"
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Vérification BODACC…
      </div>
    );
  }

  if (error || data?.error) return null;
  if (annonces.length === 0) return null;

  return (
    <div className="space-y-2">
      {hasCritical && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-xs font-medium text-destructive">
            Alerte : procédure collective ou radiation détectée au BODACC
          </span>
        </div>
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2 text-muted-foreground">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {annonces.length} annonce{annonces.length > 1 ? "s" : ""} BODACC
            {activeAnnonces.length < annonces.length && (
              <span className="text-muted-foreground/60">
                ({annonces.length - activeAnnonces.length} prises en compte)
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-1">
          {annonces.map((a, i) => {
            const config = typeBadgeConfig[a.type] || typeBadgeConfig.autre;
            const acked = isDismissed(a as any);
            return (
              <div
                key={i}
                className={`flex flex-col gap-1 rounded-md border p-2.5 text-xs transition-opacity ${
                  acked ? "border-border/50 bg-muted/30 opacity-60" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] gap-1 ${config.className}`}>
                    {config.icon}
                    {a.typeLabel}
                  </Badge>
                  {a.date && (
                    <span className="text-muted-foreground">
                      {new Date(a.date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {a.tribunal && (
                    <span className="text-muted-foreground">· {a.tribunal}</span>
                  )}
                  {acked && (
                    <Badge variant="outline" className="text-[9px] gap-1 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Pris en compte
                    </Badge>
                  )}
                </div>
                <p className="text-foreground leading-relaxed">{a.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {a.lienBodacc && (
                    <a
                      href={a.lienBodacc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline w-fit"
                    >
                      Voir l'annonce <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {restaurantId && (a.type === "procedure_collective" || a.type === "radiation") && (
                    acked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => restore(a as any)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Rétablir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 px-3 bg-emerald-500 text-white hover:bg-emerald-600"
                        onClick={() => dismiss(a as any, siren.replace(/\s/g, "").substring(0, 9))}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pris en compte
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
