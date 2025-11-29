import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ShoppingCart,
  Users,
  Percent,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
  Lightbulb,
  Target,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ReferenceLine,
} from "recharts";

const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

interface MonthlyRevenue {
  month: number;
  revenue_ttc: number;
  order_count: number;
}

interface MonthlyConversion {
  month: number;
  visits: number;
  menu_views: number;
  add_to_cart: number;
  orders: number;
}

interface MonthlyFees {
  month: number;
  uber_fee: number;
  marketing_fee: number;
  offers_cost: number;
  ads_cost: number;
  net_payout: number;
}

interface AnalyticsChartsProps {
  revenueData: MonthlyRevenue[] | undefined;
  conversionData: MonthlyConversion[] | undefined;
  feesData: MonthlyFees[] | undefined;
  prevRevenueData?: MonthlyRevenue[] | undefined;
  prevConversionData?: MonthlyConversion[] | undefined;
  prevFeesData?: MonthlyFees[] | undefined;
  startMonth?: number;
  endMonth?: number;
  selectedYear: number;
  showComparison?: boolean;
}

// Helper to calculate variation percentage
const calcVariation = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

// Component for variation indicator
function VariationIndicator({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  const variation = calcVariation(current, previous);
  
  if (variation === null) return <span className="text-xs text-muted-foreground">--</span>;
  
  const isPositive = inverse ? variation < 0 : variation > 0;
  const isNeutral = Math.abs(variation) < 0.5;
  
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isNeutral ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-red-600"}`}>
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {Math.abs(variation).toFixed(1)}%
    </span>
  );
}

