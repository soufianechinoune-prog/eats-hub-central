import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment, x-uber-signature',
};

interface MenuRefreshWebhook {
  event_type: string;
  store_id: string;
  partner_store_id?: string;
  resource_href: string;
  webhook_meta: {
    client_id: string;
    webhook_config_id: string;
    webhook_msg_timestamp: number;
    webhook_msg_uuid: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received webhook request');
    
    // Get the raw body for signature verification
    const bodyText = await req.text();
    const body: MenuRefreshWebhook = JSON.parse(bodyText);
    
    console.log('Webhook event:', body.event_type);
    console.log('Store ID:', body.store_id);
    
    // Verify webhook signature
    const signature = req.headers.get('X-Uber-Signature');
    const environment = req.headers.get('X-Environment');
    
    console.log('Environment:', environment);
    console.log('Signature present:', !!signature);
    
    if (signature) {
      const clientSecret = Deno.env.get('VITE_UBER_CLIENT_SECRET');
      if (!clientSecret) {
        console.error('Client secret not configured');
        return new Response('Server configuration error', { status: 500, headers: corsHeaders });
      }
      
      // Compute expected signature using Web Crypto API
      const encoder = new TextEncoder();
      const keyData = encoder.encode(clientSecret);
      const messageData = encoder.encode(bodyText);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
      
      console.log('Signature verified successfully');
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Only process menu refresh requests
    if (body.event_type !== 'store.menu_refresh_request') {
      console.log('Ignoring non-menu-refresh event:', body.event_type);
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    // Find the restaurant by Uber store ID
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, uber_store_id, menu_configuration')
      .eq('uber_store_id', body.store_id)
      .single();
    
    if (restaurantError || !restaurant) {
      console.error('Restaurant not found:', restaurantError);
      // Still return 200 to acknowledge receipt
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    console.log('Found restaurant:', restaurant.id);
    
    // Check if menu configuration exists
    if (!restaurant.menu_configuration) {
      console.log('No menu configuration available for restaurant');
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    console.log('Triggering menu upload for restaurant:', restaurant.id);
    
    // Trigger menu upload asynchronously (don't wait for completion)
    (async () => {
      try {
        const { error: uploadError } = await supabase.functions.invoke('uber-menu-upload', {
          body: {
            restaurantId: restaurant.id,
            menuConfiguration: restaurant.menu_configuration,
          },
        });
        
        if (uploadError) {
          console.error('Menu upload failed:', uploadError);
        } else {
          console.log('Menu uploaded successfully');
        }
      } catch (error) {
        console.error('Error during menu upload:', error);
      }
    })();
    
    // Log webhook event
    await supabase.from('webhook_logs').insert({
      event_type: body.event_type,
      store_id: body.store_id,
      webhook_uuid: body.webhook_meta.webhook_msg_uuid,
      payload: body,
      processed_at: new Date().toISOString(),
    });
    
    console.log('Webhook processed successfully');
    
    // Return 200 to acknowledge receipt
    return new Response(null, { status: 200, headers: corsHeaders });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to avoid retries for unrecoverable errors
    return new Response(null, { status: 200, headers: corsHeaders });
  }
});
