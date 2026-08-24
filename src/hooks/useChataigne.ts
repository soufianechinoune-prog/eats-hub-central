import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChataigneOverview {
  ca_brut: number;
  commandes: number;
  panier_moyen: number;
  restos_actifs: number;
  derniere_sync: string | null;
}

export interface ChataigneMonth {
  mois: string;
  restos_actifs: number;
  commandes: number;
  ca_brut: number;
}

export interface ChataigneRestaurant {
  restaurant_id: string;
  restaurant_name: string | null;
  city: string | null;
  commandes: number;
  ca_brut: number;
  panier_moyen: number;
  dernier_jour: string | null;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export type RestaurantScope = string[] | null | undefined;

/** null = tout le réseau accessible ; undefined = scope pas encore résolu (query désactivée) */
const scopeKey = (ids: RestaurantScope) => (ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(","));

export function useChataigneOverview(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-overview", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneOverview | null> => {
      const { data, error } = await supabase.rpc("get_chataigne_overview" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      const row = (data as unknown as ChataigneOverview[] | null)?.[0];
      if (!row) return null;
      return {
        ca_brut: num(row.ca_brut),
        commandes: num(row.commandes),
        panier_moyen: num(row.panier_moyen),
        restos_actifs: num(row.restos_actifs),
        derniere_sync: row.derniere_sync ?? null,
      };
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneMonthly(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-monthly", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneMonth[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_monthly" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneMonth[] | null) ?? []).map((r) => ({
        mois: r.mois,
        restos_actifs: num(r.restos_actifs),
        commandes: num(r.commandes),
        ca_brut: num(r.ca_brut),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneByRestaurant(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-by-restaurant", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneRestaurant[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_by_restaurant" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneRestaurant[] | null) ?? []).map((r) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        city: r.city,
        commandes: num(r.commandes),
        ca_brut: num(r.ca_brut),
        panier_moyen: num(r.panier_moyen),
        dernier_jour: r.dernier_jour ?? null,
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export interface ChataigneProduct {
  item_name: string;
  commandes: number;
  quantite: number;
  ca_estime: number;
  pu_moyen: number;
}

export interface ChataignePromo {
  promo: string;
  utilisations: number;
  montant_total: number;
  remise_moyenne: number;
}

export interface ChataigneBreakdown {
  dimension: "heure" | "service_type" | "canal" | string;
  valeur: string;
  commandes: number;
  ca: number;
  panier_moyen: number;
}

export function useChataigneProducts(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-products", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneProduct[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_products" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneProduct[] | null) ?? []).map((r) => ({
        item_name: r.item_name,
        commandes: num(r.commandes),
        quantite: num(r.quantite),
        ca_estime: num(r.ca_estime),
        pu_moyen: num(r.pu_moyen),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataignePromos(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-promos", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataignePromo[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_promos" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataignePromo[] | null) ?? []).map((r) => ({
        promo: r.promo,
        utilisations: num(r.utilisations),
        montant_total: num(r.montant_total),
        remise_moyenne: num(r.remise_moyenne),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export function useChataigneBreakdown(start: string, end: string, restaurantIds: RestaurantScope = null) {
  return useQuery({
    queryKey: ["chataigne-breakdown", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ChataigneBreakdown[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_orders_breakdown" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneBreakdown[] | null) ?? []).map((r) => ({
        dimension: r.dimension,
        valeur: String(r.valeur),
        commandes: num(r.commandes),
        ca: num(r.ca),
        panier_moyen: num(r.panier_moyen),
      }));
    },
    enabled: restaurantIds !== undefined,
  });
}

export interface ChataigneOrderRow {
  total_count: number;
  chataigne_order_id: string;
  short_id: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  city: string | null;
  order_datetime: string;
  channel: string | null;
  service_type: string | null;
  status: string | null;
  item_count: number;
  total_amount: number;
  delivery_fee_amount: number;
  service_charge_amount: number;
  discount_total_amount: number;
  discounts: Array<{ name?: string; amount?: number }> | null;
  payment_status: string | null;
  payment_amount: number;
  expected_pickup_time: string | null;
  expected_delivery_time: string | null;
  client_total_orders: number | null;
  client_order_rank: number | null;
  /** Identifiant client anonyme opaque — ne jamais afficher */
  customer_ref: string | null;
}

export type ChataigneOrdersSortField =
  | "order_datetime"
  | "total_amount"
  | "delivery_fee_amount"
  | "discount_total_amount"
  | "restaurant_name"
  | "client_total_orders";

interface OrdersListParams {
  start: string;
  end: string;
  restaurantIds: RestaurantScope;
  serviceType?: string | null;
  search?: string | null;
  sortField: ChataigneOrdersSortField;
  sortDir: "asc" | "desc";
  limit: number;
  offset: number;
}

export function useChataigneOrdersList(p: OrdersListParams) {
  return useQuery({
    queryKey: [
      "chataigne-orders-list",
      p.start,
      p.end,
      scopeKey(p.restaurantIds),
      p.serviceType ?? "all",
      p.search ?? "",
      p.sortField,
      p.sortDir,
      p.limit,
      p.offset,
    ],
    queryFn: async (): Promise<{ rows: ChataigneOrderRow[]; total: number }> => {
      const { data, error } = await supabase.rpc("get_chataigne_orders_list" as never, {
        p_start: p.start,
        p_end: p.end,
        p_restaurant_ids: p.restaurantIds ?? null,
        p_service_type: p.serviceType || null,
        p_search: p.search?.trim() ? p.search.trim() : null,
        p_sort_field: p.sortField,
        p_sort_dir: p.sortDir,
        p_limit: p.limit,
        p_offset: p.offset,
      } as never);
      if (error) throw error;
      const raw = (data as unknown as ChataigneOrderRow[] | null) ?? [];
      const rows = raw.map((r) => ({
        ...r,
        item_count: num(r.item_count),
        total_amount: num(r.total_amount),
        delivery_fee_amount: num(r.delivery_fee_amount),
        service_charge_amount: num(r.service_charge_amount),
        discount_total_amount: num(r.discount_total_amount),
        payment_amount: num(r.payment_amount),
        client_total_orders: r.client_total_orders === null ? null : num(r.client_total_orders),
        client_order_rank: r.client_order_rank === null ? null : num(r.client_order_rank),
        discounts: (r.discounts as ChataigneOrderRow["discounts"]) ?? [],
      }));
      return { rows, total: num(raw[0]?.total_count) };
    },
    enabled: p.restaurantIds !== undefined,
    placeholderData: (prev) => prev,
  });
}

export interface ChataigneOrderItemRow {
  id: string;
  item_id: string | null;
  item_name: string | null;
  item_type: string | null;
  quantity: number;
  unit_price_amount: number;
  parent_item_id: string | null;
  depth: number;
}

export function useChataigneOrderItems(orderId: string | null) {
  return useQuery({
    queryKey: ["chataigne-order-items", orderId],
    queryFn: async (): Promise<ChataigneOrderItemRow[]> => {
      const { data, error } = await supabase
        .from("chataigne_order_items")
        .select("id, item_id, item_name, item_type, quantity, unit_price_amount, parent_item_id, depth")
        .eq("chataigne_order_id", orderId!)
        .order("depth", { ascending: true });
      if (error) throw error;
      return ((data as ChataigneOrderItemRow[] | null) ?? []).map((r) => ({
        ...r,
        quantity: num(r.quantity),
        unit_price_amount: num(r.unit_price_amount),
        depth: num(r.depth),
      }));
    },
    enabled: !!orderId,
  });
}

export interface ChataigneCustomerSummary {
  total_orders: number;
  total_spent: number;
  first_order: string | null;
  last_order: string | null;
  avg_basket: number;
  pct_delivery: number;
  avg_days_between: number | null;
  total_discount: number;
}

export function useChataigneCustomerSummary(codeClient: string | null) {
  return useQuery({
    queryKey: ["chataigne-customer-summary", codeClient],
    queryFn: async (): Promise<ChataigneCustomerSummary | null> => {
      const { data, error } = await supabase.rpc("get_chataigne_customer_summary" as never, {
        p_code_client: codeClient!,
      } as never);
      if (error) throw error;
      const raw = data as unknown;
      const row = (Array.isArray(raw) ? raw[0] : raw) as ChataigneCustomerSummary | undefined;
      if (!row) return null;
      return {
        ...row,
        total_orders: num(row.total_orders),
        total_spent: num(row.total_spent),
        avg_basket: num(row.avg_basket),
        pct_delivery: num(row.pct_delivery),
        avg_days_between: row.avg_days_between === null ? null : num(row.avg_days_between),
        total_discount: num(row.total_discount),
      };
    },
    enabled: !!codeClient,
  });
}

export interface ChataigneCustomerOrder {
  chataigne_order_id: string;
  short_id: string | null;
  order_datetime: string;
  restaurant_name: string | null;
  service_type: string | null;
  status: string | null;
  item_count: number;
  total_amount: number;
  delivery_fee_amount: number;
  service_charge_amount: number;
  discount_total_amount: number;
  payment_status: string | null;
  expected_pickup_time: string | null;
  expected_delivery_time: string | null;
}

export function useChataigneCustomerOrders(codeClient: string | null) {
  return useQuery({
    queryKey: ["chataigne-customer-orders", codeClient],
    queryFn: async (): Promise<ChataigneCustomerOrder[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_customer_orders" as never, {
        p_code_client: codeClient!,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneCustomerOrder[] | null) ?? []).map((r) => ({
        ...r,
        item_count: num(r.item_count),
        total_amount: num(r.total_amount),
        delivery_fee_amount: num(r.delivery_fee_amount),
        service_charge_amount: num(r.service_charge_amount),
        discount_total_amount: num(r.discount_total_amount),
      }));
    },
    enabled: !!codeClient,
  });
}
