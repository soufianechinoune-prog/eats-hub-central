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
    const { client_secret, scope, urls, method } = await req.json();
    if (!client_secret) {
      return new Response(JSON.stringify({ error: "Missing client_secret" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const useScope = scope ?? "eats.report";

    // 1. Get token
    const tokenResp = await fetch("https://login.uber.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret,
        grant_type: "client_credentials",
        scope: useScope,
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      return new Response(JSON.stringify({ step: "token", status: tokenResp.status, response: tokenJson }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const accessToken = tokenJson.access_token;

    // 2. Test URLs
    const urlsToTest: string[] = urls ?? [
      "https://api.uber.com/v1/eats/reports",
      "https://api.uber.com/v1/eats/report",
      "https://api.uber.com/v2/eats/reports",
      "https://api.uber.com/v1/eats/report/list",
      "https://api.uber.com/v1/delivery/reports",
    ];
    const httpMethod = method ?? "GET";

    const results: Record<string, any> = {};
    for (const url of urlsToTest) {
      try {
        const resp = await fetch(url, {
          method: httpMethod,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        const text = await resp.text();
        let body: any;
        try { body = JSON.parse(text); } catch { body = text.slice(0, 2000); }
        results[url] = {
          status: resp.status,
          headers: Object.fromEntries(resp.headers.entries()),
          body,
        };
      } catch (e) {
        results[url] = { error: String(e) };
      }
    }

    return new Response(JSON.stringify({
      token: { scope: tokenJson.scope, expires_in: tokenJson.expires_in },
      method: httpMethod,
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
