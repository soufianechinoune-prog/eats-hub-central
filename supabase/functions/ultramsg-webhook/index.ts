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
    
    // Log complete payload for debugging
    console.log('=== ULTRAMSG WEBHOOK RECEIVED ===');
    console.log('Full payload:', JSON.stringify(payload, null, 2));
    console.log('Payload keys:', Object.keys(payload));
    if (payload.data) {
      console.log('Payload.data keys:', Object.keys(payload.data));
    }

    // Ultramsg wraps message data in a "data" object for received messages
    const messageData = payload.data || payload;

    // Helper function to normalize phone numbers (remove spaces, dashes, dots, parentheses)
    const normalizePhoneNumber = (phone: string): string => {
      return phone.replace(/[\s\-\.\(\)]/g, '');
    };

    // Handle incoming messages (new feature for bidirectional conversations)
    // Ultramsg sends incoming messages with: { "event_type": "message_received", "data": { "from": "phone@c.us", "body": "message", "type": "chat", ... } }
    if (messageData.from && messageData.body && messageData.type === 'chat') {
      console.log('Processing incoming message from:', messageData.from);
      
      // Extract phone number (remove @c.us suffix if present)
      const senderPhone = messageData.from.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
      const normalizedPhone = normalizePhoneNumber(senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`);
      
      console.log('Normalized sender phone:', normalizedPhone);
      
      // Try to find associated restaurant by manager_whatsapp
      // Fetch all restaurants and match with normalized phone comparison
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, manager_first_name, manager_last_name, manager_whatsapp')
        .not('manager_whatsapp', 'is', null);
      
      // Find restaurant by comparing normalized phone numbers
      const restaurant = restaurants?.find(r => {
        if (!r.manager_whatsapp) return false;
        const normalizedManagerPhone = normalizePhoneNumber(r.manager_whatsapp);
        return normalizedManagerPhone.includes(normalizedPhone) || normalizedPhone.includes(normalizedManagerPhone);
      }) || null;
      
      console.log('Associated restaurant:', restaurant?.name || 'None found');

      // Check if this is an "echo" message (already sent as outbound in the last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      const { data: recentOutbound } = await supabase
        .from('message_history')
        .select('id')
        .eq('direction', 'outbound')
        .eq('recipient_phone', normalizedPhone)
        .eq('message_content', messageData.body)
        .gte('created_at', thirtySecondsAgo)
        .maybeSingle();

      if (recentOutbound) {
        console.log('Ignoring echo message - already exists as outbound');
        return new Response(
          JSON.stringify({ success: true, type: 'echo_ignored' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          message_content: messageData.body,
          ultramsg_message_id: messageData.id || messageData.sid || null,
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
    // Ultramsg may send ACK data wrapped in "data" object or directly
    const ackData = payload.data || payload;
    
    if (ackData.id && ackData.ack !== undefined) {
      console.log('=== PROCESSING ACK ===');
      console.log('ACK data:', JSON.stringify(ackData));
      
      // Extract message ID - handle different formats
      // Could be: "14", "true_33123456789@c.us", "33123456789@s.whatsapp.net"
      let messageId = String(ackData.id);
      
      // Remove WhatsApp suffixes if present
      messageId = messageId.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
      
      // If it starts with "true_", extract the phone number part
      if (messageId.startsWith('true_')) {
        messageId = messageId.replace('true_', '');
      }
      
      console.log('Extracted message ID:', messageId);
      
      const ack = parseInt(ackData.ack);
      console.log('ACK value:', ack);
      
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

      console.log(`Attempting to update message ${messageId} to status: ${newStatus}`);

      // Try multiple strategies to find the message
      // Strategy 1: Direct match on ultramsg_message_id
      let messageQuery = supabase
        .from('message_history')
        .select('id, campaign_id, status, ultramsg_message_id')
        .eq('ultramsg_message_id', messageId);
      
      let { data: messageData, error: fetchError } = await messageQuery.maybeSingle();

      // Strategy 2: If not found, try matching as substring (for different ID formats)
      if (!messageData && !fetchError) {
        console.log('Message not found with exact match, trying substring match');
        const { data: allMessages } = await supabase
          .from('message_history')
          .select('id, campaign_id, status, ultramsg_message_id')
          .not('ultramsg_message_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);
        
        // Find message where messageId is contained in ultramsg_message_id or vice versa
        messageData = allMessages?.find(msg => 
          msg.ultramsg_message_id?.includes(messageId) || 
          messageId.includes(msg.ultramsg_message_id || '')
        ) || null;
        
        if (messageData) {
          console.log('Found message via substring match:', messageData.ultramsg_message_id);
        }
      }

      if (fetchError) {
        console.error('Error fetching message:', fetchError);
      }

      if (!messageData) {
        console.warn(`No message found for ID: ${messageId}`);
        console.log('This might be a webhook test or an ACK for a very old message');
        return new Response(
          JSON.stringify({ success: true, type: 'ack_message_not_found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found message in database:', messageData.id);

      // Update message status
      const { error } = await supabase
        .from('message_history')
        .update(updateData)
        .eq('id', messageData.id);

      if (error) {
        console.error('Error updating message status:', error);
      } else {
        console.log(`✓ Message ${messageId} successfully updated to ${newStatus}`);

        // Update campaign counters if message belongs to a campaign
        if (messageData?.campaign_id) {
          const campaignId = messageData.campaign_id;
          const previousStatus = messageData.status;
          
          console.log(`Message belongs to campaign ${campaignId}, previous status: ${previousStatus}`);
          
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
              console.log('✓ Campaign delivered_count incremented');
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
                console.log('Also incrementing delivered_count since message was not previously delivered');
              }
              await supabase
                .from('message_campaigns')
                .update(updates)
                .eq('id', campaignId);
              console.log('✓ Campaign read_count incremented');
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, type: 'ack_processed', status: newStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
