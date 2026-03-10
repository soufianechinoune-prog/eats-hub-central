import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, TrendingUp, TrendingDown, Hash, ChevronRight, Download, FileSpreadsheet, Search, Shield, ShieldAlert, Loader2, Building2, CheckCircle2, XCircle, ShieldCheck, CalendarDays } from "lucide-react";
import { useEcoContribution } from "@/hooks/useEcoContribution";

import { useEcoContributionExport } from "@/hooks/useEcoContributionExport";
import { useEcoOrganismCheck, type EcoOrganismCheckResult, type IduResult } from "@/hooks/useEcoOrganismCheck";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, ReferenceLine, Bar,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const YEAR_OPTIONS = [2023, 2024, 2025, 2026] as const;

interface EcoContributionSectionProps {
  restaurants: { id: string; name: string; siret?: string | null }[];
  selectedRestaurants: string[];
  selectedYear: number;
  selectedMonth?: number | null;
  selectedPlatform?: "uber_eats" | "deliveroo" | "global";
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
}: EcoContributionSectionProps) {
  const [localYear, setLocalYear] = useState<number | null>(selectedYear);
  
  const [soldeFilter, setSoldeFilter] = useState<"all" | "positive" | "negative">("all");
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { exportPDF, exportExcel } = useEcoContributionExport();

  // REP check state
  const { data: repData, loading: repLoading, errors: repErrors, checkMultiple } = useEcoOrganismCheck();
  const [repChecked, setRepChecked] = useState(false);
  const isRepLoading = Object.values(repLoading).some(Boolean);

  const isHistorique = localYear === null;
  const effectiveYear = localYear ?? selectedYear;

  const restaurantIds = selectedRestaurants.length > 0
    ? selectedRestaurants
    : restaurants.map(r => r.id);

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

  // Parse REP data per restaurant
  const repByRestaurant = useMemo<Map<string, ParsedRepData>>(() => {
    const map = new Map<string, ParsedRepData>();
    for (const rId of restaurantIds) {
      if (!repChecked) {
        map.set(rId, { status: "unchecked", filiereCount: 0, orgs: [], iduEntries: [], entries: [] });
        continue;
      }
      const result = repData[rId];
      const error = repErrors[rId];
      const loading = repLoading[rId];

      if (loading) { map.set(rId, { status: "loading", filiereCount: 0, orgs: [], iduEntries: [], entries: [] }); continue; }
      if (error) { map.set(rId, { status: "error", filiereCount: 0, orgs: [], iduEntries: [], entries: [] }); continue; }
      if (!result) { map.set(rId, { status: "sans_siret", filiereCount: 0, orgs: [], iduEntries: [], entries: [] }); continue; }

      const hasResults = result.count > 0;
      const iduEntries = result.idu_results || [];
      const entries = result.results.map(r => {
        const matchingIdu = iduEntries.find(i => i.filiere === r.filiere);
        return {
          filiere: r.filiere,
          org: r.raison_sociale_ecoorganisme,
          start: fmtDateShort(r.date_debutvalidite_inscription) || "—",
          end: r.date_finvalidite_inscription,
          isActive: !r.date_finvalidite_inscription || new Date(r.date_finvalidite_inscription) > new Date(),
          idu: matchingIdu?.identifiant_unique,
        };
      });

      map.set(rId, {
        status: hasResults ? "inscrit" : "non_trouve",
        filiereCount: result.count,
        orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
        iduEntries,
        entries,
      });
    }
    return map;
  }, [restaurantIds, repData, repLoading, repErrors, repChecked]);

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

  const sortedRestaurants = useMemo(() => {
    const filtered = soldeFilter === "all"
      ? byRestaurant
      : soldeFilter === "positive"
        ? byRestaurant.filter(r => r.net >= 0)
        : byRestaurant.filter(r => r.net < 0);
    return [...filtered].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "desc" ? -diff : diff;
    });
  }, [byRestaurant, sortKey, sortDir, soldeFilter]);

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

  const displayedRestaurants = showAll ? filteredRestaurants : filteredRestaurants.slice(0, 20);

  const handleExport = (type: "pdf" | "excel") => {
    const exportRestaurants = sortedRestaurants.map(r => ({
      ...r,
      name: restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8),
    }));
    const params = { restaurants: exportRestaurants, monthlyData, totals, yearLabel };
    if (type === "pdf") exportPDF(params);
    else exportExcel(params);
  };

  const handleRepCheck = async () => {
    const { data: restData } = await supabase
      .from("restaurants")
      .select("id, siret")
      .in("id", restaurantIds);
    if (restData) {
      await checkMultiple(restData.map((r: any) => ({ id: r.id, siret: r.siret })));
      setRepChecked(true);
    }
  };

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

          <div className="mt-5">
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
        </CardContent>
      </Card>

      {/* ═══════════════ ZONE 3: Monthly Chart ═══════════════ */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Évolution mensuelle — {yearLabel}</h3>
            </div>
            <div className="h-[350px]">
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
          </CardContent>
        </Card>
      )}

      {/* ═══════════════ ZONE 4: Restaurant Table with integrated REP ═══════════════ */}
      <Card>
        <CardContent className="pt-5 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="h-8 w-[180px] pl-8 text-sm rounded-full"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={soldeFilter === "all" ? "default" : "outline"}
                    className="h-7 px-2.5 text-[11px] rounded-full"
                    onClick={() => setSoldeFilter("all")}
                  >
                    Tous ({byRestaurant.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={soldeFilter === "positive" ? "default" : "outline"}
                    className="h-7 px-2.5 text-[11px] rounded-full"
                    onClick={() => setSoldeFilter("positive")}
                  >
                    Solde + ({byRestaurant.filter(r => r.net >= 0).length})
                  </Button>
                  <Button
                    size="sm"
                    variant={soldeFilter === "negative" ? "default" : "outline"}
                    className="h-7 px-2.5 text-[11px] rounded-full"
                    onClick={() => setSoldeFilter("negative")}
                  >
                    Solde − ({byRestaurant.filter(r => r.net < 0).length})
                  </Button>
                </div>
              </div>
            </div>

            {/* REP verification strip - inside the card */}
            {activeTab === "synthese" && (
              <div className={cn(
                "flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-lg border transition-colors",
                repChecked
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/30 border-border/50"
              )}>
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-xs font-semibold">Adhésion REP (éco-organismes)</span>
                    {repChecked && repStats && (
                      <div className="flex items-center gap-3 mt-0.5">
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
                      </div>
                    )}
                    {!repChecked && (
                      <p className="text-[10px] text-muted-foreground">Vérifie l'inscription de vos restaurants aux filières REP via l'API ADEME</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={repChecked ? "secondary" : "outline"}
                  className="h-7 text-[11px] rounded-full gap-1.5 shrink-0"
                  disabled={isRepLoading}
                  onClick={handleRepCheck}
                >
                  {isRepLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {repChecked ? "Actualiser" : "Vérifier les SIRET"}
                </Button>
              </div>
            )}

            {activeTab === "synthese" && (
              <p className="text-[11px] text-muted-foreground mb-3">
                {filteredRestaurants.length} restaurant{filteredRestaurants.length > 1 ? "s" : ""} affiché{filteredRestaurants.length > 1 ? "s" : ""}
                {searchQuery && ` pour "${searchQuery}"`}
              </p>
            )}

            <TabsContent value="synthese" className="mt-0">
              {byRestaurant.length > 0 ? (
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
                        />
                      ))}
                    </TableBody>
                  </Table>
                  {filteredRestaurants.length > 20 && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-full gap-1.5"
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll ? "Réduire" : "Voir tout"}
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-1">
                          {filteredRestaurants.length}
                        </Badge>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée pour cette période</p>
              )}
            </TabsContent>

            <TabsContent value="detail" className="mt-0">
              <EcoContributionDetail
                detailLines={detailLines}
                restaurantMap={restaurantMap}
                showPlatformColumn={isGlobal}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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

function RepStatusBadge({ repData }: { repData: ParsedRepData }) {
  if (repData.status === "loading") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mx-auto" />;
  }
  if (repData.status === "inscrit") {
    return (
      <div className="flex items-center justify-center">
        <Badge className="text-[9px] h-5 px-1.5 bg-green-600 hover:bg-green-700 gap-0.5 font-semibold">
          <CheckCircle2 className="h-3 w-3" />
          {repData.filiereCount}
        </Badge>
      </div>
    );
  }
  if (repData.status === "non_trouve") {
    return (
      <div className="flex items-center justify-center">
        <Badge variant="destructive" className="text-[9px] h-5 px-1.5 gap-0.5">
          <XCircle className="h-3 w-3" />
          0
        </Badge>
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
          isEvenRow ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30"
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
        </TableCell>
        {showRepColumn && (
          <TableCell className="py-3">
            {repData ? <RepStatusBadge repData={repData} /> : null}
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
        <TableCell className="text-right text-sm text-muted-foreground py-3">{detailLines.length}</TableCell>
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
