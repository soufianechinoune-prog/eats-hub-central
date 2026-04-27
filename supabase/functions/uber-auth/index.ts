// Redirect to Uber OAuth with server-side client_id from secrets
const UBER_AUTH_URL = "https://login.uber.com/oauth/v2/authorize";

Deno.serve((req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";

  const clientId = Deno.env.get("VITE_UBER_CLIENT_ID") ?? "";
  const redirectUri = Deno.env.get("VITE_UBER_REDIRECT_URI") ?? "";

  console.log("Uber Auth - clientId exists:", !!clientId, "redirectUri:", redirectUri);

  const scopes = "eats.report";

  if (!clientId || !redirectUri) {
    console.error("Missing Uber config:", { clientId: !!clientId, redirectUri: !!redirectUri });
    return new Response(
      JSON.stringify({ 
        error: "Missing Uber config", 
        details: { clientId: !!clientId, redirectUri: !!redirectUri } 
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  const authUrl = `${UBER_AUTH_URL}?${params.toString()}`;
  console.log("Redirecting to:", authUrl);

  return Response.redirect(authUrl, 302);
});