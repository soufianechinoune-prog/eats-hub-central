import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPLASH_BASE_URL = "https://api2.splash360.fr";
const SPLASH_TOKEN_URL = `${SPLASH_BASE_URL}/oauth/v2/token`;
const SPLASH_CLIENT_ID = Deno.env.get("SPLASH_CLIENT_ID") ?? "4194_4aq9h0ehmhc0w4gkggsg0kk80wg4gg0s8wkoc8k0goksgsgc0o";
const SPLASH_CLIENT_SECRET = Deno.env.get("SPLASH_CLIENT_SECRET") ?? "5tjsus6ioj8ccow0o4ww4sggkss4k8sgckksg4o0kcsco0w0kc";

// ─── OAuth2 ─────────────────────────────────────────────────────────────────
async function getAccessToken(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: SPLASH_CLIENT_ID,
    client_secret: SPLASH_CLIENT_SECRET,
    username: email,
    password,
  });
  const res = await fetch(SPLASH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Auth Splash360 échouée (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Pas d'access_token");
  return data.access_token;
}

async function getUserProfile(token: string) {
  const res = await fetch(`${SPLASH_BASE_URL}/api/statistics/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`User profile error: ${res.status}`);
  return res.json();
}

async function fetchTurnover(
  token: string,
  endpoint: "salesturnover" | "ubersalesturnover" | "deliveroosalesturnover",
  year: number,
  month: number,
  granularity: "day" | "week" | "month" | "year",
  restaurantId: number,
  day: number = 1,
) {
  const url = `${SPLASH_BASE_URL}/api/v2/statistics/${endpoint}?year=${year}&month=${month}&day=${day}&granularity=${granularity}&restaurantId=${restaurantId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${endpoint} error (${res.status}): ${await res.text()}`);
  return res.json();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const PLATFORM_MAP = {
  salesturnover: "global",
  ubersalesturnover: "uber_eats",
  deliveroosalesturnover: "deliveroo",
} as const;

function buildRow(
  splashId: number,
  date: string,
  granularity: string,
  platform: string,
  data: any
) {
  const d = data?.data ?? {};
  return {
    restaurant_splash_id: splashId,
    date,
    granularity,
    platform,
    revenue_ttc: Number(d?.ttc?.current ?? 0),
    revenue_ht: Number(d?.ht?.current ?? 0),
    vat_amount: Number(d?.tva?.current ?? 0),
    order_count: Math.round(Number(d?.count?.current ?? 0)),
    average_basket: Number(d?.averageBasket?.current ?? 0),
    n1_revenue_ttc: d?.ttc?.previous != null ? Number(d.ttc.previous) : null,
    n1_order_count: d?.count?.previous != null ? Math.round(Number(d.count.previous)) : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      email = Deno.env.get("SPLASH_EMAIL"),
      password = Deno.env.get("SPLASH_PASSWORD"),
      year,
      month,
      mode = "test",
      granularity = "month",
      restaurant_splash_ids,
    } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email/password manquants (body ou secrets SPLASH_EMAIL/SPLASH_PASSWORD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    console.log(`[Splash360] Auth ${email}...`);
    const token = await getAccessToken(email, password);
    console.log(`[Splash360] Token OK ✅`);

    // ─── MODE TEST ────────────────────────────────────────────────────────
    if (mode === "test") {
      const [profile, sales, uberSales, deliverooSales] = await Promise.all([
        getUserProfile(token).catch(e => ({ error: e.message })),
        fetchTurnover(token, "salesturnover", targetYear, targetMonth, granularity, 0).catch(e => ({ error: e.message })),
        fetchTurnover(token, "ubersalesturnover", targetYear, targetMonth, granularity, 0).catch(e => ({ error: e.message })),
        fetchTurnover(token, "deliveroosalesturnover", targetYear, targetMonth, granularity, 0).catch(e => ({ error: e.message })),
      ]);
      return new Response(
        JSON.stringify({
          success: true,
          period: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
          profile, sales, uber_sales: uberSales, deliveroo_sales: deliverooSales,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── MODE SYNC ────────────────────────────────────────────────────────
    if (mode === "sync") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // 1. Liste des restos cibles
      let splashIds: number[];
      let restosMeta: { id: number; nom: string }[] = [];
      if (Array.isArray(restaurant_splash_ids) && restaurant_splash_ids.length > 0) {
        splashIds = restaurant_splash_ids.map(Number);
      } else {
        const profile = await getUserProfile(token);
        restosMeta = profile?.restos ?? [];
        splashIds = restosMeta.map((r: any) => r.id);
      }
      const allTargets = [0, ...splashIds];

      const dateRef = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
      console.log(`[Splash360] Sync ${allTargets.length} restos pour ${dateRef} (${granularity})...`);

      // 2. Charger le mapping splash_id → restaurant_id
      const { data: mappingRows } = await supabase
        .from("splash360_restaurant_mapping")
        .select("restaurant_splash_id, restaurant_id");
      const splashToRestaurantId = new Map<number, string>();
      for (const m of mappingRows ?? []) {
        if (m.restaurant_id) splashToRestaurantId.set(m.restaurant_splash_id, m.restaurant_id);
      }

      // 3. Auto-populer la table de mapping avec les restos vus (sans matching, juste les noms)
      if (restosMeta.length > 0) {
        const mappingUpsert = restosMeta.map((r) => ({
          restaurant_splash_id: r.id,
          splash_name: r.nom,
        }));
        await supabase
          .from("splash360_restaurant_mapping")
          .upsert(mappingUpsert, { onConflict: "restaurant_splash_id", ignoreDuplicates: true });
      }

      const rowsToUpsert: any[] = [];
      const errors: any[] = [];
      const CONCURRENCY = 5;

      for (let i = 0; i < allTargets.length; i += CONCURRENCY) {
        const batch = allTargets.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (splashId) => {
          for (const endpoint of ["salesturnover", "ubersalesturnover", "deliveroosalesturnover"] as const) {
            try {
              const data = await fetchTurnover(token, endpoint, targetYear, targetMonth, granularity, splashId);
              const row: any = buildRow(splashId, dateRef, granularity, PLATFORM_MAP[endpoint], data);
              const restoUuid = splashToRestaurantId.get(splashId);
              if (restoUuid) row.restaurant_id = restoUuid;
              rowsToUpsert.push(row);
            } catch (e: any) {
              errors.push({ splashId, endpoint, error: e.message });
            }
          }
        }));
      }

      let inserted = 0;
      for (let i = 0; i < rowsToUpsert.length; i += 500) {
        const chunk = rowsToUpsert.slice(i, i + 500);
        const { error } = await supabase
          .from("splash360_daily_sales")
          .upsert(chunk, { onConflict: "restaurant_splash_id,date,granularity,platform" });
        if (error) {
          errors.push({ batch_start: i, error: error.message });
        } else {
          inserted += chunk.length;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "sync",
          period: dateRef,
          granularity,
          targets_count: allTargets.length,
          mapping_loaded: splashToRestaurantId.size,
          rows_upserted: inserted,
          errors_count: errors.length,
          errors: errors.slice(0, 20),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `mode inconnu : ${mode}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Splash360] Erreur:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
