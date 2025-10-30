export interface Chain {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Restaurant {
  id: string;
  chain_id: string;
  name: string;
  city: string | null;
  uber_store_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UberConnection {
  id: string;
  restaurant_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  expires_at: string | null;
  scopes: string | null;
  raw_payload: any;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  uber_order_id: string;
  status: string | null;
  order_datetime: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  service_fee: number | null;
  currency: string | null;
  raw_payload: any;
  created_at: string;
}

export interface Promotion {
  id: string;
  restaurant_id: string;
  title: string;
  type: string | null;
  start_at: string | null;
  end_at: string | null;
  raw_payload: any;
  created_at: string;
}

export interface RestaurantWithConnection extends Restaurant {
  uber_connections?: UberConnection[];
}

export interface DashboardKPIs {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalOrders: number;
  averageTicket: number;
}

export interface RestaurantPerformance {
  restaurant: Restaurant;
  grossRevenue: number;
  netRevenue: number;
  ordersCount: number;
  activePromotions: number;
  hasConnection: boolean;
}

export type DateRange = '1' | '7' | '30' | 'custom';
