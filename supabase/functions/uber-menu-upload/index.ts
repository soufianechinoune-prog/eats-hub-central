import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuUploadRequest {
  restaurantId: string;
  menuConfiguration: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { restaurantId, menuConfiguration }: MenuUploadRequest = await req.json();

    console.log('Uploading menu for restaurant:', restaurantId);

    // Get restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('uber_store_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant?.uber_store_id) {
      throw new Error('Restaurant not found or missing Uber store ID');
    }

    // Get valid access token
    const { data: connection, error: connectionError } = await supabase
      .from('uber_connections')
      .select('access_token, expires_at, refresh_token')
      .eq('restaurant_id', restaurantId)
      .single();

    if (connectionError || !connection) {
      throw new Error('No Uber connection found for this restaurant');
    }

    let accessToken = connection.access_token;

    // Check if token is expired
    if (connection.expires_at) {
      const expiresAt = new Date(connection.expires_at);
      const now = new Date();
      
      if (expiresAt < now) {
        console.log('Token expired, refreshing...');
        // Refresh token
        const tokenResponse = await fetch('https://login.uber.com/oauth/v2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: Deno.env.get('UBER_CLIENT_ID') ?? Deno.env.get('VITE_UBER_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('UBER_CLIENT_SECRET') ?? Deno.env.get('VITE_UBER_CLIENT_SECRET') ?? '',
            refresh_token: connection.refresh_token!,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to refresh access token');
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;

        // Update token in database
        await supabase
          .from('uber_connections')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || connection.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          })
          .eq('restaurant_id', restaurantId);
      }
    }

    // Upload menu to Uber Eats
    const menuUrl = `https://api.uber.com/v2/eats/stores/${restaurant.uber_store_id}/menus`;
    
    console.log('Uploading menu to:', menuUrl);

    const menuResponse = await fetch(menuUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(menuConfiguration),
    });

    if (!menuResponse.ok) {
      const errorText = await menuResponse.text();
      console.error('Menu upload failed:', errorText);
      throw new Error(`Failed to upload menu: ${menuResponse.statusText} - ${errorText}`);
    }

    // Response is 204 No Content on success
    console.log('Menu uploaded successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Menu uploaded successfully',
        storeId: restaurant.uber_store_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error uploading menu:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload menu';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
