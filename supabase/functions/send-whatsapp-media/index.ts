import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MediaRequest {
  phone: string;
  mediaUrl: string;
  mediaType: 'image' | 'document' | 'audio';
  caption?: string;
  filename?: string;
  restaurant_id?: string;
  recipient_name?: string;
  restaurant_name?: string;
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
      phone, 
      mediaUrl, 
      mediaType, 
      caption, 
      filename,
      restaurant_id,
      recipient_name,
      restaurant_name
    }: MediaRequest = await req.json();

    if (!phone || !mediaUrl || !mediaType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, mediaUrl, mediaType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    let formattedPhone = phone.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '33' + formattedPhone.substring(1);
    }
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    console.log(`Sending ${mediaType} to ${formattedPhone}: ${mediaUrl}`);

    // Determine endpoint based on media type
    let endpoint: string;
    if (mediaType === 'image') {
      endpoint = `https://api.ultramsg.com/${INSTANCE_ID}/messages/image`;
    } else if (mediaType === 'audio') {
      endpoint = `https://api.ultramsg.com/${INSTANCE_ID}/messages/audio`;
    } else {
      endpoint = `https://api.ultramsg.com/${INSTANCE_ID}/messages/document`;
    }

    // Prepare request body
    const body: Record<string, string> = {
      token: TOKEN,
      to: formattedPhone,
    };

    if (mediaType === 'image') {
      body.image = mediaUrl;
      if (caption) body.caption = caption;
    } else if (mediaType === 'audio') {
      body.audio = mediaUrl;
    } else {
      body.document = mediaUrl;
      if (filename) body.filename = filename;
      if (caption) body.caption = caption;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    console.log('Ultramsg response:', data);

    // Create message content description
    let messageContent: string;
    if (mediaType === 'image') {
      messageContent = `📷 Image${caption ? `: ${caption}` : ''}`;
    } else if (mediaType === 'audio') {
      messageContent = `🎤 Message vocal`;
    } else {
      messageContent = `📄 Document: ${filename || 'file'}${caption ? ` - ${caption}` : ''}`;
    }

    if (response.ok && data.sent === 'true') {
      console.log(`Media sent successfully to ${formattedPhone}, ID: ${data.id}`);
      
      // Log to message_history
      if (supabase) {
        await supabase.from('message_history').insert({
          restaurant_id: restaurant_id || null,
          recipient_phone: phone,
          recipient_name: recipient_name || null,
          restaurant_name: restaurant_name || null,
          message_content: messageContent,
          ultramsg_message_id: data.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
          direction: 'outbound',
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageId: data.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error(`Failed to send media to ${formattedPhone}:`, data);
      
      // Log failed message
      if (supabase) {
        await supabase.from('message_history').insert({
          restaurant_id: restaurant_id || null,
          recipient_phone: phone,
          recipient_name: recipient_name || null,
          restaurant_name: restaurant_name || null,
          message_content: messageContent,
          status: 'failed',
          error_message: data.error || 'Unknown error',
          direction: 'outbound',
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: data.error || 'Unknown error',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in send-whatsapp-media function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
