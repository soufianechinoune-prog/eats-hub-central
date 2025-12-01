import { useState, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Euro, Users, Percent, Trophy, TrendingUp, TrendingDown, Minus, Calculator, FileDown, Loader2 } from "lucide-react";
import { RankingDistributionChart } from "@/components/analytics/RankingDistributionChart";
import { RankingTable } from "@/components/analytics/RankingTable";
import { RestaurantComparisonPanel } from "@/components/analytics/RestaurantComparisonPanel";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type MetricType = "revenue" | "conversion" | "profitability";

interface RankedRestaurant {
  id: string;
  name: string;
  city: string;
  value: number;
  prevValue: number;
  trend: number | null;
  rank: number;
}

const METRIC_CONFIG: Record<MetricType, { 
  title: string; 
  icon: typeof Euro; 
  colorClass: string;
  formatValue: (v: number) => string;
  label: string;
}> = {
  revenue: {
    title: "Chiffre d'affaires",
    icon: Euro,
    colorClass: "text-emerald-500",
    formatValue: (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v),
    label: "CA (€)",
  },
  conversion: {
    title: "Taux de conversion",
    icon: Users,
    colorClass: "text-blue-500",
    formatValue: (v) => `${v.toFixed(1)}%`,
    label: "Taux (%)",
  },
  profitability: {
    title: "Rentabilité",
    icon: Percent,
    colorClass: "text-violet-500",
    formatValue: (v) => `${v.toFixed(1)}%`,
    label: "Rentabilité (%)",
  },
};

const currentYear = new Date().getFullYear();

const calcTrend = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

