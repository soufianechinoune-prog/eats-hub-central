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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Gift, Users, ShoppingCart, Percent, TrendingUp } from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface OffersOverviewProps {
  offers: OffersCampaign[];
  stats: {
    totalSales: number;
    totalNewCustomers: number;
    totalOrders: number;
    avgUberFunding: number;
    campaignCount: number;
    byType: Record<string, { count: number; sales: number; orders: number; newCustomers: number }>;
  };
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function OffersOverview({ offers, stats }: OffersOverviewProps) {
  const byTypeData = Object.entries(stats.byType).map(([type, data]) => ({
    name: type,
    ventes: data.sales,
    commandes: data.orders,
    nouveaux: data.newCustomers,
    count: data.count,
  }));

  const pieData = Object.entries(stats.byType).map(([type, data]) => ({
    name: type,
    value: data.sales,
  }));

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "en cours":
        return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Actif</Badge>;
      case "completed":
      case "terminé":
        return <Badge variant="secondary">Terminé</Badge>;
      case "scheduled":
      case "planifié":
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">Planifié</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventes générées</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(stats.totalSales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nouveaux clients</p>
                <p className="text-2xl font-bold text-blue-700">
                  {stats.totalNewCustomers.toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commandes</p>
                <p className="text-2xl font-bold text-amber-700">
                  {stats.totalOrders.toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Percent className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Financement Uber moy.</p>
                <p className="text-2xl font-bold text-purple-700">
                  {stats.avgUberFunding.toFixed(0)}%
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
              <Gift className="h-5 w-5 text-primary" />
              Performance par type d'offre
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byTypeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="ventes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée d'offres disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Répartition des ventes par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
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
            <span>Historique des offres ({stats.campaignCount})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit/Offre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Nouveaux</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-right">Financement</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.slice(0, 50).map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {offer.title || offer.items_affected || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {offer.offer_type || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {offer.restaurant?.name || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {offer.start_date
                      ? format(new Date(offer.start_date), "dd MMM", { locale: fr })
                      : "N/A"}{" "}
                    -{" "}
                    {offer.end_date
                      ? format(new Date(offer.end_date), "dd MMM yy", { locale: fr })
                      : "en cours"}
                  </TableCell>
                  <TableCell className="text-sm">{offer.audience || "Tous"}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(offer.generated_sales)}
                  </TableCell>
                  <TableCell className="text-right">{offer.new_customers}</TableCell>
                  <TableCell className="text-right">{offer.orders}</TableCell>
                  <TableCell className="text-right">
                    {offer.uber_funding_percent > 0 ? (
                      <span className="text-purple-600 font-medium">
                        {offer.uber_funding_percent}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(offer.status || "")}</TableCell>
                </TableRow>
              ))}
              {offers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Aucune offre promotionnelle importée
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
