import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, TrendingUp, TrendingDown, Hash, ChevronRight, ChevronDown, Download, FileSpreadsheet, Search, Shield, ShieldAlert, Loader2, Building2, CheckCircle2, XCircle, ShieldCheck, CalendarDays, Sparkles, ArrowDownCircle, BarChart3 } from "lucide-react";
import { useRepCheckPersistence, type RepChangeInfo } from "@/hooks/useRepCheckPersistence";
import { useEcoContribution } from "@/hooks/useEcoContribution";

import { useEcoContributionExport } from "@/hooks/useEcoContributionExport";
import { useEcoOrganismCheck, type EcoOrganismCheckResult, type IduResult } from "@/hooks/useEcoOrganismCheck";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, ReferenceLine, Bar, AreaChart, Area, Line,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipProvider as UITooltipProvider, TooltipTrigger as UITooltipTrigger } from "@/components/ui/tooltip";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const YEAR_OPTIONS = [2023, 2024, 2025, 2026] as const;

interface EcoContributionSectionProps {
  restaurants: { id: string; name: string; siret?: string | null }[];
  selectedRestaurants: string[];
  selectedYear: number;
  selectedMonth?: number | null;
  selectedPlatform?: "uber_eats" | "deliveroo" | "global";
  selectedChainId?: string | null;
}

interface ParsedRepData {
  status: "inscrit" | "non_trouve" | "sans_siret" | "loading" | "error" | "unchecked";
  filiereCount: number;
  orgs: string[];
  iduEntries: IduResult[];
  entries: {
    filiere: string;
    org: string;
    start: string;
    end: string | null;
    isActive: boolean;
    idu?: string;
  }[];
}

const fmtDateShort = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : null;