export function AnalyticsCharts({
  revenueData,
  conversionData,
  feesData,
  prevRevenueData,
  prevConversionData,
  prevFeesData,
  startMonth = 1,
  endMonth = 12,
  selectedYear,
  showComparison = true,
}: AnalyticsChartsProps) {
  const prevYear = selectedYear - 1;
  
  // Objectif de conversion configurable (persisté dans localStorage)
  const [conversionTarget, setConversionTarget] = useState<number>(() => {
    const saved = localStorage.getItem('conversionTarget');
    return saved ? Number(saved) : 5;
  });

  useEffect(() => {
    localStorage.setItem('conversionTarget', String(conversionTarget));
  }, [conversionTarget]);
  
  // Filter months for range
  const filterByRange = (monthNum: number) => {
    return monthNum >= startMonth && monthNum <= endMonth;
  };

  // Aggregate revenue data
  const aggregatedRevenueData = useMemo(() => {
    if (!revenueData) return [];
    
    const monthlyData: { [key: number]: { revenue: number; orders: number } } = {};
    const prevMonthlyData: { [key: number]: { revenue: number; orders: number } } = {};
    
    revenueData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { revenue: 0, orders: 0 };
      }
      monthlyData[item.month].revenue += Number(item.revenue_ttc) || 0;
      monthlyData[item.month].orders += item.order_count || 0;
    });

    prevRevenueData?.forEach((item) => {
      if (!prevMonthlyData[item.month]) {
        prevMonthlyData[item.month] = { revenue: 0, orders: 0 };
      }
      prevMonthlyData[item.month].revenue += Number(item.revenue_ttc) || 0;
      prevMonthlyData[item.month].orders += item.order_count || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      monthNum: i + 1,
      revenue: monthlyData[i + 1]?.revenue || 0,
      orders: monthlyData[i + 1]?.orders || 0,
      avgBasket: monthlyData[i + 1]?.orders > 0 
        ? monthlyData[i + 1].revenue / monthlyData[i + 1].orders 
        : 0,
      prevRevenue: prevMonthlyData[i + 1]?.revenue || 0,
      prevOrders: prevMonthlyData[i + 1]?.orders || 0,
    })).filter(d => filterByRange(d.monthNum));
  }, [revenueData, prevRevenueData, startMonth, endMonth]);

  // Aggregate conversion data
  const aggregatedConversionData = useMemo(() => {
    if (!conversionData) return [];
    
    const monthlyData: { [key: number]: { visits: number; views: number; cart: number; orders: number } } = {};
    const prevMonthlyData: { [key: number]: { visits: number; views: number; cart: number; orders: number } } = {};
    
    conversionData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { visits: 0, views: 0, cart: 0, orders: 0 };
      }
      monthlyData[item.month].visits += item.visits || 0;
      monthlyData[item.month].views += item.menu_views || 0;
      monthlyData[item.month].cart += item.add_to_cart || 0;
      monthlyData[item.month].orders += item.orders || 0;
    });

    prevConversionData?.forEach((item) => {
      if (!prevMonthlyData[item.month]) {
        prevMonthlyData[item.month] = { visits: 0, views: 0, cart: 0, orders: 0 };
      }
      prevMonthlyData[item.month].visits += item.visits || 0;
      prevMonthlyData[item.month].views += item.menu_views || 0;
      prevMonthlyData[item.month].cart += item.add_to_cart || 0;
      prevMonthlyData[item.month].orders += item.orders || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => {
      const data = monthlyData[i + 1];
      const prevData = prevMonthlyData[i + 1];
      return {
        month: MONTHS[i],
        monthNum: i + 1,
        visits: data?.visits || 0,
        views: data?.views || 0,
        cart: data?.cart || 0,
        orders: data?.orders || 0,
        conversionRate: data?.visits > 0 ? ((data.orders / data.visits) * 100) : 0,
        prevVisits: prevData?.visits || 0,
        prevConversionRate: prevData?.visits > 0 ? ((prevData.orders / prevData.visits) * 100) : 0,
      };
    }).filter(d => filterByRange(d.monthNum));
  }, [conversionData, prevConversionData, startMonth, endMonth]);

  // Aggregate fees data
  const aggregatedFeesData = useMemo(() => {
    if (!feesData) return [];
    
    const monthlyData: { [key: number]: { uber: number; marketing: number; offers: number; ads: number; net: number } } = {};
    const prevMonthlyData: { [key: number]: { uber: number; marketing: number; offers: number; ads: number; net: number } } = {};
    
    feesData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { uber: 0, marketing: 0, offers: 0, ads: 0, net: 0 };
      }
      monthlyData[item.month].uber += Number(item.uber_fee) || 0;
      monthlyData[item.month].marketing += Number(item.marketing_fee) || 0;
      monthlyData[item.month].offers += Number(item.offers_cost) || 0;
      monthlyData[item.month].ads += Number(item.ads_cost) || 0;
      monthlyData[item.month].net += Number(item.net_payout) || 0;
    });

    prevFeesData?.forEach((item) => {
      if (!prevMonthlyData[item.month]) {
        prevMonthlyData[item.month] = { uber: 0, marketing: 0, offers: 0, ads: 0, net: 0 };
      }
      prevMonthlyData[item.month].uber += Number(item.uber_fee) || 0;
      prevMonthlyData[item.month].marketing += Number(item.marketing_fee) || 0;
      prevMonthlyData[item.month].offers += Number(item.offers_cost) || 0;
      prevMonthlyData[item.month].ads += Number(item.ads_cost) || 0;
      prevMonthlyData[item.month].net += Number(item.net_payout) || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      monthNum: i + 1,
      uber: monthlyData[i + 1]?.uber || 0,
      marketing: monthlyData[i + 1]?.marketing || 0,
      offers: monthlyData[i + 1]?.offers || 0,
      ads: monthlyData[i + 1]?.ads || 0,
      net: monthlyData[i + 1]?.net || 0,
      totalFees: (monthlyData[i + 1]?.uber || 0) + 
                 (monthlyData[i + 1]?.marketing || 0) + 
                 (monthlyData[i + 1]?.offers || 0) + 
                 (monthlyData[i + 1]?.ads || 0),
      prevNet: prevMonthlyData[i + 1]?.net || 0,
      prevTotalFees: (prevMonthlyData[i + 1]?.uber || 0) + 
                     (prevMonthlyData[i + 1]?.marketing || 0) + 
                     (prevMonthlyData[i + 1]?.offers || 0) + 
                     (prevMonthlyData[i + 1]?.ads || 0),
    })).filter(d => filterByRange(d.monthNum));
  }, [feesData, prevFeesData, startMonth, endMonth]);

  // Profitability data
  const profitabilityData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const revenueMonth = aggregatedRevenueData.find(r => r.monthNum === monthNum);
      const feesMonth = aggregatedFeesData.find(f => f.monthNum === monthNum);
      
      const revenue = revenueMonth?.revenue || 0;
      const netPayout = feesMonth?.net || 0;
      const profitability = revenue > 0 ? (netPayout / revenue) * 100 : 0;

      const prevRevenue = revenueMonth?.prevRevenue || 0;
      const prevNet = feesMonth?.prevNet || 0;
      const prevProfitability = prevRevenue > 0 ? (prevNet / prevRevenue) * 100 : 0;
      
      return {
        month: MONTHS[i],
        monthNum,
        revenue,
        netPayout,
        profitability,
        prevProfitability,
      };
    }).filter(d => filterByRange(d.monthNum));
  }, [aggregatedRevenueData, aggregatedFeesData, startMonth, endMonth]);

  // Dynamic Y-axis domain for conversion rate chart (inclut l'objectif)
  const conversionYDomain = useMemo(() => {
    const rates = aggregatedConversionData
      .map(d => [d.conversionRate, d.prevConversionRate])
      .flat()
      .filter(r => r > 0);
    
    // Inclure l'objectif dans le calcul du domain
    rates.push(conversionTarget);
    
    if (rates.length === 0) return [0, 10];
    
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const padding = (max - min) * 0.3 || 1; // 30% de marge, minimum 1
    
    return [
      Math.max(0, Math.floor(min - padding)),
      Math.ceil(max + padding)
    ];
  }, [aggregatedConversionData, conversionTarget]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = aggregatedRevenueData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = aggregatedRevenueData.reduce((sum, d) => sum + d.orders, 0);
    const totalVisits = aggregatedConversionData.reduce((sum, d) => sum + d.visits, 0);
    const totalConvOrders = aggregatedConversionData.reduce((sum, d) => sum + d.orders, 0);
    const totalFees = aggregatedFeesData.reduce((sum, d) => sum + d.totalFees, 0);
    const totalNet = aggregatedFeesData.reduce((sum, d) => sum + d.net, 0);
    const profitability = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

    // Previous year totals
    const prevTotalRevenue = aggregatedRevenueData.reduce((sum, d) => sum + d.prevRevenue, 0);
    const prevTotalOrders = aggregatedRevenueData.reduce((sum, d) => sum + d.prevOrders, 0);
    const prevTotalVisits = aggregatedConversionData.reduce((sum, d) => sum + d.prevVisits, 0);
    const prevTotalFees = aggregatedFeesData.reduce((sum, d) => sum + d.prevTotalFees, 0);
    const prevTotalNet = aggregatedFeesData.reduce((sum, d) => sum + d.prevNet, 0);
    const prevProfitability = prevTotalRevenue > 0 ? (prevTotalNet / prevTotalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      avgBasket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      conversionRate: totalVisits > 0 ? (totalConvOrders / totalVisits) * 100 : 0,
      totalFees,
      totalNet,
      feePercentage: totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0,
      profitability,
      // Previous year
      prevTotalRevenue,
      prevTotalOrders,
      prevAvgBasket: prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0,
      prevConversionRate: prevTotalVisits > 0 ? (aggregatedConversionData.reduce((sum, d) => sum + (d.prevVisits > 0 ? d.orders : 0), 0) / prevTotalVisits) * 100 : 0,
      prevTotalFees,
      prevProfitability,
    };
  }, [aggregatedRevenueData, aggregatedConversionData, aggregatedFeesData]);

  const hasData = aggregatedRevenueData.some(d => d.revenue > 0) || 
                  aggregatedConversionData.some(d => d.visits > 0) || 
                  aggregatedFeesData.some(d => d.totalFees > 0);

  const hasPrevData = showComparison && (
    aggregatedRevenueData.some(d => d.prevRevenue > 0) || 
    aggregatedFeesData.some(d => d.prevTotalFees > 0)
  );

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-lg">
            Aucune donnée disponible pour cette période
          </p>
          <p className="text-muted-foreground mt-2">
            Commencez par saisir vos données dans les pages de saisie
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">CA Total</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.totalRevenue} previous={kpis.prevTotalRevenue} />}
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.totalRevenue.toLocaleString("fr-FR")} €
            </p>
            {hasPrevData && (
              <p className="text-xs text-muted-foreground">
                {prevYear}: {kpis.prevTotalRevenue.toLocaleString("fr-FR")} €
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Commandes</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.totalOrders} previous={kpis.prevTotalOrders} />}
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.totalOrders.toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-muted-foreground">
              Panier moy. {kpis.avgBasket.toFixed(2)} €
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Taux Conv.</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.conversionRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">Frais Totaux</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.totalFees} previous={kpis.prevTotalFees} inverse />}
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.totalFees.toLocaleString("fr-FR")} €
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.feePercentage.toFixed(1)}% du CA
            </p>
          </CardContent>
        </Card>

        <Card className={kpis.profitability > 60 ? "border-green-500/50" : kpis.profitability > 40 ? "border-amber-500/50" : "border-destructive/50"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${kpis.profitability > 60 ? "text-green-500" : kpis.profitability > 40 ? "text-amber-500" : "text-destructive"}`} />
                <span className="text-sm text-muted-foreground">% Rentabilité</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.profitability} previous={kpis.prevProfitability} />}
            </div>
            <p className={`text-2xl font-bold mt-2 ${kpis.profitability > 60 ? "text-green-500" : kpis.profitability > 40 ? "text-amber-500" : "text-destructive"}`}>
              {kpis.profitability.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Versement / CA
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart with N-1 comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Évolution du Chiffre d'Affaires
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregatedRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes('€')) return [value.toLocaleString('fr-FR') + ' €', name];
                    return [value.toLocaleString('fr-FR'), name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name={`CA ${selectedYear} (€)`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                {hasPrevData && (
                  <Bar yAxisId="left" dataKey="prevRevenue" name={`CA ${prevYear} (€)`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                )}
                <Line yAxisId="right" type="monotone" dataKey="orders" name="Commandes" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: 'hsl(var(--chart-2))' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Funnel de Conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregatedConversionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [value.toLocaleString('fr-FR'), '']}
                />
                <Legend />
                <Area type="monotone" dataKey="visits" name="Visites" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="views" name="Vues menu" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="cart" name="Ajouts panier" stackId="3" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="orders" name="Commandes" stackId="4" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rate Chart with N-1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Taux de Conversion Global
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Section explicative */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm mb-1">Comment c'est calculé ?</p>
                <p className="text-muted-foreground text-sm">
                  <code className="bg-background px-2 py-0.5 rounded text-xs font-mono">
                    Taux = (Commandes ÷ Visites) × 100
                  </code>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm mb-1">Ce que ça révèle</p>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>• Plus le taux est élevé, mieux votre page convertit les visiteurs en clients</li>
                  <li>• Un taux faible peut indiquer : photos peu attrayantes, prix mal positionnés, ou menu confus</li>
                  <li>• <span className="text-green-600 dark:text-green-400 font-medium">Benchmark : 5-10% = correct, &gt;10% = excellent</span></li>
                </ul>
              </div>
            </div>
            {/* Input pour définir l'objectif */}
            <div className="flex items-center gap-3 pt-3 border-t border-border/50">
              <Target className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Mon objectif :</span>
                <Input
                  type="number"
                  value={conversionTarget}
                  onChange={(e) => setConversionTarget(Number(e.target.value) || 0)}
                  className="w-20 h-8 text-center"
                  min={0}
                  max={100}
                  step={0.5}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                Les mois en dessous seront en rouge
              </span>
            </div>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregatedConversionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" domain={conversionYDomain} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload;
                    const variation = data?.prevConversionRate > 0 
                      ? ((data.conversionRate - data.prevConversionRate) / data.prevConversionRate * 100)
                      : null;
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium mb-2">{label}</p>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">Taux {selectedYear} :</span>{" "}
                            <span className="font-medium">{data?.conversionRate?.toFixed(2)}%</span>
                          </p>
                          {hasPrevData && data?.prevConversionRate > 0 && (
                            <p>
                              <span className="text-muted-foreground">Taux {prevYear} :</span>{" "}
                              <span className="font-medium">{data?.prevConversionRate?.toFixed(2)}%</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-1">
                            {data?.visits?.toLocaleString('fr-FR')} visites → {data?.orders?.toLocaleString('fr-FR')} commandes
                          </p>
                          {variation !== null && (
                            <p className={`text-xs font-medium ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variation >= 0 ? '↑' : '↓'} {Math.abs(variation).toFixed(1)}% vs {prevYear}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                {/* Ligne de référence pour l'objectif */}
                <ReferenceLine 
                  y={conversionTarget} 
                  stroke="#22c55e" 
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{ 
                    value: `Objectif ${conversionTarget}%`, 
                    position: 'right', 
                    fill: '#22c55e',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="conversionRate" 
                  name={`Taux ${selectedYear}`}
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={({ cx, cy, payload }: { cx: number; cy: number; payload: { conversionRate: number } }) => {
                    const isBelow = payload.conversionRate > 0 && payload.conversionRate < conversionTarget;
                    return (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={6} 
                        fill={isBelow ? '#ef4444' : 'hsl(var(--primary))'} 
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 8, strokeWidth: 2 }}
                />
                {hasPrevData && (
                  <Line 
                    type="monotone" 
                    dataKey="prevConversionRate" 
                    name={`Taux ${prevYear}`}
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 1, r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fees Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Répartition des Frais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregatedFeesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value.toLocaleString('fr-FR') + ' €', name]}
                />
                <Legend />
                <Bar dataKey="uber" name="Commission" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="marketing" name="Marketing" stackId="a" fill="hsl(var(--chart-2))" />
                <Bar dataKey="offers" name="Offres" stackId="a" fill="hsl(var(--chart-3))" />
                <Bar dataKey="ads" name="Publicité" stackId="a" fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Net Payout Chart with N-1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Versement Net vs Frais Totaux
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregatedFeesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value.toLocaleString('fr-FR') + ' €', name]}
                />
                <Legend />
                <Bar dataKey="net" name={`Versement ${selectedYear}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                {hasPrevData && (
                  <Bar dataKey="prevNet" name={`Versement ${prevYear}`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                )}
                <Line type="monotone" dataKey="totalFees" name="Total Frais" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Profitability Rate Chart with N-1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Taux de Rentabilité
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={profitabilityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" unit="%" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes('Rentabilité')) return [value.toFixed(1) + '%', name];
                    return [value.toLocaleString('fr-FR') + ' €', name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="CA TTC" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} opacity={0.5} />
                <Bar yAxisId="left" dataKey="netPayout" name="Versement Net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="profitability" 
                  name={`Rentabilité ${selectedYear}`}
                  stroke="hsl(142.1 76.2% 36.3%)" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(142.1 76.2% 36.3%)', strokeWidth: 2, r: 4 }}
                />
                {hasPrevData && (
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="prevProfitability" 
                    name={`Rentabilité ${prevYear}`}
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 1, r: 3 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
