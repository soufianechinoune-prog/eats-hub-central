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
export const getUberAuthUrl = (restaurantId: string): string => {
  const config = getUberConfig();
  const scopes = [
    "eats.pos_provisioning",
    "eats.store",
    "eats.orders",
    "eats.report",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes,
    state: restaurantId, // Pass restaurant ID as state
  });

  return `${UBER_AUTH_URL}?${params.toString()}`;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code: string) => {
  const config = getUberConfig();

  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code: ${response.statusText}`);
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
 * Fetch stores from Uber Eats API
 */
export const fetchStores = async (accessToken: string) => {
  const response = await fetch(`${UBER_API_BASE}/v1/eats/stores`, {
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
 * Activate POS integration for a store
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
        external_reference_id: storeId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to activate integration: ${response.statusText}`);
  }

  return await response.json();
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
