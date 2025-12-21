import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { useOpeningHours } from "@/hooks/useOpeningHours";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface OpeningHoursAnalyticsProps {
  restaurantId: string;
  restaurantName: string;
}

export function OpeningHoursAnalytics({ restaurantId, restaurantName }: OpeningHoursAnalyticsProps) {
  // Fetch opening hours for both platforms
  const { openingHours: uberHours, calculateTotalHours: calcUberHours } = useOpeningHours(restaurantId, "uber_eats");
  const { openingHours: deliverooHours, calculateTotalHours: calcDeliverooHours } = useOpeningHours(restaurantId, "deliveroo");

  const totalUberHours = useMemo(() => calcUberHours(uberHours || []), [uberHours, calcUberHours]);
  const totalDeliverooHours = useMemo(() => calcDeliverooHours(deliverooHours || []), [deliverooHours, calcDeliverooHours]);
  const totalHoursPerWeek = Math.max(totalUberHours, totalDeliverooHours);

  // Fetch last month's revenue data
  const lastMonth = subMonths(new Date(), 1);
  const { data: revenueData } = useQuery({
    queryKey: ["opening-hours-analytics-revenue", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_revenue")
        .select("revenue_ttc, order_count, platform")
        .eq("restaurant_id", restaurantId)
        .eq("year", lastMonth.getFullYear())
        .eq("month", lastMonth.getMonth() + 1);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch network average hours
  const { data: networkHours } = useQuery({
    queryKey: ["network-opening-hours-avg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_opening_hours")
        .select("restaurant_id, start_time, end_time, is_overnight");
      
      if (error) throw error;
      
      // Group by restaurant and calculate total per restaurant
      const restaurantTotals: Record<string, number> = {};
      (data || []).forEach((slot: any) => {
        const [startH, startM] = slot.start_time.split(':').map(Number);
        const [endH, endM] = slot.end_time.split(':').map(Number);
        let hours = (endH + endM/60) - (startH + startM/60);
        if (slot.is_overnight || hours < 0) {
          hours = 24 - (startH + startM/60) + (endH + endM/60);
        }
        
        if (!restaurantTotals[slot.restaurant_id]) {
          restaurantTotals[slot.restaurant_id] = 0;
        }
        restaurantTotals[slot.restaurant_id] += hours;
      });
      
      const totals = Object.values(restaurantTotals);
      const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
      return { average: avg, count: totals.length };
    },
  });

  // Calculate KPIs
  const analytics = useMemo(() => {
    const totalRevenue = (revenueData || []).reduce((sum, r) => sum + (r.revenue_ttc || 0), 0);
    const totalOrders = (revenueData || []).reduce((sum, r) => sum + (r.order_count || 0), 0);
    
    // Weeks in a month ≈ 4.3
    const hoursPerMonth = totalHoursPerWeek * 4.3;
    const revenuePerHour = hoursPerMonth > 0 ? totalRevenue / hoursPerMonth : 0;
    const ordersPerHour = hoursPerMonth > 0 ? totalOrders / hoursPerMonth : 0;
    
    const networkAvg = networkHours?.average || 0;
    const vsNetwork = networkAvg > 0 ? ((totalHoursPerWeek - networkAvg) / networkAvg) * 100 : 0;
    
    return {
      totalHoursPerWeek,
      revenuePerHour,
      ordersPerHour,
      totalRevenue,
      totalOrders,
      vsNetwork,
      networkAvg,
    };
  }, [revenueData, totalHoursPerWeek, networkHours]);

  // Check for missing days
  const missingDays = useMemo(() => {
    const uberDays = new Set((uberHours || []).map(h => h.day_of_week));
    const deliverooDays = new Set((deliverooHours || []).map(h => h.day_of_week));
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    
    return allDays
      .filter(day => !uberDays.has(day) && !deliverooDays.has(day))
      .map(day => dayNames[day]);
  }, [uberHours, deliverooHours]);

  const periodLabel = format(lastMonth, "MMMM yyyy", { locale: fr });

  if (totalHoursPerWeek === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Analyse des horaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aucun horaire d'ouverture configuré. Configurez les horaires ci-dessous pour voir les analyses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Analyse des horaires
          <Badge variant="secondary" className="ml-auto font-normal">
            {periodLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Heures/semaine</p>
            <p className="text-2xl font-bold">{analytics.totalHoursPerWeek.toFixed(0)}h</p>
            {analytics.vsNetwork !== 0 && (
              <p className={`text-xs ${analytics.vsNetwork >= 0 ? "text-green-600" : "text-red-600"}`}>
                {analytics.vsNetwork >= 0 ? "+" : ""}{analytics.vsNetwork.toFixed(0)}% vs réseau
              </p>
            )}
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">CA/h d'ouverture</p>
            <p className="text-2xl font-bold">{analytics.revenuePerHour.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">
              {analytics.revenuePerHour >= 30 ? "Excellent" : analytics.revenuePerHour >= 15 ? "Correct" : "Faible"}
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Commandes/h</p>
            <p className="text-2xl font-bold">{analytics.ordersPerHour.toFixed(1)}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">CA total mois</p>
            <p className="text-2xl font-bold">{analytics.totalRevenue.toLocaleString('fr-FR')}€</p>
            <p className="text-xs text-muted-foreground">{analytics.totalOrders} commandes</p>
          </div>
        </div>

        {/* Platform comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border border-uber/30 bg-uber/5">
            <p className="text-xs text-muted-foreground">Uber Eats</p>
            <p className="text-xl font-bold">{totalUberHours.toFixed(0)}h/sem</p>
          </div>
          <div className="p-3 rounded-lg border border-deliveroo/30 bg-deliveroo/5">
            <p className="text-xs text-muted-foreground">Deliveroo</p>
            <p className="text-xl font-bold">{totalDeliverooHours.toFixed(0)}h/sem</p>
          </div>
        </div>

        {/* Alerts */}
        {missingDays.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Jours non couverts
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {missingDays.join(", ")} - potentiel de CA inexploité
              </p>
            </div>
          </div>
        )}

        {analytics.revenuePerHour >= 30 && analytics.totalHoursPerWeek < 70 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Potentiel d'extension
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                CA/h élevé ({analytics.revenuePerHour.toFixed(0)}€/h) - envisagez d'étendre les horaires
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
