import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Save, Pencil, Trash2, ArrowLeft, AlertTriangle,
  TrendingUp, Calculator, Euro, BarChart3, Receipt, 
  ShoppingCart, Eye, MousePointer, Sparkles, Calendar,
  CheckCircle2, Circle, CircleDot
} from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";

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

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const PLATFORMS = [
  { 
    value: "uber_eats", 
    label: "Uber Eats", 
    Logo: UberEatsLogo,
    bgClass: "bg-uber/10 hover:bg-uber/20 border-uber/30",
    activeClass: "bg-uber text-white shadow-lg shadow-uber/30 ring-uber/50",
    cardClass: "border-uber/40 shadow-[0_0_30px_-10px_hsl(var(--uber)/0.3)]",
    indicatorClass: "bg-gradient-to-r from-uber to-uber/70",
    badgeClass: "bg-uber/15 text-uber border-uber/30",
  },
  { 
    value: "deliveroo", 
    label: "Deliveroo", 
    Logo: DeliverooLogo,
    bgClass: "bg-deliveroo/10 hover:bg-deliveroo/20 border-deliveroo/30",
    activeClass: "bg-deliveroo text-white shadow-lg shadow-deliveroo/30 ring-deliveroo/50",
    cardClass: "border-deliveroo/40 shadow-[0_0_30px_-10px_hsl(var(--deliveroo)/0.3)]",
    indicatorClass: "bg-gradient-to-r from-deliveroo to-deliveroo/70",
    badgeClass: "bg-deliveroo/15 text-deliveroo border-deliveroo/30",
  },
];

type TabType = "revenue" | "conversion" | "fees";

