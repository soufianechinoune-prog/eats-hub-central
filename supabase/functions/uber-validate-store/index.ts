// Validate an Uber Eats store UUID using client_credentials token.
// Returns store name and basic info if the UUID is valid and accessible.

const UBER_TOKEN_URL = "https://login.uber.com/oauth/v2/token";
const UBER_API_BASE = "https://api.uber.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getClientCredentialsToken(): Promise<string> {
  const clientId = Deno.env.get("UBER_CLIENT_ID") ?? Deno.env.get("VITE_UBER_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("UBER_CLIENT_SECRET") ?? Deno.env.get("VITE_UBER_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) throw new Error("Missing Uber credentials");

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "eats.report",
  });

  const resp = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`Token error: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const storeId = (body?.store_id as string | undefined)?.trim();
  if (!storeId) {
    return new Response(JSON.stringify({ error: "Missing store_id" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Loose UUID format check
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(storeId)) {
    return new Response(
      JSON.stringify({ valid: false, error: "Format UUID invalide" }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  try {
    const token = await getClientCredentialsToken();

    // Try the simplest read endpoint that works with eats.report scope:
    // POST a tiny report-creation request just to validate access -> too costly.
    // Instead, attempt /v1/eats/stores/{store_id} (works with eats.store, may 403 with eats.report).
    // We accept 200 (valid + name) OR 403 (UUID exists, scope-limited) as "valid".
    const resp = await fetch(`${UBER_API_BASE}/v1/eats/stores/${storeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.ok) {
      const data = await resp.json();
      return new Response(
        JSON.stringify({ valid: true, store_id: storeId, name: data?.name ?? null, raw: data }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    // 403 = scope insufficient but the UUID probably exists; we accept as "valid format, untestable"
    if (resp.status === 403) {
      return new Response(
        JSON.stringify({
          valid: true,
          store_id: storeId,
          name: null,
          warning: "UUID accepté (validation complète impossible avec le scope serveur actuel)",
        }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    // 404 = unknown store
    if (resp.status === 404) {
      return new Response(
        JSON.stringify({ valid: false, error: "Store UUID introuvable côté Uber" }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const errBody = await resp.text();
    return new Response(
      JSON.stringify({ valid: false, error: `Erreur Uber ${resp.status}`, details: errBody }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ valid: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
