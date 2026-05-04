import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateReportRequest {
  restaurantId: string;
  reportType: string;
  startDate: string;
  endDate: string;
}

// Returns a valid Uber access token. Tries user OAuth first (uber_connections),
// then falls back to client_credentials (server-to-server) if no user connection.
async function getAccessToken(supabase: any, restaurantId: string): Promise<string> {
  const { data: connection } = await supabase
    .from('uber_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  const clientId = Deno.env.get('UBER_CLIENT_ID') ?? Deno.env.get('VITE_UBER_CLIENT_ID')!;
  const clientSecret = Deno.env.get('UBER_CLIENT_SECRET') ?? Deno.env.get('VITE_UBER_CLIENT_SECRET')!;

  // Path 1: user OAuth available
  if (connection?.access_token) {
    const expiresAt = new Date(connection.expires_at);
    if (expiresAt > new Date()) {
      console.log('Using existing user OAuth token');
      return connection.access_token;
    }
    console.log('User token expired, refreshing...');
    const tokenResponse = await fetch('https://auth.uber.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      await supabase
        .from('uber_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq('restaurant_id', restaurantId);
      return tokenData.access_token;
    }
    console.warn('Refresh token failed, falling back to client_credentials');
  }

  // Path 2: fallback to client_credentials (server-to-server) — CACHED in DB
  // The token is valid ~30 days. We cache it to avoid Uber's OAuth rate-limit
  // ("too_many_requests for grant type") when running batch backfills.
  const { data: cached } = await supabase
    .from('uber_app_token')
    .select('access_token, expires_at')
    .eq('id', true)
    .maybeSingle();

  // Re-use if still valid for at least 5 more minutes
  if (cached?.access_token && new Date(cached.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    console.log('Using cached client_credentials token (expires', cached.expires_at, ')');
    return cached.access_token;
  }

  console.log('Cached token missing/expired, requesting new client_credentials token');
  const tokenResponse = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'eats.report',
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    // If we got rate-limited but have a stale-ish cached token, fall back to it
    if (cached?.access_token && new Date(cached.expires_at).getTime() > Date.now()) {
      console.warn('Uber OAuth rate-limited, falling back to cached token still valid:', errText);
      return cached.access_token;
    }
    throw new Error(`Failed to get client_credentials token: ${errText}`);
  }
  const tokenData = await tokenResponse.json();

  // Persist the new token (upsert on the singleton row id=true)
  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 2592000) * 1000).toISOString();
  const { error: upsertErr } = await supabase
    .from('uber_app_token')
    .upsert({
      id: true,
      access_token: tokenData.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    });
  if (upsertErr) console.error('Failed to cache token:', upsertErr);
  else console.log('New token cached, expires at', newExpiresAt);

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating Uber Eats report');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { restaurantId, reportType, startDate, endDate }: CreateReportRequest = await req.json();
    
    console.log('Report request:', { restaurantId, reportType, startDate, endDate });

    // Fetch restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('uber_store_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }
    if (!restaurant.uber_store_id) {
      throw new Error('Restaurant has no uber_store_id configured');
    }

    // Get access token (user OAuth or client_credentials fallback)
    const accessToken = await getAccessToken(supabase, restaurantId);

    // Create report via Uber API
    const reportPayload = {
      report_type: reportType,
      store_uuids: [restaurant.uber_store_id],
      start_date: startDate,
      end_date: endDate,
    };

    console.log('Sending report request to Uber:', reportPayload);

    const reportResponse = await fetch('https://api.uber.com/v1/eats/report', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'fr-FR',
        'X-Uber-Locale': 'fr_FR',
      },
      body: JSON.stringify(reportPayload),
    });

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text();
      console.error('Uber API error:', errorText);
      throw new Error(`Failed to create report: ${errorText}`);
    }

    const reportData = await reportResponse.json();
    console.log('Report created with workflow_id:', reportData.workflow_id);

    // Store report request in database
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        restaurant_id: restaurantId,
        report_type: reportType,
        workflow_id: reportData.workflow_id,
        status: 'pending',
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store report:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        workflow_id: reportData.workflow_id,
        report_id: report.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error creating report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
