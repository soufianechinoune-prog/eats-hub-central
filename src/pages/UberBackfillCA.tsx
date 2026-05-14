import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, RefreshCw, CheckCircle2, Activity, Clock, Webhook, FileWarning } from "lucide-react";
import { BackfillNoteCard } from "@/components/admin/BackfillNoteCard";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, differenceInCalendarMonths } from "date-fns";
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

// PAYMENT_DETAILS_REPORT n'a aucune limite de date → on remonte jusqu'au 1er janvier 2024.
const HISTORY_START = new Date(2024, 0, 1);
const MONTHS_BACK = differenceInCalendarMonths(new Date(), HISTORY_START) + 1;

export default function UberBackfillCA() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

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

  // Notes (annotations) for all restaurants
  const { data: notesMap } = useQuery({
    queryKey: ["backfill-notes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_backfill_notes")
        .select("restaurant_id, status")
        .eq("report_type", "PAYMENT_DETAILS_REPORT");
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((n: any) => m.set(n.restaurant_id, n.status));
      return m;
    },
  });

  const filtered = useMemo(() => {
    if (!restos) return [];
    let list = restos;
    if (onlyFlagged) {
      list = list.filter((r) => {
        const s = notesMap?.get(r.id);
        return s && s !== "resolved";
      });
    }
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => r.name.toLowerCase().includes(s));
  }, [restos, search, onlyFlagged, notesMap]);

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

  // Jobs for selected (vague 1 = PAYMENT_DETAILS_REPORT)
  const { data: jobs } = useQuery({
    queryKey: ["backfill-jobs-resto", selectedId],
    enabled: !!selectedId,
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backfill_jobs")
        .select("id, month_start, status, attempts, last_error, updated_at")
        .eq("restaurant_id", selectedId!)
        .eq("vague", 1)
        .order("month_start", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  // Per-restaurant completion summary (vague 1) → indicator next to each resto in the list
  const { data: restoDoneMap } = useQuery({
    queryKey: ["backfill-done-by-resto"],
    refetchInterval: 15000,
    queryFn: async () => {
      const map = new Map<string, { done: number; running: number; pending: number; failed: number }>();
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("backfill_jobs")
          .select("restaurant_id, status")
          .eq("vague", 1)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data ?? [];
        for (const r of rows) {
          const k = r.restaurant_id as string;
          const cur = map.get(k) ?? { done: 0, running: 0, pending: 0, failed: 0 };
          if (r.status === "done") cur.done++;
          else if (r.status === "running") cur.running++;
          else if (r.status === "pending") cur.pending++;
          else if (r.status === "failed") cur.failed++;
          map.set(k, cur);
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return map;
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

  // Throughput: jobs done vague=1 in last 60 min → debit jobs/min
  const { data: throughput } = useQuery({
    queryKey: ["backfill-throughput"],
    refetchInterval: 30000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("backfill_jobs")
        .select("id", { count: "exact", head: true })
        .eq("vague", 1)
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
    setPicked((p) => ({ ...p, [m]: !p[m] }));
  };

  const pickAllCsv = () => {
    if (!calendar) return;
    const next: Record<string, boolean> = {};
    calendar.forEach((c) => {
      if (c.csv_count > 0 && c.api_count === 0) {
        next[c.month_start] = true;
      }
    });
    setPicked(next);
  };

  const pickYear = (year: number) => {
    if (!calendar) return;
    const next = { ...picked };
    calendar.forEach((c) => {
      if (new Date(c.month_start).getFullYear() === year) {
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
      const { data, error } = await supabase.rpc("enqueue_payment_details_backfill", {
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

  const cancelPending = async () => {
    if (!selectedId) return;
    const pendingCount = (jobs ?? []).filter((j) => j.status === "pending").length;
    if (pendingCount === 0) return;
    if (!confirm(`Annuler ${pendingCount} job(s) pending pour ${selectedResto?.name} ?`)) return;
    const { error } = await supabase
      .from("backfill_jobs")
      .update({
        status: "skipped",
        last_error: "Annulé manuellement par l'admin",
        updated_at: new Date().toISOString(),
      })
      .eq("restaurant_id", selectedId)
      .eq("vague", 1)
      .eq("status", "pending");
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Annulés", description: `${pendingCount} job(s) annulé(s).` });
    qc.invalidateQueries({ queryKey: ["backfill-jobs-resto", selectedId] });
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
            Synchronise <strong>tout l'historique disponible</strong> via l'API Uber Eats (rapport <code>PAYMENT_DETAILS_REPORT</code>, sans limite de date).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
        </Button>
      </div>

      <div className="rounded-lg border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm">
        <div className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">✅ CA Uber : aucune limite de date</div>
        <div className="text-emerald-800 dark:text-emerald-300">
          Cette page utilise uniquement le rapport <strong>PAYMENT_DETAILS_REPORT</strong>, qui n'a <strong>aucune limite de 188 jours</strong>.
          Tu peux rattraper le CA sur n'importe quel mois depuis l'ouverture du restaurant — 2024, 2023, etc.
        </div>
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
            <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
              <Checkbox checked={onlyFlagged} onCheckedChange={(v) => setOnlyFlagged(!!v)} />
              <span className="flex items-center gap-1">
                <FileWarning className="h-3 w-3 text-orange-500" />
                Uniquement les stores à problème
                {notesMap && (
                  <span className="text-muted-foreground">
                    ({Array.from(notesMap.values()).filter((s) => s !== "resolved").length})
                  </span>
                )}
              </span>
            </label>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-3">
              {loadingSummary ? (
                <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((r) => {
                    const isSel = r.id === selectedId;
                    const stats = restoDoneMap?.get(r.id);
                    const totalActionable = stats ? stats.done + stats.running + stats.pending + stats.failed : 0;
                    const isComplete = stats && totalActionable > 0 && stats.done === totalActionable;
                    const isRunning = stats && (stats.running > 0 || stats.pending > 0);
                    const hasFailed = stats && stats.failed > 0 && !isRunning;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left p-2 rounded-md border transition-colors ${
                          isSel ? "bg-primary/10 border-primary" : "hover:bg-muted border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <span title={`Rattrapage terminé (${stats!.done}/${totalActionable})`} className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          ) : isRunning ? (
                            <span title={`En cours (${stats!.running} running · ${stats!.pending} pending)`} className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/40">
                              <Loader2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
                            </span>
                          ) : hasFailed ? (
                            <span title={`${stats!.failed} job(s) en échec`} className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-destructive/15 text-destructive text-xs font-bold">!</span>
                          ) : (
                            <span title="Pas encore lancé" className="flex-shrink-0 inline-block h-2 w-2 rounded-full bg-muted-foreground/30 ml-1.5 mr-1.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{r.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              store: {r.uber_store_id}
                            </div>
                          </div>
                          {stats && stats.done > 0 && (
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                              {stats.done}/{totalActionable}
                            </span>
                          )}
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
                  const skipped = jobs.filter((j) => j.status === "skipped").length;
                  // Total "actionnable" : on exclut les skipped (hors fenêtre API → couverts par CSV)
                  const actionable = done + running + pending + failed;
                  const remaining = pending + running;
                  const rate = throughput ?? 0; // jobs/min réseau
                  const etaMin = rate > 0 ? Math.ceil(remaining / rate) : null;
                  const pct = actionable > 0 ? Math.round((done / actionable) * 100) : 0;
                  return (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          <Activity className="h-4 w-4" />
                          Progression : {done}/{actionable} done · {pct}%
                          {skipped > 0 && (
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              · {skipped} hors fenêtre (CSV)
                            </span>
                          )}
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
                  {(jobs ?? []).some((j) => j.status === "pending") && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={cancelPending}>
                      Annuler les pending
                    </Button>
                  )}
                </div>

                {loadingCalendar ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {monthsList.map((m) => {
                      const c = calMap.get(m);
                      const job = jobsByMonth.get(m);
                      // Un job done via API Uber suffit à marquer le mois comme "Live",
                      // même si data_source des commandes n'est pas (encore) tagué uber_api.
                      const jobDone = job?.status === "done";
                      const isApi = jobDone || (c && c.api_count > 0 && c.csv_count === 0);
                      const isMixed = !jobDone && c && c.api_count > 0 && c.csv_count > 0;
                      const isCsv = !jobDone && c && c.csv_count > 0 && c.api_count === 0;
                      const isEmpty = !c || c.total_count === 0;
                      const checked = !!picked[m];
                      return (
                        <label
                          key={m}
                          className={`flex items-start gap-2 p-2 border rounded-md text-xs cursor-pointer ${
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
                              {isApi && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px]">Live</Badge>}
                              {isCsv && <Badge className="bg-slate-500 hover:bg-slate-500 text-white text-[10px]">Historique</Badge>}
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
                    <h4 className="text-sm font-medium mb-2">Jobs récents (PAYMENT_DETAILS_REPORT)</h4>
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
