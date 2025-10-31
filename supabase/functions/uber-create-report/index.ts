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

    // Fetch restaurant and connection details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('uber_store_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    const { data: connection, error: connectionError } = await supabase
      .from('uber_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('restaurant_id', restaurantId)
      .single();

    if (connectionError || !connection) {
      throw new Error('Uber connection not found for this restaurant');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();

    if (expiresAt <= now) {
      console.log('Token expired, refreshing...');
      
      const clientId = Deno.env.get('VITE_UBER_CLIENT_ID')!;
      const clientSecret = Deno.env.get('VITE_UBER_CLIENT_SECRET')!;
      
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

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh access token');
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      await supabase
        .from('uber_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq('restaurant_id', restaurantId);
    }

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
