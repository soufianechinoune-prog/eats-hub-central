import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface SyncRun {
  id: string;
  triggered_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  trigger_source: string;
  connections_processed: number;
  rows_upserted: number;
  errors_count: number;
  status: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  partial: "secondary",
  failed: "destructive",
  running: "outline",
};

export function SplashSyncRunsCard() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("splash360_sync_runs")
      .select("id, triggered_at, finished_at, duration_ms, trigger_source, connections_processed, rows_upserted, errors_count, status")
      .order("triggered_at", { ascending: false })
      .limit(50);
    setRuns((data ?? []) as SyncRun[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Historique des syncs Splash360</CardTitle>
          <CardDescription>
            Cron automatique : toutes les 30 min de 11h à minuit (Paris), puis toutes les heures jusqu'à 11h.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune synchronisation enregistrée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-2 pr-3">Quand</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3 text-right">Marques</th>
                  <th className="py-2 pr-3 text-right">Lignes</th>
                  <th className="py-2 pr-3 text-right">Erreurs</th>
                  <th className="py-2 pr-3 text-right">Durée</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      {formatDistanceToNow(new Date(r.triggered_at), { addSuffix: true, locale: fr })}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.trigger_source}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">{r.connections_processed}</td>
                    <td className="py-2 pr-3 text-right">{r.rows_upserted.toLocaleString("fr-FR")}</td>
                    <td className={`py-2 pr-3 text-right ${r.errors_count > 0 ? "text-destructive" : ""}`}>
                      {r.errors_count}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">
                      {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
