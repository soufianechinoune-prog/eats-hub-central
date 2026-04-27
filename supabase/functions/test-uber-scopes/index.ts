const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = "wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_secret, scopes } = await req.json();
    if (!client_secret) {
      return new Response(JSON.stringify({ error: "Missing client_secret" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const scopesToTest: string[] = scopes ?? ["eats.store", "eats.order", "eats.report"];
    const results: Record<string, any> = {};

    for (const scope of scopesToTest) {
      const tokenResp = await fetch("https://login.uber.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret,
          grant_type: "client_credentials",
          scope,
        }),
      });
      const tokenJson = await tokenResp.json();
      results[scope] = {
        token_status: tokenResp.status,
        token_response: tokenJson,
      };
    }

    return new Response(JSON.stringify(results, null, 2), {
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
