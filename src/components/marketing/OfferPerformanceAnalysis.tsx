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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Award, 
  ShoppingBag,
  Users,
  Filter,
  Calendar,
  Percent,
  DollarSign,
  Calculator,
  PiggyBank,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { useOfferProfitability, OfferProfitability } from "@/hooks/useOfferProfitability";
import { useMemo, useState } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface OfferPerformanceAnalysisProps {
  offers: OffersCampaign[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PROFITABILITY_COLORS = {
  excellent: "hsl(142, 76%, 36%)",
  good: "hsl(142, 71%, 45%)",
  neutral: "hsl(48, 96%, 53%)",
  poor: "hsl(25, 95%, 53%)",
  negative: "hsl(0, 84%, 60%)",
};

export function OfferPerformanceAnalysis({ offers }: OfferPerformanceAnalysisProps) {
  const [selectedOfferType, setSelectedOfferType] = useState<string>("all");
  const [editingFunding, setEditingFunding] = useState<string | null>(null);
  const [fundingValue, setFundingValue] = useState<string>("");
  const queryClient = useQueryClient();
  
  // Use the profitability hook
  const { 
    offers: profitableOffers, 
    stats, 
    topProfitable, 
    bottomProfitable,
    profitabilityByType 
  } = useOfferProfitability(offers);
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const handleFundingUpdate = async (offerId: string, newValue: number) => {
    try {
      const { data: current } = await supabase
        .from("restaurant_actions")
        .select("change_context")
        .eq("id", offerId)
        .single();
      
      const updatedContext = {
        ...(current?.change_context as Record<string, unknown> || {}),
        uber_funding_percent: newValue
      };

      const { error } = await supabase
        .from("restaurant_actions")
        .update({ change_context: updatedContext })
        .eq("id", offerId);

      if (error) throw error;

      toast.success("Co-financement mis à jour");
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    } catch (error) {
      console.error("Error updating funding:", error);
      toast.error("Erreur lors de la mise à jour");
    }
    setEditingFunding(null);
  };

  // Get unique offer types for dropdown
  const offerTypes = useMemo(() => {
    const types = new Set(offers.map(o => o.offer_type || "Autre"));
    return Array.from(types).sort();
  }, [offers]);

  // Filter offers based on selected type
  const filteredOffers = useMemo(() => {
    if (selectedOfferType === "all") return [];
    return profitableOffers
      .filter(o => (o.offer_type || "Autre") === selectedOfferType)
      .sort((a, b) => b.net_margin - a.net_margin);
  }, [profitableOffers, selectedOfferType]);

  // Summary stats for filtered offers
  const filteredStats = useMemo(() => {
    if (filteredOffers.length === 0) return null;
    return {
      count: filteredOffers.length,
      totalSales: filteredOffers.reduce((sum, o) => sum + o.generated_sales, 0),
      totalMargin: filteredOffers.reduce((sum, o) => sum + o.net_margin, 0),
      avgRoi: filteredOffers.length > 0 
        ? filteredOffers.reduce((sum, o) => sum + o.roi, 0) / filteredOffers.length 
        : 0,
    };
  }, [filteredOffers]);

  // Scatter plot data: Cost vs Net Margin
  const scatterData = useMemo(() => {
    return profitableOffers
      .filter((o) => o.estimated_cost > 0)
      .map((o) => ({
        x: o.estimated_cost,
        y: o.net_margin,
        z: o.orders,
        name: o.product || o.title || "N/A",
        type: o.offer_type,
        roi: o.roi,
        profitability: o.profitability_level,
      }));
  }, [profitableOffers]);

  // Profitability badge
  const getProfitabilityBadge = (offer: OfferProfitability) => {
    const { profitability_level, roi } = offer;
    const config = {
      excellent: { label: "Excellent", className: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
      good: { label: "Rentable", className: "bg-green-500/20 text-green-700 border-green-500/30" },
      neutral: { label: "Neutre", className: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
      poor: { label: "Faible", className: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
      negative: { label: "Déficitaire", className: "bg-red-500/20 text-red-700 border-red-500/30" },
    };
    const { label, className } = config[profitability_level];
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Real Financial KPIs - shown when we have real data */}
      {stats.hasRealData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CA réel (période offres)</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(stats.realTotalSales)}
                  </p>
                  <p className="text-xs text-muted-foreground">pendant les offres</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Calculator className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission réelle</p>
                  <p className="text-2xl font-bold text-red-700">
                    {formatCurrency(stats.realTotalCommission)}
                  </p>
                  <p className="text-xs text-muted-foreground">frais Uber</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <PiggyBank className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Versement total</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(stats.realTotalPayout + stats.realTotalMealVoucher)}
                  </p>
                  <p className="text-xs text-muted-foreground">Uber + Titres resto</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rentabilité moyenne</p>
                  <p className={`text-2xl font-bold ${stats.realTotalProfitability >= 50 ? 'text-emerald-700' : stats.realTotalProfitability >= 40 ? 'text-amber-700' : 'text-red-700'}`}>
                    {stats.realTotalProfitability.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">versement / CA</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estimated KPIs - always shown as secondary info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Coût total offres</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(stats.totalCost)}
                </p>
                <p className="text-xs text-muted-foreground">estimé</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <PiggyBank className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marge nette estimée</p>
                <p className={`text-2xl font-bold ${stats.totalNetMargin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(stats.totalNetMargin)}
                </p>
                <p className="text-xs text-muted-foreground">après commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ROI moyen</p>
                <p className={`text-2xl font-bold ${stats.avgRoi >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {stats.avgRoi.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">retour sur investissement</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Coût acquisition</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(stats.avgCostPerAcquisition)}
                </p>
                <p className="text-xs text-muted-foreground">par nouveau client</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4 flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-3xl font-bold text-emerald-700">{stats.profitableCount}</p>
              <p className="text-sm text-muted-foreground">offres rentables</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 flex items-center gap-4">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-3xl font-bold text-red-700">{stats.unprofitableCount}</p>
              <p className="text-sm text-muted-foreground">offres déficitaires</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability by Type Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Rentabilité par type d'offre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type d'offre</TableHead>
                <TableHead className="text-center">Campagnes</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Coût estimé</TableHead>
                <TableHead className="text-right">Marge nette</TableHead>
                <TableHead className="text-right">ROI moyen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profitabilityByType.map((item, idx) => (
                <TableRow key={item.type}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      {item.type}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{item.count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(item.totalSales)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(item.totalCost)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.totalMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(item.totalMargin)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant="outline" 
                      className={item.avgRoi >= 50 
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" 
                        : item.avgRoi >= 0 
                          ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30"
                          : "bg-red-500/10 text-red-700 border-red-500/30"
                      }
                    >
                      {item.avgRoi.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drill-down by Offer Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Détail rentabilité par type d'offre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedOfferType} onValueChange={setSelectedOfferType}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Sélectionner un type d'offre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">-- Sélectionner un type --</SelectItem>
                {offerTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {filteredStats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span><strong>{filteredStats.count}</strong> campagnes</span>
                <span>•</span>
                <span className={filteredStats.totalMargin >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                  Marge: {formatCurrency(filteredStats.totalMargin)}
                </span>
                <span>•</span>
                <span>ROI: <strong>{filteredStats.avgRoi.toFixed(0)}%</strong></span>
              </div>
            )}
          </div>

          {selectedOfferType !== "all" && filteredOffers.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Produit / Titre</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                    <TableHead className="text-right">Coût</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Co-fin.</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead>Rentabilité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium">
                        <p className="truncate max-w-[180px]">{offer.product || offer.title || "N/A"}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {offer.restaurant_names?.[0] || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(offer.generated_sales)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(offer.estimated_cost)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(offer.commission)}
                      </TableCell>
                      <TableCell className="text-right text-purple-600">
                        +{formatCurrency(offer.uber_cofunding)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${offer.net_margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(offer.net_margin)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {offer.roi.toFixed(0)}%
                      </TableCell>
                      <TableCell>
                        {getProfitabilityBadge(offer)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : selectedOfferType === "all" ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sélectionnez un type d'offre pour voir le détail de rentabilité</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune campagne trouvée pour ce type d'offre</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Scatter Plot: Cost vs Net Margin */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coût vs Marge nette</CardTitle>
            <p className="text-sm text-muted-foreground">
              Taille des bulles = Nombre de commandes
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Coût" 
                  className="text-xs"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Marge" 
                  className="text-xs"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border rounded-lg p-3 shadow-lg">
                          <p className="font-medium text-sm mb-1">{data.name}</p>
                          <p className="text-xs text-muted-foreground">{data.type}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            <p>Coût: {formatCurrency(data.x)}</p>
                            <p className={data.y >= 0 ? "text-emerald-600" : "text-red-600"}>
                              Marge: {formatCurrency(data.y)}
                            </p>
                            <p>ROI: {data.roi.toFixed(0)}%</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PROFITABILITY_COLORS[entry.profitability as keyof typeof PROFITABILITY_COLORS]} 
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart: ROI by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ROI par type d'offre</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitabilityByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" tickFormatter={(v) => `${v}%`} />
                <YAxis 
                  dataKey="type" 
                  type="category" 
                  width={150} 
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(0)}%`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar 
                  dataKey="avgRoi" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name="ROI moyen"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Profitable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Top 5 - Plus rentables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProfitable.map((offer, idx) => (
                <div 
                  key={offer.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[180px]">
                        {offer.product || offer.title || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {offer.restaurant_names?.[0] || "—"} • {offer.offer_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">
                      ROI {offer.roi.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge: {formatCurrency(offer.net_margin)}
                    </p>
                  </div>
                </div>
              ))}
              {topProfitable.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Aucune offre rentable</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Profitable (to avoid) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Bottom 5 - À éviter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bottomProfitable.map((offer, idx) => (
                <div 
                  key={offer.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[180px]">
                        {offer.product || offer.title || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {offer.restaurant_names?.[0] || "—"} • {offer.offer_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${offer.roi < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      ROI {offer.roi.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge: {formatCurrency(offer.net_margin)}
                    </p>
                  </div>
                </div>
              ))}
              {bottomProfitable.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Aucune donnée</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
