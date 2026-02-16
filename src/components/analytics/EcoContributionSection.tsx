import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Leaf, TrendingUp, TrendingDown, Hash } from "lucide-react";
import { useEcoContribution } from "@/hooks/useEcoContribution";
import { EcoContributionDetail } from "./EcoContributionDetail";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

interface EcoContributionSectionProps {
  restaurants: { id: string; name: string }[];
  selectedRestaurants: string[];
  selectedYear: number;
  selectedMonth?: number | null;
}

export function EcoContributionSection({
  restaurants,
  selectedRestaurants,
  selectedYear,
  selectedMonth,
}: EcoContributionSectionProps) {
  const [activeTab, setActiveTab] = useState<"synthese" | "detail">("synthese");

  const restaurantIds = selectedRestaurants.length > 0
    ? selectedRestaurants
    : restaurants.map(r => r.id);

  const { monthlyData, byRestaurant, totals, detailLines, isLoading } = useEcoContribution({
    restaurantIds,
    year: selectedYear,
    month: selectedMonth,
  });

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    restaurants.forEach(r => map.set(r.id, r.name));
    return map;
  }, [restaurants]);

  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
      name: MONTHS[d.month - 1],
      Remboursements: d.refund,
      Prélèvements: d.charge,
      "Solde net": d.net,
    }));
  }, [monthlyData]);

  const fmt = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  // Sort restaurant data
  const [sortKey, setSortKey] = useState<"net" | "refund" | "charge">("net");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedRestaurants = useMemo(() => {
    return [...byRestaurant].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "desc" ? -diff : diff;
    });
  }, [byRestaurant, sortKey, sortDir]);

  const handleSort = (key: "net" | "refund" | "charge") => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement éco-contribution...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Leaf className="h-5 w-5 text-green-600" />
        <h2 className="text-lg font-semibold">Éco-Contribution</h2>
        <Badge variant="secondary" className="text-xs">{selectedYear}</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "synthese" | "detail")}>
        <TabsList>
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="detail">
            Détail lignes ({totals.lineCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="synthese" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <Leaf className="h-4 w-4" />
                  Solde Net
                </div>
                <div className={`text-xl font-bold ${totals.net >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {fmt(totals.net)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Hash className="h-4 w-4" />
                  Lignes individuelles
                </div>
                <div className="text-xl font-bold">{totals.lineCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Chart */}
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
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Legend />
                      <Bar dataKey="Remboursements" fill="hsl(142, 76%, 36%)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Prélèvements" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
                      <Line type="monotone" dataKey="Solde net" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Restaurant Ranking Table */}
          {sortedRestaurants.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Par restaurant</CardTitle>
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
                      <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort("net")}>
                        Solde {sortKey === "net" && (sortDir === "desc" ? "↓" : "↑")}
                      </TableHead>
                      <TableHead className="text-right">Versements</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRestaurants.map((r) => (
                      <TableRow key={r.restaurant_id}>
                        <TableCell className="font-medium text-sm">
                          {restaurantMap.get(r.restaurant_id) || r.restaurant_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 text-sm">{fmt(r.refund)}</TableCell>
                        <TableCell className="text-right text-red-500 text-sm">{fmt(r.charge)}</TableCell>
                        <TableCell className={`text-right font-medium text-sm ${r.net >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {fmt(r.net)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{r.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <EcoContributionDetail
            detailLines={detailLines}
            restaurantMap={restaurantMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
