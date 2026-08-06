import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, Copy, Loader2, Ban, RefreshCw } from "lucide-react";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useToast } from "@/hooks/use-toast";

interface DuplicateRow {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_splash_id: number;
  splash_name: string | null;
  is_not_applicable: boolean;
  revenue_ttc: number;
  order_count: number;
  days_count: number;
  first_sale: string | null;
  last_sale: string | null;
}

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

/**
 * Écran de réconciliation des boutiques Splash rattachées au même restaurant.
 * Permet de conserver le bon splash_id et de marquer les autres « non applicable ».
 */
export function SplashReconciliationCard() {
  const { selectedChainId } = useAnalyticsContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<number | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<DuplicateRow[]>({
    queryKey: ["splash-duplicate-mappings", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("splash_duplicate_mappings", {
        p_chain_id: selectedChainId as string,
      });
      if (error) throw error;
      return (data ?? []) as DuplicateRow[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, DuplicateRow[]>();
    (data ?? []).forEach((row) => {
      const list = map.get(row.restaurant_id) ?? [];
      list.push(row);
      map.set(row.restaurant_id, list);
    });
    return Array.from(map.values());
  }, [data]);

  const detach = useMutation({
    mutationFn: async (splashIds: number[]) => {
      const { error } = await supabase
        .from("splash360_restaurant_mapping")
        .update({ restaurant_id: null, is_not_applicable: true })
        .in("restaurant_splash_id", splashIds);
      if (error) throw error;
    },
    onSuccess: async (_r, splashIds) => {
      toast({
        title: "Réconciliation appliquée",
        description: `${splashIds.length} boutique(s) Splash marquée(s) « non applicable ».`,
      });
      await queryClient.invalidateQueries({ queryKey: ["splash-duplicate-mappings"] });
      await queryClient.invalidateQueries({ queryKey: ["splash-onsite-monthly"] });
    },
    onError: (e: unknown) => {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Mise à jour impossible",
        variant: "destructive",
      });
    },
    onSettled: () => setPending(null),
  });

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-amber-600" />
              Réconciliation des boutiques Splash
            </CardTitle>
            <CardDescription className="mt-1">
              Boutiques Splash rattachées au même restaurant. Conserve celle qui porte le chiffre d'affaires et marque
              l'autre « non applicable » pour éviter tout double comptage.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Vérifier
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Aucun doublon : chaque boutique Splash est rattachée à un seul restaurant.
          </div>
        ) : (
          groups.map((group) => {
            const best = group.reduce((a, b) => (Number(b.revenue_ttc) > Number(a.revenue_ttc) ? b : a));
            return (
              <div key={group[0].restaurant_id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-semibold">{group[0].restaurant_name}</span>
                  <Badge variant="outline">{group.length} boutiques Splash</Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  {group.map((row) => {
                    const isBest = row.restaurant_splash_id === best.restaurant_splash_id;
                    const others = group
                      .filter((r) => r.restaurant_splash_id !== row.restaurant_splash_id)
                      .map((r) => r.restaurant_splash_id);
                    return (
                      <div
                        key={row.restaurant_splash_id}
                        className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                          isBest ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/30"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-xs">
                              #{row.restaurant_splash_id}
                            </Badge>
                            <span className="text-sm font-medium">{row.splash_name ?? "Sans nom"}</span>
                            {isBest && (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">CA principal</Badge>
                            )}
                            {Number(row.revenue_ttc) === 0 && <Badge variant="outline">Aucun CA</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {eur(Number(row.revenue_ttc))} · {Number(row.order_count).toLocaleString("fr-FR")} commandes ·{" "}
                            {row.days_count} jours · {fdate(row.first_sale)} → {fdate(row.last_sale)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={detach.isPending}
                            onClick={() => {
                              setPending(row.restaurant_splash_id);
                              detach.mutate(others);
                            }}
                          >
                            {detach.isPending && pending === row.restaurant_splash_id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Garder celle-ci
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={detach.isPending}
                            onClick={() => {
                              setPending(row.restaurant_splash_id);
                              detach.mutate([row.restaurant_splash_id]);
                            }}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Non applicable
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <p className="text-xs italic text-muted-foreground">
          ℹ️ « Garder celle-ci » détache les autres boutiques du restaurant et les marque « non applicable » : leurs
          ventes sortent du rapport Ventes sur place, sans suppression de données.
        </p>
      </CardContent>
    </Card>
  );
}
