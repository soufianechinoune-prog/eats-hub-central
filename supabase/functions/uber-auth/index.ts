// Redirect to Uber OAuth with server-side client_id from secrets
const UBER_AUTH_URL = "https://login.uber.com/oauth/v2/authorize";

Deno.serve((req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";

  const clientId = Deno.env.get("VITE_UBER_CLIENT_ID") ?? "";
  const redirectUri = Deno.env.get("VITE_UBER_REDIRECT_URI") ?? "";

  // Required minimal scopes for activation + store access
  const scopes = [
    "eats.pos_provisioning",
    "eats.store",
    "eats.orders",
    "eats.report",
  ].join(" ");

  if (!clientId || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "Missing Uber config", details: { clientId: !!clientId, redirectUri: !!redirectUri } }),
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

  return Response.redirect(`${UBER_AUTH_URL}?${params.toString()}`, 302);
});