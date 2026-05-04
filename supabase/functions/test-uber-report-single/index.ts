// Disposable smoke test: validates that Uber GTS provisioning is real
// by calling the actual /v1/eats/report endpoint on a single store UUID
// using client_credentials with eats.report scope.
// Safe to delete after the bulk activation is confirmed.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let storeUuid = url.searchParams.get('store_uuid');
    let reportType = url.searchParams.get('report_type') ?? 'PAYMENT_DETAILS_REPORT';
    let startDate = url.searchParams.get('start_date');
    let endDate = url.searchParams.get('end_date');

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        storeUuid = body.store_uuid ?? storeUuid;
        reportType = body.report_type ?? reportType;
        startDate = body.start_date ?? startDate;
        endDate = body.end_date ?? endDate;
      } catch (_) { /* no body */ }
    }

    if (!storeUuid) {
      return json({ error: 'store_uuid is required (query param or JSON body)' }, 400);
    }

    if (!startDate || !endDate) {
      const today = new Date();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      startDate = startDate ?? fmt(weekAgo);
      endDate = endDate ?? fmt(today);
    }

    const clientId = Deno.env.get('UBER_CLIENT_ID') ?? Deno.env.get('VITE_UBER_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('UBER_CLIENT_SECRET') ?? Deno.env.get('VITE_UBER_CLIENT_SECRET') ?? '';

    if (!clientId || !clientSecret) {
      return json({ error: 'Missing UBER_CLIENT_ID / UBER_CLIENT_SECRET' }, 500);
    }

    // 1. client_credentials token
    const tokenResp = await fetch('https://auth.uber.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'eats.report',
      }),
    });
    const tokenText = await tokenResp.text();
    let tokenData: any;
    try { tokenData = JSON.parse(tokenText); } catch { tokenData = { raw: tokenText }; }

    if (!tokenResp.ok) {
      return json({
        step: 'token',
        ok: false,
        status: tokenResp.status,
        error: tokenData,
        diagnosis: '❌ Could not obtain client_credentials token. Check Uber app config / scope eats.report.',
      });
    }

    // 2. POST /v1/eats/report
    const reportPayload = {
      report_type: reportType,
      store_uuids: [storeUuid],
      start_date: startDate,
      end_date: endDate,
    };

    const reportResp = await fetch('https://api.uber.com/v1/eats/report', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportPayload),
    });
    const reportText = await reportResp.text();
    let reportData: any;
    try { reportData = JSON.parse(reportText); } catch { reportData = { raw: reportText }; }

    let diagnosis = '';
    if (reportResp.ok && reportData.workflow_id) {
      diagnosis = '✅ SUCCESS — Uber GTS provisioning is working. Safe to flag remaining UUIDs as activated.';
    } else if (reportResp.status === 401) {
      diagnosis = '❌ 401 — Token rejected. Scope eats.report may not be granted on this app.';
    } else if (reportResp.status === 403) {
      diagnosis = '❌ 403 — Token valid but store NOT provisioned for this POS client. Sanjay needs to recheck.';
    } else if (reportResp.status === 404) {
      diagnosis = '❌ 404 — Store UUID unknown to Uber (or wrong endpoint).';
    } else {
      diagnosis = `⚠️ Unexpected status ${reportResp.status} — see error payload.`;
    }

    return json({
      step: 'report',
      ok: reportResp.ok,
      http_status: reportResp.status,
      payload_sent: reportPayload,
      uber_response: reportData,
      diagnosis,
      token_scope: tokenData.scope,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
