import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format, startOfWeek, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

// Deliveroo history_type categories for mapping
const DELIVEROO_MEAL_VOUCHER_TYPES = [
  "Montant commande Edenred",
  "Montant commande Swile",
  "Montant commande Sodexo",
  "Montant commande Up",
  "Montant commande Bimpli",
];

const DELIVEROO_REFUND_TYPES = [
  "Remboursement client",
];

const DELIVEROO_PROMO_TYPES = [
  "Partner funding from agreed voucher campaign",
  "Contribution marketing",
  "Bon de réduction à payer par le restaurant",
  "Publicités Marketer",
];

const DELIVEROO_CREDIT_ADJUSTMENT_TYPES = [
  "Crédit pour rectification de facture",
];

const DELIVEROO_CANCELLATION_ORDER_TYPES = [
  "Montant commande annulée",
];

const DELIVEROO_CANCELLATION_COMMISSION_TYPES = [
  "Commission Deliveroo sur la commande annulée",
];

const DELIVEROO_CANCELLATION_FEE_TYPES = [
  "Frais d'annulation de commande",
];

const DELIVEROO_ECO_CONTRIBUTION_TYPES = [
  "Eco-contribution – article L.541-10 du Code de l'environnement",
];

const DELIVEROO_ORDER_TYPES = [
  "Livraison",
  "À emporter",
  "Nouvelle livraison",
];

