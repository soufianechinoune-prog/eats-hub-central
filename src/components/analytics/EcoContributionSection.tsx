import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Leaf, TrendingUp, TrendingDown, Hash, ChevronRight, Download, FileSpreadsheet, Trophy, AlertTriangle } from "lucide-react";
import { useEcoContribution } from "@/hooks/useEcoContribution";
import { EcoContributionDetail } from "./EcoContributionDetail";
import { useEcoContributionExport } from "@/hooks/useEcoContributionExport";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart, ReferenceLine,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

interface EcoContributionSectionProps {
  restaurants: { id: string; name: string }[];
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
  const [activeTab, setActiveTab] = useState<"synthese" | "detail">("synthese");
  const [localYear, setLocalYear] = useState<number | null>(selectedYear);
  const [soldeFilter, setSoldeFilter] = useState<"all" | "positive" | "negative">("all");
  const [showAll, setShowAll] = useState(false);
  const { exportPDF, exportExcel } = useEcoContributionExport();

  const restaurantIds = selectedRestaurants.length > 0
    ? selectedRestaurants
    : restaurants.map(r => r.id);

  const { monthlyData, byRestaurant, totals, detailLines, isLoading } = useEcoContribution({
    restaurantIds,
    year: localYear,
    month: selectedMonth,
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
      name: localYear === null
        ? `${MONTHS[d.month - 1]} ${String(d.year).slice(2)}`
        : MONTHS[d.month - 1],
      Remboursements: d.refund,
      Prélèvements: Math.abs(d.charge),
      
    }));
  }, [monthlyData, localYear]);

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

  const handleSort = (key: "net" | "refund" | "charge") => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const yearLabel = localYear === null ? "Historique" : String(localYear);

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

  const displayedRestaurants = showAll ? sortedRestaurants : sortedRestaurants.slice(0, 20);

  const handleExport = (type: "pdf" | "excel") => {
    const exportRestaurants = sortedRestaurants.map(r => ({
      ...r,
      name: restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8),
    }));
    const params = { restaurants: exportRestaurants, monthlyData, totals, yearLabel };
    if (type === "pdf") exportPDF(params);
    else exportExcel(params);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement éco-contribution...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold">Éco-Contribution</h2>
          <div className="flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant={localYear === null ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setLocalYear(null)}
            >
              Historique
            </Button>
            {[2023, 2024, 2025, 2026].map((y) => (
              <Button
                key={y}
                size="sm"
                variant={localYear === y ? "default" : "outline"}
                className="h-7 px-3 text-xs"
                onClick={() => setLocalYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "synthese" | "detail")}>
        <TabsList>
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="detail">
            Détail lignes ({totals.lineCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="synthese" className="space-y-6 mt-4">
          {/* KPI Cards with hierarchy */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Solde Net - Primary card, col-span-2 */}
            <Card className={cn(
              "md:col-span-2 border-2",
              totals.net >= 0
                ? "border-green-500/30 bg-green-500/5 dark:bg-green-500/10"
                : "border-red-500/30 bg-red-500/5 dark:bg-red-500/10"
            )}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Leaf className="h-4 w-4" />
                  Solde Net
                </div>
                <div className={cn("text-3xl font-bold tracking-tight", totals.net >= 0 ? "text-green-600" : "text-red-500")}>
                  {fmt(totals.net)}
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Taux de récupération</span>
                    <span className="font-medium">{recoveryRatio}%</span>
                  </div>
                  <Progress value={Math.min(recoveryRatio, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Remboursements
                </div>
                <div className="text-xl font-bold text-green-600">{fmt(totals.refund)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Prélèvements
                </div>
                <div className="text-xl font-bold text-red-500">{fmt(totals.charge)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Hash className="h-4 w-4" />
                  Lignes
                </div>
                <div className="text-xl font-bold">{totals.lineCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Chart - Stacked bars + Net line */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Évolution mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${v}€`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [fmt(name === "Prélèvements" ? -value : value), name]}
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Bar dataKey="Remboursements" stackId="eco" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Prélèvements" stackId="eco" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 3 / Flop 3 */}
          {byRestaurant.length > 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-green-600" />
                    Top 3 — Meilleurs soldes
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-2">
                    {top3.map((r, i) => (
                      <div key={r.restaurant_id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                          <span className="truncate max-w-[200px]">{restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8)}</span>
                        </div>
                        <span className={cn("font-semibold tabular-nums", r.net >= 0 ? "text-green-600" : "text-red-500")}>
                          {fmt(r.net)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Flop 3 — Pires soldes
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-2">
                    {flop3.map((r, i) => (
                      <div key={r.restaurant_id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                          <span className="truncate max-w-[200px]">{restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8)}</span>
                        </div>
                        <span className={cn("font-semibold tabular-nums", r.net >= 0 ? "text-green-600" : "text-red-500")}>
                          {fmt(r.net)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Restaurant Ranking Table */}
          {byRestaurant.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Par restaurant</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={soldeFilter === "all" ? "default" : "outline"}
                      className="h-6 px-2.5 text-[11px]"
                      onClick={() => setSoldeFilter("all")}
                    >
                      Tous ({byRestaurant.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={soldeFilter === "positive" ? "default" : "outline"}
                      className="h-6 px-2.5 text-[11px]"
                      onClick={() => setSoldeFilter("positive")}
                    >
                      Solde + ({byRestaurant.filter(r => r.net >= 0).length})
                    </Button>
                    <Button
                      size="sm"
                      variant={soldeFilter === "negative" ? "default" : "outline"}
                      className="h-6 px-2.5 text-[11px]"
                      onClick={() => setSoldeFilter("negative")}
                    >
                      Solde − ({byRestaurant.filter(r => r.net < 0).length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                    {displayedRestaurants.map((r) => (
                      <RestaurantDrilldown
                        key={r.restaurant_id}
                        restaurant={r}
                        name={restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8)}
                        detailLines={detailLines.filter(l => l.restaurant_id === r.restaurant_id)}
                        fmt={fmt}
                        isHistorique={localYear === null}
                        showPlatformDot={isGlobal}
                      />
                    ))}
                  </TableBody>
                </Table>
                {sortedRestaurants.length > 20 && (
                  <div className="flex justify-center pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowAll(!showAll)}
                    >
                      {showAll ? "Réduire" : `Voir tout (${sortedRestaurants.length} restaurants)`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <EcoContributionDetail
            detailLines={detailLines}
            restaurantMap={restaurantMap}
            showPlatformColumn={isGlobal}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
}: {
  restaurant: { restaurant_id: string; refund: number; charge: number; net: number; count: number };
  name: string;
  detailLines: DetailLine[];
  fmt: (v: number) => string;
  isHistorique?: boolean;
  showPlatformDot?: boolean;
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
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setOpen(!open)}
      >
        <TableCell className="font-medium text-sm">
          <div className="flex items-center gap-1.5">
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
            {name}
          </div>
        </TableCell>
        <TableCell className="text-right text-green-600 text-sm">{fmt(r.refund)}</TableCell>
        <TableCell className="text-right text-red-500 text-sm">{fmt(r.charge)}</TableCell>
        <TableCell className="text-right text-sm">
          <div className="flex items-center justify-end gap-2">
            {/* Mini ratio bar */}
            <div className="w-16 h-2 rounded-full overflow-hidden bg-red-500/20 hidden sm:block">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${refundPct}%` }}
              />
            </div>
            <span className={cn("font-medium tabular-nums", r.net >= 0 ? "text-green-600" : "text-red-500")}>
              {fmt(r.net)}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">{detailLines.length}</TableCell>
      </TableRow>
      {open && monthlyBreakdown.map((mg) => (
        <MonthDrilldownRow key={mg.month} monthGroup={mg} fmt={fmt} showPlatformDot={showPlatformDot} />
      ))}
    </>
  );
}

function MonthDrilldownRow({
  monthGroup,
  fmt,
  showPlatformDot = true,
}: {
  monthGroup: { month: number; label: string; refund: number; charge: number; net: number; lines: DetailLine[] };
  fmt: (v: number) => string;
  showPlatformDot?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "-";

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/30 bg-muted/10"
        onClick={() => setOpen(!open)}
      >
        <TableCell className="text-sm pl-10">
          <div className="flex items-center gap-1.5">
            <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")} />
            <span className="font-medium">{monthGroup.label}</span>
          </div>
        </TableCell>
        <TableCell className="text-right text-green-600 text-xs">{fmt(monthGroup.refund)}</TableCell>
        <TableCell className="text-right text-red-500 text-xs">{fmt(monthGroup.charge)}</TableCell>
        <TableCell className={cn("text-right font-medium text-xs", monthGroup.net >= 0 ? "text-green-600" : "text-red-500")}>
          {fmt(monthGroup.net)}
        </TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">{monthGroup.lines.length}</TableCell>
      </TableRow>
      {open && monthGroup.lines.map((line) => (
        <TableRow key={line.id} className="bg-muted/5">
          <TableCell className="text-xs pl-16 text-muted-foreground">
            {showPlatformDot && (
              line.platform === "deliveroo"
                ? <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1.5 border-cyan-500 text-cyan-600 font-normal">Deliveroo</Badge>
                : <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1.5 border-green-500 text-green-600 font-normal">Uber</Badge>
            )}
            {fmtDate(line.payout_date)} — {line.description || "-"}
          </TableCell>
          <TableCell />
          <TableCell />
          <TableCell className={cn("text-right text-xs font-medium", Number(line.amount) >= 0 ? "text-green-600" : "text-red-500")}>
            {fmt(Number(line.amount))}
          </TableCell>
          <TableCell className="text-right text-[10px] text-muted-foreground font-mono">
            {line.payout_reference_id ? line.payout_reference_id.slice(0, 12) + "…" : "-"}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
