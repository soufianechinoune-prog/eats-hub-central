const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = "wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX";
const SCOPE = "eats.store eats.store.orders.read eats.report";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_secret } = await req.json();
    if (!client_secret) {
      return new Response(JSON.stringify({ error: "Missing client_secret" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const tokenResp = await fetch("https://login.uber.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret,
        grant_type: "client_credentials",
        scope: SCOPE,
      }),
    });

    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      return new Response(JSON.stringify({
        step: "token",
        status: tokenResp.status,
        response: tokenJson,
      }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const accessToken = tokenJson.access_token;

    const endpoints = [
      { name: "stores", url: "https://api.uber.com/v1/eats/stores" },
      { name: "orders", url: "https://api.uber.com/v1/eats/orders" },
      { name: "reports", url: "https://api.uber.com/v1/eats/reports" },
    ];

    const results: Record<string, any> = {};
    for (const ep of endpoints) {
      const resp = await fetch(ep.url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const text = await resp.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = text; }
      results[ep.name] = { status: resp.status, body };
    }

    return new Response(JSON.stringify({
      token: {
        status: tokenResp.status,
        scope: tokenJson.scope,
        expires_in: tokenJson.expires_in,
        token_type: tokenJson.token_type,
      },
      endpoints: results,
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
