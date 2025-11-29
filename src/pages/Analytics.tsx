import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

type PeriodMode = "year" | "month" | "range";

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("platform") || "uber_eats";
  
  const [selectedTab, setSelectedTab] = useState(initialTab);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);

  const prevYear = selectedYear - 1;

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    setSearchParams({ platform: value });
  };

  const handleRangeChange = (start: number, end: number) => {
    setStartMonth(start);
    setEndMonth(end);
  };

  // Determine month range based on period mode
  const effectiveStartMonth = periodMode === "year" ? 1 : periodMode === "month" ? selectedMonth : startMonth;
  const effectiveEndMonth = periodMode === "year" ? 12 : periodMode === "month" ? selectedMonth : endMonth;

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

  // Build filter for restaurants
  const restaurantFilter = selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  // ========== UBER EATS DATA (Current Year) ==========
  const { data: uberRevenueData, isLoading: loadingUberRevenue } = useQuery({
    queryKey: ["analytics_revenue_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberConversionData, isLoading: loadingUberConversion } = useQuery({
    queryKey: ["analytics_conversion_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberFeesData, isLoading: loadingUberFees } = useQuery({
    queryKey: ["analytics_fees_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== UBER EATS DATA (Previous Year - N-1) ==========
  const { data: uberPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberPrevConversionData } = useQuery({
    queryKey: ["analytics_conversion_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberPrevFeesData } = useQuery({
    queryKey: ["analytics_fees_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== DELIVEROO DATA (Current Year) ==========
  const { data: deliverooRevenueData, isLoading: loadingDeliverooRevenue } = useQuery({
    queryKey: ["analytics_revenue_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooConversionData, isLoading: loadingDeliverooConversion } = useQuery({
    queryKey: ["analytics_conversion_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooFeesData, isLoading: loadingDeliverooFees } = useQuery({
    queryKey: ["analytics_fees_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== DELIVEROO DATA (Previous Year - N-1) ==========
  const { data: deliverooPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooPrevConversionData } = useQuery({
    queryKey: ["analytics_conversion_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooPrevFeesData } = useQuery({
    queryKey: ["analytics_fees_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== GLOBAL DATA (Combined) ==========
  const globalRevenueData = useMemo(() => {
    return [...(uberRevenueData || []), ...(deliverooRevenueData || [])];
  }, [uberRevenueData, deliverooRevenueData]);

  const globalConversionData = useMemo(() => {
    return [...(uberConversionData || []), ...(deliverooConversionData || [])];
  }, [uberConversionData, deliverooConversionData]);

  const globalFeesData = useMemo(() => {
    return [...(uberFeesData || []), ...(deliverooFeesData || [])];
  }, [uberFeesData, deliverooFeesData]);

  const globalPrevRevenueData = useMemo(() => {
    return [...(uberPrevRevenueData || []), ...(deliverooPrevRevenueData || [])];
  }, [uberPrevRevenueData, deliverooPrevRevenueData]);

  const globalPrevConversionData = useMemo(() => {
    return [...(uberPrevConversionData || []), ...(deliverooPrevConversionData || [])];
  }, [uberPrevConversionData, deliverooPrevConversionData]);

  const globalPrevFeesData = useMemo(() => {
    return [...(uberPrevFeesData || []), ...(deliverooPrevFeesData || [])];
  }, [uberPrevFeesData, deliverooPrevFeesData]);

  const isLoading = loadingUberRevenue || loadingUberConversion || loadingUberFees ||
                    loadingDeliverooRevenue || loadingDeliverooConversion || loadingDeliverooFees;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Analyse de vos performances mensuelles
        </p>
      </div>

      {/* Filters Section */}
      <AnalyticsFilters
        restaurants={restaurants}
        selectedRestaurants={selectedRestaurants}
        onRestaurantsChange={setSelectedRestaurants}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        periodMode={periodMode}
        onPeriodModeChange={setPeriodMode}
        startMonth={startMonth}
        endMonth={endMonth}
        onRangeChange={handleRangeChange}
      />

      {/* Platform Tabs */}
      <Tabs value={selectedTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="uber_eats" className="flex items-center gap-2">
            <img src={uberEatsLogo} alt="Uber Eats" className="h-4 w-4 object-contain" />
            <span className="hidden sm:inline">Uber Eats</span>
          </TabsTrigger>
          <TabsTrigger value="deliveroo" className="flex items-center gap-2">
            <img src={deliverooLogo} alt="Deliveroo" className="h-4 w-4 object-contain" />
            <span className="hidden sm:inline">Deliveroo</span>
          </TabsTrigger>
          <TabsTrigger value="global" className="flex items-center gap-2">
            🌐
            <span className="hidden sm:inline">Global</span>
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="uber_eats" className="mt-6">
              <AnalyticsCharts
                revenueData={uberRevenueData}
                conversionData={uberConversionData}
                feesData={uberFeesData}
                prevRevenueData={uberPrevRevenueData}
                prevConversionData={uberPrevConversionData}
                prevFeesData={uberPrevFeesData}
                startMonth={effectiveStartMonth}
                endMonth={effectiveEndMonth}
                selectedYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="deliveroo" className="mt-6">
              <AnalyticsCharts
                revenueData={deliverooRevenueData}
                conversionData={deliverooConversionData}
                feesData={deliverooFeesData}
                prevRevenueData={deliverooPrevRevenueData}
                prevConversionData={deliverooPrevConversionData}
                prevFeesData={deliverooPrevFeesData}
                startMonth={effectiveStartMonth}
                endMonth={effectiveEndMonth}
                selectedYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="global" className="mt-6">
              <AnalyticsCharts
                revenueData={globalRevenueData}
                conversionData={globalConversionData}
                feesData={globalFeesData}
                prevRevenueData={globalPrevRevenueData}
                prevConversionData={globalPrevConversionData}
                prevFeesData={globalPrevFeesData}
                startMonth={effectiveStartMonth}
                endMonth={effectiveEndMonth}
                selectedYear={selectedYear}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