export default function RankingDetail() {
  const { metric } = useParams<{ metric: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const metricType = (metric as MetricType) || "revenue";
  const config = METRIC_CONFIG[metricType] || METRIC_CONFIG.revenue;
  const Icon = config.icon;

  // Get filters from URL
  const platformParam = searchParams.get("platform") || "uber_eats";
  const yearParam = parseInt(searchParams.get("year") || String(currentYear));
  const startMonthParam = parseInt(searchParams.get("startMonth") || "1");
  const endMonthParam = parseInt(searchParams.get("endMonth") || "12");

  const [selectedPlatform, setSelectedPlatform] = useState(platformParam);
  const [selectedYear, setSelectedYear] = useState(yearParam);
  const [startMonth, setStartMonth] = useState(startMonthParam);
  const [endMonth, setEndMonth] = useState(endMonthParam);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  const prevYear = selectedYear - 1;

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch revenue data
  const { data: revenueData } = useQuery({
    queryKey: ["ranking_revenue", selectedPlatform, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", selectedYear)
        .order("month");
      
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: prevRevenueData } = useQuery({
    queryKey: ["ranking_revenue_prev", selectedPlatform, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", prevYear)
        .order("month");
      
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch conversion data
  const { data: conversionData } = useQuery({
    queryKey: ["ranking_conversion", selectedPlatform, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", selectedYear)
        .order("month");
      
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: prevConversionData } = useQuery({
    queryKey: ["ranking_conversion_prev", selectedPlatform, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", prevYear)
        .order("month");
      
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch fees data
  const { data: feesData } = useQuery({
    queryKey: ["ranking_fees", selectedPlatform, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .order("month");
      
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: prevFeesData } = useQuery({
    queryKey: ["ranking_fees_prev", selectedPlatform, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .order("month");
      
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate ranking based on metric type
  const ranking = useMemo((): RankedRestaurant[] => {
    if (!restaurants) return [];

    if (metricType === "revenue") {
      if (!revenueData) return [];
      
      const aggregated = new Map<string, { current: number; prev: number }>();
      
      revenueData
        .filter(r => r.month >= startMonth && r.month <= endMonth)
        .forEach(r => {
          const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
          existing.current += Number(r.revenue_ttc) || 0;
          aggregated.set(r.restaurant_id, existing);
        });

      prevRevenueData
        ?.filter(r => r.month >= startMonth && r.month <= endMonth)
        .forEach(r => {
          const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
          existing.prev += Number(r.revenue_ttc) || 0;
          aggregated.set(r.restaurant_id, existing);
        });

      return Array.from(aggregated.entries())
        .map(([id, { current, prev }]) => {
          const restaurant = restaurants.find(r => r.id === id);
          return {
            id,
            name: restaurant?.name || "Inconnu",
            city: restaurant?.city || "",
            value: current,
            prevValue: prev,
            trend: calcTrend(current, prev),
            rank: 0,
          };
        })
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    }

    if (metricType === "conversion") {
      if (!conversionData) return [];
      
      const aggregated = new Map<string, { currentVisits: number; currentOrders: number; prevVisits: number; prevOrders: number }>();
      
      conversionData
        .filter(r => r.month >= startMonth && r.month <= endMonth)
        .forEach(r => {
          const existing = aggregated.get(r.restaurant_id) || { currentVisits: 0, currentOrders: 0, prevVisits: 0, prevOrders: 0 };
          existing.currentVisits += Number(r.visits) || 0;
          existing.currentOrders += Number(r.orders) || 0;
          aggregated.set(r.restaurant_id, existing);
        });

      prevConversionData
        ?.filter(r => r.month >= startMonth && r.month <= endMonth)
        .forEach(r => {
          const existing = aggregated.get(r.restaurant_id) || { currentVisits: 0, currentOrders: 0, prevVisits: 0, prevOrders: 0 };
          existing.prevVisits += Number(r.visits) || 0;
          existing.prevOrders += Number(r.orders) || 0;
          aggregated.set(r.restaurant_id, existing);
        });

      return Array.from(aggregated.entries())
        .map(([id, data]) => {
          const restaurant = restaurants.find(r => r.id === id);
          const currentRate = data.currentVisits > 0 ? (data.currentOrders / data.currentVisits) * 100 : 0;
          const prevRate = data.prevVisits > 0 ? (data.prevOrders / data.prevVisits) * 100 : 0;
          
          return {
            id,
            name: restaurant?.name || "Inconnu",
            city: restaurant?.city || "",
            value: currentRate,
            prevValue: prevRate,
            trend: calcTrend(currentRate, prevRate),
            rank: 0,
          };
        })
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Profitability
    if (!revenueData || !feesData) return [];
    
    const aggregated = new Map<string, { currentRevenue: number; currentPayout: number; prevRevenue: number; prevPayout: number }>();
    
    revenueData
      .filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.currentRevenue += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    feesData
      .filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.currentPayout += Number(r.net_payout) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    prevRevenueData
      ?.filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.prevRevenue += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    prevFeesData
      ?.filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.prevPayout += Number(r.net_payout) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    return Array.from(aggregated.entries())
      .map(([id, data]) => {
        const restaurant = restaurants.find(r => r.id === id);
        const currentProfit = data.currentRevenue > 0 ? (data.currentPayout / data.currentRevenue) * 100 : 0;
        const prevProfit = data.prevRevenue > 0 ? (data.prevPayout / data.prevRevenue) * 100 : 0;
        
        return {
          id,
          name: restaurant?.name || "Inconnu",
          city: restaurant?.city || "",
          value: currentProfit,
          prevValue: prevProfit,
          trend: calcTrend(currentProfit, prevProfit),
          rank: 0,
        };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [metricType, restaurants, revenueData, prevRevenueData, conversionData, prevConversionData, feesData, prevFeesData, startMonth, endMonth]);

  // Calculate monthly data for comparison chart
  const monthlyChartData = useMemo(() => {
    if (metricType === "revenue" && revenueData) {
      return revenueData
        .filter(r => r.month >= startMonth && r.month <= endMonth)
        .map(r => ({
          restaurant_id: r.restaurant_id,
          month: r.month,
          value: Number(r.revenue_ttc) || 0,
        }));
    }
    
    if (metricType === "conversion" && conversionData) {
      return conversionData
        .filter(r => r.month >= startMonth && r.month <= endMonth)
        .map(r => ({
          restaurant_id: r.restaurant_id,
          month: r.month,
          value: Number(r.visits) > 0 ? (Number(r.orders) / Number(r.visits)) * 100 : 0,
        }));
    }
    
    if (metricType === "profitability" && revenueData && feesData) {
      const revenueByMonth = new Map<string, number>();
      const payoutByMonth = new Map<string, number>();
      
      revenueData
        .filter(r => r.month >= startMonth && r.month <= endMonth)
        .forEach(r => {
          const key = `${r.restaurant_id}-${r.month}`;
          revenueByMonth.set(key, Number(r.revenue_ttc) || 0);
        });
      
      feesData
        .filter(r => r.month >= startMonth && r.month <= endMonth)
        .forEach(r => {
          const key = `${r.restaurant_id}-${r.month}`;
          payoutByMonth.set(key, Number(r.net_payout) || 0);
        });
      
      const result: { restaurant_id: string; month: number; value: number }[] = [];
      revenueByMonth.forEach((revenue, key) => {
        const [restaurantId, monthStr] = key.split("-");
        const month = parseInt(monthStr);
        const payout = payoutByMonth.get(key) || 0;
        const profitability = revenue > 0 ? (payout / revenue) * 100 : 0;
        result.push({ restaurant_id: restaurantId, month, value: profitability });
      });
      
      return result;
    }
    
    return [];
  }, [metricType, revenueData, conversionData, feesData, startMonth, endMonth]);

  // Selected restaurants for comparison
  const selectedRestaurants = useMemo(() => {
    return ranking.filter(r => comparisonIds.includes(r.id));
  }, [ranking, comparisonIds]);

  // Comparison handlers
  const handleToggleComparison = useCallback((restaurant: typeof ranking[0]) => {
    setComparisonIds(prev => {
      if (prev.includes(restaurant.id)) {
        return prev.filter(id => id !== restaurant.id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, restaurant.id];
    });
  }, []);

  const handleRemoveFromComparison = useCallback((id: string) => {
    setComparisonIds(prev => prev.filter(i => i !== id));
  }, []);

  const handleClearComparison = useCallback(() => {
    setComparisonIds([]);
  }, []);


  // KPI calculations
  const kpis = useMemo(() => {
    if (ranking.length === 0) return { total: 0, average: 0, median: 0, stdDev: 0 };
    
    const values = ranking.map(r => r.value);
    const total = values.reduce((sum, v) => sum + v, 0);
    const average = total / values.length;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    
    const squaredDiffs = values.map(v => Math.pow(v - average, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    return { total, average, median, stdDev };
  }, [ranking]);

  const prevKpis = useMemo(() => {
    if (ranking.length === 0) return { total: 0, average: 0 };
    const prevValues = ranking.map(r => r.prevValue).filter(v => v > 0);
    if (prevValues.length === 0) return { total: 0, average: 0 };
    const total = prevValues.reduce((sum, v) => sum + v, 0);
    return { total, average: total / prevValues.length };
  }, [ranking]);

  const MONTHS = [
    { value: 1, label: "Janvier" },
    { value: 2, label: "Février" },
    { value: 3, label: "Mars" },
    { value: 4, label: "Avril" },
    { value: 5, label: "Mai" },
    { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" },
    { value: 8, label: "Août" },
    { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" },
    { value: 11, label: "Novembre" },
    { value: 12, label: "Décembre" },
  ];

  const totalTrend = prevKpis.total > 0 ? calcTrend(kpis.total, prevKpis.total) : null;
  const avgTrend = prevKpis.average > 0 ? calcTrend(kpis.average, prevKpis.average) : null;

  // PDF Export
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const getPlatformLabel = (platform: string) => {
    if (platform === "uber_eats") return "Uber Eats";
    if (platform === "deliveroo") return "Deliveroo";
    return "Global";
  };

  const getMonthLabel = (month: number) => MONTHS.find(m => m.value === month)?.label || "";

  const exportToPdf = useCallback(async () => {
    if (!contentRef.current) return;

    setIsExporting(true);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pageWidth, 25, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Classement - ${config.title}`, margin, 12);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${ranking.length} restaurants classés`, margin, 19);

      pdf.text(getPlatformLabel(selectedPlatform), pageWidth - margin - pdf.getTextWidth(getPlatformLabel(selectedPlatform)), 12);

      // Meta info
      pdf.setFillColor(249, 250, 251);
      pdf.rect(0, 25, pageWidth, 12, "F");
      
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      const periodText = `Période: ${getMonthLabel(startMonth)} - ${getMonthLabel(endMonth)} ${selectedYear}`;
      pdf.text(periodText, margin, 32);
      
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      pdf.text(`Généré le ${dateStr}`, pageWidth - margin - pdf.getTextWidth(`Généré le ${dateStr}`), 32);

      // Content
      const contentY = 42;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - contentY - margin - 10;
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      const xOffset = margin + (contentWidth - scaledWidth) / 2;
      
      pdf.addImage(imgData, "PNG", xOffset, contentY, scaledWidth, scaledHeight);

      // Footer
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
      
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("CS Delivery Performance - Classement", margin, pageHeight - 4);
      pdf.text("Page 1/1", pageWidth - margin - pdf.getTextWidth("Page 1/1"), pageHeight - 4);

      const filename = `classement_${metricType}_${selectedPlatform}_${selectedYear}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, [config.title, ranking.length, selectedPlatform, startMonth, endMonth, selectedYear, metricType]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(`/analytics?platform=${selectedPlatform}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Icon className={`h-6 w-6 ${config.colorClass}`} />
              <h1 className="text-2xl font-bold">{config.title}</h1>
              <Badge variant="outline" className="ml-2">
                {ranking.length} restaurants
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Classement détaillé et évolution
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={exportToPdf}
            disabled={isExporting || ranking.length === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Plateforme</label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uber_eats">Uber Eats</SelectItem>
                    <SelectItem value="deliveroo">Deliveroo</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Année</label>
                <Select 
                  value={String(selectedYear)} 
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1, currentYear - 2].map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Select 
                  value={String(startMonth)} 
                  onValueChange={(v) => setStartMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">À</label>
                <Select 
                  value={String(endMonth)} 
                  onValueChange={(v) => setEndMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.filter(m => m.value >= startMonth).map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Metric switcher */}
              <div className="flex flex-col gap-1 ml-auto">
                <label className="text-xs text-muted-foreground">Métrique</label>
                <Select value={metricType} onValueChange={(v) => navigate(`/analytics/ranking/${v}?platform=${selectedPlatform}&year=${selectedYear}&startMonth=${startMonth}&endMonth=${endMonth}`)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Chiffre d'affaires</SelectItem>
                    <SelectItem value="conversion">Taux de conversion</SelectItem>
                    <SelectItem value="profitability">Rentabilité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Calculator className="h-4 w-4" />
                Total
              </div>
              <p className="text-2xl font-bold">{config.formatValue(kpis.total)}</p>
              {totalTrend !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${totalTrend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totalTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {totalTrend >= 0 ? "+" : ""}{totalTrend.toFixed(1)}% vs N-1
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Minus className="h-4 w-4" />
                Moyenne
              </div>
              <p className="text-2xl font-bold">{config.formatValue(kpis.average)}</p>
              {avgTrend !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${avgTrend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {avgTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {avgTrend >= 0 ? "+" : ""}{avgTrend.toFixed(1)}% vs N-1
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Trophy className="h-4 w-4" />
                Médiane
              </div>
              <p className="text-2xl font-bold">{config.formatValue(kpis.median)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Écart-type
              </div>
              <p className="text-2xl font-bold">{config.formatValue(kpis.stdDev)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Panel */}
        {selectedRestaurants.length > 0 && (
          <RestaurantComparisonPanel
            selectedRestaurants={selectedRestaurants}
            onRemove={handleRemoveFromComparison}
            onClear={handleClearComparison}
            monthlyData={monthlyChartData}
            metricLabel={config.label}
            formatValue={config.formatValue}
          />
        )}

        {/* Exportable content */}
        <div ref={contentRef} className="space-y-6">
          {/* Distribution Chart */}
          <RankingDistributionChart
            ranking={ranking}
            metricLabel={config.label}
            formatValue={config.formatValue}
            colorClass={config.colorClass}
          />

          {/* Full Table */}
          <RankingTable
            ranking={ranking}
            metricLabel={config.label}
            formatValue={config.formatValue}
            selectedForComparison={comparisonIds}
            onToggleComparison={handleToggleComparison}
          />
        </div>
      </div>
    </AppLayout>
  );
}
