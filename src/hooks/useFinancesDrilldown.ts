import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// =====================================================================
// Deliveroo history_type categories for mapping (legacy client-side path)
// =====================================================================
const DELIVEROO_MEAL_VOUCHER_TYPES = [
  "Montant commande Edenred",
  "Montant commande Swile",
  "Montant commande Sodexo",
  "Montant commande Up",
  "Montant commande Bimpli",
];
const DELIVEROO_REFUND_TYPES = ["Remboursement client"];
const DELIVEROO_PROMO_TYPES = [
  "Partner funding from agreed voucher campaign",
  "Contribution marketing",
  "Bon de réduction à payer par le restaurant",
  "Publicités Marketer",
];
const DELIVEROO_CREDIT_ADJUSTMENT_TYPES = ["Crédit pour rectification de facture"];
const DELIVEROO_CANCELLATION_ORDER_TYPES = ["Montant commande annulée"];
const DELIVEROO_CANCELLATION_COMMISSION_TYPES = ["Commission Deliveroo sur la commande annulée"];
const DELIVEROO_CANCELLATION_FEE_TYPES = ["Frais d'annulation de commande"];
const DELIVEROO_ECO_CONTRIBUTION_TYPES = ["Eco-contribution – article L.541-10 du Code de l'environnement"];
const DELIVEROO_ORDER_TYPES = ["Livraison", "À emporter", "Nouvelle livraison"];

const SENTINEL = "00000000-0000-0000-0000-000000000000";

export type OrderSortField =
  | "order_datetime"
  | "sales_excl_vat"
  | "sales_incl_vat"
  | "profitability"
  | "uber_fee"
  | "promo"
  | "refund"
  | "net_payout"
  | "meal_voucher"
  | "total_payout";
export type SortDirection = "asc" | "desc";
export type DrilldownGranularity = "daily" | "hourly" | "product" | "order";

interface DailyFinanceData {
  date: string;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
  restaurant_id?: string;
}

interface HourlyFinanceData {
  hour: number;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
}

interface ProductFinanceData {
  item_id: string;
  item_title: string;
  category: string | null;
  quantity: number;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_unit_price: number;
  refund_rate: number;
  promo_incl_vat: number;
}

export interface OrderFinanceData {
  id: string;
  uber_order_id: string;
  order_datetime: string;
  sales_excl_vat: number;
  vat_amount: number;
  sales_incl_vat: number;
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  refund_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
  profitability: number;
  has_offer?: boolean;
  offer_note?: string;
  deliveroo_funding?: number;
  fulfillment_type?: string | null;
  offer_fee_incl_vat?: number;
  marketing_cofunding?: number;
}

