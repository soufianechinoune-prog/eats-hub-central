import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format, subYears, startOfYear, endOfYear, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { PeriodMode, ComparisonMode, Platform } from "@/contexts/AnalyticsContext";

interface RestaurantConsolidatedData {
  restaurantId: string;
  restaurantName: string;
  platform: string;
  // Current period
  revenue: number;
  orders: number;
  avgBasket: number;
  netPayout: number;
  marginRate: number;
  mealVoucher: number;
  mealVoucherRate: number;
  uberFee: number;
  itemPromo: number;
  refunds: number;
  // Previous period
  prevRevenue: number;
  prevOrders: number;
  prevAvgBasket: number;
  prevNetPayout: number;
}

interface UseRestaurantConsolidatedExportParams {
  restaurantIds: string[];
  platform: Platform;
  periodMode: PeriodMode;
  selectedYear: number;
  selectedMonth: number;
  dateRange?: DateRange;
  comparisonMode: ComparisonMode;
}

function getDateRanges(
  periodMode: PeriodMode,
  selectedYear: number,
  selectedMonth: number,
  dateRange?: DateRange,
  comparisonMode: ComparisonMode = "yearOverYear"
): { currentStart: Date; currentEnd: Date; prevStart: Date; prevEnd: Date } {
  const today = new Date();
  let currentStart: Date;
  let currentEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (periodMode) {
    case "year":
      currentStart = startOfYear(new Date(selectedYear, 0, 1));
      currentEnd = endOfYear(new Date(selectedYear, 0, 1));
      prevStart = startOfYear(new Date(selectedYear - 1, 0, 1));
      prevEnd = endOfYear(new Date(selectedYear - 1, 0, 1));
      break;
    case "month":
      currentStart = startOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
      currentEnd = endOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
      if (comparisonMode === "yearOverYear") {
        prevStart = startOfMonth(new Date(selectedYear - 1, selectedMonth - 1, 1));
        prevEnd = endOfMonth(new Date(selectedYear - 1, selectedMonth - 1, 1));
      } else {
        prevStart = startOfMonth(new Date(selectedYear, selectedMonth - 2, 1));
        prevEnd = endOfMonth(new Date(selectedYear, selectedMonth - 2, 1));
      }
      break;
    case "range":
      if (dateRange?.from && dateRange?.to) {
        currentStart = dateRange.from;
        currentEnd = dateRange.to;
        const daysInRange = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
        if (comparisonMode === "yearOverYear") {
          prevStart = subYears(currentStart, 1);
          prevEnd = subYears(currentEnd, 1);
        } else {
          prevStart = subDays(currentStart, daysInRange);
          prevEnd = subDays(currentEnd, daysInRange);
        }
      } else {
        currentStart = startOfYear(today);
        currentEnd = today;
        prevStart = subYears(currentStart, 1);
        prevEnd = subYears(currentEnd, 1);
      }
      break;
    case "7d":
      currentEnd = today;
      currentStart = subDays(today, 6);
      prevEnd = subDays(currentStart, 1);
      prevStart = subDays(prevEnd, 6);
      break;
    case "30d":
      currentEnd = today;
      currentStart = subDays(today, 29);
      prevEnd = subDays(currentStart, 1);
      prevStart = subDays(prevEnd, 29);
      break;
    case "current_month":
      currentStart = startOfMonth(today);
      currentEnd = today;
      if (comparisonMode === "yearOverYear") {
        prevStart = startOfMonth(subYears(today, 1));
        prevEnd = subYears(today, 1);
      } else {
        prevStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        prevEnd = endOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      }
      break;
    case "previous_week":
      const lastWeekEnd = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1);
      const lastWeekStart = startOfWeek(lastWeekEnd, { weekStartsOn: 1 });
      currentStart = lastWeekStart;
      currentEnd = lastWeekEnd;
      prevStart = subDays(lastWeekStart, 7);
      prevEnd = subDays(lastWeekEnd, 7);
      break;
    default:
      currentStart = startOfYear(today);
      currentEnd = today;
      prevStart = subYears(currentStart, 1);
      prevEnd = subYears(currentEnd, 1);
  }

  return { currentStart, currentEnd, prevStart, prevEnd };
}

