import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse webhook payload from Ultramsg
    const payload = await req.json();
    
    console.log('Received Ultramsg webhook:', JSON.stringify(payload));

    // Handle incoming messages (new feature for bidirectional conversations)
    // Ultramsg sends incoming messages with: { "from": "phone@c.us", "body": "message", "type": "chat", ... }
    if (payload.from && payload.body && payload.type === 'chat') {
      console.log('Processing incoming message from:', payload.from);
      
      // Extract phone number (remove @c.us suffix if present)
      const senderPhone = payload.from.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
      const normalizedPhone = senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`;
      
      // Try to find associated restaurant by manager_whatsapp
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name, manager_first_name, manager_last_name')
        .or(`manager_whatsapp.ilike.%${senderPhone}%,manager_whatsapp.ilike.%${normalizedPhone}%`)
        .maybeSingle();
      
      console.log('Associated restaurant:', restaurant?.name || 'None found');

      // Insert incoming message into message_history
      const { error: insertError } = await supabase
        .from('message_history')
        .insert({
          direction: 'inbound',
          sender_phone: normalizedPhone,
          recipient_phone: normalizedPhone, // Use same phone for conversation grouping
          recipient_name: restaurant 
            ? `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim() 
            : null,
          restaurant_id: restaurant?.id || null,
          restaurant_name: restaurant?.name || null,
          message_content: payload.body,
          ultramsg_message_id: payload.id || null,
          status: 'received',
          sent_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error inserting incoming message:', insertError);
      } else {
        console.log('Incoming message saved successfully');
      }

      return new Response(
        JSON.stringify({ success: true, type: 'incoming_message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle message ACK updates (existing functionality)
    // ack values: 1 = sent to server, 2 = delivered to device, 3 = read
    if (payload.id && payload.ack !== undefined) {
      const messageId = payload.id;
      const ack = parseInt(payload.ack);
      
      let newStatus = 'sent';
      let updateData: Record<string, unknown> = {};
      
      if (ack === 1) {
        newStatus = 'sent';
        updateData = { status: newStatus };
      } else if (ack === 2) {
        newStatus = 'delivered';
        updateData = { 
          status: newStatus,
          delivered_at: new Date().toISOString()
        };
      } else if (ack === 3) {
        newStatus = 'read';
        updateData = { 
          status: newStatus,
          read_at: new Date().toISOString()
        };
      }

      console.log(`Updating message ${messageId} to status: ${newStatus}`);

      // First, get the message to find its campaign_id
      const { data: messageData, error: fetchError } = await supabase
        .from('message_history')
        .select('id, campaign_id, status')
        .eq('ultramsg_message_id', messageId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching message:', fetchError);
      }

      // Update message status
      const { error } = await supabase
        .from('message_history')
        .update(updateData)
        .eq('ultramsg_message_id', messageId);

      if (error) {
        console.error('Error updating message status:', error);
      } else {
        console.log(`Message ${messageId} updated to ${newStatus}`);

        // Update campaign counters if message belongs to a campaign
        if (messageData?.campaign_id) {
          const campaignId = messageData.campaign_id;
          const previousStatus = messageData.status;
          
          // Only increment delivered/read counts when status changes
          if (newStatus === 'delivered' && previousStatus !== 'delivered' && previousStatus !== 'read') {
            console.log(`Incrementing delivered_count for campaign ${campaignId}`);
            const { data: campaign } = await supabase
              .from('message_campaigns')
              .select('delivered_count')
              .eq('id', campaignId)
              .single();
            
            if (campaign) {
              await supabase
                .from('message_campaigns')
                .update({ delivered_count: (campaign.delivered_count || 0) + 1 })
                .eq('id', campaignId);
            }
          } else if (newStatus === 'read' && previousStatus !== 'read') {
            console.log(`Incrementing read_count for campaign ${campaignId}`);
            const { data: campaign } = await supabase
              .from('message_campaigns')
              .select('read_count, delivered_count')
              .eq('id', campaignId)
              .single();
            
            if (campaign) {
              // Also increment delivered if it wasn't delivered before
              const updates: Record<string, number> = { read_count: (campaign.read_count || 0) + 1 };
              if (previousStatus !== 'delivered') {
                updates.delivered_count = (campaign.delivered_count || 0) + 1;
              }
              await supabase
                .from('message_campaigns')
                .update(updates)
                .eq('id', campaignId);
            }
          }
        }
      }
    }

    // Handle message delivery errors
    if (payload.id && payload.error) {
      console.log(`Message ${payload.id} failed: ${payload.error}`);
      
      const { error } = await supabase
        .from('message_history')
        .update({
          status: 'failed',
          error_message: payload.error
        })
        .eq('ultramsg_message_id', payload.id);

      if (error) {
        console.error('Error updating failed message:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in ultramsg-webhook:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
