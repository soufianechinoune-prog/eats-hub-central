import { supabase } from "@/integrations/supabase/client";

const UBER_AUTH_URL = "https://login.uber.com/oauth/v2/authorize";
const UBER_TOKEN_URL = "https://login.uber.com/oauth/v2/token";
const UBER_API_BASE = "https://api.uber.com";

// Note: These should be set as environment variables or secrets
const getUberConfig = () => ({
  clientId: import.meta.env.VITE_UBER_CLIENT_ID || "",
  clientSecret: import.meta.env.VITE_UBER_CLIENT_SECRET || "",
  redirectUri: import.meta.env.VITE_UBER_REDIRECT_URI || `${window.location.origin}/auth/uber/callback`,
});

/**
 * Generate the OAuth URL for Uber authentication
 */
export const getUberAuthUrl = (state: string): string => {
  const functionsUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${functionsUrl}/functions/v1/uber-auth?state=${encodeURIComponent(state)}`;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code: string) => {
  const functionsUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${functionsUrl}/functions/v1/uber-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Failed to exchange code: ${response.statusText} ${err?.error ?? ""}`);
  }

  return await response.json();
};

/**
 * Refresh an expired access token
 */
export const refreshAccessToken = async (restaurantId: string) => {
  // Get current connection
  const { data: connection, error: fetchError } = await supabase
    .from("uber_connections")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();

  if (fetchError || !connection?.refresh_token) {
    throw new Error("No refresh token found for this restaurant");
  }

  const config = getUberConfig();

  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  const tokenData = await response.json();

  // Update connection in database
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("uber_connections")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      expires_at: expiresAt,
      token_type: tokenData.token_type,
      raw_payload: tokenData,
    })
    .eq("restaurant_id", restaurantId);

  if (updateError) {
    throw new Error("Failed to update token in database");
  }

  return tokenData;
};

/**
 * Get valid access token for a restaurant (refresh if needed)
 */