// =====================================================================
// Deliveroo client-side helpers (kept for daily/hourly/order on Deliveroo)
// =====================================================================
async function fetchDeliverooOrdersData(restaurantIds: string[] | undefined, startStr: string, endStr: string) {
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let query = supabase
      .from("deliveroo_orders")
      .select("delivery_datetime, order_amount, commission_amount, total_payable, adjustment_amount, vat_amount, history_type, restaurant_id")
      .gte("delivery_datetime", `${startStr}T00:00:00`)
      .lte("delivery_datetime", `${endStr}T23:59:59`)
      .range(from, from + PAGE_SIZE - 1);
    if (restaurantIds && restaurantIds.length > 0) query = query.in("restaurant_id", restaurantIds);
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      allRows.push(...data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else hasMore = false;
  }

  const grouped: Record<string, any> = {};
  allRows.forEach(row => {
    const date = row.delivery_datetime?.split("T")[0] || "unknown";
    const key = `${date}|${row.restaurant_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        order_datetime: row.delivery_datetime,
        restaurant_id: row.restaurant_id,
        sales_incl_vat: 0,
        uber_fee_after_promo_incl_vat: 0,
        item_promo_incl_vat: 0,
        refund_incl_vat: 0,
        net_payout: 0,
        meal_voucher_amount: 0,
        order_count: 0,
      };
    }
    const g = grouped[key];
    const ht = row.history_type;
    if (DELIVEROO_ORDER_TYPES.includes(ht)) {
      g.sales_incl_vat += Math.abs(Number(row.order_amount) || 0);
      g.uber_fee_after_promo_incl_vat += Math.abs(Number(row.commission_amount) || 0);
      g.net_payout += Number(row.total_payable) || 0;
      g.order_count += 1;
    } else if (DELIVEROO_MEAL_VOUCHER_TYPES.includes(ht)) {
      g.meal_voucher_amount += Number(row.total_payable) || 0;
    } else if (DELIVEROO_REFUND_TYPES.includes(ht)) {
      g.refund_incl_vat += Math.abs(Number(row.order_amount) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_PROMO_TYPES.includes(ht)) {
      g.item_promo_incl_vat += Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CREDIT_ADJUSTMENT_TYPES.includes(ht)) {
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_ORDER_TYPES.includes(ht)) {
      g.refund_incl_vat += Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_COMMISSION_TYPES.includes(ht)) {
      g.uber_fee_after_promo_incl_vat -= Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_FEE_TYPES.includes(ht)) {
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_ECO_CONTRIBUTION_TYPES.includes(ht)) {
      g.net_payout += Number(row.total_payable) || 0;
    } else {
      g.net_payout += Number(row.total_payable) || 0;
    }
  });
  return Object.values(grouped);
}

async function fetchDeliverooIndividualOrders(
  restaurantIds: string[] | undefined,
  startStr: string,
  endStr: string,
  searchQuery: string,
  sortField: OrderSortField,
  sortDirection: SortDirection
) {
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let query = supabase
      .from("deliveroo_orders")
      .select("id, deliveroo_order_id, delivery_datetime, order_amount, commission_amount, total_payable, adjustment_amount, history_type, restaurant_id, note")
      .gte("delivery_datetime", `${startStr}T00:00:00`)
      .lte("delivery_datetime", `${endStr}T23:59:59`)
      .range(from, from + PAGE_SIZE - 1);
    if (restaurantIds?.length) query = query.in("restaurant_id", restaurantIds);
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      allRows.push(...data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else hasMore = false;
  }

  const grouped: Record<string, any> = {};
  allRows.forEach(row => {
    const orderId = row.deliveroo_order_id || row.id;
    if (!grouped[orderId]) {
      grouped[orderId] = {
        id: row.id,
        uber_order_id: row.deliveroo_order_id || row.id,
        order_datetime: row.delivery_datetime,
        sales_incl_vat: 0,
        uber_fee_after_promo_incl_vat: 0,
        item_promo_incl_vat: 0,
        refund_incl_vat: 0,
        net_payout: 0,
        meal_voucher_amount: 0,
        has_offer: false,
        offer_note: "",
        deliveroo_funding: 0,
      };
    }
    const g = grouped[orderId];
    const ht = row.history_type;
    const note = row.note || "";
    if (ht === "Contribution marketing") {
      g.has_offer = true;
      g.deliveroo_funding += Math.abs(Number(row.total_payable) || 0);
    }
    if (note.includes("Remise sur offre Marketer")) {
      g.has_offer = true;
      const match = note.match(/Remise sur offre Marketer[^,\n]*/);
      if (match && !g.offer_note) g.offer_note = match[0].trim();
    }
    if (DELIVEROO_ORDER_TYPES.includes(ht)) {
      g.sales_incl_vat += Math.abs(Number(row.order_amount) || 0);
      g.uber_fee_after_promo_incl_vat += Math.abs(Number(row.commission_amount) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_MEAL_VOUCHER_TYPES.includes(ht)) {
      g.meal_voucher_amount += Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_REFUND_TYPES.includes(ht)) {
      g.refund_incl_vat += Math.abs(Number(row.order_amount) || Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_PROMO_TYPES.includes(ht)) {
      g.item_promo_incl_vat += Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else {
      g.net_payout += Number(row.total_payable) || 0;
    }
  });

  let orders = Object.values(grouped).filter((o: any) => {
    if (o.uber_order_id === "0") return false;
    if (Math.abs(o.sales_incl_vat) < 0.01 && Math.abs(o.uber_fee_after_promo_incl_vat) < 0.01 && Math.abs(o.meal_voucher_amount) > 0) return false;
    return true;
  }) as any[];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    orders = orders.filter((o: any) => o.uber_order_id.toLowerCase().includes(q));
  }
  const isAsc = sortDirection === "asc";
  orders.sort((a: any, b: any) => {
    let cmp = 0;
    if (sortField === "order_datetime") cmp = (a.order_datetime || "").localeCompare(b.order_datetime || "");
    else if (sortField === "sales_incl_vat") cmp = a.sales_incl_vat - b.sales_incl_vat;
    else if (sortField === "uber_fee") cmp = a.uber_fee_after_promo_incl_vat - b.uber_fee_after_promo_incl_vat;
    else if (sortField === "net_payout") cmp = a.net_payout - b.net_payout;
    else cmp = a.sales_incl_vat - b.sales_incl_vat;
    return isAsc ? cmp : -cmp;
  });

  return {
    orders,
    totalCount: orders.length,
    hasMore: false,
    orderIdsWithItems: [] as string[],
  };
}

// =====================================================================
// Main hook
// =====================================================================
interface UseFinancesDrilldownParams {
  restaurantIds?: string[];
  startDate: Date;
  endDate: Date;
  granularity: DrilldownGranularity;
  enabled?: boolean;
  orderSearchQuery?: string;
  orderSortField?: OrderSortField;
  orderSortDirection?: SortDirection;
  platform?: "uber_eats" | "deliveroo" | "global";
  fulfillmentFilter?: "all" | "delivery" | "pickup";
  pageIndex?: number;
  pageSize?: number;
}

export function useFinancesDrilldown({
  restaurantIds,
  startDate,
  endDate,
  granularity,
  enabled = true,
  orderSearchQuery = "",
  orderSortField = "order_datetime",
  orderSortDirection = "desc",
  platform = "uber_eats",
  fulfillmentFilter = "all",
  pageIndex = 0,
  pageSize = 100,
}: UseFinancesDrilldownParams) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const hasRealIds =
    !!restaurantIds &&
    restaurantIds.length > 0 &&
    !restaurantIds.includes(SENTINEL);
  const ready = enabled && hasRealIds;

  const isUber = platform === "uber_eats" || platform === "global";
  const isDeliveroo = platform === "deliveroo" || platform === "global";

  // ============ DAILY (Uber via RPC) ============
  const { data: uberDailyData = [], isLoading: loadingUberDaily } = useQuery({
    queryKey: ["finances-daily-uber", restaurantIds, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finances_daily_uber", {
        p_restaurant_ids: restaurantIds!,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: ready && granularity === "daily" && isUber,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // ============ DAILY (Deliveroo legacy) ============
  const { data: deliverooDailyRaw = [], isLoading: loadingDeliverooDaily } = useQuery({
    queryKey: ["finances-daily-deliveroo", restaurantIds, startStr, endStr],
    queryFn: () => fetchDeliverooOrdersData(restaurantIds, startStr, endStr),
    enabled: ready && granularity === "daily" && isDeliveroo,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // ============ HOURLY (Uber via RPC) ============
  const { data: uberHourlyData = [], isLoading: loadingUberHourly } = useQuery({
    queryKey: ["finances-hourly-uber", restaurantIds, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finances_hourly_uber", {
        p_restaurant_ids: restaurantIds!,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: ready && granularity === "hourly" && isUber,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // ============ HOURLY (Deliveroo legacy) ============
  const { data: deliverooHourlyRaw = [], isLoading: loadingDeliverooHourly } = useQuery({
    queryKey: ["finances-hourly-deliveroo", restaurantIds, startStr, endStr],
    queryFn: () => fetchDeliverooOrdersData(restaurantIds, startStr, endStr),
    enabled: ready && granularity === "hourly" && isDeliveroo,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // ============ PRODUCT (Uber via RPC) ============
  const { data: productRpcData = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["finances-products-uber", restaurantIds, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finances_products_uber", {
        p_restaurant_ids: restaurantIds!,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: ready && granularity === "product" && platform !== "deliveroo",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // ============ ORDER (Uber via paginated RPC) ============
  const { data: uberOrdersPage, isLoading: loadingUberOrders } = useQuery({
    queryKey: [
      "finances-orders-uber",
      restaurantIds, startStr, endStr,
      orderSearchQuery, orderSortField, orderSortDirection, fulfillmentFilter,
      pageIndex, pageSize,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finances_orders_paginated_uber", {
        p_restaurant_ids: restaurantIds!,
        p_start_date: startStr,
        p_end_date: endStr,
        p_search: orderSearchQuery || null,
        p_sort_field: orderSortField,
        p_sort_dir: orderSortDirection,
        p_fulfillment: fulfillmentFilter,
        p_limit: pageSize,
        p_offset: pageIndex * pageSize,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: ready && granularity === "order" && isUber,
    staleTime: 60 * 1000,
    retry: false,
  });

  // ============ ORDER (Deliveroo legacy) ============
  const { data: deliverooOrdersData, isLoading: loadingDeliverooOrders } = useQuery({
    queryKey: ["finances-orders-deliveroo", restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection],
    queryFn: () =>
      fetchDeliverooIndividualOrders(restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection),
    enabled: ready && granularity === "order" && platform === "deliveroo",
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // ============ Fulfillment stats (Uber only, server-side via daily RPC sum) ============
  const fulfillmentStatsData = null; // Désactivé: data lourde, peut être ré-ajoutée via une RPC dédiée

  // =====================================================================
  // Memo: dailyData
  // =====================================================================
  const dailyData = useMemo((): DailyFinanceData[] => {
    if (granularity !== "daily") return [];
    const byDate: Record<string, any> = {};

    // Uber RPC rows
    (uberDailyData as any[]).forEach(r => {
      const date = String(r.day).slice(0, 10);
      if (!byDate[date]) {
        byDate[date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
      }
      byDate[date].sales += Number(r.sales_incl_vat) || 0;
      byDate[date].refund += Number(r.refund_incl_vat) || 0;
      byDate[date].uberFee += Number(r.uber_fee_incl_vat) || 0;
      byDate[date].promo += Number(r.promo_incl_vat) || 0;
      byDate[date].netPayout += Number(r.net_payout) || 0;
      byDate[date].mealVoucher += Number(r.meal_voucher_amount) || 0;
      byDate[date].count += Number(r.order_count) || 0;
    });

    // Deliveroo rows (legacy shape)
    (deliverooDailyRaw as any[]).forEach((o: any) => {
      if (!o.order_datetime) return;
      const date = o.order_datetime.split("T")[0];
      if (!byDate[date]) {
        byDate[date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
      }
      byDate[date].sales += Math.abs(Number(o.sales_incl_vat) || 0);
      byDate[date].refund += Math.abs(Number(o.refund_incl_vat) || 0);
      byDate[date].uberFee += Math.abs(Number(o.uber_fee_after_promo_incl_vat) || 0);
      byDate[date].promo += Math.abs(Number(o.item_promo_incl_vat) || 0);
      byDate[date].netPayout += Number(o.net_payout) || 0;
      byDate[date].mealVoucher += Number(o.meal_voucher_amount) || 0;
      byDate[date].count += Number(o.order_count) || 1;
    });

    return Object.entries(byDate)
      .map(([date, s]: [string, any]) => ({
        date,
        label: format(new Date(date), "EEE dd MMM", { locale: fr }),
        sales_incl_vat: s.sales,
        refund_incl_vat: s.refund,
        order_count: s.count,
        avg_basket: s.count > 0 ? s.sales / s.count : 0,
        uber_fee_incl_vat: s.uberFee,
        promo_incl_vat: s.promo,
        net_payout: s.netPayout,
        meal_voucher_amount: s.mealVoucher,
        total_payout: s.netPayout + s.mealVoucher,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [granularity, uberDailyData, deliverooDailyRaw]);

  // Per-restaurant breakdown (used by chart)
  const dailyDataByRestaurant = useMemo((): Record<string, DailyFinanceData[]> => {
    if (granularity !== "daily") return {};
    const out: Record<string, Record<string, any>> = {};

    (uberDailyData as any[]).forEach(r => {
      const rid = r.restaurant_id;
      const date = String(r.day).slice(0, 10);
      if (!out[rid]) out[rid] = {};
      if (!out[rid][date]) out[rid][date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
      const x = out[rid][date];
      x.sales += Number(r.sales_incl_vat) || 0;
      x.refund += Number(r.refund_incl_vat) || 0;
      x.uberFee += Number(r.uber_fee_incl_vat) || 0;
      x.promo += Number(r.promo_incl_vat) || 0;
      x.netPayout += Number(r.net_payout) || 0;
      x.mealVoucher += Number(r.meal_voucher_amount) || 0;
      x.count += Number(r.order_count) || 0;
    });

    (deliverooDailyRaw as any[]).forEach((o: any) => {
      const rid = o.restaurant_id;
      if (!rid || !o.order_datetime) return;
      const date = o.order_datetime.split("T")[0];
      if (!out[rid]) out[rid] = {};
      if (!out[rid][date]) out[rid][date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
      const x = out[rid][date];
      x.sales += Math.abs(Number(o.sales_incl_vat) || 0);
      x.refund += Math.abs(Number(o.refund_incl_vat) || 0);
      x.uberFee += Math.abs(Number(o.uber_fee_after_promo_incl_vat) || 0);
      x.promo += Math.abs(Number(o.item_promo_incl_vat) || 0);
      x.netPayout += Number(o.net_payout) || 0;
      x.mealVoucher += Number(o.meal_voucher_amount) || 0;
      x.count += Number(o.order_count) || 1;
    });

    const result: Record<string, DailyFinanceData[]> = {};
    Object.entries(out).forEach(([rid, byDate]) => {
      result[rid] = Object.entries(byDate)
        .map(([date, s]: [string, any]) => ({
          date,
          label: format(new Date(date), "EEE dd MMM", { locale: fr }),
          sales_incl_vat: s.sales,
          refund_incl_vat: s.refund,
          order_count: s.count,
          avg_basket: s.count > 0 ? s.sales / s.count : 0,
          uber_fee_incl_vat: s.uberFee,
          promo_incl_vat: s.promo,
          net_payout: s.netPayout,
          meal_voucher_amount: s.mealVoucher,
          total_payout: s.netPayout + s.mealVoucher,
          restaurant_id: rid,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });
    return result;
  }, [granularity, uberDailyData, deliverooDailyRaw]);

  // =====================================================================
  // Memo: hourlyData
  // =====================================================================
  const hourlyData = useMemo((): HourlyFinanceData[] => {
    if (granularity !== "hourly") return [];
    const byHour: Record<number, any> = {};
    for (let h = 0; h < 24; h++) byHour[h] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };

    (uberHourlyData as any[]).forEach(r => {
      const h = Number(r.hour);
      if (!Number.isFinite(h)) return;
      byHour[h].sales += Number(r.sales_incl_vat) || 0;
      byHour[h].refund += Number(r.refund_incl_vat) || 0;
      byHour[h].uberFee += Number(r.uber_fee_incl_vat) || 0;
      byHour[h].promo += Number(r.promo_incl_vat) || 0;
      byHour[h].netPayout += Number(r.net_payout) || 0;
      byHour[h].mealVoucher += Number(r.meal_voucher_amount) || 0;
      byHour[h].count += Number(r.order_count) || 0;
    });

    (deliverooHourlyRaw as any[]).forEach((o: any) => {
      if (!o.order_datetime) return;
      const h = new Date(o.order_datetime).getHours();
      byHour[h].sales += Math.abs(Number(o.sales_incl_vat) || 0);
      byHour[h].refund += Math.abs(Number(o.refund_incl_vat) || 0);
      byHour[h].uberFee += Math.abs(Number(o.uber_fee_after_promo_incl_vat) || 0);
      byHour[h].promo += Math.abs(Number(o.item_promo_incl_vat) || 0);
      byHour[h].netPayout += Number(o.net_payout) || 0;
      byHour[h].mealVoucher += Number(o.meal_voucher_amount) || 0;
      byHour[h].count += Number(o.order_count) || 1;
    });

    return Object.entries(byHour)
      .map(([hour, s]: [string, any]) => ({
        hour: Number(hour),
        label: `${hour}h`,
        sales_incl_vat: s.sales,
        refund_incl_vat: s.refund,
        order_count: s.count,
        avg_basket: s.count > 0 ? s.sales / s.count : 0,
        uber_fee_incl_vat: s.uberFee,
        promo_incl_vat: s.promo,
        net_payout: s.netPayout,
        meal_voucher_amount: s.mealVoucher,
        total_payout: s.netPayout + s.mealVoucher,
      }))
      .filter(h => h.order_count > 0)
      .sort((a, b) => a.hour - b.hour);
  }, [granularity, uberHourlyData, deliverooHourlyRaw]);

  // =====================================================================
  // Memo: productData
  // =====================================================================
  const productData = useMemo((): ProductFinanceData[] => {
    if (granularity !== "product") return [];
    if (platform === "deliveroo") return [];
    return (productRpcData as any[]).map((r: any) => {
      const sales = Number(r.sales_incl_vat) || 0;
      const refund = Number(r.refund_incl_vat) || 0;
      const qty = Number(r.quantity) || 0;
      return {
        item_id: r.item_id,
        item_title: r.item_title || "Produit inconnu",
        category: r.category || null,
        quantity: qty,
        sales_incl_vat: sales,
        refund_incl_vat: refund,
        promo_incl_vat: Number(r.promo_incl_vat) || 0,
        order_count: Number(r.order_count) || 0,
        avg_unit_price: qty > 0 ? sales / qty : 0,
        refund_rate: sales > 0 ? (refund / sales) * 100 : 0,
      };
    });
  }, [granularity, productRpcData, platform]);

  // =====================================================================
  // Memo: orderData + pagination
  // =====================================================================
  const orderData = useMemo((): OrderFinanceData[] => {
    if (granularity !== "order") return [];
    const rawList: any[] =
      platform === "deliveroo"
        ? deliverooOrdersData?.orders || []
        : (uberOrdersPage as any[]) || [];

    return rawList.map((order: any) => {
      const salesExclVat = Math.abs(Number(order.sales_excl_vat) || 0);
      const vatAmount = Math.abs(
        (Number(order.vat_1_sales) || 0) + (Number(order.vat_2_sales) || 0) + (Number(order.vat_3_sales) || 0)
      );
      const salesInclVat = Math.abs(Number(order.sales_incl_vat) || 0);
      const uberFeeInclVat = Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      const promoInclVat = Math.abs(Number(order.item_promo_incl_vat) || 0);
      const refundInclVat = Math.abs(Number(order.refund_incl_vat) || 0);
      const netPayout = Number(order.net_payout) || 0;
      const mealVoucherAmount = Number(order.meal_voucher_amount) || 0;
      const totalPayout = netPayout + mealVoucherAmount;
      const profitability = salesInclVat > 0 ? (totalPayout / salesInclVat) * 100 : 0;
      return {
        id: order.id,
        uber_order_id: order.uber_order_id,
        order_datetime: order.order_datetime,
        sales_excl_vat: salesExclVat,
        vat_amount: vatAmount,
        sales_incl_vat: salesInclVat,
        uber_fee_incl_vat: uberFeeInclVat,
        promo_incl_vat: promoInclVat,
        refund_incl_vat: refundInclVat,
        net_payout: netPayout,
        meal_voucher_amount: mealVoucherAmount,
        total_payout: totalPayout,
        profitability,
        has_offer:
          Math.abs(Number(order.item_promo_incl_vat) || 0) > 0 ||
          Math.abs(Number(order.promotion_discount) || 0) > 0,
        offer_note:
          Math.abs(Number(order.item_promo_incl_vat) || 0) > 0
            ? `Promo article : ${Number(order.item_promo_incl_vat).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
            : order.offer_note || "",
        deliveroo_funding: Number(order.deliveroo_funding) || 0,
        fulfillment_type: order.fulfillment_type || null,
        offer_fee_incl_vat:
          Math.abs(Number(order.offer_usage_fee) || 0) + Math.abs(Number(order.vat_offer_usage_fee) || 0),
        marketing_cofunding: Number(order.marketing_fee_adjustment) || 0,
      };
    });
  }, [granularity, uberOrdersPage, deliverooOrdersData, platform]);

  const orderIdsWithItems = useMemo(() => {
    if (granularity !== "order") return [] as string[];
    if (platform === "deliveroo") return [];
    return ((uberOrdersPage as any[]) || [])
      .filter((o: any) => o.has_items)
      .map((o: any) => o.id);
  }, [granularity, uberOrdersPage, platform]);

  const orderTotalCount = useMemo(() => {
    if (granularity !== "order") return 0;
    if (platform === "deliveroo") return deliverooOrdersData?.totalCount ?? 0;
    const first = (uberOrdersPage as any[])?.[0];
    return Number(first?.total_count) || 0;
  }, [granularity, uberOrdersPage, deliverooOrdersData, platform]);

  // Summary stats (light)
  const summary = useMemo(() => {
    if (granularity === "daily" && dailyData.length > 0) {
      const totalSales = dailyData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalOrders = dailyData.reduce((sum, d) => sum + d.order_count, 0);
      return {
        totalSales,
        totalRefund: dailyData.reduce((sum, d) => sum + d.refund_incl_vat, 0),
        totalOrders,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        periodCount: dailyData.length,
      };
    }
    if (granularity === "hourly" && hourlyData.length > 0) {
      const totalSales = hourlyData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalOrders = hourlyData.reduce((sum, d) => sum + d.order_count, 0);
      const peak = hourlyData.reduce((max, d) => (d.order_count > max.order_count ? d : max), hourlyData[0]);
      return {
        totalSales,
        totalRefund: hourlyData.reduce((sum, d) => sum + d.refund_incl_vat, 0),
        totalOrders,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        peakHour: peak?.hour,
        peakHourOrders: peak?.order_count,
      };
    }
    if (granularity === "product" && productData.length > 0) {
      return {
        totalSales: productData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
        totalRefund: productData.reduce((sum, d) => sum + d.refund_incl_vat, 0),
        totalQuantity: productData.reduce((sum, d) => sum + d.quantity, 0),
        productCount: productData.length,
        topProduct: productData[0]?.item_title,
        topProductSales: productData[0]?.sales_incl_vat,
      };
    }
    return null;
  }, [granularity, dailyData, hourlyData, productData]);

  const isLoading =
    (granularity === "daily" && ((isUber && loadingUberDaily) || (isDeliveroo && loadingDeliverooDaily))) ||
    (granularity === "hourly" && ((isUber && loadingUberHourly) || (isDeliveroo && loadingDeliverooHourly))) ||
    (granularity === "product" && loadingProducts) ||
    (granularity === "order" && ((isUber && loadingUberOrders) || (platform === "deliveroo" && loadingDeliverooOrders)));

  return {
    dailyData,
    dailyDataByRestaurant,
    hourlyData,
    productData,
    orderData,
    orderPagination: {
      totalCount: orderTotalCount,
      hasMore: (pageIndex + 1) * pageSize < orderTotalCount,
      pageIndex,
      pageSize,
    },
    orderIdsWithItems,
    fulfillmentStats: fulfillmentStatsData,
    summary,
    isLoading,
  };
}
