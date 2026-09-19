import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Gift,
  HandCoins,
  Info,
  Percent,
  Repeat,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import type { GrowthGranularity } from "@/hooks/useChataigneGrowth";
import {
  useChataigneReferralAcquisition,
  useChataigneReferralPayback,
  useChataigneReferralRetention,
  useChataigneReferralSegments,
} from "@/hooks/useChataigneReferral";
import { ChartNoteDialog } from "@/components/charts/ChartNoteDialog";
import { renderChartNoteMarkers } from "@/components/charts/ChartNoteMarkers";
import { filterNotesByScope, useChartNotes, type ChartNote } from "@/hooks/useChartNotes";
import { cn } from "@/lib/utils";

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)} %`;

const periodLabel = (periode: string, granularity: GrowthGranularity) => {
  try {
    const d = parseISO(periode);
    if (granularity === "month") return format(d, "MMM yyyy", { locale: fr });
    if (granularity === "week") return `S${format(d, "II", { locale: fr })} · ${format(d, "dd/MM")}`;
    return format(d, "dd/MM");
  } catch {
    return periode;
  }
};

const SEGMENT_LABELS: Record<string, string> = {
  filleul: "Filleuls (parrainage)",
  bienvenue: "Promo de bienvenue",
  organique: "Organique",
};

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const cohortLabel = (cohorte: string) => {
  const [y, m] = cohorte.split("-");
  return `${MONTH_LABELS[Number(m) - 1] ?? cohorte} ${y}`;
};

function retentionColor(pct: number) {
  if (pct <= 0) return "bg-muted text-muted-foreground";
  if (pct < 5) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (pct < 10) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (pct < 20) return "bg-emerald-500/35 text-emerald-900 dark:text-emerald-100";
  if (pct < 35) return "bg-emerald-500/55 text-emerald-950 dark:text-emerald-50";
  return "bg-emerald-600/75 text-emerald-50";
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  borderColor: "hsl(var(--border))",
  color: "hsl(var(--popover-foreground))",
  borderRadius: 8,
};

function DeltaValue({
  label,
  before,
  after,
  render,
  higherIsBetter = true,
}: {
  label: string;
  before: number;
  after: number;
  render: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const delta = after - before;
  const good = higherIsBetter ? delta >= 0 : delta <= 0;
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">{render(before)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-lg font-semibold">{render(after)}</span>
      </div>
      <div className={cn("text-xs font-medium", good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
        {delta >= 0 ? "+" : "−"}
        {render(Math.abs(delta))}
      </div>
    </div>
  );
}

export default function ChataigneReferral() {
  const [granularity, setGranularity] = useState<GrowthGranularity>("week");
  const [paybackBasis, setPaybackBasis] = useState<"rank" | "days">("rank");
  const [markerId, setMarkerId] = useState<string>("");
  const [windowDays, setWindowDays] = useState<number>(28);

  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    setPeriodMode,
    setDateRange,
  } = useAnalyticsContext();

  // Par défaut : tout l'historique du canal (1er juin 2026 → aujourd'hui)
  const didInitPeriod = useRef(false);
  useEffect(() => {
    if (didInitPeriod.current) return;
    didInitPeriod.current = true;
    setDateRange({ from: new Date(2026, 5, 1), to: new Date() });
    setPeriodMode("range");
  }, [setDateRange, setPeriodMode]);

  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id, name, city, is_pinned, is_active").order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    if (!restaurants) return undefined;
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    if (!resolved) return null;
    if (resolved === EMPTY_BRAND_SCOPE_RESTAURANT_IDS) return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    return resolved;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const acquisitionQ = useChataigneReferralAcquisition(start, end, granularity, restaurantFilter);
  const paybackQ = useChataigneReferralPayback(start, end, restaurantFilter);
  const segmentsQ = useChataigneReferralSegments(start, end, restaurantFilter);
  const retentionQ = useChataigneReferralRetention(start, end, restaurantFilter);

  const rows = acquisitionQ.data ?? [];
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        periode: r.periode,
        label: periodLabel(r.periode, granularity),
        filleuls: r.filleuls,
        parrains: r.parrains,
        part: r.part_parrainage,
        viralite: r.viralite,
        cac: r.cac,
      })),
    [rows, granularity]
  );

  // ---- Annotations posées sur les graphiques (mécanisme Actions & Events) ----
  const notesQ = useChartNotes(start, end);
  const chartNotes = useMemo(
    () => filterNotesByScope(notesQ.data, restaurantFilter),
    [notesQ.data, restaurantFilter]
  );
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; date: Date | null; existing: ChartNote | null }>({
    open: false,
    date: null,
    existing: null,
  });
  const openNoteForLabel = (label: string | undefined) => {
    if (!label) return;
    const row = chartData.find((r) => r.label === label);
    setNoteDialog({ open: true, date: row?.periode ? parseISO(row.periode) : null, existing: null });
  };
  const openExistingNote = (notes: ChartNote[]) => {
    const first = notes[0];
    setNoteDialog({ open: true, date: first ? parseISO(first.note_date) : null, existing: first ?? null });
  };

  // ---- Avant / après un marqueur ----
  const marker = chartNotes.find((n) => n.id === markerId) ?? null;
  const beforeStart = marker ? format(addDays(parseISO(marker.note_date), -windowDays), "yyyy-MM-dd") : "";
  const beforeEnd = marker ? format(addDays(parseISO(marker.note_date), -1), "yyyy-MM-dd") : "";
  const afterStart = marker ? marker.note_date : "";
  const afterEnd = marker ? format(addDays(parseISO(marker.note_date), windowDays - 1), "yyyy-MM-dd") : "";

  const beforeAcqQ = useChataigneReferralAcquisition(beforeStart, beforeEnd, "week", restaurantFilter, !!marker);
  const afterAcqQ = useChataigneReferralAcquisition(afterStart, afterEnd, "week", restaurantFilter, !!marker);
  const beforeSegQ = useChataigneReferralSegments(beforeStart, beforeEnd, restaurantFilter, !!marker);
  const afterSegQ = useChataigneReferralSegments(afterStart, afterEnd, restaurantFilter, !!marker);

  const windowStats = (
    acq: typeof rows | undefined,
    seg: ReturnType<typeof useChataigneReferralSegments>["data"]
  ) => {
    const list = acq ?? [];
    const filleuls = list.reduce((s, r) => s + r.filleuls, 0);
    const cost = list.reduce((s, r) => s + r.cout_filleul + r.cout_parrain, 0);
    const weeks = Math.max(1, windowDays / 7);
    const fill = (seg ?? []).find((s) => s.segment === "filleul");
    return {
      filleulsPerWeek: filleuls / weeks,
      cac: filleuls > 0 ? cost / filleuls : 0,
      reachat: fill?.taux_reachat ?? 0,
      panier: fill?.panier_moyen ?? 0,
    };
  };
  const before = windowStats(beforeAcqQ.data, beforeSegQ.data);
  const after = windowStats(afterAcqQ.data, afterSegQ.data);
  const beforeAfterLoading =
    !!marker && (beforeAcqQ.isLoading || afterAcqQ.isLoading || beforeSegQ.isLoading || afterSegQ.isLoading);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const filleuls = rows.reduce((s, r) => s + r.filleuls, 0);
    const parrains = rows.reduce((s, r) => s + r.parrains, 0);
    const nouveaux = rows.reduce((s, r) => s + r.nouveaux_clients, 0);
    const cost = rows.reduce((s, r) => s + r.cout_filleul + r.cout_parrain, 0);
    return {
      filleuls,
      parrains,
      nouveaux,
      part: nouveaux > 0 ? (filleuls / nouveaux) * 100 : 0,
      viralite: parrains > 0 ? filleuls / parrains : 0,
      cac: filleuls > 0 ? cost / filleuls : 0,
      cost,
    };
  }, [rows]);

  // ---- Payback ----
  const paybackRows = paybackQ.data ?? [];
  const cac = paybackRows[0]?.cac ?? kpis.cac;
  const paybackData = useMemo(
    () =>
      paybackRows
        .filter((r) => r.basis === paybackBasis)
        .map((r) => ({
          label: paybackBasis === "rank" ? `${r.x}${r.x === 1 ? "ʳᵉ" : "ᵉ"}` : `J+${r.x}`,
          x: r.x,
          cumul: r.contribution_cumul,
          clients: r.clients,
        })),
    [paybackRows, paybackBasis]
  );
  const breakEven = useMemo(() => {
    const ranks = paybackRows.filter((r) => r.basis === "rank").sort((a, b) => a.x - b.x);
    const days = paybackRows.filter((r) => r.basis === "days").sort((a, b) => a.x - b.x);
    return {
      orders: ranks.find((r) => r.contribution_cumul >= cac)?.x ?? null,
      days: days.find((r) => r.contribution_cumul >= cac)?.x ?? null,
    };
  }, [paybackRows, cac]);

  // ---- Réachat / cohortes filleuls ----
  const segments = segmentsQ.data ?? [];
  const segmentChart = segments.map((s) => ({
    label: SEGMENT_LABELS[s.segment] ?? s.segment,
    reachat: s.taux_reachat,
    commandes: s.commandes_moy,
    panier: s.panier_moyen,
    clients: s.clients,
  }));

  const filleulCohorts = useMemo(() => {
    const map = new Map<string, { cohorte: string; taille: number; cells: Map<number, number> }>();
    for (const r of retentionQ.data ?? []) {
      if (r.segment !== "filleul") continue;
      const entry = map.get(r.cohorte) ?? { cohorte: r.cohorte, taille: r.taille_cohorte, cells: new Map() };
      entry.taille = Math.max(entry.taille, r.taille_cohorte);
      entry.cells.set(r.mois_offset, r.taux_pct);
      map.set(r.cohorte, entry);
    }
    return [...map.values()].sort((a, b) => a.cohorte.localeCompare(b.cohorte));
  }, [retentionQ.data]);
  const maxOffset = useMemo(
    () => (retentionQ.data ?? []).filter((r) => r.segment === "filleul").reduce((m, r) => Math.max(m, r.mois_offset), 0),
    [retentionQ.data]
  );
  const offsets = useMemo(() => Array.from({ length: Math.max(0, maxOffset) }, (_, i) => i + 1), [maxOffset]);

  const isLoading = restaurantFilter === undefined || acquisitionQ.isLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Parrainage</h1>
                <p className="text-muted-foreground">
                  Canal Chataigne · acquisition, coût d'acquisition et rentabilisation des filleuls · 100 % anonyme
                </p>
              </div>
              <ToggleGroup
                type="single"
                value={granularity}
                onValueChange={(v) => v && setGranularity(v as GrowthGranularity)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="day">Jour</ToggleGroupItem>
                <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
                <ToggleGroupItem value="month">Mois</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <AnalyticsHeader />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              <strong>Filleul</strong> : client dont la 1ʳᵉ commande porte « Code Parrainage » (−25 %), suivi ensuite
              sur toutes ses commandes. <strong>Parrain</strong> : client dont une commande porte « Referral Reward »
              (−15 %). <strong>Contribution</strong> = montant encaissé (déjà net des remises) − 1 € Chataigne − frais
              Stripe (0,25 € + 1,5 %) ; le coût matière n'est pas encore inclus. <strong>Coût d'acquisition</strong> =
              remise filleul + remise parrain ; la remise parrain n'étant pas reliée à son filleul dans les données,
              elle est répartie en moyenne sur les filleuls de la période. Valeur vie client et ratio valeur/coût
              volontairement exclus pour l'instant.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <KPICard title="Filleuls acquis" value={fmtInt(kpis.filleuls)} icon={Gift} />
              <KPICard title="Parrains actifs" value={fmtInt(kpis.parrains)} icon={Users} />
              <KPICard
                title="Filleuls par parrain"
                value={kpis.viralite ? kpis.viralite.toFixed(2) : "—"}
                icon={Sparkles}
              />
              <KPICard title="Coût d'acquisition filleul" value={fmtEur(kpis.cac)} icon={HandCoins} />
              <KPICard title="Part des nouveaux clients" value={fmtPct(kpis.part)} icon={Percent} />
            </div>
          )}

          {isEmpty ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Aucune commande avec code de parrainage sur la période sélectionnée.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 1. Acquisition dans le temps */}
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Filleuls &amp; parrains dans le temps</CardTitle>
                    <CardDescription>
                      Cliquez sur le graphique pour ajouter un repère (changement de barème, campagne…)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {acquisitionQ.isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 18, right: 16, bottom: 0, left: 0 }}
                          onClick={(s: any) => openNoteForLabel(s?.activeLabel)}
                          style={{ cursor: "pointer" }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickMargin={8} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={44} />
                          <RTooltip contentStyle={tooltipStyle} />
                          <Legend />
                          <Bar dataKey="filleuls" name="Filleuls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="parrains" name="Parrains" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                          {renderChartNoteMarkers({
                            notes: chartNotes,
                            rows: chartData,
                            granularity,
                            onMarkerClick: openExistingNote,
                          })}
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Viralité &amp; poids dans l'acquisition</CardTitle>
                    <CardDescription>Filleuls par parrain · part du parrainage dans les nouveaux clients</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {acquisitionQ.isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 18, right: 16, bottom: 0, left: 0 }}
                          onClick={(s: any) => openNoteForLabel(s?.activeLabel)}
                          style={{ cursor: "pointer" }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickMargin={8} />
                          <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(v) => `${v} %`}
                            width={52}
                          />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={44} />
                          <RTooltip contentStyle={tooltipStyle} />
                          <Legend />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="part"
                            name="% des nouveaux clients"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="viralite"
                            name="Filleuls par parrain"
                            stroke="hsl(38 92% 50%)"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                          />
                          {renderChartNoteMarkers({
                            notes: chartNotes,
                            rows: chartData,
                            granularity,
                            onMarkerClick: openExistingNote,
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 2. Avant / après un repère */}
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Avant / après un changement de barème</CardTitle>
                    <CardDescription>
                      Choisissez un repère posé sur les graphiques : les métriques sont comparées sur la même durée
                      avant et après.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={markerId} onValueChange={setMarkerId}>
                      <SelectTrigger className="w-[260px]">
                        <SelectValue placeholder="Sélectionner un repère" />
                      </SelectTrigger>
                      <SelectContent>
                        {chartNotes.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Aucun repère — cliquez sur un graphique
                          </SelectItem>
                        ) : (
                          chartNotes.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {format(parseISO(n.note_date), "dd/MM/yyyy")} · {n.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <ToggleGroup
                      type="single"
                      value={String(windowDays)}
                      onValueChange={(v) => v && setWindowDays(Number(v))}
                      variant="outline"
                      size="sm"
                    >
                      <ToggleGroupItem value="14">14 j</ToggleGroupItem>
                      <ToggleGroupItem value="28">28 j</ToggleGroupItem>
                      <ToggleGroupItem value="56">56 j</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent>
                  {!marker ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Aucun repère sélectionné. Cliquez sur un graphique ci-dessus pour ajouter une date et un libellé,
                      puis sélectionnez-le ici.
                    </p>
                  ) : beforeAfterLoading ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{marker.title}</Badge>
                        <span>
                          {format(parseISO(beforeStart), "dd/MM")} → {format(parseISO(beforeEnd), "dd/MM")} vs{" "}
                          {format(parseISO(afterStart), "dd/MM")} → {format(parseISO(afterEnd), "dd/MM")}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <DeltaValue
                          label="Filleuls / semaine"
                          before={before.filleulsPerWeek}
                          after={after.filleulsPerWeek}
                          render={(v) => v.toFixed(1)}
                        />
                        <DeltaValue
                          label="Coût d'acquisition"
                          before={before.cac}
                          after={after.cac}
                          render={(v) => fmtEur(v)}
                          higherIsBetter={false}
                        />
                        <DeltaValue
                          label="Taux de réachat filleuls"
                          before={before.reachat}
                          after={after.reachat}
                          render={(v) => fmtPct(v)}
                        />
                        <DeltaValue
                          label="Panier moyen filleuls"
                          before={before.panier}
                          after={after.panier}
                          render={(v) => fmtEur(v)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 3. Payback */}
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Rentabilisation du filleul</CardTitle>
                    <CardDescription>
                      Contribution cumulée moyenne par filleul face au coût d'acquisition ({fmtEur(cac)}) — indicatif
                      tant que les cohortes sont jeunes
                    </CardDescription>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={paybackBasis}
                    onValueChange={(v) => v && setPaybackBasis(v as "rank" | "days")}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="rank">Par commande</ToggleGroupItem>
                    <ToggleGroupItem value="days">Par jours</ToggleGroupItem>
                  </ToggleGroup>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Rentabilisé au bout de</div>
                      <div className="text-lg font-semibold">
                        {breakEven.orders ? `${breakEven.orders} commande${breakEven.orders > 1 ? "s" : ""}` : "pas encore atteint"}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Soit environ</div>
                      <div className="text-lg font-semibold">
                        {breakEven.days !== null ? `${breakEven.days} jours` : "pas encore atteint"}
                      </div>
                    </div>
                  </div>
                  {paybackQ.isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={paybackData} margin={{ top: 18, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} tickMargin={8} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} €`} width={60} />
                        <RTooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number, n) => [n === "cumul" ? fmtEur(Number(v)) : fmtInt(Number(v)), n === "cumul" ? "Contribution cumulée" : "Clients"]}
                        />
                        <ReferenceLine
                          y={cac}
                          stroke="hsl(0 84% 60%)"
                          strokeDasharray="4 3"
                          label={{ value: `Coût d'acquisition ${fmtEur(cac)}`, position: "insideTopRight", fontSize: 11 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumul"
                          name="cumul"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* 4. Réachat */}
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Filleul vs bienvenue vs organique</CardTitle>
                    <CardDescription>
                      Taux de réachat, commandes par client et panier moyen selon la porte d'entrée
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {segmentsQ.isLoading ? (
                      <Skeleton className="h-[260px] w-full" />
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={segmentChart} margin={{ top: 18, right: 16, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickMargin={8} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} %`} width={52} />
                            <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtPct(Number(v)), "Taux de réachat"]} />
                            <Bar dataKey="reachat" name="Taux de réachat" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-muted-foreground">
                                <th className="py-2">Porte d'entrée</th>
                                <th className="py-2 text-right">Clients</th>
                                <th className="py-2 text-right">Réachat</th>
                                <th className="py-2 text-right">Cmd / client</th>
                                <th className="py-2 text-right">Panier moyen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {segmentChart.map((s) => (
                                <tr key={s.label} className="border-t">
                                  <td className="py-2">{s.label}</td>
                                  <td className="py-2 text-right">{fmtInt(s.clients)}</td>
                                  <td className="py-2 text-right">{fmtPct(s.reachat)}</td>
                                  <td className="py-2 text-right">{s.commandes.toFixed(2)}</td>
                                  <td className="py-2 text-right">{fmtEur(s.panier)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Rétention des filleuls par cohorte</CardTitle>
                    <CardDescription>% de filleuls qui recommandent le mois suivant, puis les mois d'après</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {retentionQ.isLoading ? (
                      <Skeleton className="h-[240px] w-full" />
                    ) : filleulCohorts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Pas encore assez de recul pour mesurer la rétention des filleuls.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="py-2 pr-3">Cohorte</th>
                              <th className="py-2 pr-3 text-right">Filleuls</th>
                              {offsets.map((o) => (
                                <th key={o} className="py-2 px-2 text-center">
                                  M+{o}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filleulCohorts.map((c) => (
                              <tr key={c.cohorte} className="border-t">
                                <td className="py-2 pr-3 whitespace-nowrap">{cohortLabel(c.cohorte)}</td>
                                <td className="py-2 pr-3 text-right">{fmtInt(c.taille)}</td>
                                {offsets.map((o) => {
                                  const v = c.cells.get(o);
                                  return (
                                    <td key={o} className="py-1 px-1 text-center">
                                      <span
                                        className={cn(
                                          "inline-block w-full rounded px-2 py-1 text-xs font-medium",
                                          retentionColor(v ?? 0)
                                        )}
                                      >
                                        {v === undefined ? "—" : `${v.toFixed(0)} %`}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <ChartNoteDialog
            open={noteDialog.open}
            onOpenChange={(o) => setNoteDialog((s) => ({ ...s, open: o }))}
            date={noteDialog.date}
            existingNote={noteDialog.existing}
            scopedRestaurantIds={Array.isArray(restaurantFilter) ? restaurantFilter : []}
          />
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
