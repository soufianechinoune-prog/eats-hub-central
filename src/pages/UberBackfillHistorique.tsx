import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Play, AlertTriangle, CheckCircle2, RefreshCw, Trash2, Clock,
  History, Database, Zap, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ============= Configuration des 5 vagues =============
const VAGUES = [
  { vague: 1, type: "PAYMENT_DETAILS_REPORT", label: "Commandes & Finance", color: "emerald" },
  { vague: 2, type: "MENU_ITEM_FEEDBACK_REPORT", label: "Items / Produits vendus", color: "blue" },
  { vague: 3, type: "CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT", label: "Avis clients", color: "purple" },
  { vague: 4, type: "ORDER_ERRORS_TRANSACTION_REPORT", label: "Erreurs commandes", color: "amber" },
  { vague: 5, type: "DOWNTIME_REPORT", label: "Downtime / Disponibilité", color: "rose" },
] as const;

type ReportType = typeof VAGUES[number]["type"];

interface JobRow {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  uber_store_id: string;
  month_start: string;
  month_end: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  report_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  report_type: ReportType;
  vague: number;
}

interface Stats {
  pending: number;
  running: number;
  done: number;
  failed: number;
  skipped: number;
  total: number;
  started_at: string | null;
  last_completed_at: string | null;
}

interface VagueStats {
  vague: number;
  report_type: ReportType;
  pending: number;
  running: number;
  done: number;
  failed: number;
  skipped: number;
  total: number;
}

interface Stats {
  pending: number;
  running: number;
  done: number;
  failed: number;
  skipped: number;
  total: number;
  started_at: string | null;
  last_completed_at: string | null;
}

