import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const CLIENT_ID = "wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client_secret, store_uuid, start_date, end_date, report_type } = await req.json();
    if (!client_secret) {
      return new Response(JSON.stringify({ error: "client_secret required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get token
    const tokenResp = await fetch("https://login.uber.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret,
        grant_type: "client_credentials",
        scope: "eats.report",
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      return new Response(JSON.stringify({ step: "token", status: tokenResp.status, body: tokenJson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = tokenJson.access_token;

    // 2. POST /v1/eats/report
    const body = {
      report_type: report_type || "PAYMENT_DETAIL_V2",
      store_uuids: [store_uuid],
      start_date,
      end_date,
    };
    const reportResp = await fetch("https://api.uber.com/v1/eats/report", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const reportText = await reportResp.text();
    let reportBody: unknown = reportText;
    try { reportBody = JSON.parse(reportText); } catch {}

    return new Response(JSON.stringify({
      token_status: tokenResp.status,
      token_scope: tokenJson.scope,
      request: { url: "https://api.uber.com/v1/eats/report", body },
      report_status: reportResp.status,
      report_headers: Object.fromEntries(reportResp.headers.entries()),
      report_body: reportBody,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