export const getValidAccessToken = async (restaurantId: string): Promise<string> => {
  const { data: connection } = await supabase
    .from("uber_connections")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();

  if (!connection) {
    throw new Error("No Uber connection found for this restaurant");
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (!expiresAt || expiresAt <= fiveMinutesFromNow) {
    // Token expired or about to expire, refresh it
    const tokenData = await refreshAccessToken(restaurantId);
    return tokenData.access_token;
  }

  return connection.access_token || "";
};

/**
 * Fetch stores from Uber Eats API (correct endpoint)
 */
export const fetchStores = async (accessToken: string) => {
  const response = await fetch(`${UBER_API_BASE}/v1/delivery/stores`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stores: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Activate POS integration for a store - correct endpoint from documentation
 */
export const activateStoreIntegration = async (
  accessToken: string,
  storeId: string
) => {
  const response = await fetch(
    `${UBER_API_BASE}/v1/eats/stores/${storeId}/pos_data`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        integrator_store_id: storeId,
        is_order_manager: true,
        require_manual_acceptance: false,
        allowed_customer_requests: {
          allow_single_use_items_requests: true,
          allow_special_instruction_requests: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to activate integration: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({})); // Some endpoints return empty body on success
};

/**
 * Fetch orders from Uber Eats API
 */
export const fetchRestaurantOrders = async (
  restaurantId: string,
  from: string,
  to: string
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  // Get store ID
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/eats/stores/${restaurant.uber_store_id}/orders?from=${from}&to=${to}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.statusText}`);
  }

  const orders = await response.json();

  // Store orders in database
  for (const order of orders.data || []) {
    await supabase.from("orders").upsert({
      restaurant_id: restaurantId,
      uber_order_id: order.id,
      status: order.status,
      order_datetime: order.created_at,
      gross_amount: order.gross_amount / 100, // Convert cents to euros
      net_amount: order.net_amount / 100,
      service_fee: order.service_fee / 100,
      currency: order.currency || "EUR",
      raw_payload: order,
    }, { onConflict: "uber_order_id" });
  }

  return orders;
};

/**
 * Fetch promotions from Uber Eats API
 */
export const fetchRestaurantPromotions = async (restaurantId: string) => {
  const accessToken = await getValidAccessToken(restaurantId);

  // Get store ID
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/eats/stores/${restaurant.uber_store_id}/promotions`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch promotions: ${response.statusText}`);
  }

  const promotions = await response.json();

  // Store promotions in database
  for (const promo of promotions.data || []) {
    await supabase.from("promotions").upsert({
      restaurant_id: restaurantId,
      title: promo.title,
      type: promo.type,
      start_at: promo.start_at,
      end_at: promo.end_at,
      raw_payload: promo,
    });
  }

  return promotions;
};

/**
 * Get store status (online/offline) - correct endpoint
 */
export const getStoreStatus = async (restaurantId: string) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/store/${restaurant.uber_store_id}/status`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch store status: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Set store status (online/offline) - correct endpoint
 */
export const setStoreStatus = async (
  restaurantId: string,
  status: "ONLINE" | "OFFLINE"
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/store/${restaurant.uber_store_id}/update-store-status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to set store status: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Get holiday hours for a store
 */
export const getHolidayHours = async (restaurantId: string) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/eats/stores/${restaurant.uber_store_id}/holiday-hours`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch holiday hours: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Set holiday hours for a store
 */
export const setHolidayHours = async (
  restaurantId: string,
  holidayHours: Array<{
    date: string;
    open_time_periods?: Array<{ start_time: string; end_time: string }>;
  }>
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/eats/stores/${restaurant.uber_store_id}/holiday-hours`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ holiday_hours: holidayHours }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to set holiday hours: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Get order details
 */
export const getOrderDetails = async (
  restaurantId: string,
  orderId: string,
  expand?: string
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const url = new URL(`${UBER_API_BASE}/v1/delivery/order/${orderId}`);
  if (expand) {
    url.searchParams.append("expand", expand);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order details: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * List orders for a store
 */
export const listOrders = async (
  restaurantId: string,
  params?: {
    expand?: string;
    state?: string;
    status?: string;
    start_time?: string;
    end_time?: string;
    next_page_token?: string;
    page_size?: number;
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const url = new URL(
    `${UBER_API_BASE}/v1/delivery/store/${restaurant.uber_store_id}/orders`
  );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list orders: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Accept an order
 */
export const acceptOrder = async (
  restaurantId: string,
  orderId: string,
  params?: {
    ready_for_pickup_time?: string;
    external_reference_id?: string;
    accepted_by?: string;
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params || {}),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to accept order: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Deny an order
 */
export const denyOrder = async (
  restaurantId: string,
  orderId: string,
  denyReason: {
    info?: string;
    type: string;
    client_error_code?: string;
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/deny`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deny_reason: denyReason }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to deny order: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Cancel an order
 */
export const cancelOrder = async (
  restaurantId: string,
  orderId: string,
  cancellationReason: {
    info?: string;
    type: string;
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancellation_reason: cancellationReason }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to cancel order: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Mark order as ready for pickup
 */
export const markOrderReady = async (
  restaurantId: string,
  orderId: string
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/ready`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to mark order ready: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Adjust order price
 */
export const adjustOrderPrice = async (
  restaurantId: string,
  orderId: string,
  adjustment: {
    amount_e5: number;
    tax_rate?: string;
    reason: string;
    custom_reason?: string;
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/adjust-price`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(adjustment),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to adjust order price: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Update order ready time
 */
export const updateOrderReadyTime = async (
  restaurantId: string,
  orderId: string,
  readyForPickupTime: string
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/update-ready-time`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ready_for_pickup_time: readyForPickupTime }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update order ready time: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Resolve fulfillment issues
 */
export const resolveFulfillmentIssues = async (
  restaurantId: string,
  orderId: string,
  fulfillmentIssues: Array<{
    issue_type: string;
    action_type: string;
    item: { cart_item_id: string };
    suspend_until?: string;
    store_response?: string;
    item_availability?: any;
    item_substitute?: any;
  }>
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/resolve-fulfillment-issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fulfillment_issues: fulfillmentIssues }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to resolve fulfillment issues: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Update delivery partner count for an order (Dispatch Multiple Courier - DMC)
 * Allows requesting 2-5 couriers for large orders
 */
export const updateDeliveryPartnerCount = async (
  restaurantId: string,
  orderId: string,
  deliveryPartnerCount: number
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  if (deliveryPartnerCount < 2 || deliveryPartnerCount > 5) {
    throw new Error("Delivery partner count must be between 2 and 5");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/order/${orderId}/update-delivery-partner-count`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delivery_partner_count: deliveryPartnerCount }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update delivery partner count: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Ingest courier live location for BYOC (Bring Your Own Courier) orders
 */
export const ingestCourierLiveLocation = async (
  restaurantId: string,
  locationData: {
    order_workflow_uuid: string;
    restaurant_uuid: string;
    is_batched_order: boolean;
    location_events: Array<{
      eta_in_minutes?: number;
      position_event: {
        point: {
          latitude: number;
          longitude: number;
        };
        time: {
          epochMillis: number;
        };
      };
    }>;
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/eats/byoc/restaurants/orders/event/location`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ location_request: locationData }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to ingest courier location: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Create a promotion for a store
 */
export const createPromotion = async (
  restaurantId: string,
  promotionData: any
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/stores/${restaurant.uber_store_id}/promotion`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promotionData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create promotion: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Revoke a promotion
 */
export const revokePromotion = async (
  restaurantId: string,
  promotionId: string
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/promotions/${promotionId}/revoke`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to revoke promotion: ${response.statusText} - ${errorText}`);
  }

  return await response.json().catch(() => ({}));
};

/**
 * Get a single promotion by ID
 */
export const getPromotion = async (
  restaurantId: string,
  promotionId: string
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const response = await fetch(
    `${UBER_API_BASE}/v1/delivery/promotions/${promotionId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get promotion: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Get all promotions for a store
 */
export const getPromotions = async (
  restaurantId: string,
  params?: {
    state?: "active" | "pending" | "completed" | "revoked" | "expired" | "deleted";
    time_range?: {
      start_time: string;
      end_time: string;
    };
  }
) => {
  const accessToken = await getValidAccessToken(restaurantId);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("uber_store_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.uber_store_id) {
    throw new Error("No Uber store ID found for this restaurant");
  }

  const url = new URL(
    `${UBER_API_BASE}/v1/delivery/stores/${restaurant.uber_store_id}/promotions`
  );

  if (params?.state) {
    url.searchParams.append("state", params.state);
  }

  if (params?.time_range) {
    url.searchParams.append("time_range", JSON.stringify(params.time_range));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get promotions: ${response.statusText}`);
  }

  return await response.json();
};
