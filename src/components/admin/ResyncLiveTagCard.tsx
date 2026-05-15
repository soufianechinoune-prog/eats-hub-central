import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResyncRow {
  restaurant_id: string;
  restaurant_name: string;
  retagged_count: number;
  status?: "ok" | "locked" | "error" | "partial";
  message?: string;
}

interface ResyncLiveTagCardProps {
  selectedRestaurantId?: string | null;
  selectedRestaurantName?: string | null;
  onDone?: () => void;
}

export function ResyncLiveTagCard({ selectedRestaurantId, selectedRestaurantName, onDone }: ResyncLiveTagCardProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResyncRow[] | null>(null);

  const handleRun = async (mode: "selected" | "all") => {
    const isSelected = mode === "selected" && selectedRestaurantId;
    const targetLabel = isSelected ? selectedRestaurantName : "tous les restaurants éligibles";
    if (!confirm(`Resynchroniser le tag « Live » sur ${targetLabel} ?\n\nCela retag les commandes en \`uber_api\` partout où un backfill PAYMENT_DETAILS_REPORT est terminé.`)) return;
    setRunning(true);
    setResults(null);
    try {
      const rpc = supabase.rpc as any;
      const { data, error } = await rpc("resync_live_tag_restaurants", {
        p_restaurant_ids: isSelected ? [selectedRestaurantId] : null,
      });
      if (error) throw error;
      const rows = (data ?? []) as ResyncRow[];
      setResults(rows);
      const total = rows.reduce((s, r) => s + (r.retagged_count || 0), 0);
      onDone?.();
      toast({
        title: "Resynchronisation terminée",
        description: `${total.toLocaleString("fr-FR")} commande(s) re-taguées « Live » sur ${rows.length} restaurant(s).`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const total = results?.reduce((s, r) => s + (r.retagged_count || 0), 0) ?? 0;

  return (
    <Card className="border-l-4 border-l-violet-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Resynchroniser le tag « Live »
            </CardTitle>
            <CardDescription className="mt-1">
              Re-tag automatiquement les commandes en <code>uber_api</code> partout où un backfill officiel est déjà <strong>done</strong>.
              Utile quand des restos restent affichés en « Historique » alors que leurs données viennent bien de l'API Uber.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button onClick={() => handleRun("selected")} disabled={running || !selectedRestaurantId} variant="outline">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Resto sélectionné
            </Button>
            <Button onClick={() => handleRun("all")} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Tous les restos
            </Button>
          </div>
        </div>
      </CardHeader>
      {results && (
        <CardContent>
          <div className="flex items-center gap-2 mb-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">
              {total.toLocaleString("fr-FR")} commande(s) re-taguées sur {results.length} restaurant(s)
            </span>
          </div>
          {results.length > 0 && (
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-1">
                {results.map((r) => (
                  <div key={r.restaurant_id} className="flex justify-between text-xs px-2 py-1 hover:bg-muted rounded">
                    <span className="truncate">
                      {r.status === "locked" && "🔒 "}
                      {(r.status === "error" || r.status === "partial") && "⚠️ "}
                      {r.restaurant_name}
                    </span>
                    <span title={r.message} className={`tabular-nums ml-2 flex-shrink-0 ${r.status === "locked" || r.status === "error" || r.status === "partial" ? "text-destructive" : "text-muted-foreground"}`}>
                      {r.status === "locked" ? "verrouillé" : r.status === "error" ? "erreur" : r.status === "partial" ? `partiel +${r.retagged_count.toLocaleString("fr-FR")}` : `+${r.retagged_count.toLocaleString("fr-FR")}`}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
}
