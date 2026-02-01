import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recipient {
  restaurant_id?: string;
  phone: string;
  name: string;
  restaurantName: string;
}

interface SendRequest {
  recipients: Recipient[];
  message: string;
  scheduled_message_id?: string;
  skip_campaign?: boolean;
  message_type?: 'campaign' | 'report' | 'individual' | 'chatbot';
  batch_id?: string;
  skip_status_check?: boolean; // For internal calls that already verified status
  report_start_date?: string; // For tracking report date context
  report_end_date?: string;   // For tracking report date context
}

/**
 * Normalize a French phone number to the format expected by Ultramsg API (without +)
 * Handles various input formats:
 * - "06 12 34 56 78" → "33612345678"
 * - "+33 6 12 34 56 78" → "33612345678"
 * - "+330612345678" → "33612345678" (fixes common error)
 * - "0033612345678" → "33612345678"
 * - "33612345678" → "33612345678"
 * - "+330 76 21 16 20 5" → "33762116205" (fixes malformed numbers)
 */
function normalizePhoneNumber(phone: string): { normalized: string | null; error: string | null } {
  // Step 1: Remove all non-digit characters except +
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Step 2: Handle 00 prefix (international format)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  // Step 3: Handle + prefix
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Step 4: Handle French-specific cases
  if (cleaned.startsWith('33')) {
    // Fix +330... or 330... pattern → should be 33 + number without leading 0
    if (cleaned.startsWith('330') && cleaned.length >= 11) {
      // 3306... or 3307... etc → remove the extra 0
      cleaned = '33' + cleaned.substring(3);
    }
  } else if (cleaned.startsWith('0') && cleaned.length >= 10) {
    // French national format: 0612345678 → 33612345678
    cleaned = '33' + cleaned.substring(1);
  }
  
  // Step 5: Validate length
  // French numbers should be 11 digits (33 + 9 digits)
  // Allow some flexibility for international numbers (9-15 digits)
  if (cleaned.length < 9) {
    return { normalized: null, error: `Numéro trop court: ${phone}` };
  }
  if (cleaned.length > 15) {
    return { normalized: null, error: `Numéro trop long: ${phone}` };
  }
  
  // Step 6: Validate it contains only digits now
  if (!/^\d+$/.test(cleaned)) {
    return { normalized: null, error: `Format invalide: ${phone}` };
  }
  
  return { normalized: cleaned, error: null };
}

/**
 * Check if the Ultramsg instance is connected
 */