export function useRestaurantConsolidatedExport({
  restaurantIds,
  platform,
  periodMode,
  selectedYear,
  selectedMonth,
  dateRange,
  comparisonMode,
}: UseRestaurantConsolidatedExportParams) {
  const { currentStart, currentEnd, prevStart, prevEnd } = useMemo(
    () => getDateRanges(periodMode, selectedYear, selectedMonth, dateRange, comparisonMode),
    [periodMode, selectedYear, selectedMonth, dateRange, comparisonMode]
  );

  const currentStartStr = format(currentStart, "yyyy-MM-dd");
  const currentEndStr = format(currentEnd, "yyyy-MM-dd");
  const prevStartStr = format(prevStart, "yyyy-MM-dd");
  const prevEndStr = format(prevEnd, "yyyy-MM-dd");

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-for-export", restaurantIds],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch payouts for current period
  const { data: currentPayouts } = useQuery({
    queryKey: ["payouts-export-current", restaurantIds, currentStartStr, currentEndStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .in("restaurant_id", restaurantIds)
        .gte("payout_date", currentStartStr)
        .lte("payout_date", currentEndStr);
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch payouts for previous period
  const { data: prevPayouts } = useQuery({
    queryKey: ["payouts-export-prev", restaurantIds, prevStartStr, prevEndStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .in("restaurant_id", restaurantIds)
        .gte("payout_date", prevStartStr)
        .lte("payout_date", prevEndStr);
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch orders for current period (for revenue if payouts don't have it)
  const { data: currentOrders } = useQuery({
    queryKey: ["orders-export-current", restaurantIds, currentStartStr, currentEndStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("restaurant_id, sales_incl_vat, net_payout, meal_voucher_amount, uber_fee_after_promo_excl_vat, item_promo_incl_vat, refund_incl_vat")
        .in("restaurant_id", restaurantIds)
        .gte("order_datetime", currentStartStr)
        .lte("order_datetime", currentEndStr + "T23:59:59");
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch orders for previous period
  const { data: prevOrders } = useQuery({
    queryKey: ["orders-export-prev", restaurantIds, prevStartStr, prevEndStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("restaurant_id, sales_incl_vat, net_payout")
        .in("restaurant_id", restaurantIds)
        .gte("order_datetime", prevStartStr)
        .lte("order_datetime", prevEndStr + "T23:59:59");
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Aggregate data per restaurant
  const consolidatedData = useMemo<RestaurantConsolidatedData[]>(() => {
    if (!restaurants || restaurants.length === 0) return [];

    return restaurants.map((restaurant) => {
      // Current period from payouts
      const currPayoutsForResto = currentPayouts?.filter((p) => p.restaurant_id === restaurant.id) || [];
      const currOrdersForResto = currentOrders?.filter((o) => o.restaurant_id === restaurant.id) || [];

      // Aggregate from payouts
      const payoutAgg = currPayoutsForResto.reduce(
        (acc, p) => ({
          revenue: acc.revenue + (p.sales_incl_vat || 0),
          orders: acc.orders + (p.order_count || 0),
          netPayout: acc.netPayout + (p.net_payout || 0),
          mealVoucher: acc.mealVoucher + (p.meal_voucher_amount || 0),
          uberFee: acc.uberFee + Math.abs(p.uber_fee_after_promo_excl_vat || 0),
          itemPromo: acc.itemPromo + Math.abs(p.item_promo_incl_vat || 0),
          refunds: acc.refunds + Math.abs(p.refund_incl_vat || 0),
        }),
        { revenue: 0, orders: 0, netPayout: 0, mealVoucher: 0, uberFee: 0, itemPromo: 0, refunds: 0 }
      );

      // If no payouts, fallback to orders
      let revenue = payoutAgg.revenue;
      let orders = payoutAgg.orders;
      let netPayout = payoutAgg.netPayout;
      let mealVoucher = payoutAgg.mealVoucher;
      let uberFee = payoutAgg.uberFee;
      let itemPromo = payoutAgg.itemPromo;
      let refunds = payoutAgg.refunds;

      if (currPayoutsForResto.length === 0 && currOrdersForResto.length > 0) {
        const orderAgg = currOrdersForResto.reduce(
          (acc, o) => ({
            revenue: acc.revenue + (o.sales_incl_vat || 0),
            netPayout: acc.netPayout + (o.net_payout || 0),
            mealVoucher: acc.mealVoucher + (o.meal_voucher_amount || 0),
            uberFee: acc.uberFee + Math.abs(o.uber_fee_after_promo_excl_vat || 0),
            itemPromo: acc.itemPromo + Math.abs(o.item_promo_incl_vat || 0),
            refunds: acc.refunds + Math.abs(o.refund_incl_vat || 0),
          }),
          { revenue: 0, netPayout: 0, mealVoucher: 0, uberFee: 0, itemPromo: 0, refunds: 0 }
        );
        revenue = orderAgg.revenue;
        orders = currOrdersForResto.length;
        netPayout = orderAgg.netPayout;
        mealVoucher = orderAgg.mealVoucher;
        uberFee = orderAgg.uberFee;
        itemPromo = orderAgg.itemPromo;
        refunds = orderAgg.refunds;
      }

      // Previous period
      const prevPayoutsForResto = prevPayouts?.filter((p) => p.restaurant_id === restaurant.id) || [];
      const prevOrdersForResto = prevOrders?.filter((o) => o.restaurant_id === restaurant.id) || [];

      const prevPayoutAgg = prevPayoutsForResto.reduce(
        (acc, p) => ({
          revenue: acc.revenue + (p.sales_incl_vat || 0),
          orders: acc.orders + (p.order_count || 0),
          netPayout: acc.netPayout + (p.net_payout || 0),
        }),
        { revenue: 0, orders: 0, netPayout: 0 }
      );

      let prevRevenue = prevPayoutAgg.revenue;
      let prevOrdersCount = prevPayoutAgg.orders;
      let prevNetPayout = prevPayoutAgg.netPayout;

      if (prevPayoutsForResto.length === 0 && prevOrdersForResto.length > 0) {
        const prevOrderAgg = prevOrdersForResto.reduce(
          (acc, o) => ({
            revenue: acc.revenue + (o.sales_incl_vat || 0),
            netPayout: acc.netPayout + (o.net_payout || 0),
          }),
          { revenue: 0, netPayout: 0 }
        );
        prevRevenue = prevOrderAgg.revenue;
        prevOrdersCount = prevOrdersForResto.length;
        prevNetPayout = prevOrderAgg.netPayout;
      }

      const avgBasket = orders > 0 ? revenue / orders : 0;
      const prevAvgBasket = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;
      const marginRate = revenue > 0 ? (netPayout / revenue) * 100 : 0;
      const mealVoucherRate = revenue > 0 ? (mealVoucher / revenue) * 100 : 0;

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        platform: platform === "global" ? "TOUTES" : platform.toUpperCase().replace("_", " "),
        revenue,
        orders,
        avgBasket,
        netPayout,
        marginRate,
        mealVoucher,
        mealVoucherRate,
        uberFee,
        itemPromo,
        refunds,
        prevRevenue,
        prevOrders: prevOrdersCount,
        prevAvgBasket,
        prevNetPayout,
      };
    });
  }, [restaurants, currentPayouts, currentOrders, prevPayouts, prevOrders, platform]);

  // Export function
  const exportToExcel = useCallback(() => {
    if (consolidatedData.length === 0) return;

    const calcVar = (curr: number, prev: number): string => {
      if (prev === 0) return curr > 0 ? "+100%" : "--";
      const variation = ((curr - prev) / prev) * 100;
      return `${variation > 0 ? "+" : ""}${variation.toFixed(1)}%`;
    };

    const periodLabel = (() => {
      switch (periodMode) {
        case "year":
          return `Année ${selectedYear}`;
        case "month":
          return format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: fr });
        case "range":
          if (dateRange?.from && dateRange?.to) {
            return `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`;
          }
          return "Période personnalisée";
        case "7d":
          return "7 derniers jours";
        case "30d":
          return "30 derniers jours";
        case "current_month":
          return "Mois en cours";
        case "previous_week":
          return "Semaine dernière";
        default:
          return "";
      }
    })();

    const exportData = consolidatedData.map((d) => ({
      Restaurant: d.restaurantName,
      Plateforme: d.platform,
      "CA TTC (€)": d.revenue.toFixed(2),
      "CA N-1 (€)": d.prevRevenue.toFixed(2),
      "Évol. CA": calcVar(d.revenue, d.prevRevenue),
      Commandes: d.orders,
      "Cmd N-1": d.prevOrders,
      "Évol. Cmd": calcVar(d.orders, d.prevOrders),
      "Panier Moy. (€)": d.avgBasket.toFixed(2),
      "Panier N-1 (€)": d.prevAvgBasket.toFixed(2),
      "Évol. Panier": calcVar(d.avgBasket, d.prevAvgBasket),
      "Résultat Net (€)": d.netPayout.toFixed(2),
      "Résultat N-1 (€)": d.prevNetPayout.toFixed(2),
      "Évol. Résultat": calcVar(d.netPayout, d.prevNetPayout),
      "Marge (%)": d.marginRate.toFixed(1),
      "Titres-Restaurant (€)": d.mealVoucher.toFixed(2),
      "% TR": d.mealVoucherRate.toFixed(1),
      "Frais Uber (€)": d.uberFee.toFixed(2),
      "Offres Articles (€)": d.itemPromo.toFixed(2),
      "Remboursements (€)": d.refunds.toFixed(2),
    }));

    // Add totals row
    const totals = consolidatedData.reduce(
      (acc, d) => ({
        revenue: acc.revenue + d.revenue,
        prevRevenue: acc.prevRevenue + d.prevRevenue,
        orders: acc.orders + d.orders,
        prevOrders: acc.prevOrders + d.prevOrders,
        netPayout: acc.netPayout + d.netPayout,
        prevNetPayout: acc.prevNetPayout + d.prevNetPayout,
        mealVoucher: acc.mealVoucher + d.mealVoucher,
        uberFee: acc.uberFee + d.uberFee,
        itemPromo: acc.itemPromo + d.itemPromo,
        refunds: acc.refunds + d.refunds,
      }),
      { revenue: 0, prevRevenue: 0, orders: 0, prevOrders: 0, netPayout: 0, prevNetPayout: 0, mealVoucher: 0, uberFee: 0, itemPromo: 0, refunds: 0 }
    );

    const totalAvgBasket = totals.orders > 0 ? totals.revenue / totals.orders : 0;
    const prevTotalAvgBasket = totals.prevOrders > 0 ? totals.prevRevenue / totals.prevOrders : 0;
    const totalMarginRate = totals.revenue > 0 ? (totals.netPayout / totals.revenue) * 100 : 0;
    const totalMealVoucherRate = totals.revenue > 0 ? (totals.mealVoucher / totals.revenue) * 100 : 0;

    exportData.push({
      Restaurant: `TOTAL (${consolidatedData.length} restaurants)`,
      Plateforme: "",
      "CA TTC (€)": totals.revenue.toFixed(2),
      "CA N-1 (€)": totals.prevRevenue.toFixed(2),
      "Évol. CA": calcVar(totals.revenue, totals.prevRevenue),
      Commandes: totals.orders,
      "Cmd N-1": totals.prevOrders,
      "Évol. Cmd": calcVar(totals.orders, totals.prevOrders),
      "Panier Moy. (€)": totalAvgBasket.toFixed(2),
      "Panier N-1 (€)": prevTotalAvgBasket.toFixed(2),
      "Évol. Panier": calcVar(totalAvgBasket, prevTotalAvgBasket),
      "Résultat Net (€)": totals.netPayout.toFixed(2),
      "Résultat N-1 (€)": totals.prevNetPayout.toFixed(2),
      "Évol. Résultat": calcVar(totals.netPayout, totals.prevNetPayout),
      "Marge (%)": totalMarginRate.toFixed(1),
      "Titres-Restaurant (€)": totals.mealVoucher.toFixed(2),
      "% TR": totalMealVoucherRate.toFixed(1),
      "Frais Uber (€)": totals.uberFee.toFixed(2),
      "Offres Articles (€)": totals.itemPromo.toFixed(2),
      "Remboursements (€)": totals.refunds.toFixed(2),
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Récapitulatif Restaurants");

    // Set column widths
    ws["!cols"] = [
      { wch: 35 }, // Restaurant
      { wch: 12 }, // Plateforme
      { wch: 12 }, // CA TTC
      { wch: 12 }, // CA N-1
      { wch: 10 }, // Évol. CA
      { wch: 10 }, // Commandes
      { wch: 10 }, // Cmd N-1
      { wch: 10 }, // Évol. Cmd
      { wch: 12 }, // Panier Moy
      { wch: 12 }, // Panier N-1
      { wch: 10 }, // Évol. Panier
      { wch: 14 }, // Résultat Net
      { wch: 14 }, // Résultat N-1
      { wch: 12 }, // Évol. Résultat
      { wch: 10 }, // Marge %
      { wch: 16 }, // TR
      { wch: 8 },  // % TR
      { wch: 14 }, // Frais Uber
      { wch: 16 }, // Offres
      { wch: 16 }, // Remboursements
    ];

    const fileName = `recap_restaurants_${format(currentStart, "yyyyMMdd")}_${format(currentEnd, "yyyyMMdd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [consolidatedData, periodMode, selectedYear, selectedMonth, dateRange, currentStart, currentEnd]);

  return {
    consolidatedData,
    exportToExcel,
    isLoading: !restaurants || !currentPayouts || !currentOrders,
    periodLabel: `${format(currentStart, "dd/MM/yyyy")} - ${format(currentEnd, "dd/MM/yyyy")}`,
  };
}
