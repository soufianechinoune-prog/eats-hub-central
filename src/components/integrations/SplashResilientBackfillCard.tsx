import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Server, Settings2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { BackfillConfigDialog } from "./BackfillConfigDialog";

interface ProgressRow {
  total: number;
  pending: number;
  running: number;
  done: number;
  error: number;
  oldest_pending_created: string | null;
  latest_completed: string | null;
}

/**
 * Carte de pilotage du backfill Splash360 résilient (côté serveur).
 * - Lance les jobs via la fonction Postgres enqueue_splash_backfill_for_chain
 * - Le worker tourne automatiquement toutes les minutes via pg_cron
 * - L'utilisateur peut fermer l'onglet, le backfill continue
 */
export function SplashResilientBackfillCard() {
  const { selectedChainId } = useAnalyticsContext();
  const [enqueuing, setEnqueuing] = useState(false);

  const { data: progress, isLoading } = useQuery<ProgressRow | null>({
    queryKey: ["splash-backfill-progress", selectedChainId],
    enabled: !!selectedChainId,
    refetchInterval: 5000, // poll toutes les 5 sec
    queryFn: async () => {
      if (!selectedChainId) return null;
      const { data, error } = await supabase.rpc("splash_backfill_progress", {
        p_chain_id: selectedChainId,
      });
      if (error) throw error;
      return (data?.[0] as ProgressRow) ?? null;
    },
  });

  const isRunning = (progress?.pending ?? 0) > 0 || (progress?.running ?? 0) > 0;
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const errors = progress?.error ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleEnqueue = async (
    label: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
  ) => {
    if (!selectedChainId) return;
    setEnqueuing(true);
    try {
      const { data, error } = await supabase.rpc("enqueue_splash_backfill_for_chain", {
        p_chain_id: selectedChainId,
        p_start_year: startYear,
        p_start_month: startMonth,
        p_end_year: endYear,
        p_end_month: endMonth,
      });
      if (error) throw error;
      toast({
        title: `Backfill ${label} lancé ✓`,
        description: `${data} jobs créés. Le serveur va les traiter en arrière-plan (≈ 1 minute par job, plusieurs heures au total). Tu peux fermer l'onglet.`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message ?? "Impossible de lancer le backfill",
        variant: "destructive",
      });
    } finally {
      setEnqueuing(false);
    }
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Backfill Splash360 résilient
            </CardTitle>
            <CardDescription className="mt-1">
              Tourne côté serveur, tu peux fermer l'onglet. Worker exécuté toutes les minutes via cron, reprend automatiquement en cas d'erreur.
            </CardDescription>
          </div>
          {isRunning ? (
            <Badge variant="default" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              En cours
            </Badge>
          ) : total > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Terminé
            </Badge>
          ) : (
            <Badge variant="outline">Inactif</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : total > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progression : <span className="font-semibold text-foreground">{done}/{total}</span> jobs ({pct}%)
              </span>
              <div className="flex gap-3 text-xs">
                {(progress?.running ?? 0) > 0 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    {progress?.running} en cours
                  </span>
                )}
                {(progress?.pending ?? 0) > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {progress?.pending} en attente
                  </span>
                )}
                {errors > 0 && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors} erreur{errors > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <Progress value={pct} className="h-2" />
            {progress?.latest_completed && (
              <p className="text-xs text-muted-foreground">
                Dernier job terminé{" "}
                {formatDistanceToNow(new Date(progress.latest_completed), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun backfill lancé. Cliquez sur l'un des boutons ci-dessous pour démarrer.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => handleEnqueue("24 mois (2024-05 → aujourd'hui)", 2024, 5, currentYear, currentMonth)}
            disabled={enqueuing || isRunning}
            className="gap-2"
          >
            {enqueuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Backfill 2024-05 → aujourd'hui
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEnqueue("historique 2021-2023", 2021, 1, 2024, 4)}
            disabled={enqueuing || isRunning}
            className="gap-2"
          >
            {enqueuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Backfill historique 2021-01 → 2024-04
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEnqueue("complet 2021 → aujourd'hui", 2021, 1, currentYear, currentMonth)}
            disabled={enqueuing || isRunning}
            className="gap-2"
          >
            {enqueuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Tout (2021 → aujourd'hui)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground italic">
          ℹ️ ~5 jobs traités par minute (≈ 300 jobs/h). Pour 104 restos × 24 mois = 2 500 jobs ≈ 8 h.
          Pour 60 mois ≈ 21 h. Tu peux fermer l'onglet, le backfill continue côté serveur.
        </p>
      </CardContent>
    </Card>
  );
}
