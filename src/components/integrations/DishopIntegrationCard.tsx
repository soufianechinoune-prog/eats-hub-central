import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import {
  useDishopSyncWeek,
  useDishopProbeHistory,
  useDishopShopMapping,
  useUpdateDishopShopMapping,
  useDishopSyncRuns,
} from "@/hooks/usePOSConnectors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Search, ShieldAlert, Download, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  chainConnectionId: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  failed: "destructive",
  running: "secondary",
};

export function DishopIntegrationCard({ chainConnectionId }: Props) {
  const { selectedChainId } = useAnalyticsContext();
  const queryClient = useQueryClient();
  const sync = useDishopSyncWeek();
  const probe = useDishopProbeHistory();
  const updateMap = useUpdateDishopShopMapping();
  const {
    data: mappings = [],
    isLoading: mapLoading,
    isFetching: mapFetching,
    error: mapError,
    refetch: refetchMap,
  } = useDishopShopMapping(chainConnectionId);
  const { data: runs = [], refetch: refetchRuns } = useDishopSyncRuns(chainConnectionId);

  // Surface query errors (otherwise they would be silently swallowed)
  useEffect(() => {
    if (mapError) {
      console.error("[Dishop mapping] query error", mapError);
      toast({
        title: "Erreur de lecture du mapping Dishop",
        description: (mapError as Error)?.message ?? "Erreur inconnue",
        variant: "destructive",
      });
    }
  }, [mapError]);

  // Restaurants de la marque active
  const { data: restaurants = [] } = useQuery({
    queryKey: ["chain_restaurants", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("chain_id", selectedChainId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [probeOpen, setProbeOpen] = useState(false);

  const unmappedCount = useMemo(
    () => mappings.filter((m) => !m.restaurant_id).length,
    [mappings],
  );

  const handleRefreshMapping = async () => {
    console.log("[Dishop mapping] refresh clicked", {
      chainConnectionId,
      selectedChainId,
      currentMappings: mappings.length,
    });
    if (!chainConnectionId) {
      toast({
        title: "Connexion Dishop introuvable",
        description: "Aucune connexion Dishop active pour la marque sélectionnée.",
        variant: "destructive",
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["dishop_shop_mapping"] });
    const r = await refetchMap();
    toast({
      title: "Mapping rafraîchi",
      description: `${r.data?.length ?? 0} shop(s) Dishop trouvé(s).`,
    });
  };


  const handleSync = async () => {
    try {
      const r = await sync.mutateAsync({ connectionId: chainConnectionId });
      toast({
        title: "Import Dishop OK",
        description: `${r.rows_inserted.orders} commandes, ${r.rows_inserted.items} items, ${r.rows_inserted.customers} clients. ${r.new_shops.length > 0 ? `${r.new_shops.length} nouveaux shops détectés à mapper.` : ""}`,
      });
      refetchMap();
      refetchRuns();
    } catch (e: any) {
      toast({
        title: "Échec import Dishop",
        description: e?.message ?? "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const handleProbe = async () => {
    try {
      const r = await probe.mutateAsync(chainConnectionId);
      console.log("[Dishop probe_history]", r);
      setProbeOpen(true);
    } catch (e: any) {
      toast({ title: "Probe échoué", description: e?.message, variant: "destructive" });
    }
  };

  const handleMappingChange = async (mappingId: string, restaurantId: string) => {
    try {
      await updateMap.mutateAsync({
        mappingId,
        restaurantId: restaurantId === "__none__" ? null : restaurantId,
      });
      toast({ title: "Mapping mis à jour" });
    } catch (e: any) {
      toast({
        title: "Erreur de mapping",
        description: e?.message ?? "Vérifie que le restaurant appartient à la bonne marque.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {!chainConnectionId && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Connexion Dishop introuvable</AlertTitle>
          <AlertDescription className="text-xs">
            Aucune connexion Dishop active pour la marque sélectionnée. Vérifie le sélecteur de marque en haut de l'app.
          </AlertDescription>
        </Alert>
      )}

      {/* RGPD banner */}
      <Alert className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">Données personnelles importées</AlertTitle>
        <AlertDescription className="text-xs text-amber-800/80 dark:text-amber-200/80">
          L'import Dishop récupère email, téléphone et prénom des clients. Données chiffrées au repos
          et isolées par marque via RLS. Toute requête nécessite une authentification valide.
        </AlertDescription>
      </Alert>

      {/* Actions principales */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSync}
          disabled={sync.isPending}
          className="gap-2"
        >
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Importer la semaine courante
        </Button>
        <Button variant="outline" onClick={handleProbe} disabled={probe.isPending} className="gap-2">
          {probe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Sonder l'historique
        </Button>
      </div>

      {/* Mapping shops */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Mapping des shops Dishop</CardTitle>
            <CardDescription>
              {mappings.length === 0
                ? "Aucun shop encore détecté. Lance un import pour les découvrir."
                : `${mappings.length} shop(s) détecté(s)${unmappedCount > 0 ? ` — ${unmappedCount} sans restaurant` : ""}`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefreshMapping} disabled={mapFetching}>
            <RefreshCw className={`h-4 w-4 ${mapFetching ? "animate-spin" : ""}`} />
          </Button>

        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Les shops Dishop apparaîtront ici après le premier import.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Dishop</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.dishop_shop_id}</TableCell>
                    <TableCell>
                      <Select
                        value={m.restaurant_id ?? "__none__"}
                        onValueChange={(v) => handleMappingChange(m.id, v)}
                        disabled={updateMap.isPending}
                      >
                        <SelectTrigger className="h-8 w-[280px]">
                          <SelectValue placeholder="Choisir un restaurant…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Non mappé —</SelectItem>
                          {restaurants.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {m.restaurant_id ? (
                        <Badge variant="default">Mappé</Badge>
                      ) : (
                        <Badge variant="destructive">Non mappé</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Historique imports */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique des imports
            </CardTitle>
            <CardDescription>20 derniers imports Dishop pour cette marque.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchRuns()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun import pour l'instant.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Lignes insérées</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.year}-{String(r.month).padStart(2, "0")}
                      {r.week_index ? `-W${r.week_index}` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.rows_inserted ? (
                        <span>
                          {r.rows_inserted.orders ?? 0} cmd · {r.rows_inserted.items ?? 0} items ·{" "}
                          {r.rows_inserted.customers ?? 0} clients
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {probe.data && probeOpen && (
            <div className="mt-4 rounded-md border bg-muted/50 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <strong>Sondage historique Dishop</strong>
                <Button size="sm" variant="ghost" onClick={() => setProbeOpen(false)}>
                  Fermer
                </Button>
              </div>
              {probe.data.probes.map((p, i) => (
                <div key={i} className="border-b border-border/50 pb-2 last:border-b-0">
                  <div className="flex gap-2 items-center">
                    <Badge variant={p.status >= 200 && p.status < 300 ? "default" : "outline"}>
                      {p.status}
                    </Badge>
                    <code className="font-mono text-[10px] break-all">{p.path}</code>
                  </div>
                  <div className="mt-1 text-muted-foreground font-mono text-[10px] line-clamp-3">
                    {p.preview}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
