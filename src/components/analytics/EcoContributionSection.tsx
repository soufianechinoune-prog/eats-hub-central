import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, TrendingUp, TrendingDown, Hash, ChevronRight, Download, FileSpreadsheet, Search, Shield, ShieldAlert, Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { useEcoContribution } from "@/hooks/useEcoContribution";
import { EcoContributionDetail } from "./EcoContributionDetail";
import { useEcoContributionExport } from "@/hooks/useEcoContributionExport";
import { useEcoOrganismCheck } from "@/hooks/useEcoOrganismCheck";
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
import { Progress } from "@/components/ui/progress";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const YEAR_OPTIONS = [2023, 2024, 2025, 2026] as const;

interface EcoContributionSectionProps {
  restaurants: { id: string; name: string; siret?: string | null }[];
  selectedRestaurants: string[];
  selectedYear: number;
  selectedMonth?: number | null;
  selectedPlatform?: "uber_eats" | "deliveroo" | "global";
}

export function EcoContributionSection({
  restaurants,
  selectedRestaurants,
  selectedYear,
  selectedMonth,
  selectedPlatform = "global",
}: EcoContributionSectionProps) {
  const [localYear, setLocalYear] = useState<number | null>(selectedYear);
  const [activeTab, setActiveTab] = useState<"synthese" | "detail">("synthese");
  const [soldeFilter, setSoldeFilter] = useState<"all" | "positive" | "negative">("all");
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { exportPDF, exportExcel } = useEcoContributionExport();
  const { data: repData, loading: repLoading, errors: repErrors, checkMultiple } = useEcoOrganismCheck();
  const [repChecked, setRepChecked] = useState(false);

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

  // Recovery ratio
  const absCharge = Math.abs(totals.charge);
  const recoveryRatio = absCharge > 0 ? Math.round((totals.refund / absCharge) * 100) : 0;



  // Top 3 / Flop 3
  const top3 = useMemo(() => {
    return [...byRestaurant].sort((a, b) => b.net - a.net).slice(0, 3);
  }, [byRestaurant]);

  const flop3 = useMemo(() => {
    return [...byRestaurant].sort((a, b) => a.net - b.net).slice(0, 3);
  }, [byRestaurant]);

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

  const isExempt = totals.net >= 0;

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
          {/* Year pill buttons */}
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
            {/* Left: Net balance big number */}
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

            {/* Right: 3 mini stats */}
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

          {/* Full-width progress bar */}
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

      {/* ═══════════════ ZONE 4: Monthly Chart ═══════════════ */}
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

      {/* ═══════════════ ZONE 4b: REP Membership Check ═══════════════ */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Adhésion éco-organismes (REP)</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs rounded-full gap-1.5"
              disabled={Object.values(repLoading).some(Boolean)}
              onClick={async () => {
                const ids = restaurantIds;
                const { data: restData } = await supabase
                  .from("restaurants")
                  .select("id, siret")
                  .in("id", ids);
                if (restData) {
                  await checkMultiple(restData.map((r: any) => ({ id: r.id, siret: r.siret })));
                  setRepChecked(true);
                }
              }}
            >
              {Object.values(repLoading).some(Boolean) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Vérifier les SIRET
            </Button>
          </div>

          {repChecked && (
            <div className="space-y-2">
              {restaurantIds.map(rId => {
                const name = restaurantMap.get(rId) || rId.slice(0, 8);
                const result = repData[rId];
                const isLoading = repLoading[rId];
                const error = repErrors[rId];

                if (isLoading) {
                  return (
                    <div key={rId} className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {name}…
                    </div>
                  );
                }

                if (error) {
                  return (
                    <div key={rId} className="flex items-center gap-2 text-xs text-destructive py-1.5">
                      <XCircle className="h-3.5 w-3.5" />
                      {name} — {error}
                    </div>
                  );
                }

                if (!result) {
                  return (
                    <div key={rId} className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      {name} — <span className="italic">Pas de SIRET renseigné</span>
                    </div>
                  );
                }

                const hasResults = result.count > 0;
                const uniqueOrgs = [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))];
                const uniqueFilieres = [...new Set(result.results.map(r => r.filiere).filter(Boolean))];

                return (
                  <div key={rId} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {hasResults
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      }
                      <span className="text-sm font-medium">{name}</span>
                      <Badge variant={hasResults ? "default" : "destructive"} className="text-[10px] h-5">
                        {hasResults ? `${result.count} filière${result.count > 1 ? "s" : ""} REP` : "Non trouvé"}
                      </Badge>
                    </div>
                    {hasResults && (
                      <div className="pl-6 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {uniqueFilieres.map(f => (
                            <Badge key={f} variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                              {f}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Éco-organismes : {uniqueOrgs.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!repChecked && (
            <p className="text-xs text-muted-foreground">
              Cliquez sur "Vérifier les SIRET" pour interroger l'API ADEME et vérifier l'adhésion de vos restaurants aux filières REP.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════ ZONE 5: Restaurant Table with pill tabs ═══════════════ */}
      <Card>
        <CardContent className="pt-5 pb-3">
          {/* Pill tabs inside the card */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "synthese" | "detail")}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <TabsList className="rounded-full p-1 bg-muted/60 h-auto">
                <TabsTrigger value="synthese" className="rounded-full px-5 py-1.5 text-xs font-medium">
                  Synthèse
                </TabsTrigger>
                <TabsTrigger value="detail" className="rounded-full px-5 py-1.5 text-xs font-medium">
                  Détail ({totals.lineCount})
                </TabsTrigger>
              </TabsList>

              {activeTab === "synthese" && (
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
              )}
            </div>

            {/* Result counter */}
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

function RestaurantDrilldown({
  restaurant,
  name,
  detailLines,
  fmt,
  isHistorique,
  showPlatformDot = true,
  isEvenRow = false,
}: {
  restaurant: { restaurant_id: string; refund: number; charge: number; net: number; count: number };
  name: string;
  detailLines: DetailLine[];
  fmt: (v: number) => string;
  isHistorique?: boolean;
  showPlatformDot?: boolean;
  isEvenRow?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const r = restaurant;
  const absCharge = Math.abs(r.charge);
  const total = r.refund + absCharge;
  const refundPct = total > 0 ? Math.round((r.refund / total) * 100) : 0;

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
      {open && (
        <>
          {monthlyBreakdown.map((mg) => (
            <MonthDrilldownRow key={mg.month} monthGroup={mg} fmt={fmt} showPlatformDot={showPlatformDot} parentNet={r.net} />
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
}: {
  monthGroup: { month: number; label: string; refund: number; charge: number; net: number; lines: DetailLine[] };
  fmt: (v: number) => string;
  showPlatformDot?: boolean;
  parentNet?: number;
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
        <TableCell className="text-sm pl-10 py-2.5">
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
          <TableCell className="text-xs pl-16 text-muted-foreground py-2">
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
