import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusResponse {
  connected: boolean;
  status: string;
  me?: {
    number: string;
    name: string;
  };
  raw?: unknown;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INSTANCE_ID = Deno.env.get('ULTRAMSG_INSTANCE_ID');
    const TOKEN = Deno.env.get('ULTRAMSG_TOKEN');

    if (!INSTANCE_ID || !TOKEN) {
      console.error('Missing Ultramsg credentials');
      return new Response(
        JSON.stringify({ 
          connected: false, 
          status: 'not_configured',
          error: 'Ultramsg credentials not configured' 
        } as StatusResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking WhatsApp instance status...');

    // Fetch instance status
    const statusUrl = `https://api.ultramsg.com/${INSTANCE_ID}/instance/status?token=${TOKEN}`;
    const statusResponse = await fetch(statusUrl);
    const statusData = await statusResponse.json();
    
    console.log('Instance status response:', JSON.stringify(statusData));

    // Determine connection status
    // UltraMsg returns status.accountStatus.status = "authenticated" when connected
    const accountStatus = statusData?.status?.accountStatus?.status;
    const isConnected = accountStatus === 'authenticated';
    
    let me: StatusResponse['me'] = undefined;
    
    // If connected, fetch the phone number info
    if (isConnected) {
      try {
        const meUrl = `https://api.ultramsg.com/${INSTANCE_ID}/instance/me?token=${TOKEN}`;
        const meResponse = await fetch(meUrl);
        const meData = await meResponse.json();
        
        console.log('Instance me response:', JSON.stringify(meData));
        
        if (meData?.me) {
          // Format: "33767818586:45@c.us" or similar
          const rawNumber = meData.me.split(':')[0] || meData.me;
          me = {
            number: rawNumber,
            name: meData.pushname || '',
          };
        }
      } catch (meErr) {
        console.error('Error fetching /me:', meErr);
        // Continue without me info
      }
    }

    const response: StatusResponse = {
      connected: isConnected,
      status: accountStatus || statusData?.status || 'unknown',
      me,
      raw: statusData,
    };

    console.log('Returning status:', JSON.stringify({ connected: response.connected, status: response.status, me: response.me }));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error checking WhatsApp status:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        connected: false, 
        status: 'error',
        error: errorMessage 
      } as StatusResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
