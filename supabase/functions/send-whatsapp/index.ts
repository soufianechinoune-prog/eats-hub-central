import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recipient {
  phone: string;
  name: string;
  restaurantName: string;
}

interface SendRequest {
  recipients: Recipient[];
  message: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INSTANCE_ID = Deno.env.get('ULTRAMSG_INSTANCE_ID');
    const TOKEN = Deno.env.get('ULTRAMSG_TOKEN');

    if (!INSTANCE_ID || !TOKEN) {
      console.error('Missing Ultramsg credentials');
      return new Response(
        JSON.stringify({ error: 'Ultramsg credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recipients, message }: SendRequest = await req.json();

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

    console.log(`Sending WhatsApp to ${recipients.length} recipients`);

    const results = [];

    for (const recipient of recipients) {
      // Personalize message with variables
      let personalizedMessage = message
        .replace(/{prenom}/g, recipient.name?.split(' ')[0] || '')
        .replace(/{nom}/g, recipient.name?.split(' ').slice(1).join(' ') || '')
        .replace(/{restaurant}/g, recipient.restaurantName || '');

      // Format phone number (remove spaces, ensure starts with country code)
      let phone = recipient.phone.replace(/\s/g, '');
      if (phone.startsWith('0')) {
        phone = '33' + phone.substring(1);
      }
      if (phone.startsWith('+')) {
        phone = phone.substring(1);
      }

      console.log(`Sending to ${phone}: ${personalizedMessage.substring(0, 50)}...`);

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
          results.push({
            phone: recipient.phone,
            name: recipient.name,
            success: true,
            messageId: data.id,
          });
        } else {
          console.error(`Failed to send to ${phone}:`, data);
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

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        results,
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
