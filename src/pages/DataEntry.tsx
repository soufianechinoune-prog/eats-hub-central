import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp, Calculator, Euro, BarChart3, Receipt
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
    color: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30", 
    cardStyle: "border-green-500 bg-green-50/50 dark:bg-green-950/20",
    indicatorStyle: "bg-green-500",
    Logo: UberEatsLogo 
  },
  { 
    value: "deliveroo", 
    label: "Deliveroo", 
    color: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30", 
    cardStyle: "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20",
    indicatorStyle: "bg-cyan-500",
    Logo: DeliverooLogo 
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
  
  // Fees state
  const [uberFee, setUberFee] = useState<string>("");
  const [marketingFee, setMarketingFee] = useState<string>("");
  const [offersCost, setOffersCost] = useState<string>("");
  const [adsCost, setAdsCost] = useState<string>("");
  const [errorAdjustments, setErrorAdjustments] = useState<string>("");
  const [otherFees, setOtherFees] = useState<string>("");
  const [netPayout, setNetPayout] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [feesEditingId, setFeesEditingId] = useState<string | null>(null);
  const [showFeesConfirm, setShowFeesConfirm] = useState(false);

  useEffect(() => {
    if (restaurantFromUrl) {
      setSelectedRestaurant(restaurantFromUrl);
    }
  }, [restaurantFromUrl]);

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
        ads_cost: parseFloat(adsCost) || 0,
        error_adjustments: parseFloat(errorAdjustments) || 0,
        other_fees: parseFloat(otherFees) || 0,
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
    setUberFee(""); setMarketingFee(""); setOffersCost(""); setAdsCost("");
    setErrorAdjustments(""); setOtherFees(""); setNetPayout(""); setNotes(""); setFeesEditingId(null);
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
    setAdsCost(entry.ads_cost?.toString() || "");
    setErrorAdjustments(entry.error_adjustments?.toString() || "");
    setOtherFees(entry.other_fees?.toString() || "");
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
    (parseFloat(offersCost) || 0) + (parseFloat(adsCost) || 0) + 
    (parseFloat(errorAdjustments) || 0) + (parseFloat(otherFees) || 0);

  const commissionLabel = selectedPlatform === "deliveroo" ? "Commission Deliveroo" : "Commission Uber";
  const selectedPlatformConfig = PLATFORMS.find(p => p.value === selectedPlatform);

  const getPlatformBadge = (platform: string) => {
    const p = PLATFORMS.find(pl => pl.value === platform);
    return p ? (
      <Badge className={`${p.color} flex items-center gap-1.5`}>
        <p.Logo size={14} />
        {p.label}
      </Badge>
    ) : <Badge variant="outline">{platform}</Badge>;
  };

  const selectedRestaurantName = restaurants?.find(r => r.id === selectedRestaurant)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {restaurantFromUrl && (
          <Button variant="ghost" size="icon" onClick={() => navigate(`/restaurants/${restaurantFromUrl}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Saisie des données mensuelles</h1>
          <p className="text-muted-foreground mt-1">
            CA, conversion et frais pour {selectedRestaurantName || "votre restaurant"}
          </p>
        </div>
      </div>

      {/* Shared Period Selection */}
      <Card className={`transition-all duration-300 border-2 ${selectedPlatformConfig?.cardStyle}`}>
        <CardHeader className="relative pb-4">
          <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-lg ${selectedPlatformConfig?.indicatorStyle}`} />
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Restaurant</Label>
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant} disabled={!!restaurantFromUrl}>
                  <SelectTrigger className="h-9">
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

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Plateforme</Label>
                <div className="flex gap-1">
                  {PLATFORMS.map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      size="sm"
                      variant={selectedPlatform === p.value ? "default" : "outline"}
                      className="flex-1 h-9"
                      onClick={() => setSelectedPlatform(p.value)}
                    >
                      <p.Logo size={16} />
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Année</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="h-9">
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
                <Label className="text-xs text-muted-foreground">Mois</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="h-9">
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
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="revenue" className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                <span className="hidden sm:inline">CA & Commandes</span>
                <span className="sm:hidden">CA</span>
              </TabsTrigger>
              <TabsTrigger value="conversion" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Conversion</span>
                <span className="sm:hidden">Conv.</span>
              </TabsTrigger>
              <TabsTrigger value="fees" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Frais & Marketing</span>
                <span className="sm:hidden">Frais</span>
              </TabsTrigger>
            </TabsList>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-4 mt-0">
              {existingRevenue && !revenueEditingId && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Données existantes pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                    <span className="ml-2 text-sm">
                      ({Number(existingRevenue.revenue_ttc).toLocaleString("fr-FR")} € • {existingRevenue.order_count} cmd)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-amber-700" onClick={() => handleEditRevenue(existingRevenue)}>
                      Modifier
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CA TTC (€)</Label>
                  <Input type="number" step="0.01" value={revenueTtc} onChange={(e) => setRevenueTtc(e.target.value)} placeholder="Ex: 15000.50" />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de commandes</Label>
                  <Input type="number" value={orderCount} onChange={(e) => setOrderCount(e.target.value)} placeholder="Ex: 450" />
                </div>
                <div className="space-y-2">
                  <Label>Jours ouvrés (optionnel)</Label>
                  <Input type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} placeholder="Ex: 30" />
                </div>
                <div className="space-y-2">
                  <Label>Panier moyen (€) - optionnel</Label>
                  <Input type="number" step="0.01" value={averageBasket} onChange={(e) => setAverageBasket(e.target.value)} placeholder={`Auto: ${calculatedBasket} €`} />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Panier moyen :</span> <span className="font-medium">{previewBasket} €</span></div>
                <div><span className="text-muted-foreground">CA/jour :</span> <span className="font-medium">{previewPerDay} €</span></div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveRevenue} disabled={!selectedRestaurant || revenueMutation.isPending} className="flex-1">
                  {revenueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {revenueEditingId ? "Mettre à jour" : existingRevenue ? "Remplacer" : "Enregistrer"}
                </Button>
                {revenueEditingId && <Button variant="outline" onClick={resetRevenueForm}>Annuler</Button>}
              </div>
            </TabsContent>

            {/* Conversion Tab */}
            <TabsContent value="conversion" className="space-y-4 mt-0">
              {existingConversion && !conversionEditingId && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Données existantes pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                    <span className="ml-2 text-sm">
                      ({existingConversion.visits.toLocaleString("fr-FR")} visites • {Number(existingConversion.overall_rate).toFixed(1)}%)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-amber-700" onClick={() => handleEditConversion(existingConversion)}>
                      Modifier
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de visites</Label>
                  <Input type="number" value={visits} onChange={(e) => setVisits(e.target.value)} placeholder="Ex: 5000" />
                </div>
                <div className="space-y-2">
                  <Label>Consultations du menu</Label>
                  <Input type="number" value={menuViews} onChange={(e) => setMenuViews(e.target.value)} placeholder="Ex: 3500" />
                </div>
                <div className="space-y-2">
                  <Label>Ajouts au panier</Label>
                  <Input type="number" value={addToCart} onChange={(e) => setAddToCart(e.target.value)} placeholder="Ex: 800" />
                </div>
                <div className="space-y-2">
                  <Label>Commandes passées</Label>
                  <Input type="number" value={orders} onChange={(e) => setOrders(e.target.value)} placeholder="Ex: 450" />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4" /> Taux de conversion</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Visites → Menu :</span> <span className="font-medium">{viewRate}%</span></div>
                  <div><span className="text-muted-foreground">Menu → Panier :</span> <span className="font-medium">{cartRate}%</span></div>
                  <div><span className="text-muted-foreground">Panier → Cmd :</span> <span className="font-medium">{conversionRate}%</span></div>
                  <div><span className="text-muted-foreground font-medium">Global :</span> <span className="font-bold text-primary">{overallRate}%</span></div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveConversion} disabled={!selectedRestaurant || conversionMutation.isPending} className="flex-1">
                  {conversionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {conversionEditingId ? "Mettre à jour" : existingConversion ? "Remplacer" : "Enregistrer"}
                </Button>
                {conversionEditingId && <Button variant="outline" onClick={resetConversionForm}>Annuler</Button>}
              </div>
            </TabsContent>

            {/* Fees Tab */}
            <TabsContent value="fees" className="space-y-4 mt-0">
              {existingFees && !feesEditingId && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Données existantes pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                    <span className="ml-2 text-sm">
                      (Total: {(Number(existingFees.uber_fee) + Number(existingFees.marketing_fee) + Number(existingFees.offers_cost) + Number(existingFees.ads_cost)).toLocaleString("fr-FR")} €)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-amber-700" onClick={() => handleEditFees(existingFees)}>
                      Modifier
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{commissionLabel} (€)</Label>
                  <Input type="number" step="0.01" value={uberFee} onChange={(e) => setUberFee(e.target.value)} placeholder="Ex: 4500" />
                </div>
                <div className="space-y-2">
                  <Label>Frais marketing (€)</Label>
                  <Input type="number" step="0.01" value={marketingFee} onChange={(e) => setMarketingFee(e.target.value)} placeholder="Ex: 200" />
                </div>
                <div className="space-y-2">
                  <Label>Coût des offres (€)</Label>
                  <Input type="number" step="0.01" value={offersCost} onChange={(e) => setOffersCost(e.target.value)} placeholder="Ex: 350" />
                </div>
                <div className="space-y-2">
                  <Label>Publicité (€)</Label>
                  <Input type="number" step="0.01" value={adsCost} onChange={(e) => setAdsCost(e.target.value)} placeholder="Ex: 150" />
                </div>
                <div className="space-y-2">
                  <Label>Ajustements erreurs (€)</Label>
                  <Input type="number" step="0.01" value={errorAdjustments} onChange={(e) => setErrorAdjustments(e.target.value)} placeholder="Ex: 50" />
                </div>
                <div className="space-y-2">
                  <Label>Autres frais (€)</Label>
                  <Input type="number" step="0.01" value={otherFees} onChange={(e) => setOtherFees(e.target.value)} placeholder="Ex: 25" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Versement net reçu (€)</Label>
                  <Input type="number" step="0.01" value={netPayout} onChange={(e) => setNetPayout(e.target.value)} placeholder="Ex: 9724.50" />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques..." rows={1} />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium flex items-center gap-2 mb-2"><Calculator className="h-4 w-4" /> Récapitulatif</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Total frais :</span> <span className="font-bold text-primary">{totalFees.toLocaleString("fr-FR")} €</span></div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveFees} disabled={!selectedRestaurant || feesMutation.isPending} className="flex-1">
                  {feesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {feesEditingId ? "Mettre à jour" : existingFees ? "Remplacer" : "Enregistrer"}
                </Button>
                {feesEditingId && <Button variant="outline" onClick={resetFeesForm}>Annuler</Button>}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Historique
              <Badge variant="outline" className="font-normal">
                {activeTab === "revenue" ? "CA & Commandes" : activeTab === "conversion" ? "Conversion" : "Frais"}
              </Badge>
            </CardTitle>
            {getPlatformBadge(selectedPlatform)}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedRestaurant ? (
            <p className="text-muted-foreground text-center py-8">Sélectionnez un restaurant pour voir l'historique</p>
          ) : activeTab === "revenue" ? (
            loadingRevenue ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 
            !revenueEntries?.length ? <p className="text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">CA TTC</TableHead>
                      <TableHead className="text-right">Cmd</TableHead>
                      <TableHead className="text-right">Panier</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{getMonthLabel(entry.month)} {entry.year}</TableCell>
                        <TableCell className="text-right">{Number(entry.revenue_ttc).toLocaleString("fr-FR")} €</TableCell>
                        <TableCell className="text-right">{entry.order_count}</TableCell>
                        <TableCell className="text-right">{Number(entry.average_basket).toFixed(2)} €</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditRevenue(entry)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteRevenueMutation.mutate(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : activeTab === "conversion" ? (
            loadingConversion ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 
            !conversionEntries?.length ? <p className="text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Visites</TableHead>
                      <TableHead className="text-right">Cmd</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversionEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{getMonthLabel(entry.month)} {entry.year}</TableCell>
                        <TableCell className="text-right">{entry.visits.toLocaleString("fr-FR")}</TableCell>
                        <TableCell className="text-right">{entry.orders}</TableCell>
                        <TableCell className="text-right">{Number(entry.overall_rate).toFixed(1)}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditConversion(entry)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteConversionMutation.mutate(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            loadingFees ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 
            !feesEntries?.length ? <p className="text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Marketing</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feesEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{getMonthLabel(entry.month)} {entry.year}</TableCell>
                        <TableCell className="text-right">{Number(entry.uber_fee).toLocaleString("fr-FR")} €</TableCell>
                        <TableCell className="text-right">{(Number(entry.marketing_fee) + Number(entry.offers_cost) + Number(entry.ads_cost)).toLocaleString("fr-FR")} €</TableCell>
                        <TableCell className="text-right">{Number(entry.net_payout).toLocaleString("fr-FR")} €</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditFees(entry)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteFeesMutation.mutate(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
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
            <AlertDialogAction onClick={() => { setShowRevenueConfirm(false); revenueMutation.mutate(); }}>Remplacer</AlertDialogAction>
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
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
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
            <AlertDialogAction onClick={() => { setShowConversionConfirm(false); conversionMutation.mutate(); }}>Remplacer</AlertDialogAction>
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
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                    <p className="font-medium mb-2 text-foreground">Nouvelles</p>
                    <p className="text-muted-foreground">Total: {totalFees.toLocaleString("fr-FR")} €</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowFeesConfirm(false); feesMutation.mutate(); }}>Remplacer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
