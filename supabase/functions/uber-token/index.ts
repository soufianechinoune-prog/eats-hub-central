// Exchange authorization code for access token using server-side secret
const UBER_TOKEN_URL = "https://login.uber.com/oauth/v2/token";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
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

  const code = body?.code as string | undefined;
  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const clientId = Deno.env.get("VITE_UBER_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("VITE_UBER_CLIENT_SECRET") ?? "";
  const redirectUri = Deno.env.get("VITE_UBER_REDIRECT_URI") ?? "";

  console.log("Token Exchange - Config check:", { 
    hasClientId: !!clientId, 
    hasClientSecret: !!clientSecret, 
    redirectUri 
  });

  if (!clientId || !clientSecret || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "Missing Uber secrets", details: { clientId: !!clientId, clientSecret: !!clientSecret, redirectUri: !!redirectUri } }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  console.log("Exchanging code for token...");

  const resp = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const json = await resp.json();
  
  if (!resp.ok) {
    console.error("Token exchange failed:", json);
    return new Response(JSON.stringify({ error: "Token exchange failed", details: json }), {
      status: resp.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  console.log("Token exchange successful");

  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});