import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recipient {
  restaurant_id: string;
  phone: string;
  name: string;
  restaurantName: string;
}

interface ScheduledMessage {
  id: string;
  scheduled_at: string;
  message: string;
  recipients: Recipient[];
  status: string;
  media_url: string | null;
  media_type: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const INSTANCE_ID = Deno.env.get('ULTRAMSG_INSTANCE_ID');
    const TOKEN = Deno.env.get('ULTRAMSG_TOKEN');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    if (!INSTANCE_ID || !TOKEN) {
      throw new Error('Missing Ultramsg credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending messages that are due
    const now = new Date().toISOString();
    console.log(`Checking for scheduled messages due before ${now}`);

    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch pending messages: ${fetchError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('No pending messages to process');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingMessages.length} pending messages to process`);

    const processedResults = [];

    for (const scheduledMsg of pendingMessages as ScheduledMessage[]) {
      console.log(`Processing scheduled message ${scheduledMsg.id}`);

      // Mark as processing
      await supabase
        .from('scheduled_messages')
        .update({ status: 'processing' })
        .eq('id', scheduledMsg.id);

      const results = [];
      let successCount = 0;
      let failCount = 0;

      // Check if this is a media message
      const hasMedia = scheduledMsg.media_url && scheduledMsg.media_type;

      for (const recipient of scheduledMsg.recipients) {
        // Personalize message
        let personalizedMessage = scheduledMsg.message
          .replace(/{prenom}/g, recipient.name?.split(' ')[0] || '')
          .replace(/{nom}/g, recipient.name?.split(' ').slice(1).join(' ') || '')
          .replace(/{restaurant}/g, recipient.restaurantName || '');

        // Format phone number
        let phone = recipient.phone.replace(/\s/g, '');
        if (phone.startsWith('0')) {
          phone = '33' + phone.substring(1);
        }
        if (phone.startsWith('+')) {
          phone = phone.substring(1);
        }

        console.log(`Sending to ${phone}${hasMedia ? ' with media' : ''}`);

        try {
          let response;
          let messageContent = personalizedMessage;

          if (hasMedia) {
            // Send media message
            const mediaEndpoint = scheduledMsg.media_type === 'image' 
              ? 'image' 
              : scheduledMsg.media_type === 'audio' 
                ? 'voice' 
                : 'document';

            const mediaBody: Record<string, string> = {
              token: TOKEN,
              to: phone,
            };

            if (scheduledMsg.media_type === 'image') {
              mediaBody.image = scheduledMsg.media_url!;
              mediaBody.caption = personalizedMessage;
              messageContent = `📷 Image: ${personalizedMessage}`;
            } else if (scheduledMsg.media_type === 'audio') {
              mediaBody.audio = scheduledMsg.media_url!;
              messageContent = '🎤 Message vocal';
            } else {
              mediaBody.document = scheduledMsg.media_url!;
              mediaBody.filename = 'document';
              mediaBody.caption = personalizedMessage;
              messageContent = `📄 Document: ${personalizedMessage}`;
            }

            response = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/${mediaEndpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mediaBody),
            });
          } else {
            // Send text message
            response = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: TOKEN,
                to: phone,
                body: personalizedMessage,
              }),
            });
          }

          const data = await response.json();

          if (response.ok && data.sent === 'true') {
            console.log(`Message sent to ${phone}, ID: ${data.id}`);
            
            // Log to message_history
            await supabase.from('message_history').insert({
              restaurant_id: recipient.restaurant_id || null,
              recipient_phone: recipient.phone,
              recipient_name: recipient.name,
              restaurant_name: recipient.restaurantName,
              message_content: messageContent,
              ultramsg_message_id: data.id,
              status: 'sent',
              sent_at: new Date().toISOString(),
              scheduled_message_id: scheduledMsg.id,
              media_url: hasMedia ? scheduledMsg.media_url : null,
              media_type: hasMedia ? scheduledMsg.media_type : null,
            });

            results.push({ phone, name: recipient.name, success: true, messageId: data.id });
            successCount++;
          } else {
            console.error(`Failed to send to ${phone}:`, data);
            
            // Log failed message
            await supabase.from('message_history').insert({
              restaurant_id: recipient.restaurant_id || null,
              recipient_phone: recipient.phone,
              recipient_name: recipient.name,
              restaurant_name: recipient.restaurantName,
              message_content: messageContent,
              status: 'failed',
              error_message: data.error || 'Unknown error',
              scheduled_message_id: scheduledMsg.id,
            });

            results.push({ phone, name: recipient.name, success: false, error: data.error || 'Unknown error' });
            failCount++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Error sending to ${phone}:`, errorMessage);
          
          // Log error
          await supabase.from('message_history').insert({
            restaurant_id: recipient.restaurant_id || null,
            recipient_phone: recipient.phone,
            recipient_name: recipient.name,
            restaurant_name: recipient.restaurantName,
            message_content: personalizedMessage,
            status: 'failed',
            error_message: errorMessage,
            scheduled_message_id: scheduledMsg.id,
          });

          results.push({ phone, name: recipient.name, success: false, error: errorMessage });
          failCount++;
        }

        // Small delay between messages
        if (scheduledMsg.recipients.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Update scheduled message with results
      const finalStatus = failCount === 0 ? 'sent' : (successCount > 0 ? 'partial' : 'failed');
      
      await supabase
        .from('scheduled_messages')
        .update({
          status: finalStatus,
          sent_at: new Date().toISOString(),
          results: results,
          sent_count: successCount,
          failed_count: failCount,
        })
        .eq('id', scheduledMsg.id);

      console.log(`Message ${scheduledMsg.id} completed: ${successCount} sent, ${failCount} failed`);

      processedResults.push({
        id: scheduledMsg.id,
        status: finalStatus,
        sent: successCount,
        failed: failCount,
      });
    }

    return new Response(
      JSON.stringify({
        processed: processedResults.length,
        results: processedResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in process-scheduled-messages:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});