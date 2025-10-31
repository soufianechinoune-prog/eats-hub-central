// Exchange authorization code for access token using server-side secret
const UBER_TOKEN_URL = "https://login.uber.com/oauth/v2/token";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const code = body?.code as string | undefined;
  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const clientId = Deno.env.get("VITE_UBER_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("VITE_UBER_CLIENT_SECRET") ?? "";
  const redirectUri = Deno.env.get("VITE_UBER_REDIRECT_URI") ?? "";

  if (!clientId || !clientSecret || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "Missing Uber secrets" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const resp = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const json = await resp.json();
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: "Token exchange failed", details: json }), {
      status: resp.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});