async function checkInstanceStatus(instanceId: string, token: string): Promise<{ connected: boolean; status: string }> {
  try {
    const statusUrl = `https://api.ultramsg.com/${instanceId}/instance/status?token=${token}`;
    const response = await fetch(statusUrl);
    const data = await response.json();
    
    const accountStatus = data?.status?.accountStatus?.status;
    const isConnected = accountStatus === 'authenticated';
    
    return { connected: isConnected, status: accountStatus || 'unknown' };
  } catch (err) {
    console.error('Error checking instance status:', err);
    return { connected: false, status: 'error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INSTANCE_ID = Deno.env.get('ULTRAMSG_INSTANCE_ID');
    const TOKEN = Deno.env.get('ULTRAMSG_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!INSTANCE_ID || !TOKEN) {
      console.error('Missing Ultramsg credentials');
      return new Response(
        JSON.stringify({ error: 'Ultramsg credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    const { 
      recipients, 
      message, 
      scheduled_message_id, 
      skip_campaign, 
      message_type, 
      batch_id: providedBatchId,
      skip_status_check,
      report_start_date,
      report_end_date,
    }: SendRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'No message provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check instance connection status before sending (unless skipped)
    if (!skip_status_check) {
      console.log('Checking WhatsApp instance connection...');
      const instanceStatus = await checkInstanceStatus(INSTANCE_ID, TOKEN);
      
      if (!instanceStatus.connected) {
        console.error(`WhatsApp instance not connected. Status: ${instanceStatus.status}`);
        return new Response(
          JSON.stringify({ 
            error: 'WhatsApp déconnecté. Le téléphone d\'envoi doit être connecté à WhatsApp. Scannez le QR code dans UltraMsg puis réessayez.',
            status: instanceStatus.status,
            connected: false
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('WhatsApp instance connected, proceeding with send...');
    }

    // Generate batch_id for grouping if multiple recipients and not already provided
    const batchId = providedBatchId || (recipients.length > 1 ? crypto.randomUUID() : null);
    
    // Determine message type based on content or explicit parameter
    const determineMessageType = (content: string, hasCampaign: boolean): string => {
      if (message_type) return message_type;
      if (content.includes('📊') || content.toLowerCase().includes('rapport')) return 'report';
      if (hasCampaign) return 'campaign';
      return 'individual';
    };

    console.log(`Sending WhatsApp to ${recipients.length} recipients`);

    // Create campaign for bulk messages (more than 1 recipient) unless skip_campaign is true
    let campaignId: string | null = null;
    const shouldCreateCampaign = supabase && recipients.length > 1 && !skip_campaign;
    
    if (shouldCreateCampaign) {
      console.log('Creating message campaign...');
      const { data: campaign, error: campaignError } = await supabase
        .from('message_campaigns')
        .insert({
          message_template: message,
          recipient_count: recipients.length,
          status: 'sending',
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (campaignError) {
        console.error('Error creating campaign:', campaignError);
      } else {
        campaignId = campaign.id;
        console.log(`Campaign created with ID: ${campaignId}`);
      }
    }

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      // Personalize message with variables
      let personalizedMessage = message
        .replace(/{prenom}/g, recipient.name?.split(' ')[0] || '')
        .replace(/{nom}/g, recipient.name?.split(' ').slice(1).join(' ') || '')
        .replace(/{restaurant}/g, recipient.restaurantName || '');

      // Normalize phone number with robust validation
      const { normalized: phone, error: phoneError } = normalizePhoneNumber(recipient.phone);
      
      if (phoneError || !phone) {
        console.error(`Invalid phone number for ${recipient.restaurantName}: ${phoneError}`);
        failedCount++;
        
          // Log failed message to history with report dates
          if (supabase) {
            const msgType = determineMessageType(personalizedMessage, !!campaignId);
            await supabase.from('message_history').insert({
              direction: 'outbound',
              restaurant_id: recipient.restaurant_id || null,
              recipient_phone: recipient.phone,
              recipient_name: recipient.name,
              restaurant_name: recipient.restaurantName,
              message_content: personalizedMessage,
              status: 'failed',
              error_message: phoneError || 'Invalid phone number',
              scheduled_message_id: scheduled_message_id || null,
              campaign_id: campaignId,
              batch_id: batchId,
              message_type: msgType,
              report_start_date: report_start_date || null,
              report_end_date: report_end_date || null,
            });
        }

        results.push({
          phone: recipient.phone,
          name: recipient.name,
          success: false,
          error: phoneError || 'Invalid phone number',
        });
        continue;
      }

      console.log(`Sending to ${phone} (original: ${recipient.phone}): ${personalizedMessage.substring(0, 50)}...`);

      try {
        const response = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: TOKEN,
            to: phone,
            body: personalizedMessage,
          }),
        });

        const data = await response.json();
        
        if (response.ok && data.sent === 'true') {
          console.log(`Message sent successfully to ${phone}, ID: ${data.id}`);
          sentCount++;
          
          // Log to message_history with campaign_id, batch_id, message_type, and report dates
          if (supabase) {
            const msgType = determineMessageType(personalizedMessage, !!campaignId);
            await supabase.from('message_history').insert({
              direction: 'outbound',
              restaurant_id: recipient.restaurant_id || null,
              recipient_phone: recipient.phone,
              recipient_name: recipient.name,
              restaurant_name: recipient.restaurantName,
              message_content: personalizedMessage,
              ultramsg_message_id: data.id,
              status: 'sent',
              sent_at: new Date().toISOString(),
              scheduled_message_id: scheduled_message_id || null,
              campaign_id: campaignId,
              batch_id: batchId,
              message_type: msgType,
              report_start_date: report_start_date || null,
              report_end_date: report_end_date || null,
            });
          }

          results.push({
            phone: recipient.phone,
            name: recipient.name,
            success: true,
            messageId: data.id,
          });
        } else {
          console.error(`Failed to send to ${phone}:`, data);
          failedCount++;
          
          // Log failed message to history with campaign_id, batch_id, message_type, and report dates
          if (supabase) {
            const msgType = determineMessageType(personalizedMessage, !!campaignId);
            await supabase.from('message_history').insert({
              direction: 'outbound',
              restaurant_id: recipient.restaurant_id || null,
              recipient_phone: recipient.phone,
              recipient_name: recipient.name,
              restaurant_name: recipient.restaurantName,
              message_content: personalizedMessage,
              status: 'failed',
              error_message: data.error || 'Unknown error',
              scheduled_message_id: scheduled_message_id || null,
              campaign_id: campaignId,
              batch_id: batchId,
              message_type: msgType,
              report_start_date: report_start_date || null,
              report_end_date: report_end_date || null,
            });
          }

          results.push({
            phone: recipient.phone,
            name: recipient.name,
            success: false,
            error: data.error || 'Unknown error',
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error sending to ${phone}:`, errorMessage);
        failedCount++;
        
        // Log error to history with campaign_id, batch_id, message_type, and report dates
        if (supabase) {
          const msgType = determineMessageType(personalizedMessage, !!campaignId);
          await supabase.from('message_history').insert({
            direction: 'outbound',
            restaurant_id: recipient.restaurant_id || null,
            recipient_phone: recipient.phone,
            recipient_name: recipient.name,
            restaurant_name: recipient.restaurantName,
            message_content: personalizedMessage,
            status: 'failed',
            error_message: errorMessage,
            scheduled_message_id: scheduled_message_id || null,
            campaign_id: campaignId,
            batch_id: batchId,
            message_type: msgType,
            report_start_date: report_start_date || null,
            report_end_date: report_end_date || null,
          });
        }

        results.push({
          phone: recipient.phone,
          name: recipient.name,
          success: false,
          error: errorMessage,
        });
      }

      // Small delay between messages to avoid rate limiting
      if (recipients.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update campaign with final counts and status
    if (supabase && campaignId) {
      const finalStatus = failedCount === 0 ? 'sent' : (sentCount === 0 ? 'failed' : 'partial');
      console.log(`Updating campaign ${campaignId}: sent=${sentCount}, failed=${failedCount}, status=${finalStatus}`);
      
      await supabase
        .from('message_campaigns')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          status: finalStatus,
        })
        .eq('id', campaignId);
    }

    console.log(`Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        results,
        campaign_id: campaignId,
        batch_id: batchId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in send-whatsapp function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
