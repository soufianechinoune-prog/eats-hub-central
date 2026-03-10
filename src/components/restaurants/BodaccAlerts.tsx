import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, FileText, Loader2, Scale, ShieldAlert } from "lucide-react";

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

export function BodaccAlerts({ siren }: { siren: string | null | undefined }) {
  const [isOpen, setIsOpen] = useState(false);

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
  const hasCritical = annonces.some(
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
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-1">
          {annonces.map((a, i) => {
            const config = typeBadgeConfig[a.type] || typeBadgeConfig.autre;
            return (
              <div
                key={i}
                className="flex flex-col gap-1 rounded-md border border-border bg-card p-2.5 text-xs"
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
                </div>
                <p className="text-foreground leading-relaxed">{a.description}</p>
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
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
