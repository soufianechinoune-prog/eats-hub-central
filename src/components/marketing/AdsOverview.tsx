import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";
import { Megaphone, MousePointer, Eye, Target, Wallet, TrendingUp } from "lucide-react";
import { AdsCampaign } from "@/hooks/useMarketingCampaigns";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AdsOverviewProps {
  ads: AdsCampaign[];
  stats: {
    totalSales: number;
    totalSpend: number;
    totalBudget: number;
    avgRoas: number;
    avgCostPerOrder: number;
    totalImpressions: number;
    totalClicks: number;
    totalOrders: number;
    campaignCount: number;
  };
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function AdsOverview({ ads, stats }: AdsOverviewProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("fr-FR").format(value);

  // Funnel data
  const funnelData = [
    { name: "Impressions", value: stats.totalImpressions, fill: "hsl(var(--chart-1))" },
    { name: "Clics", value: stats.totalClicks, fill: "hsl(var(--chart-2))" },
    { name: "Commandes", value: stats.totalOrders, fill: "hsl(var(--chart-3))" },
  ];

  // Scatter data for ROI comparison
  const scatterData = ads.map((ad) => ({
    name: ad.title || ad.campaign_uuid?.slice(0, 8) || "Campagne",
    spend: ad.ad_spend,
    sales: ad.generated_sales,
    roas: ad.roas,
  }));

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "en cours":
        return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Actif</Badge>;
      case "completed":
      case "terminé":
        return <Badge variant="secondary">Terminé</Badge>;
      case "paused":
      case "en pause":
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">Pause</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
  };

  const getRoasBadge = (roas: number) => {
    if (roas >= 5) {
      return <span className="text-emerald-600 font-bold">{roas.toFixed(1)}x</span>;
    } else if (roas >= 2) {
      return <span className="text-blue-600 font-medium">{roas.toFixed(1)}x</span>;
    } else if (roas >= 1) {
      return <span className="text-amber-600">{roas.toFixed(1)}x</span>;
    }
    return <span className="text-destructive">{roas.toFixed(1)}x</span>;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventes pub</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatCurrency(stats.totalSales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Wallet className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dépenses</p>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency(stats.totalSpend)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ROAS moyen</p>
                <p className="text-xl font-bold text-blue-700">
                  {stats.avgRoas.toFixed(1)}x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <MousePointer className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Coût/commande</p>
                <p className="text-xl font-bold text-amber-700">
                  {formatCurrency(stats.avgCostPerOrder)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impressions</p>
                <p className="text-xl font-bold text-purple-700">
                  {formatNumber(stats.totalImpressions)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Funnel publicitaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalImpressions > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                  <Tooltip
                    formatter={(value: number) => formatNumber(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée publicitaire disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              ROI par campagne (Dépenses vs Ventes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="spend"
                    name="Dépenses"
                    className="text-xs"
                    tickFormatter={(v) => `${v}€`}
                  />
                  <YAxis
                    dataKey="sales"
                    name="Ventes"
                    className="text-xs"
                    tickFormatter={(v) => `${v}€`}
                  />
                  <ZAxis dataKey="roas" range={[100, 500]} name="ROAS" />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "ROAS" ? `${value.toFixed(1)}x` : formatCurrency(value)
                    }
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Scatter data={scatterData} fill="hsl(var(--primary))">
                    {scatterData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Historique des publicités ({stats.campaignCount})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campagne</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Période</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Dépenses</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clics</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.slice(0, 50).map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell className="font-medium max-w-[150px] truncate">
                    {ad.title || ad.campaign_uuid?.slice(0, 8) || "N/A"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {ad.restaurant?.name || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ad.start_date
                      ? format(new Date(ad.start_date), "dd MMM", { locale: fr })
                      : "N/A"}{" "}
                    -{" "}
                    {ad.end_date
                      ? format(new Date(ad.end_date), "dd MMM yy", { locale: fr })
                      : "en cours"}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(ad.budget)}</TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(ad.ad_spend)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(ad.generated_sales)}
                  </TableCell>
                  <TableCell className="text-right">{getRoasBadge(ad.roas)}</TableCell>
                  <TableCell className="text-right">{formatNumber(ad.impressions)}</TableCell>
                  <TableCell className="text-right">{formatNumber(ad.clicks)}</TableCell>
                  <TableCell className="text-right">
                    {(ad.click_through_rate * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell>{getStatusBadge(ad.status || "")}</TableCell>
                </TableRow>
              ))}
              {ads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    Aucune publicité importée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