const STATUS_COLORS: Record<JobRow["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
  skipped: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export default function UberBackfillHistorique() {
  const { data: isSuperAdmin, isLoading: roleLoading } = useIsSuperAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [restaurantFilter, setRestaurantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vagueFilter, setVagueFilter] = useState<number | "all">("all");
  const [selectedReportTypes, setSelectedReportTypes] = useState<ReportType[]>(
    VAGUES.map((v) => v.type) as ReportType[]
  );
  const [seeding, setSeeding] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const toggleReportType = (t: ReportType) => {
    setSelectedReportTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  // ============= Stats globales (auto-refresh 10s) =============
  const { data: stats } = useQuery<Stats>({
    queryKey: ["backfill-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backfill_jobs_stats")
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as Stats;
    },
    enabled: !!isSuperAdmin,
    refetchInterval: 10000,
  });

  // ============= Stats par vague =============
  const { data: vagueStats } = useQuery<VagueStats[]>({
    queryKey: ["backfill-stats-by-vague"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("backfill_jobs_stats_by_vague")
        .select("*")
        .order("vague", { ascending: true });
      if (error) throw error;
      return (data || []) as VagueStats[];
    },
    enabled: !!isSuperAdmin,
    refetchInterval: 10000,
  });

  // ============= Liste des jobs (paginée client-side) =============
  const { data: jobs, isLoading: jobsLoading } = useQuery<JobRow[]>({
    queryKey: ["backfill-jobs", statusFilter, vagueFilter],
    queryFn: async () => {
      let q = supabase
        .from("backfill_jobs")
        .select("*")
        .order("vague", { ascending: true })
        .order("restaurant_name", { ascending: true })
        .order("month_start", { ascending: true })
        .limit(3000);
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      if (vagueFilter !== "all") {
        q = q.eq("vague", vagueFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as JobRow[];
    },
    enabled: !!isSuperAdmin,
    refetchInterval: 15000,
  });

  // ============= Heatmap data =============
  const heatmap = useMemo(() => {
    if (!jobs) return null;
    const restosMap = new Map<string, JobRow[]>();
    jobs.forEach((j) => {
      if (!restosMap.has(j.restaurant_name)) restosMap.set(j.restaurant_name, []);
      restosMap.get(j.restaurant_name)!.push(j);
    });
    const months = Array.from(new Set(jobs.map((j) => j.month_start))).sort();
    const restos = Array.from(restosMap.keys()).sort();
    return { restos, months, restosMap };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!restaurantFilter.trim()) return jobs;
    const f = restaurantFilter.toLowerCase();
    return jobs.filter((j) => j.restaurant_name.toLowerCase().includes(f));
  }, [jobs, restaurantFilter]);

  // ============= Actions =============
  const handleSeed = async () => {
    if (selectedReportTypes.length === 0) {
      toast({
        title: "Aucune vague sélectionnée",
        description: "Coche au moins une vague à générer.",
        variant: "destructive",
      });
      return;
    }
    setSeeding(true);
    try {
      const { data, error } = await supabase.rpc("seed_backfill_jobs", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_restaurant_ids: undefined,
        p_report_types: selectedReportTypes,
      });
      if (error) throw error;
      const result = (data as Array<{ inserted_count: number; skipped_count: number }>)?.[0];
      toast({
        title: "Seed terminé",
        description: `${result?.inserted_count ?? 0} jobs créés, ${result?.skipped_count ?? 0} déjà existants (${selectedReportTypes.length} vague(s)).`,
      });
      queryClient.invalidateQueries({ queryKey: ["backfill-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats-by-vague"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats-by-vague"] });
    } catch (err: any) {
      toast({ title: "Erreur seed", description: err.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const handleTriggerWorker = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("uber-backfill-worker", {
        body: {},
      });
      if (error) throw error;
      toast({
        title: "Worker déclenché",
        description: data?.status === "dispatched"
          ? `Job lancé : ${data.restaurant} (${data.month})`
          : data?.status === "idle"
          ? "Aucun job pending."
          : `Statut : ${data?.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ["backfill-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats-by-vague"] });
    } catch (err: any) {
      toast({ title: "Erreur worker", description: err.message, variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  const handleResetFailed = async () => {
    try {
      const { error } = await supabase
        .from("backfill_jobs")
        .update({ status: "pending", attempts: 0, last_error: null })
        .eq("status", "failed");
      if (error) throw error;
      toast({ title: "Failed → Pending", description: "Les échecs ont été remis dans la queue." });
      queryClient.invalidateQueries({ queryKey: ["backfill-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats-by-vague"] });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleClearAll = async () => {
    try {
      const { error } = await supabase
        .from("backfill_jobs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast({ title: "Queue vidée" });
      queryClient.invalidateQueries({ queryKey: ["backfill-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats"] });
      queryClient.invalidateQueries({ queryKey: ["backfill-stats-by-vague"] });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // ============= Garde super-admin =============
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/overview" replace />;

  // ============= Calculs progression =============
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const failed = stats?.failed ?? 0;
  const running = stats?.running ?? 0;
  const pending = stats?.pending ?? 0;
  const progressPct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;

  // ETA basée sur 1 job par minute (cron */1 * * * *)
  const etaMinutes = pending * 1;
  const etaText = etaMinutes > 60 * 24
    ? `${Math.round(etaMinutes / 60 / 24)} jours`
    : etaMinutes > 60
    ? `${Math.round(etaMinutes / 60)} h`
    : `${etaMinutes} min`;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8 text-primary" />
            Backfill Historique Uber Eats
          </h1>
          <p className="text-muted-foreground mt-1">
            Récupération automatique des commandes mois par mois, restaurant par restaurant.
          </p>
        </div>
      </div>

      {/* ============= Carte CONFIG / SEED ============= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Étape 1 : Générer la queue
          </CardTitle>
          <CardDescription>
            Crée 1 job par couple (restaurant × mois) entre les 2 dates. Idempotent : les jobs déjà créés sont ignorés.
            <strong className="block mt-1 text-foreground">
              Aucun risque de doublon de commandes : la contrainte unique (uber_order_id, uber_flow_id) protège la base.
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Date de début</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date de fin</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSeed}
                disabled={seeding}
                className="w-full"
              >
                {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                Générer les jobs
              </Button>
            </div>
          </div>

          {/* ============= Sélecteur de vagues ============= */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" /> Vagues à générer (séquentielles)
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedReportTypes(VAGUES.map((v) => v.type) as ReportType[])}
                >
                  Tout
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedReportTypes([])}
                >
                  Aucun
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {VAGUES.map((v) => {
                const checked = selectedReportTypes.includes(v.type);
                return (
                  <label
                    key={v.type}
                    className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleReportType(v.type)}
                    />
                    <span className="text-xs font-mono text-muted-foreground">V{v.vague}</span>
                    <span className="text-sm flex-1">{v.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Estimation : 169 restos × ~28 mois × {selectedReportTypes.length} vague(s) ={" "}
            <strong>
              ~{(169 * 28 * selectedReportTypes.length).toLocaleString("fr-FR")} jobs
            </strong>
            . Cron <strong>1 job/min</strong> → durée estimée{" "}
            <strong>
              ~{Math.round((169 * 28 * selectedReportTypes.length) / 60 / 24)} jours
            </strong>{" "}
            en arrière-plan. Vague 1 prête en ~{Math.round((169 * 28) / 60 / 24)} jours.
          </p>
        </CardContent>
      </Card>

      {/* ============= STATS PAR VAGUE ============= */}
      {vagueStats && vagueStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5" /> Avancement par vague
            </CardTitle>
            <CardDescription>
              Les vagues sont traitées dans l'ordre : la vague 1 se termine avant que la 2 ne commence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {vagueStats.map((vs) => {
              const conf = VAGUES.find((v) => v.type === vs.report_type);
              const pct = vs.total > 0 ? Math.round(((vs.done + vs.failed) / vs.total) * 100) : 0;
              const isActive = vagueFilter === vs.vague;
              return (
                <div
                  key={vs.vague}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                  }`}
                  onClick={() => setVagueFilter(isActive ? "all" : vs.vague)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">V{vs.vague}</Badge>
                      <span className="font-medium text-sm">{conf?.label ?? vs.report_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{vs.done.toLocaleString("fr-FR")} / {vs.total.toLocaleString("fr-FR")}</span>
                      {vs.running > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" /> {vs.running}
                        </span>
                      )}
                      {vs.failed > 0 && (
                        <span className="text-destructive">⚠ {vs.failed}</span>
                      )}
                      <span className="font-semibold text-foreground">{pct}%</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
            {vagueFilter !== "all" && (
              <Button size="sm" variant="ghost" onClick={() => setVagueFilter("all")}>
                Voir toutes les vagues
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============= STATS GLOBALES ============= */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{total.toLocaleString("fr-FR")}</div>
            <p className="text-xs text-muted-foreground mt-1">Total jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{done.toLocaleString("fr-FR")}</div>
            <p className="text-xs text-muted-foreground mt-1">Terminés ✓</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
              {running.toLocaleString("fr-FR")}
              {running > 0 && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">En cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pending.toLocaleString("fr-FR")}</div>
            <p className="text-xs text-muted-foreground mt-1">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{failed.toLocaleString("fr-FR")}</div>
            <p className="text-xs text-muted-foreground mt-1">Échoués</p>
          </CardContent>
        </Card>
      </div>

      {/* ============= PROGRESSION ============= */}
      {total > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Progression : {progressPct}%</span>
              </div>
              {pending > 0 && (
                <span className="text-sm text-muted-foreground">
                  ETA : <strong>~{etaText}</strong>
                </span>
              )}
            </div>
            <Progress value={progressPct} className="h-3" />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleTriggerWorker} disabled={triggering} size="sm" variant="default">
                {triggering ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Zap className="h-3 w-3 mr-2" />}
                Déclencher worker maintenant
              </Button>
              {failed > 0 && (
                <Button onClick={handleResetFailed} size="sm" variant="outline">
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Relancer les {failed} échecs
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive">
                    <Trash2 className="h-3 w-3 mr-2" />
                    Vider la queue
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Vider toute la queue ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Supprime tous les jobs (pending, done, failed). Les commandes déjà importées dans la base ne sont pas touchées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>Vider</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============= HEATMAP ============= */}
      {heatmap && heatmap.restos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Couverture par restaurant × mois</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1 mr-3">
                <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> Done
              </span>
              <span className="inline-flex items-center gap-1 mr-3">
                <span className="inline-block w-3 h-3 rounded bg-blue-500" /> Running
              </span>
              <span className="inline-flex items-center gap-1 mr-3">
                <span className="inline-block w-3 h-3 rounded bg-muted" /> Pending
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-destructive" /> Failed
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[500px]">
              <table className="text-xs border-collapse">
                <thead className="sticky top-0 bg-background z-10">
                  <tr>
                    <th className="text-left p-1 sticky left-0 bg-background border-r min-w-[200px]">Restaurant</th>
                    {heatmap.months.map((m) => (
                      <th key={m} className="p-1 font-mono text-[10px] whitespace-nowrap">
                        {m.slice(2, 7)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.restos.map((resto) => {
                    const restoJobs = heatmap.restosMap.get(resto)!;
                    const byMonth = new Map(restoJobs.map((j) => [j.month_start, j]));
                    return (
                      <tr key={resto} className="hover:bg-muted/30">
                        <td className="p-1 sticky left-0 bg-background border-r truncate max-w-[200px]" title={resto}>
                          {resto}
                        </td>
                        {heatmap.months.map((m) => {
                          const j = byMonth.get(m);
                          if (!j) return <td key={m} className="p-0.5"><div className="w-4 h-4 rounded-sm border border-dashed border-muted" /></td>;
                          const cls =
                            j.status === "done" ? "bg-emerald-500" :
                            j.status === "running" ? "bg-blue-500 animate-pulse" :
                            j.status === "failed" ? "bg-destructive" :
                            j.status === "skipped" ? "bg-amber-500" :
                            "bg-muted";
                          return (
                            <td key={m} className="p-0.5">
                              <div
                                className={`w-4 h-4 rounded-sm ${cls}`}
                                title={`${j.status}${j.last_error ? ` - ${j.last_error}` : ""}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============= TABLE DÉTAILLÉE ============= */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des jobs ({filteredJobs.length})</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Input
              placeholder="Filtrer par restaurant..."
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex gap-1">
              {(["all", "pending", "running", "done", "failed"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun job.</p>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Tentatives</TableHead>
                    <TableHead>Dernière erreur</TableHead>
                    <TableHead>Terminé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.slice(0, 500).map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.restaurant_name}</TableCell>
                      <TableCell className="font-mono text-xs">{j.month_start.slice(0, 7)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[j.status]}>
                          {j.status === "done" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {j.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {j.status === "failed" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{j.attempts}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={j.last_error || ""}>
                        {j.last_error || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {j.completed_at
                          ? format(new Date(j.completed_at), "d MMM HH:mm", { locale: fr })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredJobs.length > 500 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Affichage limité aux 500 premiers résultats sur {filteredJobs.length}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
