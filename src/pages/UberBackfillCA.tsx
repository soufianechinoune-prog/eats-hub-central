import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, RefreshCw, CheckCircle2, Activity, Clock, Webhook } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface RestoRow {
  id: string;
  name: string;
  uber_store_id: string;
  chain_id: string | null;
}

interface CalendarRow {
  month_start: string;
  api_count: number;
  csv_count: number;
  total_count: number;
}

interface JobRow {
  id: string;
  month_start: string;
  status: string;
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

const MONTHS_BACK = 24;
// Limite stricte de l'API Uber Eats pour ORDER_HISTORY_REPORT
const UBER_API_WINDOW_DAYS = 188;
const MIN_API_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() - UBER_API_WINDOW_DAYS);
  return d;
})();
const isInApiWindow = (monthStart: string) => {
  // Le mois est éligible si sa fin (dernier jour) est >= MIN_API_DATE
  const start = new Date(monthStart);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return end >= MIN_API_DATE;
};

export default function UberBackfillCA() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState(false);

  const startDate = useMemo(
    () => format(startOfMonth(subMonths(new Date(), MONTHS_BACK - 1)), "yyyy-MM-dd"),
    [],
  );
  const endDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // List — fast, no aggregation
  const { data: restos, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["backfill-ca-restos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_store_id, chain_id")
        .not("uber_store_id", "is", null)
        .neq("uber_store_id", "")
        .order("name");
      if (error) throw error;
      return (data ?? []) as RestoRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!restos) return [];
    const s = search.trim().toLowerCase();
    if (!s) return restos;
    return restos.filter((r) => r.name.toLowerCase().includes(s));
  }, [restos, search]);

  // Calendar for selected
  const { data: calendar, isLoading: loadingCalendar, refetch: refetchCalendar } = useQuery({
    queryKey: ["data-source-calendar", selectedId, startDate, endDate],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_restaurant_data_source_calendar", {
        p_restaurant_id: selectedId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data ?? []) as CalendarRow[];
    },
  });

  // Jobs for selected (vague 6 = ORDER_HISTORY_REPORT)
  const { data: jobs } = useQuery({
    queryKey: ["backfill-jobs-resto", selectedId],
    enabled: !!selectedId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backfill_jobs")
        .select("id, month_start, status, attempts, last_error, updated_at")
        .eq("restaurant_id", selectedId!)
        .eq("vague", 6)
        .order("month_start", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  // Global queue: pending + running across ALL vagues
  const { data: globalQueue } = useQuery({
    queryKey: ["backfill-global-queue"],
    refetchInterval: 10000,
    queryFn: async () => {
      const [pending, running] = await Promise.all([
        supabase.from("backfill_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("backfill_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
      ]);
      return { pending: pending.count ?? 0, running: running.count ?? 0 };
    },
  });

  // Throughput: jobs done vague=6 in last 60 min → debit jobs/min
  const { data: throughput } = useQuery({
    queryKey: ["backfill-throughput"],
    refetchInterval: 30000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("backfill_jobs")
        .select("id", { count: "exact", head: true })
        .eq("vague", 6)
        .eq("status", "done")
        .gte("updated_at", since);
      return (count ?? 0) / 60; // jobs per minute
    },
  });

  // Recent Uber webhooks for this restaurant
  const { data: webhooks } = useQuery({
    queryKey: ["uber-webhooks", selectedId],
    enabled: !!selectedId,
    refetchInterval: 10000,
    queryFn: async () => {
      const storeId = restos?.find((r) => r.id === selectedId)?.uber_store_id;
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("id, event_type, store_id, processed_at, payload")
        .eq("store_id", storeId)
        .order("processed_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    setPicked({});
  }, [selectedId]);

  const selectedResto = restos?.find((r) => r.id === selectedId);

  const togglePick = (m: string) => {
    if (!isInApiWindow(m)) return; // ignore les mois hors fenêtre
    setPicked((p) => ({ ...p, [m]: !p[m] }));
  };

  const pickAllCsv = () => {
    if (!calendar) return;
    const next: Record<string, boolean> = {};
    calendar.forEach((c) => {
      if (c.csv_count > 0 && c.api_count === 0 && isInApiWindow(c.month_start)) {
        next[c.month_start] = true;
      }
    });
    setPicked(next);
  };

  const pickYear = (year: number) => {
    if (!calendar) return;
    const next = { ...picked };
    calendar.forEach((c) => {
      if (new Date(c.month_start).getFullYear() === year && isInApiWindow(c.month_start)) {
        next[c.month_start] = true;
      }
    });
    setPicked(next);
  };


  const pickedMonths = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);

  const hasRunningJob = (jobs ?? []).some((j) => j.status === "pending" || j.status === "running");

  const launch = async () => {
    if (!selectedId || pickedMonths.length === 0) return;
    if (!confirm(`Lancer ${pickedMonths.length} appel(s) Uber pour ${selectedResto?.name} ?`)) return;
    setLaunching(true);
    try {
      const { data, error } = await supabase.rpc("enqueue_order_history_backfill", {
        p_restaurant_id: selectedId,
        p_months: pickedMonths,
      });
      if (error) throw error;
      toast({
        title: "Backfill lancé ✓",
        description: `${data} job(s) créés. Le worker (cron) traite ~5 jobs/min. Tu peux fermer l'onglet.`,
      });
      setPicked({});
      qc.invalidateQueries({ queryKey: ["backfill-jobs-resto", selectedId] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Impossible de lancer", variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  const monthsList = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < MONTHS_BACK; i++) {
      arr.push(format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM-dd"));
    }
    return arr;
  }, []);

  const calMap = useMemo(() => {
    const m = new Map<string, CalendarRow>();
    (calendar ?? []).forEach((c) => m.set(c.month_start.slice(0, 10), c));
    return m;
  }, [calendar]);

  const jobsByMonth = useMemo(() => {
    const m = new Map<string, JobRow>();
    (jobs ?? []).forEach((j) => m.set(j.month_start.slice(0, 10), j));
    return m;
  }, [jobs]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rattrapage CA Uber</h1>
          <p className="text-muted-foreground mt-1">
            Synchronise les <strong>6 derniers mois</strong> via l'API Uber Eats. Au-delà, l'historique reste sur les imports CSV — c'est la même donnée, même fiabilité.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Restaurants ({filtered.length})</CardTitle>
            <CardDescription>Triés par mois en CSV (priorité de rattrapage)</CardDescription>
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-3">
              {loadingSummary ? (
                <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((r) => {
                    const isSel = r.id === selectedId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left p-2 rounded-md border transition-colors ${
                          isSel ? "bg-primary/10 border-primary" : "hover:bg-muted border-transparent"
                        }`}
                      >
                        <div className="font-medium text-sm truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          store: {r.uber_store_id}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail */}
        <Card className="lg:col-span-3">
          {!selectedResto ? (
            <CardContent className="p-12 text-center text-muted-foreground">
              Sélectionne un restaurant à gauche
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{selectedResto.name}</CardTitle>
                <CardDescription>
                  uber_store_id: <code>{selectedResto.uber_store_id}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress banner for this resto */}
                {jobs && jobs.length > 0 && (() => {
                  const done = jobs.filter((j) => j.status === "done").length;
                  const running = jobs.filter((j) => j.status === "running").length;
                  const pending = jobs.filter((j) => j.status === "pending").length;
                  const failed = jobs.filter((j) => j.status === "failed").length;
                  const total = jobs.length;
                  const remaining = pending + running;
                  const rate = throughput ?? 0; // jobs/min réseau
                  const etaMin = rate > 0 ? Math.ceil(remaining / rate) : null;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          <Activity className="h-4 w-4" />
                          Progression : {done}/{total} done · {pct}%
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {remaining === 0
                            ? "Terminé"
                            : etaMin !== null
                              ? `ETA ~${etaMin < 60 ? `${etaMin} min` : `${(etaMin / 60).toFixed(1)} h`}`
                              : "ETA en cours de calcul…"}
                        </div>
                      </div>
                      <div className="h-2 bg-background rounded overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="text-emerald-600">✓ {done} done</span>
                        <span className="text-blue-600">⟳ {running} running</span>
                        <span>⏳ {pending} pending</span>
                        {failed > 0 && <span className="text-destructive">✕ {failed} failed</span>}
                        <span className="ml-auto">
                          Débit réseau : {rate.toFixed(2)} jobs/min
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Global queue indicator */}
                {globalQueue && (globalQueue.pending > 0 || globalQueue.running > 0) && (
                  <div className="text-xs text-muted-foreground border rounded p-2 bg-amber-50 dark:bg-amber-950/20">
                    <strong>File d'attente globale :</strong> {globalQueue.pending} pending · {globalQueue.running} running
                    (toutes vagues). Tes jobs peuvent attendre derrière les autres restos.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={pickAllCsv}>Cocher tous les CSV</Button>
                  <Button size="sm" variant="outline" onClick={() => pickYear(2025)}>Tout 2025</Button>
                  <Button size="sm" variant="outline" onClick={() => pickYear(2024)}>Tout 2024</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked({})}>Tout décocher</Button>
                </div>

                {loadingCalendar ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {monthsList.map((m) => {
                      const c = calMap.get(m);
                      const job = jobsByMonth.get(m);
                      const isApi = c && c.api_count > 0 && c.csv_count === 0;
                      const isMixed = c && c.api_count > 0 && c.csv_count > 0;
                      const isCsv = c && c.csv_count > 0 && c.api_count === 0;
                      const isEmpty = !c || c.total_count === 0;
                      const checked = !!picked[m];
                      return (
                        <label
                          key={m}
                          className={`flex items-start gap-2 p-2 border rounded-md cursor-pointer text-xs ${
                            checked ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePick(m)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {format(new Date(m), "MMM yyyy", { locale: fr })}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {isApi && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px]">API</Badge>}
                              {isCsv && <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-[10px]">CSV</Badge>}
                              {isMixed && <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">Mixte</Badge>}
                              {isEmpty && <Badge variant="outline" className="text-[10px]">Vide</Badge>}
                            </div>
                            {c && c.total_count > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {c.total_count} cmd
                              </div>
                            )}
                            {job && (
                              <div className="text-[10px] mt-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {job.status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {pickedMonths.length} mois sélectionné(s)
                    {hasRunningJob && <span className="ml-2 text-amber-600">• jobs en cours</span>}
                  </div>
                  <Button
                    onClick={launch}
                    disabled={launching || pickedMonths.length === 0}
                    className="gap-2"
                  >
                    {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Lancer ({pickedMonths.length})
                  </Button>
                </div>

                {jobs && jobs.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Jobs récents (vague 6)</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {jobs.map((j) => (
                        <div key={j.id} className="flex items-center justify-between text-xs p-1.5 bg-muted/50 rounded">
                          <span>{format(new Date(j.month_start), "MMM yyyy", { locale: fr })}</span>
                          <Badge
                            variant="outline"
                            className={
                              j.status === "done" ? "text-emerald-600" :
                              j.status === "failed" ? "text-destructive" :
                              j.status === "running" ? "text-blue-600" : ""
                            }
                          >
                            {j.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Uber webhooks */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Webhook className="h-4 w-4" /> Webhooks Uber reçus (ce resto)
                  </h4>
                  {!webhooks || webhooks.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">
                      Aucun webhook reçu pour ce store_id. Si "running" depuis &gt;30 min sans webhook, Uber n'a pas (encore) renvoyé le rapport.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {webhooks.map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between text-xs p-1.5 bg-muted/50 rounded">
                          <span className="font-mono">{w.event_type}</span>
                          <span className="text-muted-foreground">
                            {w.processed_at ? formatDistanceToNow(new Date(w.processed_at), { addSuffix: true, locale: fr }) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