export function EcoContributionSection({
  restaurants,
  selectedRestaurants,
  selectedYear,
  selectedMonth,
  selectedPlatform = "global",
  selectedChainId,
}: EcoContributionSectionProps) {
  const [localYear, setLocalYear] = useState<number | null>(selectedYear);
  
  const [soldeFilter, setSoldeFilter] = useState<"all" | "positive" | "negative">("all");
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { exportPDF, exportExcel } = useEcoContributionExport();

  const isHistorique = localYear === null;
  const effectiveYear = localYear ?? selectedYear;

  // When selectedRestaurants is empty but restaurants list is also empty (empty brand), keep []
  const restaurantIds = selectedRestaurants.length > 0
    ? selectedRestaurants
    : restaurants.map(r => r.id); // Will be [] if brand has no restaurants → hook returns empty

  // REP check state
  const { data: repData, loading: repLoading, errors: repErrors, progress: repProgress, checkMultiple } = useEcoOrganismCheck();
  const [repChecked, setRepChecked] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const isRepLoading = repProgress !== null;

  // REP persistence & change tracking
  const {
    latestSnapshot, changes: repChanges, evolutionData: repEvolutionData,
    loadingCache: repLoadingCache, saveSnapshot: saveRepSnapshot,
  } = useRepCheckPersistence(restaurantIds, selectedChainId);

  // Auto-load cached results on mount
  const cachedRepLoaded = useRef(false);
  useEffect(() => {
    if (!cachedRepLoaded.current && latestSnapshot && !repChecked && !repLoadingCache) {
      cachedRepLoaded.current = true;
      setRepChecked(true);
    }
  }, [latestSnapshot, repChecked, repLoadingCache]);

  // Eco line scanning state (prélèvements/remboursements change detection)
  const [ecoLineSnapshot, setEcoLineSnapshot] = useState<Record<string, number> | null>(null);
  const [ecoLineDeltas, setEcoLineDeltas] = useState<Map<string, number>>(new Map());
  const [ecoScanDone, setEcoScanDone] = useState(false);
  const [ecoScanLoading, setEcoScanLoading] = useState(false);
  const [ecoLastScanDate, setEcoLastScanDate] = useState<string | null>(null);

  // Load latest eco line snapshot on mount, filtered by chain
  useEffect(() => {
    (async () => {
      let query = supabase
        .from("eco_line_snapshots" as any)
        .select("*")
        .order("checked_at", { ascending: false })
        .limit(1);
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      } else {
        query = query.is("chain_id", null);
      }
      const { data } = await query;
      if (data && data.length > 0) {
        const snap = data[0] as any;
        setEcoLineSnapshot(snap.line_counts as Record<string, number>);
        setEcoLastScanDate(snap.checked_at);
      } else {
        setEcoLineSnapshot(null);
        setEcoLastScanDate(null);
      }
    })();
  }, [selectedChainId]);

  const { monthlyData, byRestaurant, totals, detailLines, isLoading } = useEcoContribution({
    restaurantIds,
    year: isHistorique ? null : effectiveYear,
    month: isHistorique ? null : selectedMonth,
    platform: selectedPlatform,
  });

  const isGlobal = selectedPlatform === "global";

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    restaurants.forEach(r => map.set(r.id, r.name));
    return map;
  }, [restaurants]);

  // Parse REP data per restaurant — use live data if available, fall back to cached snapshot
  const repByRestaurant = useMemo<Map<string, ParsedRepData>>(() => {
    const map = new Map<string, ParsedRepData>();
    const hasLiveData = Object.keys(repData).length > 0;

    for (const rId of restaurantIds) {
      if (!repChecked) {
        map.set(rId, { status: "unchecked", filiereCount: 0, orgs: [], iduEntries: [], entries: [] });
        continue;
      }

      // Use live data if available
      if (hasLiveData) {
        const result = repData[rId];
        const error = repErrors[rId];
        const loading = repLoading[rId];

        if (loading) { map.set(rId, { status: "loading", filiereCount: 0, orgs: [], iduEntries: [], entries: [] }); continue; }
        if (error) { map.set(rId, { status: "error", filiereCount: 0, orgs: [], iduEntries: [], entries: [] }); continue; }
        if (!result) { map.set(rId, { status: "sans_siret", filiereCount: 0, orgs: [], iduEntries: [], entries: [] }); continue; }

        const hasResults = result.count > 0;
        const iduEntries = result.idu_results || [];
        if (hasResults && iduEntries.length === 0) {
          console.log("[REP debug] Adhérent sans IDU:", restaurantMap.get(rId) || rId, { count: result.count, results: result.results });
        }
        const entries = result.results.map(r => {
          const matchingIdu = iduEntries.find(i => i.filiere === r.filiere)
            || (iduEntries.length === 1 ? iduEntries[0] : undefined);
          return {
            filiere: r.filiere,
            org: r.raison_sociale_ecoorganisme,
            start: fmtDateShort(r.date_debutvalidite_inscription) || "—",
            end: r.date_finvalidite_inscription,
            isActive: !r.date_finvalidite_inscription || new Date(r.date_finvalidite_inscription) > new Date(),
            idu: matchingIdu?.identifiant_unique,
          };
        });

        // Fallback : IDU présent mais pas encore dans le dataset annuel
        if (!hasResults && iduEntries.length > 0) {
          for (const idu of iduEntries) {
            entries.push({
              filiere: idu.filiere || "—",
              org: "Non encore enregistré (adhésion en cours)",
              start: "—",
              end: null,
              isActive: true,
              idu: idu.identifiant_unique,
            });
          }
        }

        const finalStatus = hasResults || iduEntries.length > 0 ? "inscrit" : "non_trouve";

        map.set(rId, {
          status: finalStatus,
          filiereCount: result.count || iduEntries.length,
          orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
          iduEntries,
          entries,
        });
      } else if (latestSnapshot) {
        // Fall back to cached snapshot
        const cached = latestSnapshot.results[rId];
        if (cached) {
          map.set(rId, {
            status: cached.status,
            filiereCount: cached.filiereCount,
            orgs: cached.orgs || [],
            iduEntries: (cached as any).iduEntries || [],
            entries: (cached as any).entries || [],
          });
        } else {
          map.set(rId, { status: "sans_siret", filiereCount: 0, orgs: [], iduEntries: [], entries: [] });
        }
      }
    }
    return map;
  }, [restaurantIds, repData, repLoading, repErrors, repChecked, latestSnapshot]);

  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
      name: MONTHS[d.month - 1],
      Remboursements: d.refund,
      Prélèvements: Math.abs(d.charge),
      "Solde Net": d.net,
    }));
  }, [monthlyData]);

  const fmt = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const [sortKey, setSortKey] = useState<"net" | "refund" | "charge">("net");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Merge restaurants: eco data + restaurants with REP status but no eco data
  const mergedByRestaurant = useMemo(() => {
    const existingIds = new Set(byRestaurant.map(r => r.restaurant_id));
    const extras: typeof byRestaurant = [];
    if (repChecked) {
      for (const rId of restaurantIds) {
        if (!existingIds.has(rId)) {
          extras.push({ restaurant_id: rId, refund: 0, charge: 0, net: 0, lineCount: 0 } as any);
        }
      }
    }
    return [...byRestaurant, ...extras];
  }, [byRestaurant, repChecked, restaurantIds]);

  const sortedRestaurants = useMemo(() => {
    const filtered = soldeFilter === "all"
      ? mergedByRestaurant
      : soldeFilter === "positive"
        ? mergedByRestaurant.filter(r => r.net >= 0)
        : mergedByRestaurant.filter(r => r.net < 0);
    return [...filtered].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "desc" ? -diff : diff;
    });
  }, [mergedByRestaurant, sortKey, sortDir, soldeFilter]);

  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return sortedRestaurants;
    const q = searchQuery.toLowerCase();
    return sortedRestaurants.filter(r => {
      const name = restaurantMap.get(r.restaurant_id) || "";
      return name.toLowerCase().includes(q);
    });
  }, [sortedRestaurants, searchQuery, restaurantMap]);

  const handleSort = (key: "net" | "refund" | "charge") => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const yearLabel = isHistorique ? "Historique" : String(effectiveYear);

  const absCharge = Math.abs(totals.charge);
  const recoveryRatio = absCharge > 0 ? Math.round((totals.refund / absCharge) * 100) : 0;

  const displayedRestaurants = filteredRestaurants;

  const handleExport = (type: "pdf" | "excel") => {
    const exportRestaurants = sortedRestaurants.map(r => ({
      ...r,
      name: restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8),
    }));
    const params = {
      restaurants: exportRestaurants,
      monthlyData,
      totals,
      yearLabel,
      detailLines,
      repByRestaurant: repChecked ? repByRestaurant : undefined,
    };
    if (type === "pdf") exportPDF(params);
    else exportExcel(params);
  };

  // Track flash states for completed scans
  const [flashStatuses, setFlashStatuses] = useState<Map<string, "ok" | "alert">>(new Map());
  const prevScanningRef = useRef<string | null>(null);

  // When scanningId changes, flash the previous restaurant
  useEffect(() => {
    const prevId = prevScanningRef.current;
    if (prevId && prevId !== scanningId) {
      const result = repData[prevId];
      const status = result && (result.count > 0 || (result.idu_results || []).length > 0) ? "ok" : "alert";
      setFlashStatuses(prev => new Map(prev).set(prevId, status));
      // Remove flash after animation
      setTimeout(() => {
        setFlashStatuses(prev => {
          const next = new Map(prev);
          next.delete(prevId);
          return next;
        });
      }, 600);
    }
    prevScanningRef.current = scanningId;
  }, [scanningId, repData]);

  const repDataRef = useRef(repData);
  repDataRef.current = repData;

  const handleRepCheck = async () => {
    const { data: restData } = await supabase
      .from("restaurants")
      .select("id, siret")
      .in("id", restaurantIds);
    if (restData) {
      setFlashStatuses(new Map());
      const items = restData.map((r: any) => ({ id: r.id, siret: r.siret }));
      await checkMultiple(items, setScanningId);
      setRepChecked(true);
      // Save snapshot — use ref to get latest repData after checkMultiple completes
      setTimeout(async () => {
        await saveRepSnapshot(repDataRef.current, items);
      }, 300);
    }
  };

  // Eco line scan handler: count lines per restaurant and compare with previous snapshot
  const handleEcoLineScan = async () => {
    setEcoScanLoading(true);
    try {
      // Count current lines per restaurant from the already-loaded byRestaurant data
      const currentCounts: Record<string, number> = {};
      byRestaurant.forEach(r => {
        currentCounts[r.restaurant_id] = r.count;
      });

      // Compare with previous snapshot
      if (ecoLineSnapshot) {
        const deltas = new Map<string, number>();
        for (const [rId, count] of Object.entries(currentCounts)) {
          const prev = ecoLineSnapshot[rId] || 0;
          const diff = count - prev;
          if (diff > 0) {
            deltas.set(rId, diff);
          }
        }
        setEcoLineDeltas(deltas);
      }

      // Save new snapshot
      const { error } = await supabase
        .from("eco_line_snapshots" as any)
        .insert({
          line_counts: currentCounts,
          total_lines: Object.values(currentCounts).reduce((s, c) => s + c, 0),
          chain_id: selectedChainId || null,
        } as any);
      if (!error) {
        setEcoLineSnapshot(currentCounts);
        setEcoLastScanDate(new Date().toISOString());
      }
      setEcoScanDone(true);
    } finally {
      setEcoScanLoading(false);
    }
  };

  const repChangesMap = useMemo(() => {
    const map = new Map<string, RepChangeInfo["changeType"]>();
    repChanges.forEach(c => map.set(c.restaurant_id, c.changeType));
    return map;
  }, [repChanges]);

  const isExempt = totals.net >= 0;

  // REP summary stats
  const repStats = useMemo(() => {
    if (!repChecked) return null;
    let inscrit = 0, nonTrouve = 0, sansSiret = 0;
    repByRestaurant.forEach(v => {
      if (v.status === "inscrit") inscrit++;
      else if (v.status === "non_trouve") nonTrouve++;
      else if (v.status === "sans_siret") sansSiret++;
    });
    return { inscrit, nonTrouve, sansSiret, total: restaurantIds.length };
  }, [repChecked, repByRestaurant, restaurantIds]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement éco-contribution...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════ ZONE 1: Status Banner ═══════════════ */}
      <div className={cn(
        "rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
        isExempt
          ? "bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border border-green-500/20"
          : "bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-11 w-11 rounded-xl",
            isExempt ? "bg-green-500/15" : "bg-red-500/15"
          )}>
            {isExempt
              ? <Shield className="h-6 w-6 text-green-600" />
              : <ShieldAlert className="h-6 w-6 text-red-500" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold leading-tight">Éco-Contribution</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {yearLabel} · {totals.lineCount} lignes · {byRestaurant.length} restaurants
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-background/80 backdrop-blur rounded-full p-0.5 border border-border/50">
            <button
              onClick={() => setLocalYear(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                isHistorique
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Historique
            </button>
            {YEAR_OPTIONS.map(y => (
              <button
                key={y}
                onClick={() => setLocalYear(y)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  localYear === y
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {y}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-full">
                <Download className="h-3.5 w-3.5" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ═══════════════ ZONE 2: Hero KPI + Stat Strip ═══════════════ */}
      <Card className={cn(
        "overflow-hidden border-0 shadow-md",
        isExempt
          ? "bg-gradient-to-br from-green-500/5 via-background to-background"
          : "bg-gradient-to-br from-red-500/5 via-background to-background"
      )}>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Leaf className="h-3.5 w-3.5" />
                Solde Net
              </div>
              <div className={cn(
                "text-4xl md:text-5xl font-extrabold tracking-tight",
                isExempt ? "text-green-600" : "text-red-500"
              )}>
                {fmt(totals.net)}
              </div>
              <p className="text-xs text-muted-foreground">
                {isExempt
                  ? "Les remboursements couvrent les prélèvements"
                  : "Défaut d'exonération détecté — action requise"
                }
              </p>
            </div>

            <div className="flex items-stretch gap-4 md:gap-6">
              <div className="text-center space-y-1 px-4 border-l border-border/50 first:border-l-0 first:pl-0">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  Remboursements
                </div>
                <div className="text-xl font-bold text-green-600 tabular-nums">{fmt(totals.refund)}</div>
              </div>
              <div className="text-center space-y-1 px-4 border-l border-border/50">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  Prélèvements
                </div>
                <div className="text-xl font-bold text-red-500 tabular-nums">{fmt(totals.charge)}</div>
              </div>
              <div className="text-center space-y-1 px-4 border-l border-border/50">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                  <Hash className="h-3 w-3" />
                  Lignes
                </div>
                <div className="text-xl font-bold tabular-nums">{totals.lineCount}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {/* Barre 1: Ratio remboursements / prélèvements */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>Ratio remboursements / prélèvements</span>
                <span className="font-semibold">{recoveryRatio}%</span>
              </div>
              <div className="h-2.5 w-full bg-red-500/15 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    recoveryRatio >= 100 ? "bg-green-500" : recoveryRatio >= 50 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(recoveryRatio, 100)}%` }}
                />
              </div>
            </div>

            {/* Barre 2: Taux d'adhésion REP */}
            {repChecked && repStats && (() => {
              const verifiedTotal = repStats.inscrit + repStats.nonTrouve;
              const adhesionRate = verifiedTotal > 0 ? Math.round((repStats.inscrit / verifiedTotal) * 100) : 0;
              return (
                <div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span>Taux d'adhésion REP</span>
                    <span className="font-semibold">{adhesionRate}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-green-500/15 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        adhesionRate >= 80 ? "bg-green-500" : adhesionRate >= 50 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${adhesionRate}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════ ZONE 3: Restaurant Table with integrated REP (moved up) ═══════════════ */}
      <Card>
        <CardContent className="pt-5 pb-3">
          {/* Search + count moved together below REP strip */}

            {/* REP verification strip - inside the card */}
            <div className={cn(
                "flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-lg border transition-colors",
                repChecked
                  ? "bg-primary/5 border-primary/20"
                  : isRepLoading
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-border/50"
              )}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold">Adhésion REP (éco-organismes)</span>
                    {repChecked && repStats && !isRepLoading && (
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-green-600 font-medium">
                          <ShieldCheck className="h-3 w-3 inline mr-0.5" />
                          {repStats.inscrit} inscrits
                        </span>
                        {repStats.nonTrouve > 0 && (
                          <span className="text-[10px] text-red-500 font-medium">
                            <XCircle className="h-3 w-3 inline mr-0.5" />
                            {repStats.nonTrouve} non trouvés
                          </span>
                        )}
                        {repStats.sansSiret > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {repStats.sansSiret} sans SIRET
                          </span>
                        )}
                        {repChanges.length > 0 && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-fade-in">
                            <Sparkles className="h-3 w-3 inline mr-0.5" />
                            {repChanges.filter(c => c.changeType === "new_adherent").length > 0 &&
                              `+${repChanges.filter(c => c.changeType === "new_adherent").length} nouveau(x)`}
                            {repChanges.filter(c => c.changeType === "lost_adherent").length > 0 &&
                              ` −${repChanges.filter(c => c.changeType === "lost_adherent").length} perdu(s)`}
                          </span>
                        )}
                        {latestSnapshot && (
                          <span className="text-[9px] text-muted-foreground/60 ml-auto">
                            Dernière vérif. : {new Date(latestSnapshot.checked_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    )}
                    {isRepLoading && repProgress && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Vérification en cours… {repProgress.done}/{repProgress.total}</span>
                          <span className="font-semibold text-primary tabular-nums">
                            {Math.round((repProgress.done / repProgress.total) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${(repProgress.done / repProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {!repChecked && !isRepLoading && repLoadingCache && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement des résultats précédents…
                      </p>
                    )}
                    {!repChecked && !isRepLoading && !repLoadingCache && !latestSnapshot && (
                      <p className="text-[10px] text-muted-foreground">Vérifie l'inscription de vos restaurants aux filières REP via l'API ADEME</p>
                    )}
                  </div>
                </div>
                {!isRepLoading && (
                  <Button
                    size="sm"
                    variant={repChecked ? "secondary" : "outline"}
                    className="h-7 text-[11px] rounded-full gap-1.5 shrink-0"
                    onClick={handleRepCheck}
                  >
                    <Building2 className="h-3 w-3" />
                    {repChecked ? "Actualiser adhésions" : "Vérifier adhésions"}
                  </Button>
                )}
              </div>

              {/* Eco line scan strip */}
              <div className={cn(
                "flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-lg border transition-colors",
                ecoScanDone
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-muted/30 border-border/50"
              )}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <BarChart3 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold">Prélèvements & Remboursements</span>
                    {ecoScanDone && (
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {ecoLineDeltas.size > 0 ? (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <Sparkles className="h-3 w-3 inline mr-0.5" />
                            {ecoLineDeltas.size} restaurant{ecoLineDeltas.size > 1 ? "s" : ""} avec nouvelles lignes
                          </span>
                        ) : (
                          <span className="text-[10px] text-green-600 font-medium">
                            <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                            Aucune nouvelle ligne détectée
                          </span>
                        )}
                        {ecoLastScanDate && (
                          <span className="text-[9px] text-muted-foreground/60 ml-auto">
                            Dernier scan : {new Date(ecoLastScanDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    )}
                    {!ecoScanDone && !ecoScanLoading && (
                      <p className="text-[10px] text-muted-foreground">
                        Compare les lignes éco-contribution avec le dernier scan pour détecter les nouvelles entrées
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={ecoScanDone ? "secondary" : "outline"}
                  className="h-7 text-[11px] rounded-full gap-1.5 shrink-0"
                  onClick={handleEcoLineScan}
                  disabled={ecoScanLoading || isLoading}
                >
                  {ecoScanLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  <BarChart3 className="h-3 w-3" />
                  {ecoScanDone ? "Re-scanner" : "Scanner prélèvements"}
                </Button>
              </div>

              {/* ADEME data freshness notice */}
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-1">
                Source ADEME — Données mises à jour <span className="font-medium">tous les 3 mois</span>. Dernière MàJ : fév. 2026. Inutile d'actualiser quotidiennement.
              </p>

            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[11px] text-muted-foreground">
                {filteredRestaurants.length} restaurant{filteredRestaurants.length > 1 ? "s" : ""} affiché{filteredRestaurants.length > 1 ? "s" : ""}
                {searchQuery && ` pour "${searchQuery}"`}
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="h-8 w-[180px] pl-8 text-sm rounded-full"
                />
              </div>
            </div>

            <div>
              {(byRestaurant.length > 0 || (repChecked && restaurantIds.length > 0)) ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        {repChecked && <TableHead className="text-center w-[80px]">REP</TableHead>}
                        <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort("refund")}>
                          Remb. {sortKey === "refund" && (sortDir === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort("charge")}>
                          Prél. {sortKey === "charge" && (sortDir === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:text-foreground min-w-[180px]" onClick={() => handleSort("net")}>
                          Solde {sortKey === "net" && (sortDir === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="text-right">Lignes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRestaurants.map((r, idx) => (
                        <RestaurantDrilldown
                          key={r.restaurant_id}
                          restaurant={r}
                          name={restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8)}
                          detailLines={detailLines.filter(l => l.restaurant_id === r.restaurant_id)}
                          fmt={fmt}
                          isHistorique={isHistorique}
                          showPlatformDot={isGlobal}
                          isEvenRow={idx % 2 === 0}
                          repData={repChecked ? repByRestaurant.get(r.restaurant_id) : undefined}
                          showRepColumn={repChecked}
                          repChangeType={repChangesMap.get(r.restaurant_id)}
                          newLinesDelta={ecoLineDeltas.get(r.restaurant_id)}
                          scanClass={
                            scanningId === r.restaurant_id
                              ? "bodacc-scanning"
                              : flashStatuses.get(r.restaurant_id) === "ok"
                                ? "bodacc-scan-ok"
                                : flashStatuses.get(r.restaurant_id) === "alert"
                                  ? "bodacc-scan-alert"
                                  : undefined
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée pour cette période</p>
              )}
            </div>
        </CardContent>
      </Card>

      {/* ═══════════════ ZONE 4: Monthly Chart (collapsible) ═══════════════ */}
      {chartData.length > 0 && (
        <Collapsible>
          <Card>
            <CardContent className="pt-4 pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Évolution mensuelle — {yearLabel}
                </h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="h-[350px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} barGap={0} barCategoryGap="20%">
                      <defs>
                        <linearGradient id="gradRemb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="gradPrel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                      />
                      <YAxis
                        className="text-xs"
                        tickFormatter={(v) => `${(v / 1000).toFixed(v >= 1000 || v <= -1000 ? 0 : 1)}k€`}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={55}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          fmt(name === "Prélèvements" ? -value : value),
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          padding: "10px 14px",
                        }}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Bar dataKey="Remboursements" fill="url(#gradRemb)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Prélèvements" fill="url(#gradPrel)" radius={[3, 3, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      )}

      {/* ═══════════════ ZONE 5: REP Evolution Chart ═══════════════ */}
      {repChecked && repEvolutionData.length >= 2 && (
        <Collapsible>
          <Card>
            <CardContent className="pt-4 pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Évolution des adhésions REP
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {repEvolutionData.length} vérifications
                  </Badge>
                </h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="h-[280px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={repEvolutionData}>
                      <defs>
                        <linearGradient id="gradInscrits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradNonTrouves" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={35}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          padding: "10px 14px",
                        }}
                        cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "4 4" }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <Area
                        type="monotone"
                        dataKey="inscrits"
                        name="Adhérents"
                        stroke="hsl(142, 76%, 36%)"
                        fill="url(#gradInscrits)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "hsl(142, 76%, 36%)", stroke: "white", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="nonTrouves"
                        name="Non trouvés"
                        stroke="hsl(0, 84%, 60%)"
                        fill="url(#gradNonTrouves)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "hsl(0, 84%, 60%)", stroke: "white", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sansSiret"
                        name="Sans SIRET"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

// ──────────────── Sub-components ────────────────

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface DetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
  platform?: "uber_eats" | "deliveroo";
}

function RepStatusBadge({ repData, changeType }: { repData: ParsedRepData; changeType?: "new_adherent" | "lost_adherent" }) {
  if (repData.status === "loading") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mx-auto" />;
  }
  if (repData.status === "inscrit") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-800 rounded-md px-2 py-0.5",
          changeType === "new_adherent" && "animate-rep-new ring-2 ring-green-400/50"
        )}>
          <CheckCircle2 className="h-3 w-3" />
          Adhérent
        </span>
        {changeType === "new_adherent" && (
          <UITooltipProvider delayDuration={150}>
            <UITooltip>
              <UITooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-600 animate-fade-in cursor-help">
                  <Sparkles className="h-2.5 w-2.5" />
                  Nouvel adhérent
                </span>
              </UITooltipTrigger>
              <UITooltipContent side="top" className="max-w-xs text-xs">
                Ce restaurant n'était pas inscrit au REP lors du scan précédent.
              </UITooltipContent>
            </UITooltip>
          </UITooltipProvider>
        )}
      </div>
    );
  }
  if (repData.status === "non_trouve") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-md px-2 py-0.5",
          changeType === "lost_adherent" && "animate-rep-lost ring-2 ring-red-400/50"
        )}>
          <XCircle className="h-3 w-3" />
          Non adhérent
        </span>
        {changeType === "lost_adherent" && (
          <UITooltipProvider delayDuration={150}>
            <UITooltip>
              <UITooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-500 animate-fade-in cursor-help">
                  <ArrowDownCircle className="h-2.5 w-2.5" />
                  Adhésion perdue
                </span>
              </UITooltipTrigger>
              <UITooltipContent side="top" className="max-w-xs text-xs">
                Ce restaurant était inscrit au REP lors du scan précédent, mais ne l'est plus aujourd'hui.
              </UITooltipContent>
            </UITooltip>
          </UITooltipProvider>
        )}
      </div>
    );
  }
  if (repData.status === "sans_siret") {
    return <span className="text-[10px] text-muted-foreground/50 block text-center">—</span>;
  }
  if (repData.status === "error") {
    return <XCircle className="h-3.5 w-3.5 text-destructive mx-auto" />;
  }
  return null;
}

function RepDetailPanel({ repData }: { repData: ParsedRepData }) {
  if (repData.status !== "inscrit" || repData.entries.length === 0) return null;

  const unmatchedIdus = repData.iduEntries.filter(idu => !repData.entries.some(e => e.filiere === idu.filiere));

  return (
    <div className="space-y-2">
      {/* IDU badges */}
      {repData.iduEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repData.iduEntries.map((idu, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md">
              <Hash className="h-2.5 w-2.5" />
              IDU {idu.filiere} : {idu.identifiant_unique}
            </span>
          ))}
        </div>
      )}

      {/* Orgs */}
      <p className="text-[10px] text-muted-foreground">
        Éco-organismes : {repData.orgs.join(", ")}
      </p>

      {/* Entries */}
      {repData.entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          <CalendarDays className="h-3 w-3 flex-shrink-0" />
          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", entry.isActive ? "bg-green-500" : "bg-red-400")} />
          <span className="font-mono font-medium">{entry.filiere}</span>
          {entry.idu && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {entry.idu}
              </span>
            </>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span>{entry.org}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>du {entry.start} au {entry.end ? fmtDateShort(entry.end) : "En cours"}</span>
          {!entry.isActive && <Badge variant="destructive" className="text-[8px] h-4 px-1">Expiré</Badge>}
        </div>
      ))}

      {unmatchedIdus.length > 0 && (
        <div className="pt-1 border-t border-dashed border-muted-foreground/20">
          <p className="text-[9px] text-muted-foreground mb-1">IDU supplémentaires :</p>
          <div className="flex flex-wrap gap-1">
            {unmatchedIdus.map((idu, idx) => (
              <span key={idx} className="font-mono text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {idu.filiere} — {idu.identifiant_unique}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RestaurantDrilldown({
  restaurant,
  name,
  detailLines,
  fmt,
  isHistorique,
  showPlatformDot = true,
  isEvenRow = false,
  repData,
  showRepColumn = false,
  repChangeType,
  newLinesDelta,
  scanClass,
}: {
  restaurant: { restaurant_id: string; refund: number; charge: number; net: number; count: number };
  name: string;
  detailLines: DetailLine[];
  fmt: (v: number) => string;
  isHistorique?: boolean;
  showPlatformDot?: boolean;
  isEvenRow?: boolean;
  repData?: ParsedRepData;
  showRepColumn?: boolean;
  repChangeType?: "new_adherent" | "lost_adherent";
  newLinesDelta?: number;
  scanClass?: string;
}) {
  const [open, setOpen] = useState(false);

  const r = restaurant;
  const absCharge = Math.abs(r.charge);
  const total = r.refund + absCharge;
  const refundPct = total > 0 ? Math.round((r.refund / total) * 100) : 0;

  const hasRepDetail = repData && repData.status === "inscrit" && repData.entries.length > 0;
  const colSpan = showRepColumn ? 6 : 5;

  const monthlyBreakdown = useMemo(() => {
    const byKey = new Map<string, DetailLine[]>();
    for (const line of detailLines) {
      const d = line.payout_date ? new Date(line.payout_date) : null;
      const y = d ? d.getFullYear() : 0;
      const m = d ? d.getMonth() + 1 : 0;
      const key = isHistorique ? `${y}-${m}` : `${m}`;
      const arr = byKey.get(key) || [];
      arr.push(line);
      byKey.set(key, arr);
    }
    return Array.from(byKey.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, lines]) => {
        const parts = key.split("-");
        const month = isHistorique ? Number(parts[1]) : Number(parts[0]);
        const year = isHistorique ? Number(parts[0]) : 0;
        const refund = lines.filter(l => Number(l.amount) >= 0).reduce((s, l) => s + Number(l.amount), 0);
        const charge = lines.filter(l => Number(l.amount) < 0).reduce((s, l) => s + Number(l.amount), 0);
        const label = month === 0 ? "Sans date" : (isHistorique ? `${MONTH_NAMES[month - 1]} ${year}` : MONTH_NAMES[month - 1]);
        return {
          month,
          label,
          refund: Math.round(refund * 100) / 100,
          charge: Math.round(charge * 100) / 100,
          net: Math.round((refund + charge) * 100) / 100,
          lines: lines.sort((a, b) => (a.payout_date || "").localeCompare(b.payout_date || "")),
        };
      });
  }, [detailLines, isHistorique]);

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors duration-150",
          isEvenRow ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30",
          scanClass
        )}
        onClick={() => setOpen(!open)}
      >
        <TableCell className="font-medium text-sm py-3">
          <div className="flex items-center gap-2">
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
            <span className={cn(
              "inline-block h-2 w-2 rounded-full flex-shrink-0",
              r.net >= 0 ? "bg-green-500" : "bg-red-500"
            )} />
            {name}
          </div>

          {/* ── Infos REP inline (visibles sans déplier) ── */}
          {repData?.status === "inscrit" && (
            <div className="ml-[22px] mt-1 flex flex-wrap items-center gap-1.5">
              {repData.iduEntries.length > 0 ? (
                repData.iduEntries.map((idu, idx) => (
                  <span
                    key={`idu-${idx}`}
                    className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded"
                    title={`Filière ${idu.filiere}`}
                  >
                    <Hash className="h-2.5 w-2.5" />
                    {idu.identifiant_unique}
                  </span>
                ))
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded"
                  title="Restaurant identifié comme adhérent via le dataset annuel REP, mais aucun identifiant unique (IDU) n'est rattaché dans la source de données."
                >
                  <Hash className="h-2.5 w-2.5" />
                  Adhésion annuelle (sans IDU)
                </span>
              )}
              {repData.entries.slice(0, 2).map((entry, idx) => (
                <span
                  key={`entry-${idx}`}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                >
                  <CalendarDays className="h-2.5 w-2.5" />
                  {entry.filiere} : du {entry.start} au {entry.end ? fmtDateShort(entry.end) : "En cours"}
                  {!entry.isActive && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 ml-0.5">Expiré</Badge>}
                </span>
              ))}
              {repData.entries.length > 2 && (
                <span className="text-[10px] text-muted-foreground italic">+{repData.entries.length - 2}</span>
              )}
            </div>
          )}
        </TableCell>
        {showRepColumn && (
          <TableCell className="py-3">
            {repData ? (
              <div className="flex flex-col items-center gap-1">
                <RepStatusBadge repData={repData} changeType={repChangeType} />
              </div>
            ) : null}
          </TableCell>
        )}
        <TableCell className="text-right text-green-600 text-sm py-3">{fmt(r.refund)}</TableCell>
        <TableCell className="text-right text-red-500 text-sm py-3">{fmt(r.charge)}</TableCell>
        <TableCell className="text-right text-sm py-3">
          <div className="flex items-center justify-end gap-2.5">
            <div className={cn(
              "w-28 h-[5px] rounded-full overflow-hidden hidden sm:block",
              r.net >= 0 ? "bg-green-500/15" : "bg-red-500/15"
            )}>
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  r.net >= 0 ? "bg-green-500" : "bg-red-500"
                )}
                style={{ width: `${refundPct}%` }}
              />
            </div>
            <span className={cn("font-semibold tabular-nums", r.net >= 0 ? "text-green-600" : "text-red-500")}>
              {fmt(r.net)}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right text-sm py-3">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-muted-foreground">{detailLines.length}</span>
            {newLinesDelta && newLinesDelta > 0 && (
              <Badge className="text-[9px] h-4 px-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0">
                +{newLinesDelta}
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* REP detail panel (shown when row is expanded and has REP data) */}
      {open && hasRepDetail && (
        <TableRow className="bg-blue-50/30 dark:bg-blue-950/10 border-l-2 border-l-blue-400">
          <TableCell colSpan={colSpan} className="py-3 px-6">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <RepDetailPanel repData={repData!} />
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Non-inscrit detail when expanded */}
      {open && repData && repData.status === "non_trouve" && (
        <TableRow className="bg-red-50/30 dark:bg-red-950/10 border-l-2 border-l-red-400">
          <TableCell colSpan={colSpan} className="py-2.5 px-6">
            <div className="flex items-center gap-2 text-[11px] text-red-600">
              <XCircle className="h-3.5 w-3.5" />
              <span>Aucune adhésion REP trouvée pour ce SIRET — vérifiez l'inscription de ce restaurant</span>
            </div>
          </TableCell>
        </TableRow>
      )}

      {open && (
        <>
          {monthlyBreakdown.map((mg) => (
            <MonthDrilldownRow key={mg.month} monthGroup={mg} fmt={fmt} showPlatformDot={showPlatformDot} parentNet={r.net} colSpan={colSpan} />
          ))}
        </>
      )}
    </>
  );
}

function MonthDrilldownRow({
  monthGroup,
  fmt,
  showPlatformDot = true,
  parentNet = 0,
  colSpan = 5,
}: {
  monthGroup: { month: number; label: string; refund: number; charge: number; net: number; lines: DetailLine[] };
  fmt: (v: number) => string;
  showPlatformDot?: boolean;
  parentNet?: number;
  colSpan?: number;
}) {
  const [open, setOpen] = useState(false);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "-";
  const borderColor = parentNet >= 0 ? "border-l-green-500" : "border-l-red-500";

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors duration-150 hover:bg-muted/30 bg-muted/10 border-l-2",
          borderColor
        )}
        onClick={() => setOpen(!open)}
      >
        <TableCell className="text-sm pl-10 py-2.5" colSpan={colSpan > 5 ? 2 : 1}>
          <div className="flex items-center gap-1.5">
            <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
            <span className="font-medium">{monthGroup.label}</span>
          </div>
        </TableCell>
        <TableCell className="text-right text-green-600 text-xs py-2.5">{fmt(monthGroup.refund)}</TableCell>
        <TableCell className="text-right text-red-500 text-xs py-2.5">{fmt(monthGroup.charge)}</TableCell>
        <TableCell className={cn("text-right font-medium text-xs py-2.5", monthGroup.net >= 0 ? "text-green-600" : "text-red-500")}>
          {fmt(monthGroup.net)}
        </TableCell>
        <TableCell className="text-right text-xs text-muted-foreground py-2.5">{monthGroup.lines.length}</TableCell>
      </TableRow>
      {open && monthGroup.lines.map((line, i) => (
        <TableRow key={line.id} className={cn(
          "border-l-2",
          borderColor,
          i % 2 === 0 ? "bg-muted/5" : "bg-background"
        )}>
          <TableCell className="text-xs pl-16 text-muted-foreground py-2" colSpan={colSpan > 5 ? 2 : 1}>
            {showPlatformDot && (
              line.platform === "deliveroo"
                ? <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1.5 border-cyan-500 text-cyan-600 font-normal">Deliveroo</Badge>
                : <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1.5 border-green-500 text-green-600 font-normal">Uber</Badge>
            )}
            {fmtDate(line.payout_date)} — {line.description || "-"}
          </TableCell>
          <TableCell />
          <TableCell />
          <TableCell className={cn("text-right text-xs font-medium py-2", Number(line.amount) >= 0 ? "text-green-600" : "text-red-500")}>
            {fmt(Number(line.amount))}
          </TableCell>
          <TableCell className="text-right text-[10px] text-muted-foreground font-mono py-2">
            {line.payout_reference_id ? line.payout_reference_id.slice(0, 12) + "…" : "-"}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