// Helper: fetch Uber orders data with pagination
async function fetchUberOrdersData(restaurantIds: string[] | undefined, startStr: string, endStr: string) {
  const PAGE_SIZE = 1000;
  const allOrders: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("orders")
      .select("order_datetime, sales_incl_vat, refund_incl_vat, uber_fee_after_promo_incl_vat, item_promo_incl_vat, net_payout, meal_voucher_amount, restaurant_id")
      .gte("order_datetime", `${startStr}T00:00:00`)
      .lte("order_datetime", `${endStr}T23:59:59`)
      .range(from, from + PAGE_SIZE - 1);

    if (restaurantIds && restaurantIds.length > 0) {
      query = query.in("restaurant_id", restaurantIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data) {
      allOrders.push(...data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allOrders;
}

// Helper: fetch Deliveroo orders data and map to common format
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

    if (restaurantIds && restaurantIds.length > 0) {
      query = query.in("restaurant_id", restaurantIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data) {
      allRows.push(...data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  // Group by date+restaurant and aggregate by history_type
  const groupKey = (row: any) => {
    const date = row.delivery_datetime?.split("T")[0] || "unknown";
    return `${date}|${row.restaurant_id}`;
  };

  const grouped: Record<string, {
    order_datetime: string;
    restaurant_id: string;
    sales_incl_vat: number;
    uber_fee_after_promo_incl_vat: number;
    item_promo_incl_vat: number;
    refund_incl_vat: number;
    net_payout: number;
    meal_voucher_amount: number;
    order_count: number;
  }> = {};

  allRows.forEach(row => {
    const key = groupKey(row);
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
      // Crédits de rectification : ajout direct au net sans Math.abs (positif = crédit)
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_ORDER_TYPES.includes(ht)) {
      // Montant commande annulée : remboursement (négatif)
      g.refund_incl_vat += Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_COMMISSION_TYPES.includes(ht)) {
      // Commission sur commande annulée : crédit commission
      g.uber_fee_after_promo_incl_vat -= Math.abs(Number(row.total_payable) || 0);
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_FEE_TYPES.includes(ht)) {
      // Frais d'annulation : débit
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_ECO_CONTRIBUTION_TYPES.includes(ht)) {
      // Éco-contribution : débit
      g.net_payout += Number(row.total_payable) || 0;
    } else {
      // Other types (Remboursement de commission, etc.) → add to net_payout
      g.net_payout += Number(row.total_payable) || 0;
    }
  });

  return Object.values(grouped);
}

export type OrderSortField = "order_datetime" | "sales_excl_vat" | "sales_incl_vat" | "profitability" | "uber_fee" | "promo" | "refund" | "net_payout" | "meal_voucher" | "total_payout";
export type SortDirection = "asc" | "desc";

// Helper: fetch Uber individual orders (extracted from old inline code)
async function fetchUberIndividualOrders(
  restaurantIds: string[] | undefined, startStr: string, endStr: string,
  searchQuery: string, sortField: OrderSortField, sortDirection: SortDirection,
  fulfillmentFilter: "all" | "delivery" | "pickup" = "all"
) {
  const sortColumnMap: Record<OrderSortField, string> = {
    order_datetime: "order_datetime",
    sales_excl_vat: "sales_excl_vat",
    sales_incl_vat: "sales_incl_vat",
    profitability: "sales_incl_vat",
    uber_fee: "uber_fee_after_promo_incl_vat",
    promo: "item_promo_incl_vat",
    refund: "refund_incl_vat",
    net_payout: "net_payout",
    meal_voucher: "meal_voucher_amount",
    total_payout: "net_payout",
  };
  const dbSortColumn = sortColumnMap[sortField];
  const isAscending = sortDirection === "asc";

  let orderIdsFromItemSearch: string[] | null = null;
  if (searchQuery) {
    let orderIdsInRange: string[] = [];
    let orderQuery = supabase
      .from("orders").select("id")
      .gte("order_datetime", `${startStr}T00:00:00`)
      .lte("order_datetime", `${endStr}T23:59:59`);
    if (restaurantIds?.length) orderQuery = orderQuery.in("restaurant_id", restaurantIds);
    const { data: ordersInRange } = await orderQuery;
    if (ordersInRange) orderIdsInRange = ordersInRange.map(o => o.id);

    if (orderIdsInRange.length > 0) {
      const BATCH_SIZE = 500;
      const matchingOrderIds: Set<string> = new Set();
      for (let i = 0; i < orderIdsInRange.length; i += BATCH_SIZE) {
        const batchIds = orderIdsInRange.slice(i, i + BATCH_SIZE);
        const { data: matchingItems } = await supabase
          .from("order_items").select("order_id")
          .in("order_id", batchIds)
          .ilike("item_title", `%${searchQuery}%`);
        if (matchingItems) matchingItems.forEach(item => matchingOrderIds.add(item.order_id));
      }
      if (matchingOrderIds.size > 0) orderIdsFromItemSearch = [...matchingOrderIds];
    }
  }

  // Fetch ALL orders with pagination (while loop)
  const PAGE_SIZE = 1000;
  const allOrders: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("orders")
      .select(`id, uber_order_id, order_datetime, sales_excl_vat, vat_1_sales, vat_2_sales, vat_3_sales, sales_incl_vat, uber_fee_after_promo_incl_vat, item_promo_incl_vat, refund_incl_vat, net_payout, meal_voucher_amount, promotion_discount, fulfillment_type, offer_usage_fee, vat_offer_usage_fee`)
      .gte("order_datetime", `${startStr}T00:00:00`)
      .lte("order_datetime", `${endStr}T23:59:59`)
      .order(dbSortColumn, { ascending: isAscending })
      .range(from, from + PAGE_SIZE - 1);
    if (restaurantIds?.length) query = query.in("restaurant_id", restaurantIds);
    if (searchQuery) {
      if (orderIdsFromItemSearch?.length) {
        query = query.or(`uber_order_id.ilike.%${searchQuery}%,id.in.(${orderIdsFromItemSearch.join(",")})`);
      } else {
        query = query.ilike("uber_order_id", `%${searchQuery}%`);
      }
    }
    if (fulfillmentFilter === "delivery") {
      query = query.or("fulfillment_type.ilike.%Livraison%,fulfillment_type.ilike.%Delivery%,fulfillment_type.ilike.%coursier%");
    } else if (fulfillmentFilter === "pickup") {
      query = query.or("fulfillment_type.ilike.%emporter%,fulfillment_type.ilike.%Pickup%");
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      allOrders.push(...data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  const orderIds = allOrders.map(o => o.id);
  let orderIdsWithItems: string[] = [];
  if (orderIds.length > 0) {
    // Batch the orderIdsWithItems check too
    const BATCH = 500;
    const itemOrderIds = new Set<string>();
    for (let i = 0; i < orderIds.length; i += BATCH) {
      const batch = orderIds.slice(i, i + BATCH);
      const { data: itemsData } = await supabase
        .from("order_items").select("order_id").in("order_id", batch);
      if (itemsData) itemsData.forEach(item => itemOrderIds.add(item.order_id));
    }
    orderIdsWithItems = [...itemOrderIds];
  }

  return {
    orders: allOrders,
    totalCount: allOrders.length,
    hasMore: false,
    orderIdsWithItems,
  };
}

// Helper: fetch Deliveroo individual orders grouped by deliveroo_order_id
async function fetchDeliverooIndividualOrders(
  restaurantIds: string[] | undefined, startStr: string, endStr: string,
  searchQuery: string, sortField: OrderSortField, sortDirection: SortDirection
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
    } else {
      hasMore = false;
    }
  }

  // Group by deliveroo_order_id
  const grouped: Record<string, {
    id: string;
    uber_order_id: string;
    order_datetime: string;
    sales_incl_vat: number;
    uber_fee_after_promo_incl_vat: number;
    item_promo_incl_vat: number;
    refund_incl_vat: number;
    net_payout: number;
    meal_voucher_amount: number;
    has_offer: boolean;
    offer_note: string;
    deliveroo_funding: number;
  }> = {};

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
      if (match && !g.offer_note) {
        g.offer_note = match[0].trim();
      }
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
    } else if (DELIVEROO_CREDIT_ADJUSTMENT_TYPES.includes(ht)) {
      g.net_payout += Number(row.total_payable) || 0;
    } else if (DELIVEROO_CANCELLATION_ORDER_TYPES.includes(ht)) {
      g.refund_incl_vat += Math.abs(Number(row.order_amount) || Number(row.total_payable) || 0);
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

  let orders = Object.values(grouped).filter(o => {
    if (o.uber_order_id === "0") return false;
    if (Math.abs(o.sales_incl_vat) < 0.01 && Math.abs(o.uber_fee_after_promo_incl_vat) < 0.01 && Math.abs(o.meal_voucher_amount) > 0) return false;
    return true;
  });

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    orders = orders.filter(o => o.uber_order_id.toLowerCase().includes(q));
  }

  const isAsc = sortDirection === "asc";
  orders.sort((a, b) => {
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

export type DrilldownGranularity = "daily" | "hourly" | "product" | "order";

interface DailyFinanceData {
  date: string;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
  // Additional financial fields
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
}

interface HourlyFinanceData {
  hour: number;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
  // Additional financial fields
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
  // Additional financial field
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
}: UseFinancesDrilldownParams) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Fetch orders data for daily/hourly breakdown - include financial fields with pagination
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ["finances-drilldown-orders", restaurantIds, startStr, endStr, granularity, platform],
    queryFn: async () => {
      if (platform === "deliveroo") {
        return fetchDeliverooOrdersData(restaurantIds, startStr, endStr);
      }
      if (platform === "global") {
        const [uberData, deliverooData] = await Promise.all([
          fetchUberOrdersData(restaurantIds, startStr, endStr),
          fetchDeliverooOrdersData(restaurantIds, startStr, endStr),
        ]);
        return [...uberData, ...deliverooData];
      }
      return fetchUberOrdersData(restaurantIds, startStr, endStr);
    },
    enabled: enabled && (granularity === "daily" || granularity === "hourly"),
    retry: false,
  });

  // Fetch order items for product breakdown with pagination
  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ["finances-drilldown-items", restaurantIds, startStr, endStr],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allOrderIds: string[] = [];
      let from = 0;
      let hasMore = true;

      // First get ALL orders in date range with pagination
      while (hasMore) {
        let ordersQuery = supabase
          .from("orders")
          .select("id")
          .gte("order_datetime", `${startStr}T00:00:00`)
          .lte("order_datetime", `${endStr}T23:59:59`)
          .range(from, from + PAGE_SIZE - 1);

        if (restaurantIds && restaurantIds.length > 0) {
          ordersQuery = ordersQuery.in("restaurant_id", restaurantIds);
        }

        const { data: ordersInRange, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;

        if (ordersInRange) {
          allOrderIds.push(...ordersInRange.map(o => o.id));
          hasMore = ordersInRange.length === PAGE_SIZE;
          from += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (!allOrderIds.length) return [];

      // Fetch items in batches
      const BATCH_SIZE = 500;
      const allItems: any[] = [];

      for (let i = 0; i < allOrderIds.length; i += BATCH_SIZE) {
        const batchIds = allOrderIds.slice(i, i + BATCH_SIZE);
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select("item_id, item_title, category, quantity, sales_incl_vat, refund_incl_vat, item_promo_incl_vat, order_id")
          .in("order_id", batchIds);

        if (itemsError) throw itemsError;
        if (items) allItems.push(...items);
      }

      return allItems;
    },
    enabled: enabled && granularity === "product",
    retry: false,
  });

  // Fetch ALL individual orders (no pagination limit)
  const { data: individualOrdersData, isLoading: loadingIndividualOrders } = useQuery({
    queryKey: ["finances-drilldown-individual-orders", restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection, platform, fulfillmentFilter],
    queryFn: async () => {
      if (platform === "deliveroo") {
        return fetchDeliverooIndividualOrders(restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection);
      }
      if (platform === "global") {
        const [uber, deliveroo] = await Promise.all([
          fetchUberIndividualOrders(restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection, fulfillmentFilter),
          fetchDeliverooIndividualOrders(restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection),
        ]);
        const merged = [...uber.orders, ...deliveroo.orders];
        const sortCol = orderSortField === "order_datetime" ? "order_datetime" : "sales_incl_vat";
        merged.sort((a: any, b: any) => {
          const va = sortCol === "order_datetime" ? (a.order_datetime || "") : (Number(a[sortCol]) || 0);
          const vb = sortCol === "order_datetime" ? (b.order_datetime || "") : (Number(b[sortCol]) || 0);
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return orderSortDirection === "asc" ? cmp : -cmp;
        });
        return {
          orders: merged,
          totalCount: uber.totalCount + deliveroo.totalCount,
          hasMore: false,
          orderIdsWithItems: uber.orderIdsWithItems,
        };
      }
      return fetchUberIndividualOrders(restaurantIds, startStr, endStr, orderSearchQuery, orderSortField, orderSortDirection, fulfillmentFilter);
    },
    enabled: enabled && granularity === "order",
    retry: false,
  });

  // Fetch fulfillment stats (server-side aggregation on ALL orders, not paginated)
  const { data: fulfillmentStatsData } = useQuery({
    queryKey: ["finances-fulfillment-stats", restaurantIds, startStr, endStr, platform],
    queryFn: async () => {
      // Only Uber orders have fulfillment_type
      if (platform === "deliveroo") return null;

      let query = supabase
        .from("orders")
        .select("fulfillment_type, sales_incl_vat")
        .gte("order_datetime", `${startStr}T00:00:00`)
        .lte("order_datetime", `${endStr}T23:59:59`);

      if (restaurantIds?.length) query = query.in("restaurant_id", restaurantIds);

      // Paginate to get all
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;
      let deliveryCount = 0, pickupCount = 0, deliveryRevenue = 0, pickupRevenue = 0, totalCount = 0;

      while (hasMore) {
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (data) {
          data.forEach(row => {
            totalCount++;
            const ft = (row.fulfillment_type || "").toLowerCase();
            const rev = Math.abs(Number(row.sales_incl_vat) || 0);
            if (ft.includes("livraison") || ft.includes("delivery") || ft.includes("coursier")) {
              deliveryCount++;
              deliveryRevenue += rev;
            } else if (ft.includes("emporter") || ft.includes("pickup")) {
              pickupCount++;
              pickupRevenue += rev;
            }
          });
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (totalCount === 0) return null;
      return {
        delivery: { count: deliveryCount, pct: totalCount > 0 ? (deliveryCount / totalCount) * 100 : 0, revenue: deliveryRevenue },
        pickup: { count: pickupCount, pct: totalCount > 0 ? (pickupCount / totalCount) * 100 : 0, revenue: pickupRevenue },
      };
    },
    enabled: enabled && granularity === "order" && platform !== "deliveroo",
    retry: false,
  });

  // Process daily data with additional financial columns
  const dailyData = useMemo((): DailyFinanceData[] => {
    if (granularity !== "daily" || !ordersData?.length) return [];

    const byDate: Record<string, { 
      sales: number; 
      refund: number; 
      count: number;
      uberFee: number;
      promo: number;
      netPayout: number;
      mealVoucher: number;
    }> = {};

    ordersData.forEach(order => {
      if (!order.order_datetime) return;
      const date = order.order_datetime.split("T")[0];
      
      if (!byDate[date]) {
        byDate[date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
      }
      
      byDate[date].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byDate[date].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byDate[date].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byDate[date].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byDate[date].netPayout += Number(order.net_payout) || 0;
      byDate[date].mealVoucher += Number(order.meal_voucher_amount) || 0;
      byDate[date].count += (order as any).order_count || 1;
    });

    return Object.entries(byDate)
      .map(([date, stats]) => ({
        date,
        label: format(new Date(date), "EEE dd MMM", { locale: fr }),
        sales_incl_vat: stats.sales,
        refund_incl_vat: stats.refund,
        order_count: stats.count,
        avg_basket: stats.count > 0 ? stats.sales / stats.count : 0,
        uber_fee_incl_vat: stats.uberFee,
        promo_incl_vat: stats.promo,
        net_payout: stats.netPayout,
        meal_voucher_amount: stats.mealVoucher,
        total_payout: stats.netPayout + stats.mealVoucher,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [ordersData, granularity]);

  // Process daily data BY RESTAURANT for detailed chart view
  const dailyDataByRestaurant = useMemo((): Record<string, DailyFinanceData[]> => {
    if (granularity !== "daily" || !ordersData?.length) return {};

    // Group by restaurant then by date
    const byRestaurantAndDate: Record<string, Record<string, { 
      sales: number; 
      refund: number; 
      count: number;
      uberFee: number;
      promo: number;
      netPayout: number;
      mealVoucher: number;
    }>> = {};

    ordersData.forEach(order => {
      if (!order.order_datetime || !order.restaurant_id) return;
      const date = order.order_datetime.split("T")[0];
      const restaurantId = order.restaurant_id;
      
      if (!byRestaurantAndDate[restaurantId]) {
        byRestaurantAndDate[restaurantId] = {};
      }
      
      if (!byRestaurantAndDate[restaurantId][date]) {
        byRestaurantAndDate[restaurantId][date] = { 
          sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 
        };
      }
      
      byRestaurantAndDate[restaurantId][date].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byRestaurantAndDate[restaurantId][date].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byRestaurantAndDate[restaurantId][date].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byRestaurantAndDate[restaurantId][date].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byRestaurantAndDate[restaurantId][date].netPayout += Number(order.net_payout) || 0;
      byRestaurantAndDate[restaurantId][date].mealVoucher += Number(order.meal_voucher_amount) || 0;
      byRestaurantAndDate[restaurantId][date].count += (order as any).order_count || 1;
    });

    // Convert to output format
    const result: Record<string, DailyFinanceData[]> = {};
    
    Object.entries(byRestaurantAndDate).forEach(([restaurantId, dateData]) => {
      result[restaurantId] = Object.entries(dateData)
        .map(([date, stats]) => ({
          date,
          label: format(new Date(date), "EEE dd MMM", { locale: fr }),
          sales_incl_vat: stats.sales,
          refund_incl_vat: stats.refund,
          order_count: stats.count,
          avg_basket: stats.count > 0 ? stats.sales / stats.count : 0,
          uber_fee_incl_vat: stats.uberFee,
          promo_incl_vat: stats.promo,
          net_payout: stats.netPayout,
          meal_voucher_amount: stats.mealVoucher,
          total_payout: stats.netPayout + stats.mealVoucher,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });

    return result;
  }, [ordersData, granularity]);

  // Process hourly data with additional financial columns
  const hourlyData = useMemo((): HourlyFinanceData[] => {
    if (granularity !== "hourly" || !ordersData?.length) return [];

    const byHour: Record<number, { 
      sales: number; 
      refund: number; 
      count: number;
      uberFee: number;
      promo: number;
      netPayout: number;
      mealVoucher: number;
    }> = {};

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      byHour[h] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
    }

    ordersData.forEach(order => {
      if (!order.order_datetime) return;
      const hour = new Date(order.order_datetime).getHours();
      
      byHour[hour].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byHour[hour].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byHour[hour].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byHour[hour].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byHour[hour].netPayout += Number(order.net_payout) || 0;
      byHour[hour].mealVoucher += Number(order.meal_voucher_amount) || 0;
      byHour[hour].count += (order as any).order_count || 1;
    });

    return Object.entries(byHour)
      .map(([hour, stats]) => ({
        hour: Number(hour),
        label: `${hour}h`,
        sales_incl_vat: stats.sales,
        refund_incl_vat: stats.refund,
        order_count: stats.count,
        avg_basket: stats.count > 0 ? stats.sales / stats.count : 0,
        uber_fee_incl_vat: stats.uberFee,
        promo_incl_vat: stats.promo,
        net_payout: stats.netPayout,
        meal_voucher_amount: stats.mealVoucher,
        total_payout: stats.netPayout + stats.mealVoucher,
      }))
      .filter(h => h.order_count > 0) // Only show hours with orders
      .sort((a, b) => a.hour - b.hour);
  }, [ordersData, granularity]);

  // Process product data with promo field
  const productData = useMemo((): ProductFinanceData[] => {
    if (granularity !== "product" || !itemsData?.length) return [];

    const byProduct: Record<string, {
      item_title: string;
      category: string | null;
      quantity: number;
      sales: number;
      refund: number;
      promo: number;
      orderIds: Set<string>;
    }> = {};

    itemsData.forEach(item => {
      const key = item.item_id;
      
      if (!byProduct[key]) {
        byProduct[key] = {
          item_title: item.item_title || "Produit inconnu",
          category: item.category,
          quantity: 0,
          sales: 0,
          refund: 0,
          promo: 0,
          orderIds: new Set(),
        };
      }
      
      byProduct[key].quantity += Number(item.quantity) || 1;
      byProduct[key].sales += Math.abs(Number(item.sales_incl_vat) || 0);
      byProduct[key].refund += Math.abs(Number(item.refund_incl_vat) || 0);
      byProduct[key].promo += Math.abs(Number(item.item_promo_incl_vat) || 0);
      byProduct[key].orderIds.add(item.order_id);
    });

    return Object.entries(byProduct)
      .map(([item_id, stats]) => ({
        item_id,
        item_title: stats.item_title,
        category: stats.category,
        quantity: stats.quantity,
        sales_incl_vat: stats.sales,
        refund_incl_vat: stats.refund,
        promo_incl_vat: stats.promo,
        order_count: stats.orderIds.size,
        avg_unit_price: stats.quantity > 0 ? stats.sales / stats.quantity : 0,
        refund_rate: stats.sales > 0 ? (stats.refund / stats.sales) * 100 : 0,
      }))
      .sort((a, b) => b.sales_incl_vat - a.sales_incl_vat);
  }, [itemsData, granularity]);

  // Summary stats
  const summary = useMemo(() => {
    if (granularity === "daily" && dailyData.length > 0) {
      const totalSales = dailyData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalRefund = dailyData.reduce((sum, d) => sum + d.refund_incl_vat, 0);
      const totalOrders = dailyData.reduce((sum, d) => sum + d.order_count, 0);
      
      return {
        totalSales,
        totalRefund,
        totalOrders,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        periodCount: dailyData.length,
      };
    }

    if (granularity === "hourly" && hourlyData.length > 0) {
      const totalSales = hourlyData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalRefund = hourlyData.reduce((sum, d) => sum + d.refund_incl_vat, 0);
      const totalOrders = hourlyData.reduce((sum, d) => sum + d.order_count, 0);
      const peakHour = hourlyData.reduce((max, d) => d.order_count > max.order_count ? d : max, hourlyData[0]);
      
      return {
        totalSales,
        totalRefund,
        totalOrders,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        peakHour: peakHour?.hour,
        peakHourOrders: peakHour?.order_count,
      };
    }

    if (granularity === "product" && productData.length > 0) {
      const totalSales = productData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalRefund = productData.reduce((sum, d) => sum + d.refund_incl_vat, 0);
      const totalQuantity = productData.reduce((sum, d) => sum + d.quantity, 0);
      const topProduct = productData[0];
      
      return {
        totalSales,
        totalRefund,
        totalQuantity,
        productCount: productData.length,
        topProduct: topProduct?.item_title,
        topProductSales: topProduct?.sales_incl_vat,
      };
    }

    return null;
  }, [granularity, dailyData, hourlyData, productData]);

  // Process order data
  const orderData = useMemo((): OrderFinanceData[] => {
    if (granularity !== "order" || !individualOrdersData?.orders?.length) return [];

    return individualOrdersData.orders.map(order => {
      const salesExclVat = Math.abs(Number((order as any).sales_excl_vat) || 0);
      const vatAmount = Math.abs((Number((order as any).vat_1_sales) || 0) + (Number((order as any).vat_2_sales) || 0) + (Number((order as any).vat_3_sales) || 0));
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
        has_offer: Math.abs(Number(order.item_promo_incl_vat) || 0) > 0 || Math.abs(Number((order as any).promotion_discount) || 0) > 0,
        offer_note: Math.abs(Number(order.item_promo_incl_vat) || 0) > 0 ? `Promo article : ${Number(order.item_promo_incl_vat).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : "",
        deliveroo_funding: Number((order as any).deliveroo_funding) || 0,
        fulfillment_type: (order as any).fulfillment_type || null,
        offer_fee_incl_vat: Math.abs(Number((order as any).offer_usage_fee) || 0) + Math.abs(Number((order as any).vat_offer_usage_fee) || 0),
      };
    });
  }, [individualOrdersData, granularity]);

  return {
    dailyData,
    dailyDataByRestaurant,
    hourlyData,
    productData,
    orderData,
    orderPagination: individualOrdersData ? {
      totalCount: individualOrdersData.totalCount,
      hasMore: individualOrdersData.hasMore,
    } : null,
    orderIdsWithItems: individualOrdersData?.orderIdsWithItems || [],
    fulfillmentStats: fulfillmentStatsData || null,
    summary,
    isLoading: loadingOrders || loadingItems || loadingIndividualOrders,
  };
}
