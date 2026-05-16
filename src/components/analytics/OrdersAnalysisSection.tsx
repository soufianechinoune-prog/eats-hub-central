import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Calendar, 
  Clock, 
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Receipt,
  Search,
  Tag,
  Truck,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancesDrilldown, type DrilldownGranularity, type OrderSortField, type SortDirection as OrderSortDirection } from "@/hooks/useFinancesDrilldown";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { OrderItemsDropdown } from "./OrderItemsDropdown";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Restaurant {
  id: string;
  name: string;
}

interface OrdersAnalysisSectionProps {
  restaurants: Restaurant[];
  selectedRestaurants: string[];
  startDate: Date;
  endDate: Date;
  platform?: "uber_eats" | "deliveroo" | "global";
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
};

const formatCurrencyPrecise = (value: number) => {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const formatPercent = (value: number) => {
  return value.toFixed(1) + '%';
};

const getProfitabilityColor = (value: number) => {
  if (value >= 70) return 'text-green-600';
  if (value >= 60) return 'text-amber-600';
  return 'text-red-600';
};

export function OrdersAnalysisSection({ 
  restaurants, 
  selectedRestaurants,
  startDate,
  endDate,
  platform = "uber_eats",
}: OrdersAnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DrilldownGranularity>('daily');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    selectedRestaurants.length === 1 ? selectedRestaurants[0] : null
  );
  
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showOffersOnly, setShowOffersOnly] = useState(false);
  const [fulfillmentFilter, setFulfillmentFilter] = useState<"all" | "delivery" | "pickup">("all");
  
  // Expanded orders state for dropdown
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  // Sorting state for daily/hourly tabs
  type SortField = 'date' | 'orders' | 'sales' | 'profitability' | 'commission' | 'promos' | 'refunds' | 'payout' | 'mealVoucher' | 'totalPayout';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Sorting state for order tab (server-side)
  const [orderSortField, setOrderSortField] = useState<OrderSortField>('order_datetime');
  const [orderSortDir, setOrderSortDir] = useState<OrderSortDirection>('desc');
  
  // Payout detail sheet state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(orderSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [orderSearchQuery]);
  
  // Determine which restaurant IDs to query
  const queryRestaurantIds = useMemo(() => {
    if (selectedRestaurantId) return [selectedRestaurantId];
    if (selectedRestaurants.length > 0) return selectedRestaurants;
    return restaurants.map(r => r.id);
  }, [selectedRestaurantId, selectedRestaurants, restaurants]);
  
  // Fetch drilldown data
  const { 
    dailyData, 
    hourlyData, 
    productData,
    orderData,
    orderPagination,
    orderIdsWithItems,
    fulfillmentStats,
    isLoading 
  } = useFinancesDrilldown({
    restaurantIds: queryRestaurantIds,
    startDate,
    endDate,
    granularity: activeTab,
    enabled: isExpanded,
    orderSearchQuery: debouncedSearch,
    orderSortField,
    orderSortDirection: orderSortDir,
    platform,
    fulfillmentFilter,
  });
  
  // Handle order sort toggle
  const handleOrderSort = (field: OrderSortField) => {
    if (orderSortField === field) {
      setOrderSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderSortField(field);
      setOrderSortDir('desc');
    }
  };
  
  // Render sort icon for order columns
  const renderOrderSortIcon = (field: OrderSortField) => {
    if (orderSortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return orderSortDir === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };
  
  // Toggle expanded order
  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };
  
  // Reset state when changing tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value as DrilldownGranularity);
    setOrderSearchQuery("");
    setDebouncedSearch("");
    setExpandedOrders(new Set());
  };
  
  // Fetch payout detail when a date is selected
  const { data: payoutDetail } = useQuery({
    queryKey: ["payout-detail-orders", selectedRestaurantId, selectedDate],
    queryFn: async () => {
      if (!selectedDate || !selectedRestaurantId) return null;
      
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .eq("payout_date", selectedDate)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDate && !!selectedRestaurantId && sheetOpen,
  });
  
  const handleDayClick = (date: string) => {
    if (selectedRestaurantId) {
      setSelectedDate(date);
      setSheetOpen(true);
    }
  };
  
  const getRestaurantName = (id: string) => {
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8);
  };
  
  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'asc' : 'desc');
    }
  };
  
  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };
  
  // Sort daily data
  const sortedDailyData = useMemo(() => {
    if (!dailyData?.length) return [];
    
    return [...dailyData].sort((a, b) => {
      let comparison = 0;
      const profitA = a.sales_incl_vat > 0 ? (a.net_payout / a.sales_incl_vat) * 100 : 0;
      const profitB = b.sales_incl_vat > 0 ? (b.net_payout / b.sales_incl_vat) * 100 : 0;
      
      switch (sortField) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'orders':
          comparison = a.order_count - b.order_count;
          break;
        case 'sales':
          comparison = a.sales_incl_vat - b.sales_incl_vat;
          break;
        case 'profitability':
          comparison = profitA - profitB;
          break;
        case 'commission':
          comparison = a.uber_fee_incl_vat - b.uber_fee_incl_vat;
          break;
        case 'promos':
          comparison = a.promo_incl_vat - b.promo_incl_vat;
          break;
        case 'refunds':
          comparison = a.refund_incl_vat - b.refund_incl_vat;
          break;
        case 'payout':
          comparison = a.net_payout - b.net_payout;
          break;
        case 'mealVoucher':
          comparison = a.meal_voucher_amount - b.meal_voucher_amount;
          break;
        case 'totalPayout':
          comparison = a.total_payout - b.total_payout;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [dailyData, sortField, sortDirection]);
  
  // Calculate totals
  const dailyTotals = useMemo(() => {
    if (!dailyData?.length) return null;
    return {
      orders: dailyData.reduce((sum, d) => sum + d.order_count, 0),
      sales: dailyData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
      refunds: dailyData.reduce((sum, d) => sum + d.refund_incl_vat, 0),
      netPayout: dailyData.reduce((sum, d) => sum + d.net_payout, 0),
      commission: dailyData.reduce((sum, d) => sum + d.uber_fee_incl_vat, 0),
      promos: dailyData.reduce((sum, d) => sum + d.promo_incl_vat, 0),
      mealVoucher: dailyData.reduce((sum, d) => sum + d.meal_voucher_amount, 0),
      totalPayout: dailyData.reduce((sum, d) => sum + d.total_payout, 0),
    };
  }, [dailyData]);
  
  const hourlyTotals = useMemo(() => {
    if (!hourlyData?.length) return null;
    const maxOrders = Math.max(...hourlyData.map(h => h.order_count));
    return {
      orders: hourlyData.reduce((sum, d) => sum + d.order_count, 0),
      sales: hourlyData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
      peakHour: hourlyData.find(h => h.order_count === maxOrders)?.hour ?? null,
    };
  }, [hourlyData]);
  
  const productTotals = useMemo(() => {
    if (!productData?.length) return null;
    return {
      quantity: productData.reduce((sum, d) => sum + d.quantity, 0),
      sales: productData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
    };
  }, [productData]);

  // Helper to detect fulfillment type
  const getFulfillmentType = (ft: string | null | undefined): "delivery" | "pickup" | null => {
    if (!ft) return null;
    const lower = ft.toLowerCase();
    if (lower.includes("livraison") || lower.includes("delivery") || lower.includes("coursier")) return "delivery";
    if (lower.includes("emporter") || lower.includes("pickup") || lower.includes("à emporter")) return "pickup";
    return null;
  };

  // Filter orders by offer status (fulfillment is now server-side)
  const filteredOrderData = useMemo(() => {
    let data = orderData;
    if (showOffersOnly) data = data.filter(o => o.has_offer);
    return data;
  }, [orderData, showOffersOnly]);

  if (!isExpanded) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 flex flex-col items-center gap-3">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Analyse détaillée des commandes individuelles</p>
          <Button variant="outline" onClick={() => setIsExpanded(true)}>
            Charger l'analyse des commandes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle>Analyse par Commandes</CardTitle>
            <Badge variant="outline" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Données commandes
            </Badge>
          </div>
          
          {/* Restaurant selector */}
          {(selectedRestaurants.length !== 1) && (
            <Select 
              value={selectedRestaurantId || "all"} 
              onValueChange={(v) => setSelectedRestaurantId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Sélectionner un restaurant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les restaurants</SelectItem>
                {(selectedRestaurants.length > 0 
                  ? restaurants.filter(r => selectedRestaurants.includes(r.id))
                  : restaurants
                ).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        {/* Info banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-4">
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Ces données proviennent des commandes individuelles et peuvent différer 
              des récapitulatifs de versement. Utilisez-les pour analyser les tendances 
              jour/heure/produit, pas pour la comptabilité.
            </span>
          </p>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Par Jour
            </TabsTrigger>
            <TabsTrigger value="hourly" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Par Heure
            </TabsTrigger>
            <TabsTrigger value="product" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Par Produit
            </TabsTrigger>
            <TabsTrigger value="order" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Par Commande
            </TabsTrigger>
          </TabsList>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Daily Tab */}
              <TabsContent value="daily" className="mt-0">
                {sortedDailyData && sortedDailyData.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('date')}
                            >
                              <div className="flex items-center">
                                Date
                                <SortIcon field="date" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('orders')}
                            >
                              <div className="flex items-center justify-end">
                                Cmd
                                <SortIcon field="orders" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('sales')}
                            >
                              <div className="flex items-center justify-end">
                                CA TTC
                                <SortIcon field="sales" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('profitability')}
                            >
                              <div className="flex items-center justify-end">
                                Rentab.
                                <SortIcon field="profitability" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('commission')}
                            >
                              <div className="flex items-center justify-end">
                                Commission
                                <SortIcon field="commission" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('promos')}
                            >
                              <div className="flex items-center justify-end">
                                {platform === "deliveroo" ? "Contrib. Mktg" : "Promos"}
                                <SortIcon field="promos" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('refunds')}
                            >
                              <div className="flex items-center justify-end">
                                Remb.
                                <SortIcon field="refunds" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('payout')}
                            >
                              <div className="flex items-center justify-end">
                                Vers. Uber
                                <SortIcon field="payout" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('mealVoucher')}
                            >
                              <div className="flex items-center justify-end">
                                Titre Resto
                                <SortIcon field="mealVoucher" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('totalPayout')}
                            >
                              <div className="flex items-center justify-end">
                                Vers. Total
                                <SortIcon field="totalPayout" />
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedDailyData.map((day) => {
                            const profitability = day.sales_incl_vat > 0 
                              ? (day.total_payout / day.sales_incl_vat) * 100 
                              : 0;
                            const isClickable = !!selectedRestaurantId;
                            
                            return (
                              <TableRow 
                                key={day.date}
                                className={cn(
                                  isClickable && "cursor-pointer hover:bg-muted/50"
                                )}
                                onClick={() => isClickable && handleDayClick(day.date)}
                              >
                                <TableCell className="font-medium">
                                  {format(new Date(day.date), "EEEE d MMMM", { locale: fr })}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {day.order_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCurrency(day.sales_incl_vat)}
                                </TableCell>
                                <TableCell className={cn("text-right tabular-nums font-medium", getProfitabilityColor(profitability))}>
                                  {formatPercent(profitability)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-orange-600">
                                  {day.uber_fee_incl_vat > 0 ? `-${formatCurrency(day.uber_fee_incl_vat)}` : '-'}
                                </TableCell>
                                <TableCell className={cn("text-right tabular-nums", platform === "deliveroo" ? "text-green-600" : "text-purple-600")}>
                                  {day.promo_incl_vat > 0 ? `${platform === "deliveroo" ? "+" : "-"}${formatCurrency(day.promo_incl_vat)}` : '-'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-red-600">
                                  {day.refund_incl_vat > 0 ? `-${formatCurrency(day.refund_incl_vat)}` : '-'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-green-600">
                                  {formatCurrency(day.net_payout)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-blue-600">
                                  {day.meal_voucher_amount > 0 ? formatCurrency(day.meal_voucher_amount) : '-'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-green-700 font-bold">
                                  {formatCurrency(day.total_payout)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Totals row */}
                          {dailyTotals && (
                            <TableRow className="bg-muted/50 font-medium border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {dailyTotals.orders}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(dailyTotals.sales)}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right tabular-nums",
                                getProfitabilityColor((dailyTotals.totalPayout / dailyTotals.sales) * 100)
                              )}>
                                {formatPercent((dailyTotals.totalPayout / dailyTotals.sales) * 100)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-orange-600">
                                {dailyTotals.commission > 0 ? `-${formatCurrency(dailyTotals.commission)}` : '-'}
                              </TableCell>
                              <TableCell className={cn("text-right tabular-nums", platform === "deliveroo" ? "text-green-600" : "text-purple-600")}>
                                {dailyTotals.promos > 0 ? `${platform === "deliveroo" ? "+" : "-"}${formatCurrency(dailyTotals.promos)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">
                                {dailyTotals.refunds > 0 ? `-${formatCurrency(dailyTotals.refunds)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">
                                {formatCurrency(dailyTotals.netPayout)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-blue-600">
                                {dailyTotals.mealVoucher > 0 ? formatCurrency(dailyTotals.mealVoucher) : '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-green-700 font-bold">
                                {formatCurrency(dailyTotals.totalPayout)}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>
              
              {/* Hourly Tab */}
              <TabsContent value="hourly" className="mt-0">
                {hourlyData && hourlyData.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Créneau</TableHead>
                            <TableHead className="text-right">Commandes</TableHead>
                            <TableHead className="text-right">CA TTC</TableHead>
                            <TableHead className="text-right">Panier Ø</TableHead>
                            <TableHead className="text-right">% du total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hourlyData.map((hour) => {
                            const shareOfTotal = hourlyTotals 
                              ? (hour.order_count / hourlyTotals.orders) * 100 
                              : 0;
                            const isPeak = hourlyTotals?.peakHour === hour.hour;
                            
                            return (
                              <TableRow 
                                key={hour.hour}
                                className={cn(isPeak && "bg-green-500/5")}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {`${hour.hour}:00 - ${hour.hour + 1}:00`}
                                    {isPeak && (
                                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        Peak
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {hour.order_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCurrency(hour.sales_incl_vat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatCurrency(hour.avg_basket)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary rounded-full"
                                        style={{ width: `${Math.min(shareOfTotal * 3, 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-12 text-right">{formatPercent(shareOfTotal)}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Totals row */}
                          {hourlyTotals && (
                            <TableRow className="bg-muted/50 font-medium border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hourlyTotals.orders}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(hourlyTotals.sales)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatCurrency(hourlyTotals.orders > 0 ? hourlyTotals.sales / hourlyTotals.orders : 0)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                100%
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>
              
              {/* Product Tab */}
              <TabsContent value="product" className="mt-0">
                {productData && productData.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead className="text-right">Qté vendue</TableHead>
                            <TableHead className="text-right">CA TTC</TableHead>
                            <TableHead className="text-right">Prix Ø</TableHead>
                            <TableHead className="text-right">Remb.</TableHead>
                            <TableHead className="text-right">Taux remb.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productData.slice(0, 50).map((product, idx) => {
                            const isTopProduct = idx < 3;
                            
                            return (
                              <TableRow 
                                key={product.item_id}
                                className={cn(isTopProduct && "bg-green-500/5")}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isTopProduct && (
                                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">
                                        {idx + 1}
                                      </Badge>
                                    )}
                                    <span className="font-medium truncate max-w-[300px]">
                                      {product.item_title}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {product.quantity}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCurrency(product.sales_incl_vat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatCurrency(product.avg_unit_price)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-red-600">
                                  {product.refund_incl_vat > 0 ? `-${formatCurrency(product.refund_incl_vat)}` : '-'}
                                </TableCell>
                                <TableCell className={cn(
                                  "text-right tabular-nums",
                                  product.refund_rate > 5 ? "text-red-600" : "text-muted-foreground"
                                )}>
                                  {product.refund_rate > 0 ? formatPercent(product.refund_rate) : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Totals row */}
                          {productTotals && (
                            <TableRow className="bg-muted/50 font-medium border-t-2">
                              <TableCell>
                                Total ({productData.length} produits)
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {productTotals.quantity}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(productTotals.sales)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatCurrency(productTotals.quantity > 0 ? productTotals.sales / productTotals.quantity : 0)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                -
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                -
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>
              
              {/* Order Tab */}
              <TabsContent value="order" className="mt-0">
                {/* Fulfillment KPI badges */}
                {fulfillmentStats && (fulfillmentStats.delivery.count > 0 || fulfillmentStats.pickup.count > 0) && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        Livraison : {fulfillmentStats.delivery.count} ({fulfillmentStats.delivery.pct.toFixed(0)}%) — {formatCurrency(fulfillmentStats.delivery.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <ShoppingBag className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        Emporté : {fulfillmentStats.pickup.count} ({fulfillmentStats.pickup.pct.toFixed(0)}%) — {formatCurrency(fulfillmentStats.pickup.revenue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Search field + filters */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par n° commande ou article..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={fulfillmentFilter} onValueChange={(v) => { setFulfillmentFilter(v as "all" | "delivery" | "pickup"); }}>
                    <SelectTrigger className="w-[170px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous types</SelectItem>
                      <SelectItem value="delivery">
                        <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Livraison</span>
                      </SelectItem>
                      <SelectItem value="pickup">
                        <span className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Emporté</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {platform === "deliveroo" && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={showOffersOnly}
                        onCheckedChange={setShowOffersOnly}
                        id="offers-filter"
                      />
                      <label htmlFor="offers-filter" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        Avec offre
                      </label>
                    </div>
                  )}
                  {orderPagination && (
                    <span className="text-sm text-muted-foreground">
                      {orderPagination.totalCount.toLocaleString('fr-FR')} commandes
                    </span>
                  )}
                </div>
                
                {filteredOrderData && filteredOrderData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-md border overflow-hidden">
                      <div className="max-h-[500px] overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                          <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                            <TableRow>
                              {platform !== "deliveroo" && <TableHead className="w-8"></TableHead>}
                              <TableHead>N° Commande</TableHead>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('order_datetime')}
                              >
                                <div className="flex items-center">
                                  Date/Heure
                                  {renderOrderSortIcon('order_datetime')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('sales_excl_vat')}
                              >
                                <div className="flex items-center justify-end">
                                  CA HT
                                  {renderOrderSortIcon('sales_excl_vat')}
                                </div>
                              </TableHead>
                              <TableHead className="text-right select-none">
                                TVA
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('sales_incl_vat')}
                              >
                                <div className="flex items-center justify-end">
                                  CA TTC
                                  {renderOrderSortIcon('sales_incl_vat')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('profitability')}
                              >
                                <div className="flex items-center justify-end">
                                  Rentab.
                                  {renderOrderSortIcon('profitability')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('uber_fee')}
                              >
                                <div className="flex items-center justify-end">
                                  Commission
                                  {renderOrderSortIcon('uber_fee')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('promo')}
                              >
                                 <div className="flex items-center justify-end">
                                  {platform === "deliveroo" ? "Contrib. Mktg" : "Promos"}
                                  {renderOrderSortIcon('promo')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('refund')}
                              >
                                <div className="flex items-center justify-end">
                                  Remb.
                                  {renderOrderSortIcon('refund')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('net_payout')}
                              >
                                 <div className="flex items-center justify-end">
                                  {platform === "deliveroo" ? "Vers. Deliv." : "Vers. Uber"}
                                  {renderOrderSortIcon('net_payout')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('meal_voucher')}
                              >
                                <div className="flex items-center justify-end">
                                  Titre Resto
                                  {renderOrderSortIcon('meal_voucher')}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleOrderSort('total_payout')}
                              >
                                <div className="flex items-center justify-end">
                                  Vers. Total
                                  {renderOrderSortIcon('total_payout')}
                                </div>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrderData.map((order) => (
                              <>
                                <TableRow 
                                  key={order.id}
                                  className={cn("hover:bg-muted/50", platform !== "deliveroo" && "cursor-pointer")}
                                  onClick={() => platform !== "deliveroo" && toggleOrder(order.id)}
                                >
                                  {platform !== "deliveroo" && (
                                    <TableCell className="w-8">
                                      <ChevronRight className={cn(
                                        "h-4 w-4 transition-transform",
                                        expandedOrders.has(order.id) && "rotate-90",
                                        !orderIdsWithItems.includes(order.id) && "opacity-30"
                                      )} />
                                    </TableCell>
                                  )}
                                  <TableCell className="font-mono text-xs">
                                    <div className="flex items-center gap-1.5">
                                      {getFulfillmentType(order.fulfillment_type) === "delivery" && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Truck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                            </TooltipTrigger>
                                            <TooltipContent><span className="text-xs">Livraison</span></TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {getFulfillmentType(order.fulfillment_type) === "pickup" && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <ShoppingBag className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                                            </TooltipTrigger>
                                            <TooltipContent><span className="text-xs">Emporté</span></TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      <span>#{order.uber_order_id?.slice(-8) || order.id.slice(0, 8)}</span>
                                      {order.has_offer && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 text-[10px] px-1.5 py-0 cursor-default">
                                                <Tag className="h-2.5 w-2.5 mr-0.5" />
                                                Offre
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs">
                                              <div className="text-xs space-y-1">
                                                {order.offer_note && <p>{order.offer_note}</p>}
                                                {(order.deliveroo_funding ?? 0) > 0 && (
                                                  <p className="text-emerald-600 dark:text-emerald-400">
                                                    Co-financement Deliveroo : +{order.deliveroo_funding?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                                                  </p>
                                                )}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {((order.marketing_cofunding ?? 0) > 0 || (order.deliveroo_funding ?? 0) > 0) && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30 hover:bg-teal-500/25 text-[10px] px-1.5 py-0 cursor-default">
                                                Cofin +{((order.marketing_cofunding ?? 0) || (order.deliveroo_funding ?? 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs">
                                              <p className="text-xs">
                                                {(order.marketing_cofunding ?? 0) > 0
                                                  ? <>Cofinancement <strong>Uber Eats</strong> : +{order.marketing_cofunding!.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € (Ajustement marketing remboursé par Uber sur cette commande).</>
                                                  : <>Cofinancement <strong>Deliveroo</strong> : +{order.deliveroo_funding!.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €.</>
                                                }
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {(order.offer_fee_incl_vat ?? 0) > 0 && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25 text-[10px] px-1.5 py-0 cursor-default">
                                                Frais {order.offer_fee_incl_vat!.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs">
                                              <p className="text-xs">
                                                Frais d'utilisation de l'offre prélevé par Uber : {order.offer_fee_incl_vat!.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC (0,89 € HT + TVA). Offre <strong>non exonérée</strong>.
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {order.order_datetime 
                                      ? format(new Date(order.order_datetime), "dd/MM HH:mm", { locale: fr })
                                      : '-'
                                    }
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums font-medium">
                                    {formatCurrencyPrecise(order.sales_excl_vat)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">
                                    {formatCurrencyPrecise(order.vat_amount)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums font-medium">
                                    {formatCurrencyPrecise(order.sales_incl_vat)}
                                  </TableCell>
                                  <TableCell className={cn(
                                    "text-right tabular-nums font-medium",
                                    getProfitabilityColor(order.profitability)
                                  )}>
                                    {formatPercent(order.profitability)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-orange-600">
                                    {order.uber_fee_incl_vat > 0 ? `-${formatCurrencyPrecise(order.uber_fee_incl_vat)}` : '-'}
                                  </TableCell>
                                  <TableCell className={cn("text-right tabular-nums", platform === "deliveroo" ? "text-green-600" : "text-purple-600")}>
                                    {order.promo_incl_vat > 0 ? `${platform === "deliveroo" ? "+" : "-"}${formatCurrencyPrecise(order.promo_incl_vat)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-red-600">
                                    {order.refund_incl_vat > 0 ? `-${formatCurrencyPrecise(order.refund_incl_vat)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-green-600">
                                    {formatCurrencyPrecise(order.net_payout)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-blue-600">
                                    {order.meal_voucher_amount > 0 ? formatCurrencyPrecise(order.meal_voucher_amount) : '-'}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-green-700 font-bold">
                                    {formatCurrencyPrecise(order.total_payout)}
                                  </TableCell>
                                </TableRow>
                                
                                {/* Expanded row with items */}
                                {platform !== "deliveroo" && expandedOrders.has(order.id) && (
                                  <OrderItemsDropdown orderId={order.id} />
                                )}
                              </>
                            ))}
                          </TableBody>
                        </table>
                        
                        {filteredOrderData.length > 0 && (
                          <div className="py-3 flex justify-center">
                            <span className="text-muted-foreground text-sm">
                              {filteredOrderData.length.toLocaleString('fr-FR')} commandes affichées
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : !isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {debouncedSearch 
                      ? `Aucune commande trouvée pour "${debouncedSearch}"`
                      : "Aucune donnée disponible pour cette période"
                    }
                  </div>
                ) : null}
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
      
      {/* Payout Detail Sheet */}
      <PayoutDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        payouts={payoutDetail ? [payoutDetail] : []}
        restaurants={restaurants}
      />
    </Card>
  );
}
