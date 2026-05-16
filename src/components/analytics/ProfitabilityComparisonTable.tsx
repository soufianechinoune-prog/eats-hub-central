import { useMemo, useState } from "react";
import { format, getWeek, getMonth, getYear, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { DailyFinancesSheet } from "./DailyFinancesSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle,
  ArrowUpDown,
  HelpCircle,
  Calendar,
  LayoutList,
  Layers,
  Percent,
  Euro,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ZoomIn
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PayoutData {
  payout_date: string;
  restaurant_id: string;
  sales_incl_vat: number;
  sales_excl_vat?: number;
  net_payout: number;
  uber_fee_after_promo_incl_vat: number;
  uber_fee_after_promo_excl_vat?: number;
  uber_fee_before_promo_excl_vat?: number;
  uber_fee_promo_excl_vat?: number;
  vat_uber_fee?: number;
  item_promo_incl_vat: number;
  refund_incl_vat: number;
  refund_excl_vat?: number;
  other_payments_incl_vat: number;
  marketing_fee_adjustment: number;
  order_count: number;
  meal_voucher_amount?: number;
  eco_contribution_refund?: number;
  eco_contribution_charge?: number;
}

interface RestaurantData {
  id: string;
  name: string;
  uber_commission_rate?: number | null;
}

interface AdvertisingDataRow {
  payout_date: string;
  restaurant_id: string;
  amount: number;
}

interface ProfitabilityComparisonTableProps {
  payouts: PayoutData[];
  restaurants: RestaurantData[];
  advertisingData?: AdvertisingDataRow[];
  platform?: "uber_eats" | "deliveroo" | "global";
}

// Helper to format percentage
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

// Helper to format currency
const formatCurrency = (value: number) => {
  const absValue = Math.abs(value);
  return `${value < 0 ? '-' : ''}${absValue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
};

interface ComparisonRow {
  label: string;
  date: string;
  restaurantId: string;
  restaurantName: string;
  sales: number;
  netSales: number;            // CA net après promos
  netPayout: number;
  mealVoucher: number;       // Versement Titre Restaurant
  ecoContribution: number;   // Remboursement éco-contribution
  ecoCharge: number;         // Prélèvement éco-contribution
  totalPayout: number;       // Versement Total (net + mealVoucher)
  profitability: number;
  // Commission breakdown
  uberFeeGross: number;      // Commission brute (avant promo)
  uberFeeReduction: number;  // Réduction Uber
  uberFeeNet: number;        // Commission nette (après promo)
  uberFeeRate: number;       // Taux net en % (calculé sur base HT)
  uberFeeGrossRate: number;  // Taux brut en %
  contractRate: number | null; // Taux contractuel
  promoRate: number;
  refundRate: number;
  otherRate: number;
  // Amounts for toggling display
  promoAmount: number;
  refundAmount: number;
  orderCount: number;
  avgBasket: number;
  weekNumber: number;
  year: number;
  weekLabel: string;
  advertisingAmount: number;
}

type DisplayMode = 'percent' | 'amount';

interface WeekGroup {
  weekKey: string;
  weekLabel: string;
  weekNumber: number;
  year: number;
  restaurants: ComparisonRow[];
}

interface MonthRestaurantData {
  restaurantId: string;
  restaurantName: string;
  sales: number;
  netPayout: number;
  mealVoucher: number;
  ecoContribution: number;
  ecoCharge: number;
  totalPayout: number;
  profitability: number;
  uberFeeRate: number;
  promoRate: number;
  refundRate: number;
  uberFee: number;
  promo: number;
  refund: number;
  orderCount: number;
  advertisingAmount: number;
}

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  monthNumber: number;
  year: number;
  rows: ComparisonRow[];
  totalSales: number;
  totalPayout: number;
  totalMealVoucher: number;
  totalPayoutWithVoucher: number;
  avgProfitability: number;
  avgUberFeeRate: number;
  avgPromoRate: number;
  avgRefundRate: number;
  totalUberFee: number;
  totalPromo: number;
  totalRefund: number;
  totalOrders: number;
  restaurantData: MonthRestaurantData[];
}

interface YearGroup {
  year: number;
  rows: ComparisonRow[];
  totalSales: number;
  totalPayout: number;
  totalMealVoucher: number;
  totalPayoutWithVoucher: number;
  avgProfitability: number;
  avgUberFeeRate: number;
  avgPromoRate: number;
  avgRefundRate: number;
  totalUberFee: number;
  totalPromo: number;
  totalRefund: number;
  totalOrders: number;
  restaurantData: MonthRestaurantData[];
}

type ViewMode = 'profitability' | 'week' | 'month' | 'year';

type SortColumn = 'date' | 'sales' | 'profitability' | 'commission' | 'promo' | 'refund' | 'payout';
type SortDirection = 'asc' | 'desc';

export function ProfitabilityComparisonTable({ 
  payouts, 
  restaurants,
  advertisingData = [],
  platform = "uber_eats",
}: ProfitabilityComparisonTableProps) {
  const { profitabilityBase, setProfitabilityBase, selectedYear, setSelectedYear } = useAnalyticsContext();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPayouts, setSelectedPayouts] = useState<PayoutData[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('profitability');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percent');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('profitability');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Daily drill-down sheet state
  const [dailySheetOpen, setDailySheetOpen] = useState(false);
  const [dailySheetPeriod, setDailySheetPeriod] = useState<{
    startDate: Date;
    endDate: Date;
    label: string;
    restaurantIds: string[];
  } | null>(null);
  
  
  
  // Handle sort column click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };
  
  const getRestaurantName = (id: string) => {
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8);
  };

  const getContractRate = (id: string) => {
    return restaurants.find(r => r.id === id)?.uber_commission_rate ?? null;
  };
  
  // Handle row click to open detail sheet
  const handleRowClick = (row: ComparisonRow) => {
    const matchingPayouts = payouts.filter(p => p.payout_date === row.date);
    setSelectedDate(row.date);
    setSelectedPayouts(matchingPayouts);
    setSheetOpen(true);
  };
  
  // Handle week drill-down to show daily view
  const handleWeekDrillDown = (group: WeekGroup) => {
    const weekDate = new Date(group.year, 0, 1);
    // Find the first day of this week
    const firstRowDate = group.restaurants[0]?.date;
    if (firstRowDate) {
      const baseDate = new Date(firstRowDate);
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
      
      // Get unique restaurant IDs from this week
      const restaurantIds = [...new Set(group.restaurants.map(r => r.restaurantId))];
      
      setDailySheetPeriod({
        startDate: weekStart,
        endDate: weekEnd,
        label: group.weekLabel,
        restaurantIds,
      });
      setDailySheetOpen(true);
    }
  };
  
  // Handle month drill-down to show daily view
  const handleMonthDrillDown = (group: MonthGroup) => {
    const monthStart = startOfMonth(new Date(group.year, group.monthNumber, 1));
    const monthEnd = endOfMonth(new Date(group.year, group.monthNumber, 1));
    
    // Get unique restaurant IDs from this month
    const restaurantIds = [...new Set(group.rows.map(r => r.restaurantId))];
    
    setDailySheetPeriod({
      startDate: monthStart,
      endDate: monthEnd,
      label: group.monthLabel,
      restaurantIds,
    });
    setDailySheetOpen(true);
  };
  
  // Transform payouts into comparison rows
  // Pre-aggregate advertising by payout_date + restaurant_id
  const adMap = useMemo(() => {
    const map = new Map<string, number>();
    advertisingData.forEach(ad => {
      const key = `${ad.payout_date}|${ad.restaurant_id}`;
      map.set(key, (map.get(key) || 0) + Number(ad.amount || 0));
    });
    return map;
  }, [advertisingData]);

  // ── Audit commission par canal (livraison vs à emporter) ──
  // On interroge l'agrégat orders pour vérifier que Uber applique bien 27 % / 15 %.
  const commissionQueryParams = useMemo(() => {
    if (platform === "deliveroo" || !payouts || payouts.length === 0) return null;
    const restaurantIds = Array.from(new Set(payouts.map(p => p.restaurant_id).filter(Boolean)));
    if (restaurantIds.length === 0) return null;
    const dates = payouts.map(p => p.payout_date).filter(Boolean).sort();
    return {
      restaurantIds,
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }, [payouts, platform]);

  const { data: commissionBreakdownRaw } = useQuery({
    queryKey: ["commission-breakdown-fulfillment", commissionQueryParams],
    queryFn: async () => {
      if (!commissionQueryParams) return [];
      const { data, error } = await supabase.rpc("get_orders_commission_by_fulfillment", {
        p_restaurant_ids: commissionQueryParams.restaurantIds,
        p_start_date: commissionQueryParams.start,
        p_end_date: commissionQueryParams.end,
      });
      if (error) {
        console.error("[ProfitabilityComparisonTable] get_orders_commission_by_fulfillment", error);
        return [];
      }
      return data || [];
    },
    enabled: !!commissionQueryParams,
    staleTime: 5 * 60 * 1000,
  });

  type ChannelBreakdown = {
    channel: "delivery" | "takeaway" | "web_online" | "other";
    orderCount: number;
    bhHT: number;
    baseTTC: number;
    rate: number;
    expectedRate: number;
  };

  const commissionBreakdownMap = useMemo(() => {
    const map = new Map<string, ChannelBreakdown[]>();
    if (!commissionBreakdownRaw) return map;
    for (const row of commissionBreakdownRaw as any[]) {
      const key = `${row.day}|${row.restaurant_id}`;
      const bh = Math.abs(Number(row.uber_fee_before_promo_excl_vat) || 0);
      const sales = Math.abs(Number(row.sales_incl_vat) || 0);
      const promo = Math.abs(Number(row.item_promo_incl_vat) || 0);
      const base = sales - promo;
      const rate = base > 0 ? (bh / base) * 100 : 0;
      const channel = (row.channel || "other") as ChannelBreakdown["channel"];
      const expectedRate = channel === "delivery" ? 27 : channel === "takeaway" ? 15 : 0;
      const list = map.get(key) || [];
      list.push({
        channel,
        orderCount: Number(row.order_count) || 0,
        bhHT: bh,
        baseTTC: base,
        rate,
        expectedRate,
      });
      map.set(key, list);
    }
    // Tri : livraison d'abord, puis à emporter, puis autres
    const order = { delivery: 0, takeaway: 1, other: 2 };
    for (const list of map.values()) {
      list.sort((a, b) => order[a.channel] - order[b.channel]);
    }
    return map;
  }, [commissionBreakdownRaw]);

  // ── Éco-contribution : lue depuis payout_adjustments (les colonnes payouts.eco_contribution_* ne sont jamais peuplées) ──
  const ecoQueryParams = useMemo(() => {
    if (platform === "deliveroo" || !payouts || payouts.length === 0) return null;
    const restaurantIds = Array.from(new Set(payouts.map(p => p.restaurant_id).filter(Boolean)));
    if (restaurantIds.length === 0) return null;
    const dates = payouts.map(p => p.payout_date).filter(Boolean).sort();
    return { restaurantIds, start: dates[0], end: dates[dates.length - 1] };
  }, [payouts, platform]);

  const { data: ecoAdjustmentsRaw } = useQuery({
    queryKey: ["eco-adjustments", ecoQueryParams],
    queryFn: async () => {
      if (!ecoQueryParams) return [];
      const { data, error } = await supabase
        .from("payout_adjustments")
        .select("payout_date, restaurant_id, amount")
        .eq("category", "eco_contribution")
        .in("restaurant_id", ecoQueryParams.restaurantIds)
        .gte("payout_date", ecoQueryParams.start)
        .lte("payout_date", ecoQueryParams.end);
      if (error) {
        console.error("[ProfitabilityComparisonTable] eco_adjustments", error);
        return [];
      }
      return data || [];
    },
    enabled: !!ecoQueryParams,
    staleTime: 5 * 60 * 1000,
  });

  const ecoMap = useMemo(() => {
    const map = new Map<string, { refund: number; charge: number }>();
    if (!ecoAdjustmentsRaw) return map;
    for (const row of ecoAdjustmentsRaw as any[]) {
      const key = `${row.payout_date}|${row.restaurant_id}`;
      const amount = Number(row.amount) || 0;
      const entry = map.get(key) || { refund: 0, charge: 0 };
      if (amount > 0) entry.refund += amount;
      else if (amount < 0) entry.charge += Math.abs(amount);
      map.set(key, entry);
    }
    return map;
  }, [ecoAdjustmentsRaw]);

  const comparisonData = useMemo(() => {
    const rows = payouts.map((payout): ComparisonRow => {
      const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
      const netPayout = Number(payout.net_payout) || 0;
      const uberFeeNet = Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
      const uberFeeGrossHT = Math.abs(Number(payout.uber_fee_before_promo_excl_vat) || 0);
      const uberFeeReductionHT = Math.abs(Number(payout.uber_fee_promo_excl_vat) || 0);
      const vatUberFee = Math.abs(Number(payout.vat_uber_fee) || 0);
      // Calculer brut TTC = brut HT + TVA proportionnelle
      const uberFeeGross = uberFeeGrossHT > 0 ? uberFeeGrossHT + (vatUberFee * (uberFeeGrossHT / (uberFeeGrossHT - uberFeeReductionHT || 1))) : uberFeeNet;
      const uberFeeReduction = uberFeeReductionHT > 0 ? uberFeeReductionHT * 1.2 : 0; // Approximation TVA 20%
      const promoAmount = Math.abs(Number(payout.item_promo_incl_vat) || 0);
      const refundAmount = Math.abs(Number(payout.refund_incl_vat) || 0);
      const other = Math.abs(Number(payout.other_payments_incl_vat) || 0);
      const orderCount = Number(payout.order_count) || 0;
      
      // Calcul du taux de commission contractuel :
      // Deliveroo : commission_amount est déjà calculé après réduction → dénominateur = CA TTC brut
      // Uber : commission HT AVANT cofinancement / CA Net TTC (après promos) = taux contractuel (27% / 15%)
      // On utilise uber_fee_before_promo_excl_vat pour ne pas faire varier le taux quand Uber cofinance une promo.
      const uberFeeHT = Math.abs(Number(payout.uber_fee_before_promo_excl_vat) || 0)
        || Math.abs(Number(payout.uber_fee_after_promo_excl_vat) || 0)
        || Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
      const netSalesTTC = sales - promoAmount; // CA net après promos
      const rateDenominator = platform === "deliveroo" ? sales : netSalesTTC;
      const uberFeeRateHT = rateDenominator > 0 ? (uberFeeHT / rateDenominator) * 100 : 0;
      
      // Rentabilité = (Versement Uber + Titres restaurant) / Base
      // Base = CA TTC (gross) ou CA TTC - Promos (net)
      const mealVoucher = Math.abs(Number(payout.meal_voucher_amount) || 0);
      // Éco-contribution : priorité à payout_adjustments (Tiroir B), fallback sur colonnes payouts si jamais peuplées
      const ecoKey = `${payout.payout_date}|${payout.restaurant_id}`;
      const ecoEntry = ecoMap.get(ecoKey);
      const ecoContribution = ecoEntry?.refund ?? Math.abs(Number(payout.eco_contribution_refund) || 0);
      const ecoCharge = ecoEntry?.charge ?? Math.abs(Number(payout.eco_contribution_charge) || 0);
      const totalToReceive = netPayout + mealVoucher;
      // Dénominateur pour le calcul de rentabilité selon la base choisie
      const profitabilityDenominator = profitabilityBase === 'net' ? netSalesTTC : sales;
      
      // Week calculation
      const payoutDate = new Date(payout.payout_date);
      const weekNum = getWeek(payoutDate, { weekStartsOn: 1 });
      const yearNum = getYear(payoutDate);
      const weekStart = startOfWeek(payoutDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(payoutDate, { weekStartsOn: 1 });
      const weekLabelStr = `Sem. ${weekNum} (${format(weekStart, "d", { locale: fr })}-${format(weekEnd, "d MMM", { locale: fr })})`;
      
      // Advertising amount for this payout
      const adKey = `${payout.payout_date}|${payout.restaurant_id}`;
      const advertisingAmount = Math.abs(adMap.get(adKey) || 0);
      
      return {
        label: payout.payout_date,
        date: payout.payout_date,
        restaurantId: payout.restaurant_id,
        restaurantName: getRestaurantName(payout.restaurant_id),
        sales,
        netSales: netSalesTTC,
        netPayout,
        mealVoucher,
        ecoContribution,
        ecoCharge,
        totalPayout: totalToReceive,
        profitability: profitabilityDenominator > 0 ? (totalToReceive / profitabilityDenominator) * 100 : 0,
        uberFeeGross,
        uberFeeReduction,
        uberFeeNet,
        uberFeeRate: uberFeeRateHT,
        uberFeeGrossRate: sales > 0 ? (uberFeeGross / sales) * 100 : 0,
        contractRate: getContractRate(payout.restaurant_id),
        promoRate: sales > 0 ? (promoAmount / sales) * 100 : 0,
        refundRate: sales > 0 ? (refundAmount / sales) * 100 : 0,
        otherRate: sales > 0 ? (other / sales) * 100 : 0,
        promoAmount,
        refundAmount,
        orderCount,
        avgBasket: orderCount > 0 ? sales / orderCount : 0,
        weekNumber: weekNum,
        year: yearNum,
        weekLabel: weekLabelStr,
        advertisingAmount,
      };
    });
    
    // Apply sorting
    return rows.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'sales':
          comparison = a.sales - b.sales;
          break;
        case 'profitability':
          comparison = a.profitability - b.profitability;
          break;
        case 'commission':
          comparison = a.uberFeeRate - b.uberFeeRate;
          break;
        case 'promo':
          comparison = a.promoRate - b.promoRate;
          break;
        case 'refund':
          comparison = a.refundRate - b.refundRate;
          break;
        case 'payout':
          comparison = a.totalPayout - b.totalPayout;
          break;
        default:
          comparison = a.profitability - b.profitability;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [payouts, restaurants, sortColumn, sortDirection, profitabilityBase, adMap, ecoMap]);
  
  // Group by week for week view mode
  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: Record<string, WeekGroup> = {};
    
    comparisonData.forEach(row => {
      const key = `${row.year}-${row.weekNumber}`;
      if (!groups[key]) {
        groups[key] = {
          weekKey: key,
          weekLabel: row.weekLabel,
          weekNumber: row.weekNumber,
          year: row.year,
          restaurants: [],
        };
      }
      groups[key].restaurants.push(row);
    });
    
    // Sort groups by year desc then week desc, and restaurants by profitability
    return Object.values(groups)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      })
      .map(group => ({
        ...group,
        restaurants: group.restaurants.sort((a, b) => b.profitability - a.profitability),
      }));
  }, [comparisonData]);
  
  // Group by month for month view mode
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups: Record<string, { rows: ComparisonRow[]; monthNumber: number; year: number }> = {};
    
    comparisonData.forEach(row => {
      const payoutDate = new Date(row.date);
      const monthNum = getMonth(payoutDate);
      const yearNum = getYear(payoutDate);
      const key = `${yearNum}-${monthNum}`;
      
      if (!groups[key]) {
        groups[key] = {
          rows: [],
          monthNumber: monthNum,
          year: yearNum,
        };
      }
      groups[key].rows.push(row);
    });
    
    return Object.entries(groups)
      .map(([key, { rows, monthNumber, year }]) => {
        const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);
        const totalPayout = rows.reduce((sum, r) => sum + r.netPayout, 0);
        const totalMealVoucher = rows.reduce((sum, r) => sum + r.mealVoucher, 0);
        const totalPayoutWithVoucher = rows.reduce((sum, r) => sum + r.totalPayout, 0);
        const totalUberFeeHT = rows.reduce((sum, r) => {
          const payoutData = payouts.find(p => p.payout_date === r.date && p.restaurant_id === r.restaurantId);
          return sum + (Math.abs(Number(payoutData?.uber_fee_before_promo_excl_vat) || 0)
            || Math.abs(Number(payoutData?.uber_fee_after_promo_excl_vat) || 0));
        }, 0);
        const totalPromo = rows.reduce((sum, r) => sum + r.promoAmount, 0);
        const totalRefund = rows.reduce((sum, r) => sum + r.refundAmount, 0);
        const totalOrders = rows.reduce((sum, r) => sum + r.orderCount, 0);
        
        // Deliveroo: rate on gross sales; Uber: rate on net sales (after promos)
        const netSales = totalSales - totalPromo;
        const rateDenominator = platform === "deliveroo" ? totalSales : netSales;
        const avgUberFeeRate = rateDenominator > 0 ? (totalUberFeeHT / rateDenominator) * 100 : 0;
        const avgPromoRate = totalSales > 0 ? (totalPromo / totalSales) * 100 : 0;
        const avgRefundRate = totalSales > 0 ? (totalRefund / totalSales) * 100 : 0;
        
        // Profitability uses the selected base
        const profitabilityDenominator = profitabilityBase === 'net' ? netSales : totalSales;
        const avgProfitability = profitabilityDenominator > 0 ? (totalPayoutWithVoucher / profitabilityDenominator) * 100 : 0;
        
        // Create month label
        const monthDate = new Date(year, monthNumber, 1);
        const monthLabel = format(monthDate, "MMMM yyyy", { locale: fr });
        
        // Aggregate per restaurant for this month
        const restaurantAggregates: Record<string, {
          restaurantId: string;
          restaurantName: string;
          sales: number;
          netPayout: number;
          mealVoucher: number;
          ecoContribution: number;
          ecoCharge: number;
          promo: number;
          refund: number;
          uberFee: number;
          orderCount: number;
          advertisingAmount: number;
        }> = {};
        
        rows.forEach(row => {
          if (!restaurantAggregates[row.restaurantId]) {
            restaurantAggregates[row.restaurantId] = {
              restaurantId: row.restaurantId,
              restaurantName: row.restaurantName,
              sales: 0,
              netPayout: 0,
              mealVoucher: 0,
            ecoContribution: 0,
            ecoCharge: 0,
            promo: 0,
              refund: 0,
              uberFee: 0,
              orderCount: 0,
              advertisingAmount: 0,
            };
          }
          const agg = restaurantAggregates[row.restaurantId];
          agg.sales += row.sales;
          agg.netPayout += row.netPayout;
          agg.mealVoucher += row.mealVoucher;
          agg.ecoContribution += row.ecoContribution;
          agg.ecoCharge += row.ecoCharge;
          agg.promo += row.promoAmount;
          agg.refund += row.refundAmount;
          agg.orderCount += row.orderCount;
          agg.advertisingAmount += row.advertisingAmount;
          // Find matching payout for uber fee HT
          const payoutData = payouts.find(p => p.payout_date === row.date && p.restaurant_id === row.restaurantId);
          agg.uberFee += (Math.abs(Number(payoutData?.uber_fee_before_promo_excl_vat) || 0)
            || Math.abs(Number(payoutData?.uber_fee_after_promo_excl_vat) || 0));
        });
        
        const restaurantData: MonthRestaurantData[] = Object.values(restaurantAggregates)
          .map(agg => {
            const restoNetSales = agg.sales - agg.promo;
            const restoRateDenominator = platform === "deliveroo" ? agg.sales : restoNetSales;
            const restoProfitDenominator = profitabilityBase === 'net' ? restoNetSales : agg.sales;
            const restoTotalPayout = agg.netPayout + agg.mealVoucher;
            return {
              restaurantId: agg.restaurantId,
              restaurantName: agg.restaurantName,
              sales: agg.sales,
              netPayout: agg.netPayout,
              mealVoucher: agg.mealVoucher,
              ecoContribution: agg.ecoContribution,
              ecoCharge: agg.ecoCharge,
              totalPayout: restoTotalPayout,
              profitability: restoProfitDenominator > 0 ? (restoTotalPayout / restoProfitDenominator) * 100 : 0,
              uberFeeRate: restoRateDenominator > 0 ? (agg.uberFee / restoRateDenominator) * 100 : 0,
              promoRate: agg.sales > 0 ? (agg.promo / agg.sales) * 100 : 0,
              refundRate: agg.sales > 0 ? (agg.refund / agg.sales) * 100 : 0,
              uberFee: agg.uberFee,
              promo: agg.promo,
              refund: agg.refund,
              orderCount: agg.orderCount,
              advertisingAmount: agg.advertisingAmount,
            };
          })
          .sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
              case 'sales':
                comparison = a.sales - b.sales;
                break;
              case 'profitability':
                comparison = a.profitability - b.profitability;
                break;
              case 'commission':
                comparison = a.uberFeeRate - b.uberFeeRate;
                break;
              case 'promo':
                comparison = a.promoRate - b.promoRate;
                break;
              case 'refund':
                comparison = a.refundRate - b.refundRate;
                break;
              case 'payout':
                comparison = a.totalPayout - b.totalPayout;
                break;
              default:
                comparison = a.profitability - b.profitability;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
          });
        
        return {
          monthKey: key,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          monthNumber,
          year,
          rows: rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalSales,
          totalPayout,
          totalMealVoucher,
          totalPayoutWithVoucher,
          avgProfitability,
          avgUberFeeRate,
          avgPromoRate,
          avgRefundRate,
          totalUberFee: totalUberFeeHT,
          totalPromo,
          totalRefund,
          totalOrders,
          restaurantData,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthNumber - a.monthNumber;
      });
  }, [comparisonData, payouts, profitabilityBase, sortColumn, sortDirection]);
  
  // Group by year for year view mode
  const yearGroups = useMemo((): YearGroup[] => {
    if (viewMode !== 'year') return [];
    const groups: Record<number, { rows: ComparisonRow[]; year: number }> = {};
    
    comparisonData.forEach(row => {
      const yearNum = getYear(new Date(row.date));
      if (!groups[yearNum]) {
        groups[yearNum] = { rows: [], year: yearNum };
      }
      groups[yearNum].rows.push(row);
    });
    
    return Object.entries(groups)
      .map(([_, { rows, year }]) => {
        const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);
        const totalPayout = rows.reduce((sum, r) => sum + r.netPayout, 0);
        const totalMealVoucher = rows.reduce((sum, r) => sum + r.mealVoucher, 0);
        const totalPayoutWithVoucher = rows.reduce((sum, r) => sum + r.totalPayout, 0);
        const totalUberFeeHT = rows.reduce((sum, r) => {
          const payoutData = payouts.find(p => p.payout_date === r.date && p.restaurant_id === r.restaurantId);
          return sum + (Math.abs(Number(payoutData?.uber_fee_before_promo_excl_vat) || 0)
            || Math.abs(Number(payoutData?.uber_fee_after_promo_excl_vat) || 0));
        }, 0);
        const totalPromo = rows.reduce((sum, r) => sum + r.promoAmount, 0);
        const totalRefund = rows.reduce((sum, r) => sum + r.refundAmount, 0);
        const totalOrders = rows.reduce((sum, r) => sum + r.orderCount, 0);
        
        const netSales = totalSales - totalPromo;
        const rateDenominator = platform === "deliveroo" ? totalSales : netSales;
        const avgUberFeeRate = rateDenominator > 0 ? (totalUberFeeHT / rateDenominator) * 100 : 0;
        const avgPromoRate = totalSales > 0 ? (totalPromo / totalSales) * 100 : 0;
        const avgRefundRate = totalSales > 0 ? (totalRefund / totalSales) * 100 : 0;
        
        const profitabilityDenominator = profitabilityBase === 'net' ? netSales : totalSales;
        const avgProfitability = profitabilityDenominator > 0 ? (totalPayoutWithVoucher / profitabilityDenominator) * 100 : 0;
        
        // Aggregate per restaurant
        const restaurantAggregates: Record<string, {
          restaurantId: string;
          restaurantName: string;
          sales: number;
          netPayout: number;
          mealVoucher: number;
          ecoContribution: number;
          ecoCharge: number;
          promo: number;
          refund: number;
          uberFee: number;
          orderCount: number;
          advertisingAmount: number;
        }> = {};
        
        rows.forEach(row => {
          if (!restaurantAggregates[row.restaurantId]) {
            restaurantAggregates[row.restaurantId] = {
              restaurantId: row.restaurantId,
              restaurantName: row.restaurantName,
              sales: 0, netPayout: 0, mealVoucher: 0,
              ecoContribution: 0, ecoCharge: 0,
              promo: 0, refund: 0, uberFee: 0,
              orderCount: 0, advertisingAmount: 0,
            };
          }
          const agg = restaurantAggregates[row.restaurantId];
          agg.sales += row.sales;
          agg.netPayout += row.netPayout;
          agg.mealVoucher += row.mealVoucher;
          agg.ecoContribution += row.ecoContribution;
          agg.ecoCharge += row.ecoCharge;
          agg.promo += row.promoAmount;
          agg.refund += row.refundAmount;
          agg.orderCount += row.orderCount;
          agg.advertisingAmount += row.advertisingAmount;
          const payoutData = payouts.find(p => p.payout_date === row.date && p.restaurant_id === row.restaurantId);
          agg.uberFee += (Math.abs(Number(payoutData?.uber_fee_before_promo_excl_vat) || 0)
            || Math.abs(Number(payoutData?.uber_fee_after_promo_excl_vat) || 0));
        });
        
        const restaurantData: MonthRestaurantData[] = Object.values(restaurantAggregates)
          .map(agg => {
            const restoNetSales = agg.sales - agg.promo;
            const restoRateDenominator = platform === "deliveroo" ? agg.sales : restoNetSales;
            const restoProfitDenominator = profitabilityBase === 'net' ? restoNetSales : agg.sales;
            const restoTotalPayout = agg.netPayout + agg.mealVoucher;
            return {
              restaurantId: agg.restaurantId,
              restaurantName: agg.restaurantName,
              sales: agg.sales,
              netPayout: agg.netPayout,
              mealVoucher: agg.mealVoucher,
              ecoContribution: agg.ecoContribution,
              ecoCharge: agg.ecoCharge,
              totalPayout: restoTotalPayout,
              profitability: restoProfitDenominator > 0 ? (restoTotalPayout / restoProfitDenominator) * 100 : 0,
              uberFeeRate: restoRateDenominator > 0 ? (agg.uberFee / restoRateDenominator) * 100 : 0,
              promoRate: agg.sales > 0 ? (agg.promo / agg.sales) * 100 : 0,
              refundRate: agg.sales > 0 ? (agg.refund / agg.sales) * 100 : 0,
              uberFee: agg.uberFee,
              promo: agg.promo,
              refund: agg.refund,
              orderCount: agg.orderCount,
              advertisingAmount: agg.advertisingAmount,
            };
          })
          .sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
              case 'sales': comparison = a.sales - b.sales; break;
              case 'profitability': comparison = a.profitability - b.profitability; break;
              case 'commission': comparison = a.uberFeeRate - b.uberFeeRate; break;
              case 'promo': comparison = a.promoRate - b.promoRate; break;
              case 'refund': comparison = a.refundRate - b.refundRate; break;
              case 'payout': comparison = a.totalPayout - b.totalPayout; break;
              default: comparison = a.profitability - b.profitability;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
          });
        
        return {
          year,
          rows,
          totalSales,
          totalPayout,
          totalMealVoucher,
          totalPayoutWithVoucher,
          avgProfitability,
          avgUberFeeRate,
          avgPromoRate,
          avgRefundRate,
          totalUberFee: totalUberFeeHT,
          totalPromo,
          totalRefund,
          totalOrders,
          restaurantData,
        };
      })
      .sort((a, b) => b.year - a.year);
  }, [comparisonData, payouts, profitabilityBase, sortColumn, sortDirection, viewMode]);
  
  // Calculate averages for comparison
  const averages = useMemo(() => {
    if (comparisonData.length === 0) return null;
    
    const totalSales = comparisonData.reduce((sum, d) => sum + d.sales, 0);
    const totalNet = comparisonData.reduce((sum, d) => sum + d.netPayout, 0);
    const totalMealVoucher = comparisonData.reduce((sum, d) => sum + d.mealVoucher, 0);
    const totalEcoContribution = comparisonData.reduce((sum, d) => sum + d.ecoContribution, 0);
    const totalPayout = comparisonData.reduce((sum, d) => sum + d.totalPayout, 0);
    // Calcul du taux contractuel = uber_fee_HT (avant cofin) / (CA - promos)
    const totalUberFeeHT = payouts.reduce((sum, p) => sum + (Math.abs(Number(p.uber_fee_before_promo_excl_vat) || 0)
      || Math.abs(Number(p.uber_fee_after_promo_excl_vat) || 0)), 0);
    const totalPromoTTC = payouts.reduce((sum, p) => sum + Math.abs(Number(p.item_promo_incl_vat) || 0), 0);
    const netSales = totalSales - totalPromoTTC;
    const avgRateDenominator = platform === "deliveroo" ? totalSales : netSales;
    const avgUberRate = avgRateDenominator > 0 ? (totalUberFeeHT / avgRateDenominator) * 100 : 0;
    const avgPromoRate = comparisonData.reduce((sum, d) => sum + d.promoRate, 0) / comparisonData.length;
    const avgRefundRate = comparisonData.reduce((sum, d) => sum + d.refundRate, 0) / comparisonData.length;
    const avgOtherRate = comparisonData.reduce((sum, d) => sum + d.otherRate, 0) / comparisonData.length;
    
    // Profitability uses the selected base
    const profitabilityDenominator = profitabilityBase === 'net' ? netSales : totalSales;
    const avgProfitability = profitabilityDenominator > 0 ? (totalPayout / profitabilityDenominator) * 100 : 0;
    
    // Average amounts
    const avgUberFeeAmount = comparisonData.reduce((sum, d) => sum + d.uberFeeNet, 0) / comparisonData.length;
    const avgPromoAmount = comparisonData.reduce((sum, d) => sum + d.promoAmount, 0) / comparisonData.length;
    const avgRefundAmount = comparisonData.reduce((sum, d) => sum + d.refundAmount, 0) / comparisonData.length;
    const avgMealVoucherAmount = totalMealVoucher / comparisonData.length;
    const avgEcoContributionAmount = totalEcoContribution / comparisonData.length;
    const totalEcoCharge = comparisonData.reduce((sum, d) => sum + d.ecoCharge, 0);
    const avgEcoChargeAmount = totalEcoCharge / comparisonData.length;
    const avgTotalPayoutAmount = totalPayout / comparisonData.length;
    const totalAdvertising = comparisonData.reduce((sum, d) => sum + d.advertisingAmount, 0);
    const avgAdvertisingAmount = totalAdvertising / comparisonData.length;
    
    return {
      profitability: avgProfitability,
      uberFeeRate: avgUberRate,
      promoRate: avgPromoRate,
      refundRate: avgRefundRate,
      otherRate: avgOtherRate,
      uberFeeAmount: avgUberFeeAmount,
      promoAmount: avgPromoAmount,
      refundAmount: avgRefundAmount,
      mealVoucherAmount: avgMealVoucherAmount,
      ecoContributionAmount: avgEcoContributionAmount,
      ecoChargeAmount: avgEcoChargeAmount,
      totalPayoutAmount: avgTotalPayoutAmount,
      advertisingAmount: avgAdvertisingAmount,
    };
  }, [comparisonData, profitabilityBase, payouts]);
  
  if (comparisonData.length === 0) return null;
  
  // Check if we have multiple different restaurants or just one
  const uniqueRestaurants = new Set(comparisonData.map(d => d.restaurantId));
  const isSingleRestaurant = uniqueRestaurants.size === 1;
  
  // Find the best and worst performers
  const best = comparisonData[0];
  const worst = comparisonData[comparisonData.length - 1];
  const profitabilityGap = best.profitability - worst.profitability;
  
  // Simple cell component - displays percent or amount
  const ComparisonCell = ({ 
    percentValue, 
    amountValue,
    isCommission = false
  }: { 
    percentValue: number; 
    amountValue: number;
    isCommission?: boolean;
  }) => {
    if (displayMode === 'amount') {
      return (
        <span className="font-medium tabular-nums">
          {formatCurrency(amountValue)}
        </span>
      );
    }
    return (
      <span className="font-medium tabular-nums">
        {percentValue.toFixed(1)}%
      </span>
    );
  };

  // Cellule Commission Uber avec audit par canal (livraison vs à emporter).
  // Affiche le % global, et au survol détaille les taux contractuels par canal.
  const CommissionAuditCell = ({
    percentValue,
    amountValue,
    breakdownKeys,
  }: {
    percentValue: number;
    amountValue: number;
    breakdownKeys: string[]; // ex. ["2026-02-05|restaurantId"]
  }) => {
    // Agrège les breakdowns pour toutes les clés fournies (jour+resto, ou plusieurs)
    const aggregated = useMemo(() => {
      const acc: Record<string, ChannelBreakdown> = {};
      for (const key of breakdownKeys) {
        const list = commissionBreakdownMap.get(key);
        if (!list) continue;
        for (const b of list) {
          if (!acc[b.channel]) {
            acc[b.channel] = { ...b };
          } else {
            acc[b.channel].orderCount += b.orderCount;
            acc[b.channel].bhHT += b.bhHT;
            acc[b.channel].baseTTC += b.baseTTC;
          }
        }
      }
      const result = Object.values(acc).map(b => ({
        ...b,
        rate: b.baseTTC > 0 ? (b.bhHT / b.baseTTC) * 100 : 0,
      }));
      const order = { delivery: 0, takeaway: 1, other: 2 } as const;
      result.sort((a, b) => order[a.channel] - order[b.channel]);
      return result;
    }, [breakdownKeys]);

    const display = displayMode === 'amount'
      ? formatCurrency(amountValue)
      : `${percentValue.toFixed(1)}%`;

    if (platform === "deliveroo" || aggregated.length === 0) {
      return <span className="font-medium tabular-nums">{display}</span>;
    }

    // Détection d'une anomalie : écart > 0,5 pt vs taux contractuel attendu
    const hasAnomaly = aggregated.some(b =>
      b.expectedRate > 0 && Math.abs(b.rate - b.expectedRate) > 0.5
    );

    const channelLabel = (c: ChannelBreakdown["channel"]) =>
      c === "delivery" ? "🚲 Livraison" : c === "takeaway" ? "🛍️ À emporter" : "• Autre";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "font-medium tabular-nums cursor-help inline-flex items-center gap-1",
              hasAnomaly && "text-amber-600"
            )}>
              {display}
              {hasAnomaly && <AlertCircle className="h-3 w-3" />}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm p-0">
            <div className="text-xs">
              <div className="px-3 py-2 border-b font-semibold bg-muted/50">
                Audit commission Uber
              </div>
              <table className="w-full">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-1">Canal</th>
                    <th className="text-right px-2 py-1">Cmd</th>
                    <th className="text-right px-2 py-1">Taux</th>
                    <th className="text-right px-3 py-1">Comm. HT</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map(b => {
                    const deviation = b.expectedRate > 0 ? Math.abs(b.rate - b.expectedRate) : 0;
                    const isOk = b.expectedRate > 0 && deviation <= 0.5;
                    const isOff = b.expectedRate > 0 && deviation > 0.5;
                    return (
                      <tr key={b.channel} className="border-t">
                        <td className="px-3 py-1.5">{channelLabel(b.channel)}</td>
                        <td className="text-right tabular-nums px-2 py-1.5">{b.orderCount}</td>
                        <td className={cn(
                          "text-right tabular-nums px-2 py-1.5 font-medium",
                          isOk && "text-emerald-600",
                          isOff && "text-amber-600"
                        )}>
                          {b.rate.toFixed(2)}%
                          {b.expectedRate > 0 && (
                            <span className="text-muted-foreground font-normal ml-1">
                              / {b.expectedRate}%
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums px-3 py-1.5">{formatCurrency(b.bhHT)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Moyenne pondérée</span>
                <span className="font-semibold tabular-nums">{percentValue.toFixed(2)}%</span>
              </div>
              {hasAnomaly ? (
                <div className="px-3 py-1.5 border-t text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Écart vs taux contractuel détecté
                </div>
              ) : (
                <div className="px-3 py-1.5 border-t text-emerald-600">
                  ✓ Taux contractuels respectés
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  // Check if we have multiple restaurants (needed for week view)
  const hasMultipleRestaurants = uniqueRestaurants.size > 1;
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpDown className="h-4 w-4" />
            Comparatif de Rentabilité
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs">
                    Ce tableau compare les versements pour comprendre les écarts de rentabilité.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          
          <div className="flex gap-1 flex-wrap items-center">
            {/* Year selector - hidden in year view mode */}
            {viewMode !== 'year' && (
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 mr-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSelectedYear(selectedYear - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-semibold px-1.5 tabular-nums">{selectedYear}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSelectedYear(selectedYear + 1)}
                disabled={selectedYear >= new Date().getFullYear()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            )}
            
            {/* Separator */}
            <div className="w-px bg-border mx-1 h-5" />
            <Button
              variant={displayMode === 'percent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('percent')}
              className="h-7 text-xs gap-1.5"
            >
              <Percent className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={displayMode === 'amount' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('amount')}
              className="h-7 text-xs gap-1.5"
            >
              <Euro className="h-3.5 w-3.5" />
            </Button>
            
            {/* Separator */}
            <div className="w-px bg-border mx-1 h-5" />
            
            {/* View mode toggle - always show */}
            <Button
              variant={viewMode === 'profitability' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('profitability')}
              className="h-7 text-xs gap-1.5"
            >
              <LayoutList className="h-3.5 w-3.5" />
              Rentabilité
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="h-7 text-xs gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              Semaine
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="h-7 text-xs gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Mois
            </Button>
            <Button
              variant={viewMode === 'year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('year')}
              className="h-7 text-xs gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              Année
            </Button>
            
            {/* Separator */}
            <div className="w-px bg-border mx-1 h-5" />
            
            {/* Profitability base toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                    <Button
                      variant={profitabilityBase === "gross" ? "default" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setProfitabilityBase("gross")}
                    >
                      Brut
                    </Button>
                    <Button
                      variant={profitabilityBase === "net" ? "default" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setProfitabilityBase("net")}
                    >
                      Net
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium text-sm mb-1">Base de calcul de rentabilité</p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Brut:</strong> Rentabilité = Versement / CA TTC<br/>
                    <strong>Net:</strong> Rentabilité = Versement / (CA TTC - Promos)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="min-w-[200px] cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    {viewMode === 'year' ? 'Année / Restaurant' : viewMode === 'week' ? 'Semaine / Restaurant' : (isSingleRestaurant ? "Versement" : "Restaurant")}
                    {sortColumn === 'date' ? (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('sales')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    CA TTC
                    {sortColumn === 'sales' ? (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('profitability')}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Rentabilité
                        <HelpCircle className="h-3 w-3" />
                        {sortColumn === 'profitability' ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Total à encaisser (Versement {platform === "deliveroo" ? "Deliveroo" : "Uber"} + Titres restaurant) / CA TTC × 100</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead 
                  className="text-right text-orange-600 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('commission')}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Commission
                        <HelpCircle className="h-3 w-3" />
                        {sortColumn === 'commission' ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </TooltipTrigger>
                       <TooltipContent className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <p className="font-medium">Commission {platform === "deliveroo" ? "Deliveroo" : "Uber"} (TTC)</p>
                          {platform !== "deliveroo" && (
                            <p className="text-muted-foreground">
                              Taux contractuel = commission HT avant cofinancement / (CA TTC − promos). Constant : 27 % en livraison, 15 % à emporter.
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Cliquez sur une ligne pour voir la décomposition.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('promo')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Promos
                    {sortColumn === 'promo' ? (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('refund')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Remb.
                    {sortColumn === 'refund' ? (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right text-green-600 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('payout')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Versement {platform === "deliveroo" ? "Deliveroo" : "Uber"}
                    {sortColumn === 'payout' ? (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Titre Resto
                </TableHead>
                {platform !== "deliveroo" && (
                <TableHead className="text-right text-emerald-600">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Éco Remb.
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Remboursement annuel de l'éco-contribution (généralement versé en janvier)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                )}
                {platform !== "deliveroo" && (
                <TableHead className="text-right text-red-600">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Éco Prél.
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Prélèvement éco-contribution facturé par Uber Eats</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                )}
                {platform !== "deliveroo" && (
                <TableHead className="text-right text-orange-500">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Pub
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Dépenses publicitaires (Uber Ads) déduites du versement</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                )}
                <TableHead className="text-right text-green-600 font-semibold">
                  Versement Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewMode === 'profitability' && (
                // Standard profitability view
                <>
                  {comparisonData.map((row, index) => (
                    <TableRow 
                      key={`${row.restaurantId}-${row.date}`}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        index === 0 && "bg-green-500/5 hover:bg-green-500/10",
                        index === comparisonData.length - 1 && comparisonData.length > 1 && "bg-red-500/5 hover:bg-red-500/10"
                      )}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">TOP</Badge>}
                          {index === comparisonData.length - 1 && comparisonData.length > 1 && (
                            <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">BAS</Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1.5 font-normal">
                            Sem. {row.weekNumber}
                          </Badge>
                          {isSingleRestaurant ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{format(new Date(row.date), "d MMMM yyyy", { locale: fr })}</span>
                            </div>
                          ) : (
                            <span className="font-medium">{row.restaurantName}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isSingleRestaurant ? row.restaurantName : null}
                          {isSingleRestaurant ? " • " : ""}{row.orderCount} cmd • Ø {formatCurrency(row.avgBasket)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(row.sales)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        <span className="font-medium tabular-nums">{row.profitability.toFixed(1)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <CommissionAuditCell
                          percentValue={row.uberFeeRate}
                          amountValue={row.uberFeeNet}
                          breakdownKeys={[`${row.date}|${row.restaurantId}`]}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <ComparisonCell percentValue={row.promoRate} amountValue={row.promoAmount} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <ComparisonCell percentValue={row.refundRate} amountValue={row.refundAmount} />
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600 tabular-nums">
                        {formatCurrency(row.netPayout)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {row.mealVoucher > 0 ? formatCurrency(row.mealVoucher) : '-'}
                      </TableCell>
                      {platform !== "deliveroo" && <>
                      <TableCell className="text-right text-emerald-600 tabular-nums">
                        {row.ecoContribution > 0 ? formatCurrency(row.ecoContribution) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600 tabular-nums">
                        {row.ecoCharge > 0 ? `-${formatCurrency(row.ecoCharge)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-orange-500 tabular-nums">
                        {row.advertisingAmount > 0 ? `-${formatCurrency(row.advertisingAmount)}` : '-'}
                      </TableCell>
                      </>}
                      <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                        {formatCurrency(row.totalPayout)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Average row */}
                  {averages && comparisonData.length > 1 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="text-muted-foreground">
                        Moyenne
                      </TableCell>
                      <TableCell className="text-right text-green-600 tabular-nums">
                        {averages.profitability.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(averages.uberFeeAmount)
                          : `${averages.uberFeeRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(averages.promoAmount)
                          : `${averages.promoRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(averages.refundAmount)
                          : `${averages.refundRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-green-600 tabular-nums">
                        {formatCurrency(comparisonData.reduce((sum, d) => sum + d.netPayout, 0) / comparisonData.length)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {averages.mealVoucherAmount > 0 ? formatCurrency(averages.mealVoucherAmount) : '-'}
                      </TableCell>
                      {platform !== "deliveroo" && <>
                      <TableCell className="text-right text-emerald-600 tabular-nums">
                        {averages.ecoContributionAmount > 0 ? formatCurrency(averages.ecoContributionAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600 tabular-nums">
                        {averages.ecoChargeAmount > 0 ? `-${formatCurrency(averages.ecoChargeAmount)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-orange-500 tabular-nums">
                        {averages.advertisingAmount > 0 ? `-${formatCurrency(averages.advertisingAmount)}` : '-'}
                      </TableCell>
                      </>}
                      <TableCell className="text-right text-green-600 tabular-nums">
                        {formatCurrency(averages.totalPayoutAmount)}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
              
              {viewMode === 'week' && (
                // Week grouped view
                <>
                  {weekGroups.map((group) => {
                    const bestInGroup = group.restaurants[0];
                    const worstInGroup = group.restaurants[group.restaurants.length - 1];
                    const hasGap = group.restaurants.length > 1;
                    const profitGap = hasGap ? bestInGroup.profitability - worstInGroup.profitability : 0;
                    const salesGap = hasGap ? bestInGroup.sales - worstInGroup.sales : 0;
                    const payoutGap = hasGap ? bestInGroup.totalPayout - worstInGroup.totalPayout : 0;
                    
                    // Get week dates for drill-down
                    const firstRowDate = group.restaurants[0]?.date;
                    const baseDate = firstRowDate ? new Date(firstRowDate) : new Date();
                    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
                    const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
                    
                    return (
                      <>
                        {/* Week header row */}
                        <TableRow key={group.weekKey} className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={12} className="py-2">
                            <div className="flex items-center gap-2 font-medium">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {group.weekLabel}
                              {hasGap && profitGap > 1 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground font-normal ml-2">
                                  Écart {profitGap.toFixed(1)} pts
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleWeekDrillDown(group)}
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                              Détail
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {/* Restaurant rows within the week - simple rows (no accordion) */}
                        {group.restaurants.map((row, idx) => {
                          const rowKey = `${group.weekKey}-${row.restaurantId}`;
                          
                          return (
                            <TableRow 
                              key={rowKey}
                              className={cn(
                                "hover:bg-muted/50 transition-colors",
                                idx === 0 && hasGap && "bg-green-500/5 hover:bg-green-500/10",
                                idx === group.restaurants.length - 1 && hasGap && "bg-red-500/5 hover:bg-red-500/10",
                              )}
                            >
                              <TableCell className="pl-4">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && hasGap && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">+</Badge>}
                                  {idx === group.restaurants.length - 1 && hasGap && <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">−</Badge>}
                                  <span className="font-medium">
                                    {isSingleRestaurant 
                                      ? format(new Date(row.date), "d MMMM", { locale: fr })
                                      : row.restaurantName
                                    }
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground pl-0">
                                  {row.orderCount} cmd • Ø {formatCurrency(row.avgBasket)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatCurrency(row.sales)}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                <span className="font-medium tabular-nums">{row.profitability.toFixed(1)}%</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <CommissionAuditCell
                                  percentValue={row.uberFeeRate}
                                  amountValue={row.uberFeeNet}
                                  breakdownKeys={[`${row.date}|${row.restaurantId}`]}
                                />
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                <ComparisonCell percentValue={row.promoRate} amountValue={row.promoAmount} />
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                <ComparisonCell percentValue={row.refundRate} amountValue={row.refundAmount} />
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600 tabular-nums">
                                {formatCurrency(row.netPayout)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground tabular-nums">
                                {row.mealVoucher > 0 ? formatCurrency(row.mealVoucher) : '-'}
                              </TableCell>
                              {platform !== "deliveroo" && <>
                              <TableCell className="text-right text-emerald-600 tabular-nums">
                                {row.ecoContribution > 0 ? formatCurrency(row.ecoContribution) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-red-600 tabular-nums">
                                {row.ecoCharge > 0 ? `-${formatCurrency(row.ecoCharge)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right text-orange-500 tabular-nums">
                                {row.advertisingAmount > 0 ? `-${formatCurrency(row.advertisingAmount)}` : '-'}
                              </TableCell>
                              </>}
                              <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                                {formatCurrency(row.totalPayout)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        
                        {/* Gap row for the week */}
                        {hasGap && (
                          <TableRow className="bg-muted/10 text-xs border-b-2">
                            <TableCell className="pl-8 py-1.5 italic text-muted-foreground">
                              Écart
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {salesGap >= 0 ? '+' : ''}{formatCurrency(salesGap)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums font-medium">
                              <span className={profitGap >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {profitGap >= 0 ? '+' : ''}{profitGap.toFixed(1)} pts
                              </span>
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount' 
                                ? `${(bestInGroup.uberFeeNet - worstInGroup.uberFeeNet) >= 0 ? '+' : ''}${formatCurrency(bestInGroup.uberFeeNet - worstInGroup.uberFeeNet)}`
                                : `${(bestInGroup.uberFeeRate - worstInGroup.uberFeeRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount' 
                                ? `${(bestInGroup.promoAmount - worstInGroup.promoAmount) >= 0 ? '+' : ''}${formatCurrency(bestInGroup.promoAmount - worstInGroup.promoAmount)}`
                                : `${(bestInGroup.promoRate - worstInGroup.promoRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount' 
                                ? `${(bestInGroup.refundAmount - worstInGroup.refundAmount) >= 0 ? '+' : ''}${formatCurrency(bestInGroup.refundAmount - worstInGroup.refundAmount)}`
                                : `${(bestInGroup.refundRate - worstInGroup.refundRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestInGroup.netPayout - worstInGroup.netPayout) >= 0 ? '+' : ''}{formatCurrency(bestInGroup.netPayout - worstInGroup.netPayout)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {payoutGap >= 0 ? '+' : ''}{formatCurrency(payoutGap)}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </>
              )}
              
              {viewMode === 'month' && (
                // Month grouped view with per-restaurant breakdown
                <>
                  {monthGroups.map((group, groupIndex) => {
                    const hasMultipleRestaurantsInMonth = group.restaurantData.length > 1;
                    const bestResto = group.restaurantData[0];
                    const worstResto = group.restaurantData[group.restaurantData.length - 1];
                    const isExpanded = expandedMonths.has(group.monthKey);
                    
                    const toggleMonth = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setExpandedMonths(prev => {
                        const next = new Set(prev);
                        if (next.has(group.monthKey)) {
                          next.delete(group.monthKey);
                        } else {
                          next.add(group.monthKey);
                        }
                        return next;
                      });
                    };
                    
                    return (
                      <>
                        {/* Month header row */}
                        <TableRow 
                          key={group.monthKey}
                          className={cn(
                            "hover:bg-muted/50 transition-colors bg-muted/30 cursor-pointer",
                          )}
                          onClick={toggleMonth}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasMultipleRestaurantsInMonth && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={toggleMonth}
                                >
                                  {isExpanded 
                                    ? <ChevronDown className="h-4 w-4" /> 
                                    : <ChevronRight className="h-4 w-4" />
                                  }
                                </Button>
                              )}
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{group.monthLabel}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 gap-1 text-xs ml-auto"
                                onClick={(e) => { e.stopPropagation(); handleMonthDrillDown(group); }}
                              >
                                <ZoomIn className="h-3 w-3" />
                                Détail
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {group.rows.length} versement{group.rows.length > 1 ? 's' : ''} • {group.totalOrders} cmd • Ø {group.totalOrders > 0 ? formatCurrency(group.totalSales / group.totalOrders) : '0 €'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(group.totalSales)}
                          </TableCell>
                          <TableCell className="text-right text-primary">
                            <span className="font-medium tabular-nums">{group.avgProfitability.toFixed(1)}%</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <CommissionAuditCell
                              percentValue={group.avgUberFeeRate}
                              amountValue={group.totalUberFee}
                              breakdownKeys={group.rows.map(r => `${r.date}|${r.restaurantId}`)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <ComparisonCell percentValue={group.avgPromoRate} amountValue={group.totalPromo} />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <ComparisonCell percentValue={group.avgRefundRate} amountValue={group.totalRefund} />
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary tabular-nums">
                            {formatCurrency(group.totalPayout)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {group.totalMealVoucher > 0 ? formatCurrency(group.totalMealVoucher) : '-'}
                          </TableCell>
                          {platform !== "deliveroo" && <>
                          <TableCell className="text-right text-emerald-600 tabular-nums">
                            {group.rows.reduce((sum, r) => sum + r.ecoContribution, 0) > 0 
                              ? formatCurrency(group.rows.reduce((sum, r) => sum + r.ecoContribution, 0)) 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right text-red-600 tabular-nums">
                            {group.rows.reduce((sum, r) => sum + r.ecoCharge, 0) > 0 
                              ? `-${formatCurrency(group.rows.reduce((sum, r) => sum + r.ecoCharge, 0))}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right text-orange-500 tabular-nums">
                            {(() => {
                              const totalAd = group.rows.reduce((sum, r) => sum + r.advertisingAmount, 0);
                              return totalAd > 0 ? `-${formatCurrency(totalAd)}` : '-';
                            })()}
                          </TableCell>
                          </>}
                          <TableCell className="text-right font-semibold text-primary tabular-nums">
                            {formatCurrency(group.totalPayoutWithVoucher)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Per-restaurant rows - only if multiple restaurants AND expanded */}
                        {isExpanded && hasMultipleRestaurantsInMonth && group.restaurantData.map((resto, restoIdx) => (
                          <TableRow 
                            key={`${group.monthKey}-${resto.restaurantId}`}
                            className={cn(
                              "hover:bg-muted/30 transition-colors text-sm",
                              restoIdx === 0 && "bg-green-500/5",
                              restoIdx === group.restaurantData.length - 1 && "bg-red-500/5"
                            )}
                          >
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2">
                                {restoIdx === 0 && (
                                  <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">+</Badge>
                                )}
                                {restoIdx === group.restaurantData.length - 1 && (
                                  <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">−</Badge>
                                )}
                                <span className="text-muted-foreground">{resto.restaurantName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(resto.sales)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              restoIdx === 0 ? "text-green-600" : restoIdx === group.restaurantData.length - 1 ? "text-red-600" : "text-foreground"
                            )}>
                              {resto.profitability.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              <CommissionAuditCell
                                percentValue={resto.uberFeeRate}
                                amountValue={resto.uberFee}
                                breakdownKeys={group.rows.filter(r => r.restaurantId === resto.restaurantId).map(r => `${r.date}|${r.restaurantId}`)}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              <ComparisonCell percentValue={resto.promoRate} amountValue={resto.promo} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              <ComparisonCell percentValue={resto.refundRate} amountValue={resto.refund} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(resto.netPayout)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {resto.mealVoucher > 0 ? formatCurrency(resto.mealVoucher) : '-'}
                            </TableCell>
                            {platform !== "deliveroo" && <>
                            <TableCell className="text-right tabular-nums text-emerald-600">
                              {resto.ecoContribution > 0 ? formatCurrency(resto.ecoContribution) : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-600">
                              {resto.ecoCharge > 0 ? `-${formatCurrency(resto.ecoCharge)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-orange-500">
                              {resto.advertisingAmount > 0 ? `-${formatCurrency(resto.advertisingAmount)}` : '-'}
                            </TableCell>
                            </>}
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(resto.totalPayout)}
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {/* Gap row between best and worst restaurant */}
                        {isExpanded && hasMultipleRestaurantsInMonth && (
                          <TableRow className="bg-muted/10 border-b-2 border-border text-xs">
                            <TableCell className="py-1.5 pl-8 text-muted-foreground italic">
                              Écart
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.sales - worstResto.sales) >= 0 ? '+' : ''}{formatCurrency(bestResto.sales - worstResto.sales)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.profitability - worstResto.profitability) >= 0 ? '+' : ''}{(bestResto.profitability - worstResto.profitability).toFixed(1)} pts
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount'
                                ? `${(bestResto.uberFee - worstResto.uberFee) >= 0 ? '+' : ''}${formatCurrency(bestResto.uberFee - worstResto.uberFee)}`
                                : `${(bestResto.uberFeeRate - worstResto.uberFeeRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount'
                                ? `${(bestResto.promo - worstResto.promo) >= 0 ? '+' : ''}${formatCurrency(bestResto.promo - worstResto.promo)}`
                                : `${(bestResto.promoRate - worstResto.promoRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount'
                                ? `${(bestResto.refund - worstResto.refund) >= 0 ? '+' : ''}${formatCurrency(bestResto.refund - worstResto.refund)}`
                                : `${(bestResto.refundRate - worstResto.refundRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.netPayout - worstResto.netPayout) >= 0 ? '+' : ''}{formatCurrency(bestResto.netPayout - worstResto.netPayout)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.totalPayout - worstResto.totalPayout) >= 0 ? '+' : ''}{formatCurrency(bestResto.totalPayout - worstResto.totalPayout)}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  
                  {/* Total row for months */}
                  {monthGroups.length > 1 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="text-muted-foreground">
                        Total
                      </TableCell>
                      <TableCell className="text-right text-primary tabular-nums">
                        {averages?.profitability.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalUberFee, 0))
                          : `${averages?.uberFeeRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalPromo, 0))
                          : `${averages?.promoRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalRefund, 0))
                          : `${averages?.refundRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-primary tabular-nums">
                        {formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalPayout, 0))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalMealVoucher, 0))}
                      </TableCell>
                      {platform !== "deliveroo" && <>
                      <TableCell className="text-right text-emerald-600 tabular-nums">
                        {formatCurrency(monthGroups.reduce((sum, g) => g.rows.reduce((s, r) => s + r.ecoContribution, 0) + sum, 0))}
                      </TableCell>
                      <TableCell className="text-right text-red-600 tabular-nums">
                        {(() => {
                          const totalCharge = monthGroups.reduce((sum, g) => g.rows.reduce((s, r) => s + r.ecoCharge, 0) + sum, 0);
                          return totalCharge > 0 ? `-${formatCurrency(totalCharge)}` : '-';
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-orange-500 tabular-nums">
                        {(() => {
                          const totalAd = monthGroups.reduce((sum, g) => g.rows.reduce((s, r) => s + r.advertisingAmount, 0) + sum, 0);
                          return totalAd > 0 ? `-${formatCurrency(totalAd)}` : '-';
                        })()}
                      </TableCell>
                      </>}
                      <TableCell className="text-right font-semibold text-primary tabular-nums">
                        {formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalPayoutWithVoucher, 0))}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
              
              {viewMode === 'year' && (
                // Year grouped view
                <>
                  {yearGroups.map((group) => {
                    const hasMultipleRestaurantsInYear = group.restaurantData.length > 1;
                    const bestResto = group.restaurantData[0];
                    const worstResto = group.restaurantData[group.restaurantData.length - 1];
                    const isExpanded = expandedYears.has(group.year);
                    
                    const toggleYear = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setExpandedYears(prev => {
                        const next = new Set(prev);
                        if (next.has(group.year)) {
                          next.delete(group.year);
                        } else {
                          next.add(group.year);
                        }
                        return next;
                      });
                    };
                    
                    return (
                      <>
                        {/* Year header row */}
                        <TableRow 
                          key={`year-${group.year}`}
                          className="hover:bg-muted/50 transition-colors bg-muted/30 cursor-pointer"
                          onClick={toggleYear}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasMultipleRestaurantsInYear && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={toggleYear}
                                >
                                  {isExpanded 
                                    ? <ChevronDown className="h-4 w-4" /> 
                                    : <ChevronRight className="h-4 w-4" />
                                  }
                                </Button>
                              )}
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-base">{group.year}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 gap-1 text-xs ml-auto"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setSelectedYear(group.year);
                                  setViewMode('month'); 
                                }}
                              >
                                <ZoomIn className="h-3 w-3" />
                                Détail
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {group.rows.length} versement{group.rows.length > 1 ? 's' : ''} • {group.totalOrders} cmd • Ø {group.totalOrders > 0 ? formatCurrency(group.totalSales / group.totalOrders) : '0 €'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(group.totalSales)}
                          </TableCell>
                          <TableCell className="text-right text-primary">
                            <span className="font-medium tabular-nums">{group.avgProfitability.toFixed(1)}%</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <CommissionAuditCell
                              percentValue={group.avgUberFeeRate}
                              amountValue={group.totalUberFee}
                              breakdownKeys={group.rows.map(r => `${r.date}|${r.restaurantId}`)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <ComparisonCell percentValue={group.avgPromoRate} amountValue={group.totalPromo} />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <ComparisonCell percentValue={group.avgRefundRate} amountValue={group.totalRefund} />
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary tabular-nums">
                            {formatCurrency(group.totalPayout)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {group.totalMealVoucher > 0 ? formatCurrency(group.totalMealVoucher) : '-'}
                          </TableCell>
                          {platform !== "deliveroo" && <>
                          <TableCell className="text-right text-emerald-600 tabular-nums">
                            {group.rows.reduce((sum, r) => sum + r.ecoContribution, 0) > 0 
                              ? formatCurrency(group.rows.reduce((sum, r) => sum + r.ecoContribution, 0)) 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right text-red-600 tabular-nums">
                            {group.rows.reduce((sum, r) => sum + r.ecoCharge, 0) > 0 
                              ? `-${formatCurrency(group.rows.reduce((sum, r) => sum + r.ecoCharge, 0))}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right text-orange-500 tabular-nums">
                            {(() => {
                              const totalAd = group.rows.reduce((sum, r) => sum + r.advertisingAmount, 0);
                              return totalAd > 0 ? `-${formatCurrency(totalAd)}` : '-';
                            })()}
                          </TableCell>
                          </>}
                          <TableCell className="text-right font-semibold text-primary tabular-nums">
                            {formatCurrency(group.totalPayoutWithVoucher)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Per-restaurant rows */}
                        {isExpanded && hasMultipleRestaurantsInYear && group.restaurantData.map((resto, restoIdx) => (
                          <TableRow 
                            key={`year-${group.year}-${resto.restaurantId}`}
                            className={cn(
                              "hover:bg-muted/30 transition-colors text-sm",
                              restoIdx === 0 && "bg-green-500/5",
                              restoIdx === group.restaurantData.length - 1 && "bg-red-500/5"
                            )}
                          >
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2">
                                {restoIdx === 0 && (
                                  <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">+</Badge>
                                )}
                                {restoIdx === group.restaurantData.length - 1 && (
                                  <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">−</Badge>
                                )}
                                <span className="text-muted-foreground">{resto.restaurantName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(resto.sales)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              restoIdx === 0 ? "text-green-600" : restoIdx === group.restaurantData.length - 1 ? "text-red-600" : "text-foreground"
                            )}>
                              {resto.profitability.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              <CommissionAuditCell
                                percentValue={resto.uberFeeRate}
                                amountValue={resto.uberFee}
                                breakdownKeys={group.rows.filter(r => r.restaurantId === resto.restaurantId).map(r => `${r.date}|${r.restaurantId}`)}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              <ComparisonCell percentValue={resto.promoRate} amountValue={resto.promo} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              <ComparisonCell percentValue={resto.refundRate} amountValue={resto.refund} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(resto.netPayout)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {resto.mealVoucher > 0 ? formatCurrency(resto.mealVoucher) : '-'}
                            </TableCell>
                            {platform !== "deliveroo" && <>
                            <TableCell className="text-right tabular-nums text-emerald-600">
                              {resto.ecoContribution > 0 ? formatCurrency(resto.ecoContribution) : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-600">
                              {resto.ecoCharge > 0 ? `-${formatCurrency(resto.ecoCharge)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-orange-500">
                              {resto.advertisingAmount > 0 ? `-${formatCurrency(resto.advertisingAmount)}` : '-'}
                            </TableCell>
                            </>}
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(resto.totalPayout)}
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {/* Gap row */}
                        {isExpanded && hasMultipleRestaurantsInYear && (
                          <TableRow className="bg-muted/10 border-b-2 border-border text-xs">
                            <TableCell className="py-1.5 pl-8 text-muted-foreground italic">
                              Écart
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.sales - worstResto.sales) >= 0 ? '+' : ''}{formatCurrency(bestResto.sales - worstResto.sales)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.profitability - worstResto.profitability) >= 0 ? '+' : ''}{(bestResto.profitability - worstResto.profitability).toFixed(1)} pts
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount'
                                ? `${(bestResto.uberFee - worstResto.uberFee) >= 0 ? '+' : ''}${formatCurrency(bestResto.uberFee - worstResto.uberFee)}`
                                : `${(bestResto.uberFeeRate - worstResto.uberFeeRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount'
                                ? `${(bestResto.promo - worstResto.promo) >= 0 ? '+' : ''}${formatCurrency(bestResto.promo - worstResto.promo)}`
                                : `${(bestResto.promoRate - worstResto.promoRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount'
                                ? `${(bestResto.refund - worstResto.refund) >= 0 ? '+' : ''}${formatCurrency(bestResto.refund - worstResto.refund)}`
                                : `${(bestResto.refundRate - worstResto.refundRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.netPayout - worstResto.netPayout) >= 0 ? '+' : ''}{formatCurrency(bestResto.netPayout - worstResto.netPayout)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">-</TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">-</TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">-</TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">-</TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {(bestResto.totalPayout - worstResto.totalPayout) >= 0 ? '+' : ''}{formatCurrency(bestResto.totalPayout - worstResto.totalPayout)}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  
                  {/* Total row for years */}
                  {yearGroups.length > 1 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="text-muted-foreground">
                        Total
                      </TableCell>
                      <TableCell className="text-right text-primary tabular-nums">
                        {(() => {
                          const totalSales = yearGroups.reduce((s, g) => s + g.totalSales, 0);
                          const totalPromo = yearGroups.reduce((s, g) => s + g.totalPromo, 0);
                          const totalPayoutWV = yearGroups.reduce((s, g) => s + g.totalPayoutWithVoucher, 0);
                          const netSales = totalSales - totalPromo;
                          const denom = profitabilityBase === 'net' ? netSales : totalSales;
                          return denom > 0 ? `${(totalPayoutWV / denom * 100).toFixed(1)}%` : '0.0%';
                        })()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(yearGroups.reduce((sum, g) => sum + g.totalUberFee, 0))
                          : `${(() => {
                              const totalSales = yearGroups.reduce((s, g) => s + g.totalSales, 0);
                              const totalPromo = yearGroups.reduce((s, g) => s + g.totalPromo, 0);
                              const totalFee = yearGroups.reduce((s, g) => s + g.totalUberFee, 0);
                              const netSales = totalSales - totalPromo;
                              const denom = platform === "deliveroo" ? totalSales : netSales;
                              return denom > 0 ? (totalFee / denom * 100).toFixed(1) : '0.0';
                            })()}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(yearGroups.reduce((sum, g) => sum + g.totalPromo, 0))
                          : `${(() => {
                              const totalSales = yearGroups.reduce((s, g) => s + g.totalSales, 0);
                              const totalPromo = yearGroups.reduce((s, g) => s + g.totalPromo, 0);
                              return totalSales > 0 ? (totalPromo / totalSales * 100).toFixed(1) : '0.0';
                            })()}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(yearGroups.reduce((sum, g) => sum + g.totalRefund, 0))
                          : `${(() => {
                              const totalSales = yearGroups.reduce((s, g) => s + g.totalSales, 0);
                              const totalRefund = yearGroups.reduce((s, g) => s + g.totalRefund, 0);
                              return totalSales > 0 ? (totalRefund / totalSales * 100).toFixed(1) : '0.0';
                            })()}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-primary tabular-nums">
                        {formatCurrency(yearGroups.reduce((sum, g) => sum + g.totalPayout, 0))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatCurrency(yearGroups.reduce((sum, g) => sum + g.totalMealVoucher, 0))}
                      </TableCell>
                      {platform !== "deliveroo" && <>
                      <TableCell className="text-right text-emerald-600 tabular-nums">
                        {formatCurrency(yearGroups.reduce((sum, g) => g.rows.reduce((s, r) => s + r.ecoContribution, 0) + sum, 0))}
                      </TableCell>
                      <TableCell className="text-right text-red-600 tabular-nums">
                        {(() => {
                          const totalCharge = yearGroups.reduce((sum, g) => g.rows.reduce((s, r) => s + r.ecoCharge, 0) + sum, 0);
                          return totalCharge > 0 ? `-${formatCurrency(totalCharge)}` : '-';
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-orange-500 tabular-nums">
                        {(() => {
                          const totalAd = yearGroups.reduce((sum, g) => g.rows.reduce((s, r) => s + r.advertisingAmount, 0) + sum, 0);
                          return totalAd > 0 ? `-${formatCurrency(totalAd)}` : '-';
                        })()}
                      </TableCell>
                      </>}
                      <TableCell className="text-right font-semibold text-primary tabular-nums">
                        {formatCurrency(yearGroups.reduce((sum, g) => sum + g.totalPayoutWithVoucher, 0))}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {/* Detail Sheet */}
      <PayoutDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        payouts={selectedPayouts}
        restaurants={restaurants}
      />
      
      {/* Daily Finances Drill-down Sheet */}
      {dailySheetPeriod && (
        <DailyFinancesSheet
          open={dailySheetOpen}
          onOpenChange={setDailySheetOpen}
          restaurantIds={dailySheetPeriod.restaurantIds}
          startDate={dailySheetPeriod.startDate}
          endDate={dailySheetPeriod.endDate}
          periodLabel={dailySheetPeriod.label}
        />
      )}
    </Card>
  );
}