export default function DataEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restaurantFromUrl = searchParams.get("restaurant");
  const tabFromUrl = searchParams.get("tab") as TabType | null;
  
  // Shared state
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>(restaurantFromUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("uber_eats");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || "revenue");
  
  // Revenue state
  const [revenueTtc, setRevenueTtc] = useState<string>("");
  const [orderCount, setOrderCount] = useState<string>("");
  const [workingDays, setWorkingDays] = useState<string>("");
  const [averageBasket, setAverageBasket] = useState<string>("");
  const [revenueEditingId, setRevenueEditingId] = useState<string | null>(null);
  const [showRevenueConfirm, setShowRevenueConfirm] = useState(false);
  
  // Conversion state
  const [visits, setVisits] = useState<string>("");
  const [menuViews, setMenuViews] = useState<string>("");
  const [addToCart, setAddToCart] = useState<string>("");
  const [orders, setOrders] = useState<string>("");
  const [conversionEditingId, setConversionEditingId] = useState<string | null>(null);
  const [showConversionConfirm, setShowConversionConfirm] = useState(false);
  const [showIntermediateRates, setShowIntermediateRates] = useState(false);
  
  // Detail toggle states
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);
  const [showFeesDetails, setShowFeesDetails] = useState(false);
  
  // Fees state
  const [uberFee, setUberFee] = useState<string>("");
  const [marketingFee, setMarketingFee] = useState<string>("");
  const [offersCost, setOffersCost] = useState<string>("");
  const [offerUsageFee, setOfferUsageFee] = useState<string>("");
  const [adsCost, setAdsCost] = useState<string>("");
  const [orderError, setOrderError] = useState<string>("");
  const [errorAdjustments, setErrorAdjustments] = useState<string>("");
  const [ecoContribution, setEcoContribution] = useState<string>("");
  const [netPayout, setNetPayout] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [feesEditingId, setFeesEditingId] = useState<string | null>(null);
  const [showFeesConfirm, setShowFeesConfirm] = useState(false);

  useEffect(() => {
    if (restaurantFromUrl) {
      setSelectedRestaurant(restaurantFromUrl);
    }
  }, [restaurantFromUrl]);

  // Fetch restaurants filtered by active brand
  const { data: activeRestaurants } = useActiveRestaurants();
  const restaurants = useMemo(() =>
    (activeRestaurants || []).map(r => ({ id: r.id, name: r.name, city: r.city })),
    [activeRestaurants]
  );

  // Fetch revenue entries
  const { data: revenueEntries, isLoading: loadingRevenue } = useQuery({
    queryKey: ["monthly_revenue", selectedRestaurant, selectedPlatform],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_revenue")
        .select("*")
        .eq("restaurant_id", selectedRestaurant)
        .eq("platform", selectedPlatform)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Fetch conversion entries
  const { data: conversionEntries, isLoading: loadingConversion } = useQuery({
    queryKey: ["monthly_conversion", selectedRestaurant, selectedPlatform],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_conversion")
        .select("*")
        .eq("restaurant_id", selectedRestaurant)
        .eq("platform", selectedPlatform)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Fetch fees entries
  const { data: feesEntries, isLoading: loadingFees } = useQuery({
    queryKey: ["monthly_fees", selectedRestaurant, selectedPlatform],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_fees")
        .select("*")
        .eq("restaurant_id", selectedRestaurant)
        .eq("platform", selectedPlatform)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Check existing entries
  const existingRevenue = useMemo(() => {
    if (!revenueEntries || revenueEditingId) return null;
    return revenueEntries.find(e => e.year === selectedYear && e.month === selectedMonth);
  }, [revenueEntries, selectedYear, selectedMonth, revenueEditingId]);

  const existingConversion = useMemo(() => {
    if (!conversionEntries || conversionEditingId) return null;
    return conversionEntries.find(e => e.year === selectedYear && e.month === selectedMonth);
  }, [conversionEntries, selectedYear, selectedMonth, conversionEditingId]);

  const existingFees = useMemo(() => {
    if (!feesEntries || feesEditingId) return null;
    return feesEntries.find(e => e.year === selectedYear && e.month === selectedMonth);
  }, [feesEntries, selectedYear, selectedMonth, feesEditingId]);

  const getMonthLabel = (month: number) => MONTHS.find(m => m.value === month)?.label || "";

  // Revenue mutation
  const revenueMutation = useMutation({
    mutationFn: async () => {
      const calculatedBasket = orderCount && parseFloat(orderCount) > 0 
        ? parseFloat(revenueTtc || "0") / parseFloat(orderCount) : 0;
      const finalBasket = averageBasket ? parseFloat(averageBasket) : calculatedBasket;

      const payload = {
        restaurant_id: selectedRestaurant,
        year: selectedYear,
        month: selectedMonth,
        platform: selectedPlatform,
        revenue_ttc: parseFloat(revenueTtc) || 0,
        order_count: parseInt(orderCount) || 0,
        working_days: workingDays ? parseInt(workingDays) : null,
        average_basket: finalBasket,
      };

      if (revenueEditingId) {
        const { error } = await supabase.from("monthly_revenue").update(payload).eq("id", revenueEditingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_revenue").upsert(payload, { onConflict: "restaurant_id,year,month,platform" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "CA & Commandes enregistrés" });
      queryClient.invalidateQueries({ queryKey: ["monthly_revenue"] });
      resetRevenueForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Conversion mutation
  const conversionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurant_id: selectedRestaurant,
        year: selectedYear,
        month: selectedMonth,
        platform: selectedPlatform,
        visits: parseInt(visits) || 0,
        menu_views: parseInt(menuViews) || 0,
        add_to_cart: parseInt(addToCart) || 0,
        orders: parseInt(orders) || 0,
      };

      if (conversionEditingId) {
        const { error } = await supabase.from("monthly_conversion").update(payload).eq("id", conversionEditingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_conversion").upsert(payload, { onConflict: "restaurant_id,year,month,platform" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Données de conversion enregistrées" });
      queryClient.invalidateQueries({ queryKey: ["monthly_conversion"] });
      resetConversionForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Fees mutation
  const feesMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurant_id: selectedRestaurant,
        year: selectedYear,
        month: selectedMonth,
        platform: selectedPlatform,
        uber_fee: parseFloat(uberFee) || 0,
        marketing_fee: parseFloat(marketingFee) || 0,
        offers_cost: parseFloat(offersCost) || 0,
        offer_usage_fee: parseFloat(offerUsageFee) || 0,
        ads_cost: parseFloat(adsCost) || 0,
        order_error: parseFloat(orderError) || 0,
        error_adjustments: parseFloat(errorAdjustments) || 0,
        eco_contribution: parseFloat(ecoContribution) || 0,
        net_payout: parseFloat(netPayout) || 0,
        notes: notes || null,
      };

      if (feesEditingId) {
        const { error } = await supabase.from("monthly_fees").update(payload).eq("id", feesEditingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_fees").upsert(payload, { onConflict: "restaurant_id,year,month,platform" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Frais & Marketing enregistrés" });
      queryClient.invalidateQueries({ queryKey: ["monthly_fees"] });
      resetFeesForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutations
  const deleteRevenueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_revenue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entrée supprimée" });
      queryClient.invalidateQueries({ queryKey: ["monthly_revenue"] });
    },
  });

  const deleteConversionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_conversion").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entrée supprimée" });
      queryClient.invalidateQueries({ queryKey: ["monthly_conversion"] });
    },
  });

  const deleteFeesMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_fees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entrée supprimée" });
      queryClient.invalidateQueries({ queryKey: ["monthly_fees"] });
    },
  });

  // Reset functions
  const resetRevenueForm = () => {
    setRevenueTtc(""); setOrderCount(""); setWorkingDays(""); setAverageBasket(""); setRevenueEditingId(null);
  };
  const resetConversionForm = () => {
    setVisits(""); setMenuViews(""); setAddToCart(""); setOrders(""); setConversionEditingId(null);
  };
  const resetFeesForm = () => {
    setUberFee(""); setMarketingFee(""); setOffersCost(""); setOfferUsageFee("");
    setAdsCost(""); setOrderError(""); setErrorAdjustments(""); setEcoContribution("");
    setNetPayout(""); setNotes(""); setFeesEditingId(null);
  };

  // Edit handlers
  const handleEditRevenue = (entry: any) => {
    setSelectedYear(entry.year); setSelectedMonth(entry.month);
    setRevenueTtc(entry.revenue_ttc?.toString() || "");
    setOrderCount(entry.order_count?.toString() || "");
    setWorkingDays(entry.working_days?.toString() || "");
    setAverageBasket(entry.average_basket?.toString() || "");
    setRevenueEditingId(entry.id);
  };

  const handleEditConversion = (entry: any) => {
    setSelectedYear(entry.year); setSelectedMonth(entry.month);
    setVisits(entry.visits?.toString() || "");
    setMenuViews(entry.menu_views?.toString() || "");
    setAddToCart(entry.add_to_cart?.toString() || "");
    setOrders(entry.orders?.toString() || "");
    setConversionEditingId(entry.id);
  };

  const handleEditFees = (entry: any) => {
    setSelectedYear(entry.year); setSelectedMonth(entry.month);
    setUberFee(entry.uber_fee?.toString() || "");
    setMarketingFee(entry.marketing_fee?.toString() || "");
    setOffersCost(entry.offers_cost?.toString() || "");
    setOfferUsageFee(entry.offer_usage_fee?.toString() || "");
    setAdsCost(entry.ads_cost?.toString() || "");
    setOrderError(entry.order_error?.toString() || "");
    setErrorAdjustments(entry.error_adjustments?.toString() || "");
    setEcoContribution(entry.eco_contribution?.toString() || "");
    setNetPayout(entry.net_payout?.toString() || "");
    setNotes(entry.notes || "");
    setFeesEditingId(entry.id);
  };

  // Save handlers with confirmation
  const handleSaveRevenue = () => {
    if (existingRevenue && !revenueEditingId) setShowRevenueConfirm(true);
    else revenueMutation.mutate();
  };
  const handleSaveConversion = () => {
    if (existingConversion && !conversionEditingId) setShowConversionConfirm(true);
    else conversionMutation.mutate();
  };
  const handleSaveFees = () => {
    if (existingFees && !feesEditingId) setShowFeesConfirm(true);
    else feesMutation.mutate();
  };

  // Calculated values
  const calculatedBasket = orderCount && parseFloat(orderCount) > 0 
    ? (parseFloat(revenueTtc || "0") / parseFloat(orderCount)).toFixed(2) : "0.00";
  const previewBasket = averageBasket || calculatedBasket;
  const previewPerDay = workingDays && parseFloat(workingDays) > 0 
    ? (parseFloat(revenueTtc || "0") / parseFloat(workingDays)).toFixed(2) : "0.00";

  const v = parseInt(visits) || 0;
  const mv = parseInt(menuViews) || 0;
  const atc = parseInt(addToCart) || 0;
  const o = parseInt(orders) || 0;
  const viewRate = v > 0 ? ((mv / v) * 100).toFixed(1) : "0.0";
  const cartRate = mv > 0 ? ((atc / mv) * 100).toFixed(1) : "0.0";
  const conversionRate = atc > 0 ? ((o / atc) * 100).toFixed(1) : "0.0";
  const overallRate = v > 0 ? ((o / v) * 100).toFixed(1) : "0.0";

  const totalFees = (parseFloat(uberFee) || 0) + (parseFloat(marketingFee) || 0) + 
    (parseFloat(offersCost) || 0) + (parseFloat(offerUsageFee) || 0) + (parseFloat(adsCost) || 0) + 
    (parseFloat(orderError) || 0) + (parseFloat(errorAdjustments) || 0) + (parseFloat(ecoContribution) || 0);

  // Helper to find revenue for a given period
  const getRevenueForPeriod = (year: number, month: number) => {
    return revenueEntries?.find(r => r.year === year && r.month === month);
  };

  // Calculate profitability: (net_payout / revenue_ttc) * 100
  const calculateProfitability = (netPayoutVal: number, revenueTtc: number | null | undefined): number | null => {
    if (!revenueTtc || revenueTtc === 0) return null;
    return (netPayoutVal / revenueTtc) * 100;
  };

  // Get profitability color class based on percentage
  const getProfitabilityColor = (profitability: number | null) => {
    if (profitability === null) return "text-muted-foreground";
    if (profitability >= 60) return "text-emerald-600";
    if (profitability >= 40) return "text-amber-600";
    return "text-red-600";
  };

  // Current period profitability for KPI card
  const currentPeriodRevenue = getRevenueForPeriod(selectedYear, selectedMonth);
  const currentProfitability = calculateProfitability(
    parseFloat(netPayout || "0"), 
    currentPeriodRevenue?.revenue_ttc
  );

  const selectedPlatformConfig = PLATFORMS.find(p => p.value === selectedPlatform);
  const getPlatformBadge = (platform: string) => {
    const p = PLATFORMS.find(pl => pl.value === platform);
    return p ? (
      <Badge className={`${p.badgeClass} flex items-center gap-1.5 border`}>
        <p.Logo size={14} />
        {p.label}
      </Badge>
    ) : <Badge variant="outline">{platform}</Badge>;
  };

  const selectedRestaurantName = restaurants?.find(r => r.id === selectedRestaurant)?.name;

  // Calculate monthly completeness for the selected year
  const monthlyCompleteness = useMemo(() => {
    if (!selectedRestaurant) return [];
    
    return MONTHS.map(month => {
      const hasRevenue = revenueEntries?.some(e => e.year === selectedYear && e.month === month.value);
      const hasConversion = conversionEntries?.some(e => e.year === selectedYear && e.month === month.value);
      const hasFees = feesEntries?.some(e => e.year === selectedYear && e.month === month.value);
      
      const count = [hasRevenue, hasConversion, hasFees].filter(Boolean).length;
      
      return {
        month: month.value,
        label: month.label.slice(0, 3),
        hasRevenue,
        hasConversion,
        hasFees,
        count,
        isComplete: count === 3,
        isPartial: count > 0 && count < 3,
        isEmpty: count === 0,
      };
    });
  }, [revenueEntries, conversionEntries, feesEntries, selectedYear, selectedRestaurant]);

  const completedMonths = monthlyCompleteness.filter(m => m.isComplete).length;
  const partialMonths = monthlyCompleteness.filter(m => m.isPartial).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 border border-primary/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-4">
          {restaurantFromUrl && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/restaurants/${restaurantFromUrl}`)}
              className="shrink-0 bg-card/80 backdrop-blur-sm hover:bg-card"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Saisie des données mensuelles</h1>
            </div>
            <p className="text-muted-foreground">
              CA, conversion et frais pour <span className="font-medium text-foreground">{selectedRestaurantName || "votre restaurant"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <Card className={`transition-all duration-500 border-2 overflow-hidden ${selectedPlatformConfig?.cardClass}`}>
        {/* Platform indicator bar */}
        <div className={`h-1.5 ${selectedPlatformConfig?.indicatorClass}`} />
        
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            {/* Period selection row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Restaurant</Label>
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant} disabled={!!restaurantFromUrl}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} {r.city && `(${r.city})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-1 col-span-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plateforme</Label>
                <div className="flex gap-2">
                  {PLATFORMS.map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      variant="outline"
                      className={`flex-1 h-14 flex-col gap-1 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] ${
                        selectedPlatform === p.value 
                          ? `${p.activeClass} animate-scale-in ring-2 ring-offset-2 ring-offset-background`
                          : `${p.bgClass} hover:-translate-y-0.5`
                      }`}
                      onClick={() => setSelectedPlatform(p.value)}
                    >
                      <p.Logo size={24} className="transition-transform" />
                      <span className="text-xs font-medium">{p.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Année
                </Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mois</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Monthly completeness indicator */}
            {selectedRestaurant && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Complétude {selectedYear}
                  </Label>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {completedMonths} complet{completedMonths > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <CircleDot className="h-3 w-3" /> {partialMonths} partiel{partialMonths > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {monthlyCompleteness.map((m) => (
                    <button
                      key={m.month}
                      onClick={() => setSelectedMonth(m.month)}
                      className={`group relative flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all duration-200 hover:scale-105 ${
                        selectedMonth === m.month 
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' 
                          : ''
                      } ${
                        m.isComplete 
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30' 
                          : m.isPartial 
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30' 
                            : 'bg-muted/50 hover:bg-muted border border-transparent'
                      }`}
                    >
                      <span className={`text-[10px] font-medium ${
                        m.isComplete ? 'text-emerald-700 dark:text-emerald-400' 
                        : m.isPartial ? 'text-amber-700 dark:text-amber-400' 
                        : 'text-muted-foreground'
                      }`}>
                        {m.label}
                      </span>
                      {m.isComplete ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : m.isPartial ? (
                        <CircleDot className="h-3 w-3 text-amber-600" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border whitespace-nowrap">
                          <div className="font-medium mb-0.5">{MONTHS.find(mo => mo.value === m.month)?.label}</div>
                          <div className="flex gap-1">
                            <span className={m.hasRevenue ? 'text-emerald-600' : 'text-muted-foreground'}>CA</span>
                            <span className={m.hasConversion ? 'text-emerald-600' : 'text-muted-foreground'}>Conv</span>
                            <span className={m.hasFees ? 'text-emerald-600' : 'text-muted-foreground'}>Frais</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 h-12 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger 
                value="revenue" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-stat-revenue/10 data-[state=active]:bg-stat-revenue data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-[1.02] rounded-lg"
              >
                <Euro className="h-4 w-4 transition-transform data-[state=active]:animate-bounce-soft" />
                <span className="hidden sm:inline font-medium">CA & Commandes</span>
                <span className="sm:hidden font-medium">CA</span>
              </TabsTrigger>
              <TabsTrigger 
                value="conversion" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-stat-conversion/10 data-[state=active]:bg-stat-conversion data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-[1.02] rounded-lg"
              >
                <BarChart3 className="h-4 w-4 transition-transform data-[state=active]:animate-bounce-soft" />
                <span className="hidden sm:inline font-medium">Conversion</span>
                <span className="sm:hidden font-medium">Conv.</span>
              </TabsTrigger>
              <TabsTrigger 
                value="fees" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-stat-fees/10 data-[state=active]:bg-stat-fees data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-[1.02] rounded-lg"
              >
                <Receipt className="h-4 w-4 transition-transform data-[state=active]:animate-bounce-soft" />
                <span className="hidden sm:inline font-medium">Frais & Marketing</span>
                <span className="sm:hidden font-medium">Frais</span>
              </TabsTrigger>
            </TabsList>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-5 mt-0 animate-fade-in-up" key={`revenue-${activeTab}`}>
              {existingRevenue && !revenueEditingId && (
                <Alert className="border-amber-500/50 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 animate-slide-in-right">
                  <AlertTriangle className="h-4 w-4 text-amber-600 animate-wiggle" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <span className="font-semibold">Données existantes pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                    <span className="ml-2 text-sm opacity-80">
                      ({Number(existingRevenue.revenue_ttc).toLocaleString("fr-FR")} € • {existingRevenue.order_count} cmd)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-amber-700 hover:text-amber-900 hover:translate-x-1 transition-transform" onClick={() => handleEditRevenue(existingRevenue)}>
                      Modifier →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-stat-revenue" />
                    CA TTC (€)
                  </Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={revenueTtc} 
                    onChange={(e) => setRevenueTtc(e.target.value)} 
                    placeholder="Ex: 15000.50"
                    className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-stat-orders" />
                    Nombre de commandes
                  </Label>
                  <Input 
                    type="number" 
                    value={orderCount} 
                    onChange={(e) => setOrderCount(e.target.value)} 
                    placeholder="Ex: 450"
                    className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Jours ouvrés (optionnel)</Label>
                  <Input type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} placeholder="Ex: 30" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Panier moyen (€) - optionnel</Label>
                  <Input type="number" step="0.01" value={averageBasket} onChange={(e) => setAverageBasket(e.target.value)} placeholder={`Auto: ${calculatedBasket} €`} className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
              </div>

              {/* Colorful stats preview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="group rounded-xl p-4 bg-gradient-to-br from-stat-basket/10 to-stat-basket/5 border border-stat-basket/20 transition-all duration-300 hover:shadow-lg hover:shadow-stat-basket/10 hover:-translate-y-1 hover:border-stat-basket/40 cursor-default">
                  <div className="flex items-center gap-2 text-stat-basket mb-1">
                    <ShoppingCart className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:rotate-6" />
                    <span className="text-sm font-medium">Panier moyen</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground transition-transform group-hover:scale-105">{previewBasket} €</p>
                </div>
                <div className="group rounded-xl p-4 bg-gradient-to-br from-stat-revenue/10 to-stat-revenue/5 border border-stat-revenue/20 transition-all duration-300 hover:shadow-lg hover:shadow-stat-revenue/10 hover:-translate-y-1 hover:border-stat-revenue/40 cursor-default">
                  <div className="flex items-center gap-2 text-stat-revenue mb-1">
                    <TrendingUp className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:-rotate-6" />
                    <span className="text-sm font-medium">CA / jour</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground transition-transform group-hover:scale-105">{previewPerDay} €</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveRevenue} 
                  disabled={!selectedRestaurant || revenueMutation.isPending} 
                  className="group flex-1 h-12 text-base font-semibold bg-gradient-to-r from-stat-revenue to-stat-revenue/80 hover:from-stat-revenue/90 hover:to-stat-revenue/70 shadow-lg shadow-stat-revenue/25 transition-all duration-300 hover:shadow-xl hover:shadow-stat-revenue/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {revenueMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Save className="h-5 w-5 mr-2 transition-transform group-hover:scale-110 group-hover:rotate-6" />
                  )}
                  {revenueEditingId ? "Mettre à jour" : existingRevenue ? "Remplacer" : "Enregistrer"}
                </Button>
                {revenueEditingId && (
                  <Button variant="outline" onClick={resetRevenueForm} className="h-12 transition-all duration-200 hover:scale-105 active:scale-95">
                    Annuler
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Conversion Tab */}
            <TabsContent value="conversion" className="space-y-5 mt-0 animate-fade-in-up" key={`conversion-${activeTab}`}>
              {existingConversion && !conversionEditingId && (
                <Alert className="border-amber-500/50 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 animate-slide-in-right">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <span className="font-semibold">Données existantes pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                    <span className="ml-2 text-sm opacity-80">
                      ({existingConversion.visits.toLocaleString("fr-FR")} visites • {Number(existingConversion.overall_rate).toFixed(1)}%)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-amber-700 hover:text-amber-900 hover:translate-x-1 transition-transform" onClick={() => handleEditConversion(existingConversion)}>
                      Modifier →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Nombre de visites
                  </Label>
                  <Input type="number" value={visits} onChange={(e) => setVisits(e.target.value)} placeholder="Ex: 5000" className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MousePointer className="h-4 w-4 text-stat-orders" />
                    Consultations du menu
                  </Label>
                  <Input type="number" value={menuViews} onChange={(e) => setMenuViews(e.target.value)} placeholder="Ex: 3500" className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-stat-basket" />
                    Ajouts au panier
                  </Label>
                  <Input type="number" value={addToCart} onChange={(e) => setAddToCart(e.target.value)} placeholder="Ex: 800" className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-stat-conversion" />
                    Commandes passées
                  </Label>
                  <Input type="number" value={orders} onChange={(e) => setOrders(e.target.value)} placeholder="Ex: 450" className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md" />
                </div>
              </div>

              {/* Conversion funnel preview */}
              <div className="rounded-xl border border-stat-conversion/20 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-stat-conversion/10">
                <div className="bg-gradient-to-r from-stat-conversion/10 to-stat-conversion/5 px-4 py-3 border-b border-stat-conversion/20">
                  <p className="text-sm font-semibold flex items-center gap-2 text-stat-conversion">
                    <TrendingUp className="h-4 w-4 animate-bounce-soft" />
                    Entonnoir de conversion
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                  <div className="bg-card p-4 text-center group transition-all duration-200 hover:bg-primary/5">
                    <p className="text-xs text-muted-foreground mb-1">Visites → Menu</p>
                    <p className="text-xl font-bold text-primary transition-transform group-hover:scale-110">{viewRate}%</p>
                  </div>
                  <div className="bg-card p-4 text-center group transition-all duration-200 hover:bg-stat-orders/5">
                    <p className="text-xs text-muted-foreground mb-1">Menu → Panier</p>
                    <p className="text-xl font-bold text-stat-orders transition-transform group-hover:scale-110">{cartRate}%</p>
                  </div>
                  <div className="bg-card p-4 text-center group transition-all duration-200 hover:bg-stat-basket/5">
                    <p className="text-xs text-muted-foreground mb-1">Panier → Cmd</p>
                    <p className="text-xl font-bold text-stat-basket transition-transform group-hover:scale-110">{conversionRate}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-stat-conversion/10 to-stat-conversion/5 p-4 text-center group">
                    <p className="text-xs text-stat-conversion font-medium mb-1">Taux global</p>
                    <p className="text-2xl font-bold text-stat-conversion transition-transform group-hover:scale-110">{overallRate}%</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveConversion} 
                  disabled={!selectedRestaurant || conversionMutation.isPending} 
                  className="group flex-1 h-12 text-base font-semibold bg-gradient-to-r from-stat-conversion to-stat-conversion/80 hover:from-stat-conversion/90 hover:to-stat-conversion/70 shadow-lg shadow-stat-conversion/25 transition-all duration-300 hover:shadow-xl hover:shadow-stat-conversion/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {conversionMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Save className="h-5 w-5 mr-2 transition-transform group-hover:scale-110 group-hover:rotate-6" />
                  )}
                  {conversionEditingId ? "Mettre à jour" : existingConversion ? "Remplacer" : "Enregistrer"}
                </Button>
                {conversionEditingId && (
                  <Button variant="outline" onClick={resetConversionForm} className="h-12 transition-all duration-200 hover:scale-105 active:scale-95">
                    Annuler
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Fees Tab */}
            <TabsContent value="fees" className="space-y-5 mt-0 animate-fade-in-up" key={`fees-${activeTab}`}>
              {existingFees && !feesEditingId && (
                <Alert className="border-amber-500/50 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 animate-slide-in-right">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <span className="font-semibold">Données existantes pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                    <span className="ml-2 text-sm opacity-80">
                      (Total: {(Number(existingFees.uber_fee) + Number(existingFees.marketing_fee) + Number(existingFees.offers_cost) + Number(existingFees.ads_cost)).toLocaleString("fr-FR")} €)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-amber-700 hover:text-amber-900 hover:translate-x-1 transition-transform" onClick={() => handleEditFees(existingFees)}>
                      Modifier →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-stat-fees" />
                    Frais UBER (€)
                  </Label>
                  <Input type="number" step="0.01" value={uberFee} onChange={(e) => setUberFee(e.target.value)} placeholder="Ex: 4500" className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Marketing UBER (€)</Label>
                  <Input type="number" step="0.01" value={marketingFee} onChange={(e) => setMarketingFee(e.target.value)} placeholder="Ex: 200" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground italic">Offres sur les articles (€)</Label>
                  <Input type="number" step="0.01" value={offersCost} onChange={(e) => setOffersCost(e.target.value)} placeholder="Ex: 350" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground italic">Frais d'utilisation de l'offre (€)</Label>
                  <Input type="number" step="0.01" value={offerUsageFee} onChange={(e) => setOfferUsageFee(e.target.value)} placeholder="Ex: 50" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground italic">Dépenses publicitaire (€)</Label>
                  <Input type="number" step="0.01" value={adsCost} onChange={(e) => setAdsCost(e.target.value)} placeholder="Ex: 150" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Erreur de commande (€)</Label>
                  <Input type="number" step="0.01" value={orderError} onChange={(e) => setOrderError(e.target.value)} placeholder="Ex: 30" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Ajustements liés aux erreurs (€)</Label>
                  <Input type="number" step="0.01" value={errorAdjustments} onChange={(e) => setErrorAdjustments(e.target.value)} placeholder="Ex: 50" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Eco contribution (€)</Label>
                  <Input type="number" step="0.01" value={ecoContribution} onChange={(e) => setEcoContribution(e.target.value)} placeholder="Ex: 25" className="h-11 transition-all duration-200 focus:scale-[1.01]" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-stat-payout" />
                    Versement (€)
                  </Label>
                  <Input type="number" step="0.01" value={netPayout} onChange={(e) => setNetPayout(e.target.value)} placeholder="Ex: 9724.50" className="h-11 text-lg font-medium transition-all duration-200 focus:scale-[1.01] focus:shadow-md" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Notes (optionnel)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques..." rows={2} className="transition-all duration-200 focus:scale-[1.01]" />
              </div>

              {/* Fees summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="group rounded-xl p-4 bg-gradient-to-br from-stat-fees/10 to-stat-fees/5 border border-stat-fees/20 transition-all duration-300 hover:shadow-lg hover:shadow-stat-fees/10 hover:-translate-y-1 hover:border-stat-fees/40 cursor-default">
                  <div className="flex items-center gap-2 text-stat-fees mb-1">
                    <Calculator className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:rotate-6" />
                    <span className="text-sm font-medium">Total frais</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground transition-transform group-hover:scale-105">{totalFees.toLocaleString("fr-FR")} €</p>
                </div>
                <div className="group rounded-xl p-4 bg-gradient-to-br from-stat-payout/10 to-stat-payout/5 border border-stat-payout/20 transition-all duration-300 hover:shadow-lg hover:shadow-stat-payout/10 hover:-translate-y-1 hover:border-stat-payout/40 cursor-default">
                  <div className="flex items-center gap-2 text-stat-payout mb-1">
                    <TrendingUp className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:-rotate-6" />
                    <span className="text-sm font-medium">Versement net</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{parseFloat(netPayout || "0").toLocaleString("fr-FR")} €</p>
                </div>
                <div className={`group rounded-xl p-4 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default ${
                  currentProfitability === null 
                    ? "bg-gradient-to-br from-muted/20 to-muted/10 border-muted/30" 
                    : currentProfitability >= 60 
                      ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:shadow-emerald-500/10 hover:border-emerald-500/40" 
                      : currentProfitability >= 40 
                        ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:shadow-amber-500/10 hover:border-amber-500/40" 
                        : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 hover:shadow-red-500/10 hover:border-red-500/40"
                }`}>
                  <div className={`flex items-center gap-2 mb-1 ${getProfitabilityColor(currentProfitability)}`}>
                    <BarChart3 className="h-4 w-4 transition-transform group-hover:scale-110" />
                    <span className="text-sm font-medium">% Rentabilité</span>
                  </div>
                  <p className={`text-2xl font-bold transition-transform group-hover:scale-105 ${getProfitabilityColor(currentProfitability)}`}>
                    {currentProfitability !== null ? `${currentProfitability.toFixed(1)}%` : "--"}
                  </p>
                  {currentProfitability === null && (
                    <p className="text-xs text-muted-foreground mt-1">Saisir le CA</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveFees} 
                  disabled={!selectedRestaurant || feesMutation.isPending} 
                  className="group flex-1 h-12 text-base font-semibold bg-gradient-to-r from-stat-fees to-stat-fees/80 hover:from-stat-fees/90 hover:to-stat-fees/70 shadow-lg shadow-stat-fees/25 transition-all duration-300 hover:shadow-xl hover:shadow-stat-fees/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {feesMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Save className="h-5 w-5 mr-2 transition-transform group-hover:scale-110 group-hover:rotate-6" />
                  )}
                  {feesEditingId ? "Mettre à jour" : existingFees ? "Remplacer" : "Enregistrer"}
                </Button>
                {feesEditingId && (
                  <Button variant="outline" onClick={resetFeesForm} className="h-12 transition-all duration-200 hover:scale-105 active:scale-95">
                    Annuler
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* History Card */}
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <span>Historique</span>
              <Badge 
                variant="secondary" 
                className={`font-normal transition-all duration-300 ${
                  activeTab === "revenue" ? "bg-stat-revenue/15 text-stat-revenue" :
                  activeTab === "conversion" ? "bg-stat-conversion/15 text-stat-conversion" :
                  "bg-stat-fees/15 text-stat-fees"
                }`}
              >
                {activeTab === "revenue" ? "CA & Commandes" : activeTab === "conversion" ? "Conversion" : "Frais"}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-4">
              {activeTab === "revenue" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-revenue-details"
                    checked={showRevenueDetails}
                    onCheckedChange={setShowRevenueDetails}
                    className="data-[state=checked]:bg-stat-revenue"
                  />
                  <Label htmlFor="show-revenue-details" className="text-xs text-muted-foreground cursor-pointer">
                    Ratios détaillés
                  </Label>
                </div>
              )}
              {activeTab === "conversion" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-rates"
                    checked={showIntermediateRates}
                    onCheckedChange={setShowIntermediateRates}
                    className="data-[state=checked]:bg-stat-conversion"
                  />
                  <Label htmlFor="show-rates" className="text-xs text-muted-foreground cursor-pointer">
                    Taux détaillés
                  </Label>
                </div>
              )}
              {activeTab === "fees" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-fees-details"
                    checked={showFeesDetails}
                    onCheckedChange={setShowFeesDetails}
                    className="data-[state=checked]:bg-stat-fees"
                  />
                  <Label htmlFor="show-fees-details" className="text-xs text-muted-foreground cursor-pointer">
                    % détaillés
                  </Label>
                </div>
              )}
              <div className="transition-transform duration-200 hover:scale-105">
                {getPlatformBadge(selectedPlatform)}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedRestaurant ? (
            <div className="text-muted-foreground text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Sélectionnez un restaurant pour voir l'historique</p>
            </div>
          ) : activeTab === "revenue" ? (
            loadingRevenue ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stat-revenue" />
              </div>
            ) : !revenueEntries?.length ? (
              <div className="text-muted-foreground text-center py-12">
                <Euro className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucune donnée enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Période</TableHead>
                      <TableHead className="text-right font-semibold">CA TTC</TableHead>
                      {showRevenueDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">÷Cmd</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Cmd</TableHead>
                      {showRevenueDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">÷Jours</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Jours</TableHead>
                      {showRevenueDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">CA÷Jours</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Panier</TableHead>
                      <TableHead className="text-right font-semibold text-stat-revenue">CA/Jour</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueEntries?.map((entry) => {
                      const caPerDay = entry.working_days && entry.working_days > 0 
                        ? Number(entry.revenue_ttc) / entry.working_days : 0;
                      const cmdPerDay = entry.working_days && entry.working_days > 0 
                        ? entry.order_count / entry.working_days : 0;
                      return (
                        <TableRow key={entry.id} className="group hover:bg-stat-revenue/5 transition-colors">
                          <TableCell className="font-medium">{getMonthLabel(entry.month)} {entry.year}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-stat-revenue">{Number(entry.revenue_ttc).toLocaleString("fr-FR")} €</span>
                          </TableCell>
                          {showRevenueDetails && (
                            <TableCell className="text-center text-xs text-stat-revenue/70 bg-muted/10 border-x border-dashed border-border/30">
                              {Number(entry.average_basket).toFixed(2)} €
                            </TableCell>
                          )}
                          <TableCell className="text-right font-medium">{entry.order_count}</TableCell>
                          {showRevenueDetails && (
                            <TableCell className="text-center text-xs text-stat-revenue/70 bg-muted/10 border-x border-dashed border-border/30">
                              {cmdPerDay.toFixed(1)}/j
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{entry.working_days || "-"}</TableCell>
                          {showRevenueDetails && (
                            <TableCell className="text-center text-xs text-stat-revenue/70 bg-muted/10 border-x border-dashed border-border/30">
                              {caPerDay.toFixed(0)} €
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.average_basket).toFixed(2)} €</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-stat-revenue">{caPerDay > 0 ? caPerDay.toFixed(0) : "-"} €</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRevenue(entry)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteRevenueMutation.mutate(entry.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : activeTab === "conversion" ? (
            loadingConversion ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stat-conversion" />
              </div>
            ) : !conversionEntries?.length ? (
              <div className="text-muted-foreground text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucune donnée enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Période</TableHead>
                      <TableHead className="text-right font-semibold">Visites</TableHead>
                      {showIntermediateRates && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">→</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Menu</TableHead>
                      {showIntermediateRates && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">→</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Panier</TableHead>
                      {showIntermediateRates && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">→</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Cmd</TableHead>
                      <TableHead className="text-right font-semibold text-stat-conversion">Global</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversionEntries?.map((entry) => (
                      <TableRow key={entry.id} className="group hover:bg-stat-conversion/5 transition-colors">
                        <TableCell className="font-medium">{getMonthLabel(entry.month)} {entry.year}</TableCell>
                        <TableCell className="text-right font-medium">{entry.visits.toLocaleString("fr-FR")}</TableCell>
                        {showIntermediateRates && (
                          <TableCell className="text-center text-xs text-stat-conversion/70 bg-muted/10 border-x border-dashed border-border/30">
                            {Number(entry.view_rate || 0).toFixed(1)}%
                          </TableCell>
                        )}
                        <TableCell className="text-right text-muted-foreground">{entry.menu_views.toLocaleString("fr-FR")}</TableCell>
                        {showIntermediateRates && (
                          <TableCell className="text-center text-xs text-stat-conversion/70 bg-muted/10 border-x border-dashed border-border/30">
                            {Number(entry.cart_rate || 0).toFixed(1)}%
                          </TableCell>
                        )}
                        <TableCell className="text-right text-muted-foreground">{entry.add_to_cart.toLocaleString("fr-FR")}</TableCell>
                        {showIntermediateRates && (
                          <TableCell className="text-center text-xs text-stat-conversion/70 bg-muted/10 border-x border-dashed border-border/30">
                            {Number(entry.conversion_rate || 0).toFixed(1)}%
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium">{entry.orders}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-stat-conversion">{Number(entry.overall_rate).toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditConversion(entry)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteConversionMutation.mutate(entry.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            loadingFees ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stat-fees" />
              </div>
            ) : !feesEntries?.length ? (
              <div className="text-muted-foreground text-center py-12">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucune donnée enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Période</TableHead>
                      <TableHead className="text-right font-semibold">Frais</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Marketing</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Offres</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Frais offre</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Pub</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Err. cmd</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Ajust.</TableHead>
                      {showFeesDetails && (
                        <TableHead className="text-center text-xs font-normal text-muted-foreground bg-muted/20 border-x border-dashed border-border/50">%</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Eco</TableHead>
                      <TableHead className="text-right font-semibold text-stat-fees">Total</TableHead>
                      <TableHead className="text-right font-semibold text-stat-payout">Versement</TableHead>
                      <TableHead className="text-right font-semibold">Rent. %</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feesEntries?.map((entry) => {
                      const total = Number(entry.uber_fee) + Number(entry.marketing_fee) + Number(entry.offers_cost) + 
                        Number(entry.offer_usage_fee || 0) + Number(entry.ads_cost) + Number(entry.order_error || 0) + 
                        Number(entry.error_adjustments) + Number(entry.eco_contribution);
                      const pct = (val: number) => total > 0 ? ((val / total) * 100).toFixed(0) : "0";
                      return (
                        <TableRow key={entry.id} className="group hover:bg-stat-fees/5 transition-colors">
                          <TableCell className="font-medium whitespace-nowrap">{getMonthLabel(entry.month)} {entry.year}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-stat-fees">{Number(entry.uber_fee).toLocaleString("fr-FR")} €</span>
                          </TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.uber_fee))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.marketing_fee).toLocaleString("fr-FR")} €</TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.marketing_fee))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.offers_cost).toLocaleString("fr-FR")} €</TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.offers_cost))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.offer_usage_fee || 0).toLocaleString("fr-FR")} €</TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.offer_usage_fee || 0))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.ads_cost).toLocaleString("fr-FR")} €</TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.ads_cost))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.order_error || 0).toLocaleString("fr-FR")} €</TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.order_error || 0))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.error_adjustments).toLocaleString("fr-FR")} €</TableCell>
                          {showFeesDetails && (
                            <TableCell className="text-center text-xs text-stat-fees/70 bg-muted/10 border-x border-dashed border-border/30">
                              {pct(Number(entry.error_adjustments))}%
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">{Number(entry.eco_contribution).toLocaleString("fr-FR")} €</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-stat-fees">{total.toLocaleString("fr-FR")} €</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-stat-payout">{Number(entry.net_payout).toLocaleString("fr-FR")} €</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const matchingRevenue = getRevenueForPeriod(entry.year, entry.month);
                              const profitability = calculateProfitability(Number(entry.net_payout), matchingRevenue?.revenue_ttc);
                              return (
                                <span className={`font-semibold ${getProfitabilityColor(profitability)}`}>
                                  {profitability !== null ? `${profitability.toFixed(1)}%` : "--"}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFees(entry)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteFeesMutation.mutate(entry.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialogs */}
      <AlertDialog open={showRevenueConfirm} onOpenChange={setShowRevenueConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer les données existantes ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Des données CA existent déjà pour {getMonthLabel(selectedMonth)} {selectedYear}.</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium mb-2 text-foreground">Actuelles</p>
                    <p className="text-muted-foreground">CA: {existingRevenue ? Number(existingRevenue.revenue_ttc).toLocaleString("fr-FR") : 0} €</p>
                    <p className="text-muted-foreground">Cmd: {existingRevenue?.order_count || 0}</p>
                  </div>
                  <div className="bg-stat-revenue/10 rounded-lg p-3 border border-stat-revenue/20">
                    <p className="font-medium mb-2 text-foreground">Nouvelles</p>
                    <p className="text-muted-foreground">CA: {parseFloat(revenueTtc || "0").toLocaleString("fr-FR")} €</p>
                    <p className="text-muted-foreground">Cmd: {orderCount || 0}</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowRevenueConfirm(false); revenueMutation.mutate(); }} className="bg-stat-revenue hover:bg-stat-revenue/90">
              Remplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showConversionConfirm} onOpenChange={setShowConversionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer les données existantes ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Des données de conversion existent déjà pour {getMonthLabel(selectedMonth)} {selectedYear}.</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium mb-2 text-foreground">Actuelles</p>
                    <p className="text-muted-foreground">Visites: {existingConversion?.visits.toLocaleString("fr-FR") || 0}</p>
                    <p className="text-muted-foreground">Taux: {existingConversion ? Number(existingConversion.overall_rate).toFixed(1) : "0.0"}%</p>
                  </div>
                  <div className="bg-stat-conversion/10 rounded-lg p-3 border border-stat-conversion/20">
                    <p className="font-medium mb-2 text-foreground">Nouvelles</p>
                    <p className="text-muted-foreground">Visites: {parseInt(visits || "0").toLocaleString("fr-FR")}</p>
                    <p className="text-muted-foreground">Taux: {overallRate}%</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConversionConfirm(false); conversionMutation.mutate(); }} className="bg-stat-conversion hover:bg-stat-conversion/90">
              Remplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showFeesConfirm} onOpenChange={setShowFeesConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer les données existantes ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Des données de frais existent déjà pour {getMonthLabel(selectedMonth)} {selectedYear}.</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium mb-2 text-foreground">Actuelles</p>
                    <p className="text-muted-foreground">Total: {existingFees ? (Number(existingFees.uber_fee) + Number(existingFees.marketing_fee) + Number(existingFees.offers_cost) + Number(existingFees.ads_cost)).toLocaleString("fr-FR") : 0} €</p>
                  </div>
                  <div className="bg-stat-fees/10 rounded-lg p-3 border border-stat-fees/20">
                    <p className="font-medium mb-2 text-foreground">Nouvelles</p>
                    <p className="text-muted-foreground">Total: {totalFees.toLocaleString("fr-FR")} €</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowFeesConfirm(false); feesMutation.mutate(); }} className="bg-stat-fees hover:bg-stat-fees/90">
              Remplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
