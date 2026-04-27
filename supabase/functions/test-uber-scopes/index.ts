import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const UBER_TOKEN_URL = "https://login.uber.com/oauth/v2/token";
const CLIENT_CREDENTIAL_SCOPES = [
  "eats.store",
  "eats.store.status.write",
  "eats.order",
  "eats.store.orders.read",
  "eats.report",
];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const clientId = Deno.env.get("VITE_UBER_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("VITE_UBER_CLIENT_SECRET") ?? "";

    if (!clientId) return jsonResponse({ error: "VITE_UBER_CLIENT_ID is not configured" }, 500);
    if (!clientSecret) return jsonResponse({ error: "VITE_UBER_CLIENT_SECRET is not configured" }, 500);

    const results = [];
    for (const scope of CLIENT_CREDENTIAL_SCOPES) {
      const tokenResp = await fetch(UBER_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope,
        }),
      });

      const text = await tokenResp.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = { raw: text };
      }

      results.push({
        scope,
        grant_type: "client_credentials",
        status: tokenResp.status,
        available: tokenResp.ok,
        response_scope: typeof body === "object" && body && "scope" in body ? (body as any).scope : null,
        error: tokenResp.ok ? null : body,
      });
    }

    return jsonResponse({
      authorization_code_scope: {
        scope: "eats.pos_provisioning",
        grant_type: "authorization_code",
        testable_without_merchant_login: false,
        note: "Ce scope est testé par la redirection OAuth marchand. Un retour invalid_scope signifie qu'il n'est pas activé sur l'app Uber.",
      },
      client_credentials_scopes: results,
    });
  } catch (e) {
    console.error("test-uber-scopes error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
