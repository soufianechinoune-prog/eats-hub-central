import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Play, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const REPORT_TYPES = ["PAYMENT_DETAILS_REPORT"];

interface Restaurant {
  id: string;
  name: string;
  uber_store_id: string | null;
}

type Vague = "v1" | "v2" | "v3";

function monthsForVague(vague: Vague, v3Year: number, v3Month: number) {
  if (vague === "v1") {
    return [
      { year: 2025, month: 7 },
      { year: 2025, month: 8 },
      { year: 2025, month: 9 },
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
    ];
  }
  if (vague === "v2") {
    return [
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
    ];
  }
  return [{ year: v3Year, month: v3Month }];
}

function vagueLabel(v: Vague, year: number, month: number) {
  if (v === "v1") return "v1";
  if (v === "v2") return "v2";
  return `v3-${year}-${String(month).padStart(2, "0")}`;
}

export default function UberBackfill() {
  const { data: isSuperAdmin, isLoading: roleLoading } = useIsSuperAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vague, setVague] = useState<Vague>("v1");
  const [v3Year, setV3Year] = useState(2026);
  const [v3Month, setV3Month] = useState(1);
  const [reportType, setReportType] = useState("PAYMENT_DETAILS_REPORT");
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [excludeInactive, setExcludeInactive] = useState(true);
  const [launching, setLaunching] = useState(false);

  // Restaurants with uber_store_id
  const { data: restaurants = [] } = useQuery({
    queryKey: ["uber-restaurants-all"],
    enabled: !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_store_id")
        .not("uber_store_id", "is", null)
        .neq("uber_store_id", "")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Restaurant[];
    },
  });

  // Default V1 to Chicken Street Besançon if available
  useEffect(() => {
    if (vague === "v1" && !restaurantId && restaurants.length > 0) {
      const besancon = restaurants.find((r) => /besan/i.test(r.name));
      setRestaurantId(besancon?.id ?? restaurants[0].id);
    }
  }, [vague, restaurantId, restaurants]);

  // Recent backfill runs
  const { data: runs = [], refetch: refetchRuns } = useQuery({
    queryKey: ["backfill-runs"],
    enabled: !!isSuperAdmin,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backfill_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Reports linked to recent runs (live status)
  const lastRunRestaurantIds = useMemo(() => {
    if (!runs.length) return [] as string[];
    const ids = new Set<string>();
    for (const r of runs.slice(0, 3)) {
      for (const id of r.restaurant_ids ?? []) ids.add(id);
    }
    return Array.from(ids);
  }, [runs]);

  const { data: liveReports = [] } = useQuery({
    queryKey: ["backfill-live-reports", lastRunRestaurantIds.join(",")],
    enabled: !!isSuperAdmin && lastRunRestaurantIds.length > 0,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, restaurant_id, report_type, status, start_date, end_date, created_at, workflow_id")
        .in("restaurant_id", lastRunRestaurantIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Orphan reports (pending > 2h)
  const { data: orphans = [], refetch: refetchOrphans } = useQuery({
    queryKey: ["backfill-orphans"],
    enabled: !!isSuperAdmin,
    refetchInterval: 30000,
    queryFn: async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("reports")
        .select("id, restaurant_id, report_type, status, start_date, end_date, created_at, workflow_id")
        .eq("status", "pending")
        .lt("created_at", twoHoursAgo)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const restaurantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of restaurants) m.set(r.id, r.name);
    return m;
  }, [restaurants]);

  // Inactive restaurants for V3 (no orders in target month)
  const months = monthsForVague(vague, v3Year, v3Month);
  const targetRestaurants = vague === "v1" && restaurantId
    ? restaurants.filter((r) => r.id === restaurantId)
    : vague === "v2"
      ? restaurants.slice(0, 10)
      : restaurants;

  const launchBackfill = async (dryRun: boolean) => {
    setLaunching(true);
    try {
      const userRes = await supabase.auth.getUser();
      const triggeredBy = userRes.data.user?.id;

      const restaurantIds = targetRestaurants.map((r) => r.id);
      const label = vagueLabel(vague, v3Year, v3Month);

      const { data, error } = await supabase.functions.invoke("uber-backfill-reports", {
        body: {
          reportType,
          restaurantIds,
          months,
          vague: label,
          dryRun,
          triggeredBy,
        },
      });

      if (error) throw error;

      if (dryRun) {
        toast({
          title: "Estimation",
          description: `${data.totalPlanned} rapports seraient générés (${data.restaurantCount} restos × ${data.monthCount} mois).`,
        });
      } else {
        toast({
          title: "Backfill lancé",
          description: `${data.ok}/${data.total} OK${data.failed ? ` · ${data.failed} échecs` : ""}.`,
        });
        queryClient.invalidateQueries({ queryKey: ["backfill-runs"] });
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  if (roleLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isSuperAdmin) return <Navigate to="/overview" replace />;

  const statusCounts = liveReports.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Backfill Uber API</h1>
        <p className="text-muted-foreground mt-1">
          Pilotage des imports historiques par vagues. {restaurants.length} restaurants connectés à Uber.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lancer une vague</CardTitle>
          <CardDescription>
            Sélectionnez la vague et vérifiez l'estimation avant de lancer pour de vrai.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={vague} onValueChange={(v) => setVague(v as Vague)}>
            <TabsList>
              <TabsTrigger value="v1">Vague 1 — 1 resto / 6 mois</TabsTrigger>
              <TabsTrigger value="v2">Vague 2 — 10 restos / 3 mois</TabsTrigger>
              <TabsTrigger value="v3">Vague 3 — Réseau / 1 mois</TabsTrigger>
            </TabsList>

            <TabsContent value="v1" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Validation pipeline. Chicken Street Besançon, juillet → décembre 2025 (6 rapports).
              </p>
              <div>
                <label className="text-sm font-medium mb-1 block">Restaurant</label>
                <Select value={restaurantId} onValueChange={setRestaurantId}>
                  <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {restaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="v2" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Stress webhook. 10 premiers restos × oct/nov/déc 2025 (30 rapports).
              </p>
            </TabsContent>

            <TabsContent value="v3" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Backfill réseau, mois par mois. {restaurants.length} restos × 1 mois = {restaurants.length} rapports.
              </p>
              <div className="flex gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Année</label>
                  <Select value={String(v3Year)} onValueChange={(v) => setV3Year(Number(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Mois</label>
                  <Select value={String(v3Month)} onValueChange={(v) => setV3Month(Number(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3 pt-2 border-t">
            <div className="flex-1">
              <p className="text-sm">
                <strong>{targetRestaurants.length}</strong> resto(s) × <strong>{months.length}</strong> mois
                = <strong>{targetRestaurants.length * months.length}</strong> rapports
              </p>
              <p className="text-xs text-muted-foreground">Type : {reportType}</p>
            </div>
            <Button variant="outline" onClick={() => launchBackfill(true)} disabled={launching}>
              {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Estimer (dry run)
            </Button>
            <Button onClick={() => launchBackfill(false)} disabled={launching || targetRestaurants.length === 0}>
              {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Lancer la vague
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live status of recent runs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rapports en cours</CardTitle>
              <CardDescription>État live des rapports créés par les 3 derniers runs.</CardDescription>
            </div>
            <div className="flex gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} variant={status === "completed" ? "default" : status === "failed" ? "destructive" : "secondary"}>
                  {status} : {count}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {liveReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rapport récent.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Workflow ID</TableHead>
                    <TableHead>Créé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveReports.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{restaurantNameById.get(r.restaurant_id) ?? r.restaurant_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{r.start_date} → {r.end_date}</TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === "completed" ? "default" :
                          r.status === "failed" ? "destructive" : "secondary"
                        }>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.workflow_id?.slice(0, 12)}…</TableCell>
                      <TableCell className="text-xs">{format(new Date(r.created_at), "dd/MM HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backfill runs history */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des vagues</CardTitle>
          <CardDescription>20 derniers runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun run pour l'instant.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vague</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Restos</TableHead>
                  <TableHead>OK / Total</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Lancé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.vague}</TableCell>
                    <TableCell className="text-xs">{r.start_date} → {r.end_date}</TableCell>
                    <TableCell>{(r.restaurant_ids ?? []).length}</TableCell>
                    <TableCell>{r.ok} / {r.total}</TableCell>
                    <TableCell>
                      {r.failed > 0 ? (
                        <Badge variant="destructive">{r.failed}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        r.status === "completed" ? "default" :
                        r.status === "completed_with_errors" ? "secondary" :
                        r.status === "running" ? "secondary" : "destructive"
                      }>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(r.started_at), "dd/MM HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Orphans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Rapports orphelins (pending &gt; 2h)
              </CardTitle>
              <CardDescription>Rapports dont le webhook n'est jamais revenu.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchOrphans()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orphans.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Aucun rapport orphelin.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Workflow ID</TableHead>
                  <TableHead>Créé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{restaurantNameById.get(r.restaurant_id) ?? r.restaurant_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{r.start_date} → {r.end_date}</TableCell>
                    <TableCell className="font-mono text-xs">{r.workflow_id?.slice(0, 16)}…</TableCell>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "dd/MM HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
