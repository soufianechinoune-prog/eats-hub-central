import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPLASH_BASE_URL = "https://api2.splash360.fr";
const SPLASH_TOKEN_URL = `${SPLASH_BASE_URL}/oauth/v2/token`;
const SPLASH_CLIENT_ID = "4194_4aq9h0ehmhc0w4gkggsg0kk80wg4gg0s8wkoc8k0goksgsgc0o";
const SPLASH_CLIENT_SECRET = "5tjsus6ioj8ccow0o4ww4sggkss4k8sgckksg4o0kcsco0w0kc";

// ─── OAuth2 : obtenir un access token ───────────────────────────────────────
async function getAccessToken(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: SPLASH_CLIENT_ID,
    client_secret: SPLASH_CLIENT_SECRET,
    username: email,
    password: password,
  });

  const res = await fetch(SPLASH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Splash360 échouée (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("Pas d'access_token dans la réponse");
  return data.access_token;
}

// ─── Récupérer le profil utilisateur (pour tester + récupérer les restos) ──
async function getUserProfile(token: string): Promise<any> {
  const res = await fetch(`${SPLASH_BASE_URL}/api/statistics/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`User profile error: ${res.status}`);
  return res.json();
}

// ─── Récupérer le CA restaurant pour une période ────────────────────────────
async function getSalesTurnover(
  token: string,
  year: number,
  month: number,
  granularity: "day" | "week" | "month" | "year",
  restaurantId: number = 0
): Promise<any> {
  const url = `${SPLASH_BASE_URL}/api/v2/statistics/salesturnover?year=${year}&month=${month}&day=1&granularity=${granularity}&restaurantId=${restaurantId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sales turnover error (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Récupérer le CA Uber Eats ───────────────────────────────────────────────
async function getUberSalesTurnover(
  token: string,
  year: number,
  month: number,
  granularity: "day" | "week" | "month" | "year",
  restaurantId: number = 0
): Promise<any> {
  const url = `${SPLASH_BASE_URL}/api/v2/statistics/ubersalesturnover?year=${year}&month=${month}&day=1&granularity=${granularity}&restaurantId=${restaurantId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uber sales turnover error (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Récupérer le CA Deliveroo ───────────────────────────────────────────────
async function getDeliverooSalesTurnover(
  token: string,
  year: number,
  month: number,
  granularity: "day" | "week" | "month" | "year",
  restaurantId: number = 0
): Promise<any> {
  const url = `${SPLASH_BASE_URL}/api/v2/statistics/deliveroosalesturnover?year=${year}&month=${month}&day=1&granularity=${granularity}&restaurantId=${restaurantId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Deliveroo sales turnover error (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, year, month, mode = "test" } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email et password requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    console.log(`[Splash360] Authentification en cours pour ${email}...`);
    const token = await getAccessToken(email, password);
    console.log(`[Splash360] Token obtenu ✅`);

    // Mode test : juste vérifier l'auth + profil + données brutes
    if (mode === "test") {
      const [profile, sales, uberSales, deliverooSales] = await Promise.all([
        getUserProfile(token).catch(e => ({ error: e.message })),
        getSalesTurnover(token, targetYear, targetMonth, "month").catch(e => ({ error: e.message })),
        getUberSalesTurnover(token, targetYear, targetMonth, "month").catch(e => ({ error: e.message })),
        getDeliverooSalesTurnover(token, targetYear, targetMonth, "month").catch(e => ({ error: e.message })),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          token_obtained: true,
          period: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
          profile,
          sales,
          uber_sales: uberSales,
          deliveroo_sales: deliverooSales,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode sync : stocker dans Supabase (à développer après validation du test)
    return new Response(
      JSON.stringify({ message: "Mode sync à venir après validation du test" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Splash360] Erreur:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
