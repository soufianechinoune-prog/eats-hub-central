import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, TrendingUp, TrendingDown, Hash, ChevronRight, Download, FileSpreadsheet, Trophy, AlertTriangle, Search, Percent } from "lucide-react";
import { useEcoContribution } from "@/hooks/useEcoContribution";
import { EcoContributionDetail } from "./EcoContributionDetail";
import { useEcoContributionExport } from "@/hooks/useEcoContributionExport";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart, ReferenceLine, Bar,
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
  const [soldeFilter, setSoldeFilter] = useState<"all" | "positive" | "negative">("all");
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { exportPDF, exportExcel } = useEcoContributionExport();

  const restaurantIds = selectedRestaurants.length > 0
    ? selectedRestaurants
    : restaurants.map(r => r.id);

  const { monthlyData, byRestaurant, totals, detailLines, isLoading } = useEcoContribution({
    restaurantIds,
    year: selectedYear,
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

  const yearLabel = String(selectedYear);

  // Recovery ratio
  const absCharge = Math.abs(totals.charge);
  const recoveryRatio = absCharge > 0 ? Math.round((totals.refund / absCharge) * 100) : 0;

  // Coût moyen par ligne
  const avgCostPerLine = totals.lineCount > 0 ? Math.round((absCharge / totals.lineCount) * 100) / 100 : 0;

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

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement éco-contribution...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header compact: titre + badge + export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-green-500/10 dark:bg-green-500/20">
            <Leaf className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">Éco-Contribution</h2>
            <p className="text-xs text-muted-foreground">{yearLabel} · {totals.lineCount} lignes</p>
          </div>
          <Badge variant={totals.net >= 0 ? "default" : "destructive"} className="ml-1">
            {totals.net >= 0 ? "Exonéré" : "Non exonéré"}
          </Badge>
        </div>

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

      {/* Modern pill tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "synthese" | "detail")}>
        <TabsList className="rounded-full p-1 bg-muted/60">
          <TabsTrigger value="synthese" className="rounded-full px-5 text-sm">Synthèse</TabsTrigger>
          <TabsTrigger value="detail" className="rounded-full px-5 text-sm">
            Détail ({totals.lineCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="synthese" className="space-y-6 mt-5">
          {/* KPI Cards - 4 columns with hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Solde Net - Hero card */}
            <Card className={cn(
              "lg:col-span-1 relative overflow-hidden border-2",
              totals.net >= 0
                ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-green-600/10 dark:from-green-500/10 dark:to-green-600/15"
                : "border-red-500/30 bg-gradient-to-br from-red-500/5 to-red-600/10 dark:from-red-500/10 dark:to-red-600/15"
            )}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  <Leaf className="h-3.5 w-3.5" />
                  Solde Net
                </div>
                <div className={cn("text-3xl font-bold tracking-tight", totals.net >= 0 ? "text-green-600" : "text-red-500")}>
                  {fmt(totals.net)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {totals.net >= 0 ? "Les remboursements couvrent les prélèvements" : "Défaut d'exonération détecté"}
                </p>
              </CardContent>
            </Card>

            {/* Remboursements */}
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  Remboursements
                </div>
                <div className="text-2xl font-bold text-green-600">{fmt(totals.refund)}</div>
                <div className="mt-3">
                  <Progress value={recoveryRatio > 100 ? 100 : recoveryRatio} className="h-1.5 [&>div]:bg-green-500" />
                </div>
              </CardContent>
            </Card>

            {/* Prélèvements */}
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  Prélèvements
                </div>
                <div className="text-2xl font-bold text-red-500">{fmt(totals.charge)}</div>
                <div className="mt-3">
                  <Progress value={100} className="h-1.5 [&>div]:bg-red-500" />
                </div>
              </CardContent>
            </Card>

            {/* Taux de récupération - Gauge-like */}
            <Card>
              <CardContent className="pt-5 pb-4 px-5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                  <Percent className="h-3.5 w-3.5" />
                  Récupération
                </div>
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={recoveryRatio >= 100 ? "hsl(142, 76%, 36%)" : recoveryRatio >= 50 ? "hsl(48, 96%, 53%)" : "hsl(0, 84%, 60%)"}
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(recoveryRatio, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn(
                      "text-lg font-bold",
                      recoveryRatio >= 100 ? "text-green-600" : recoveryRatio >= 50 ? "text-yellow-500" : "text-red-500"
                    )}>
                      {recoveryRatio}%
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{totals.lineCount} lignes · ~{fmt(avgCostPerLine)}/l</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Chart - Stacked bars + Net line */}
          {chartData.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Évolution mensuelle — {yearLabel}</h3>
                </div>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${v}€`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          fmt(name === "Prélèvements" ? -value : value),
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Bar dataKey="Remboursements" stackId="eco" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Prélèvements" stackId="eco" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="Solde Net"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "hsl(var(--primary))" }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 3 / Flop 3 side by side with mini bars */}
          {byRestaurant.length > 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-500/20">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <h3 className="text-sm font-semibold">Top 3 — Meilleurs soldes</h3>
                  </div>
                  <div className="space-y-3">
                    {top3.map((r, i) => {
                      const name = restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8);
                      const maxNet = Math.max(...top3.map(x => Math.abs(x.net)), 1);
                      const barWidth = Math.round((Math.abs(r.net) / maxNet) * 100);
                      return (
                        <div key={r.restaurant_id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
                                i === 0 ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
                              )}>
                                {i + 1}
                              </span>
                              <span className="truncate max-w-[180px] font-medium">{name}</span>
                            </div>
                            <span className={cn("font-semibold tabular-nums text-sm", r.net >= 0 ? "text-green-600" : "text-red-500")}>
                              {fmt(r.net)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500/60 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/20">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <h3 className="text-sm font-semibold">Flop 3 — Pires soldes</h3>
                  </div>
                  <div className="space-y-3">
                    {flop3.map((r, i) => {
                      const name = restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8);
                      const maxNet = Math.max(...flop3.map(x => Math.abs(x.net)), 1);
                      const barWidth = Math.round((Math.abs(r.net) / maxNet) * 100);
                      return (
                        <div key={r.restaurant_id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
                                i === 0 ? "bg-red-500/20 text-red-500" : "bg-muted text-muted-foreground"
                              )}>
                                {i + 1}
                              </span>
                              <span className="truncate max-w-[180px] font-medium">{name}</span>
                            </div>
                            <span className={cn("font-semibold tabular-nums text-sm", r.net >= 0 ? "text-green-600" : "text-red-500")}>
                              {fmt(r.net)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-500/60 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Restaurant Ranking Table with search */}
          {byRestaurant.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <h3 className="text-sm font-semibold">Par restaurant</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="h-8 w-[180px] pl-8 text-sm"
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
                        isHistorique={false}
                        showPlatformDot={isGlobal}
                        isEvenRow={idx % 2 === 0}
                      />
                    ))}
                  </TableBody>
                </Table>
                {filteredRestaurants.length > 20 && (
                  <div className="flex justify-center pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowAll(!showAll)}
                    >
                      {showAll ? "Réduire" : `Voir tout (${filteredRestaurants.length} restaurants)`}
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
        className={cn("cursor-pointer hover:bg-muted/50", isEvenRow && "bg-muted/20")}
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
            <div className="w-20 h-2 rounded-full overflow-hidden bg-red-500/20 hidden sm:block">
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
