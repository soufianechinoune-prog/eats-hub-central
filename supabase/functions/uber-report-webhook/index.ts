import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment, x-uber-signature',
};

interface ReportWebhook {
  event_type: string;
  event_id: string;
  job_id: string;
  report_type: string;
  start_time_ms: number;
  end_time_ms: number;
  report_metadata: {
    sections: Array<{
      section_id: string;
      content_type: string;
      download_url: string;
    }>;
  };
  webhook_meta: {
    client_id: string;
    webhook_config_id: string;
    webhook_msg_timestamp: number;
    webhook_msg_uuid: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received report webhook');
    
    const bodyText = await req.text();
    const body: ReportWebhook = JSON.parse(bodyText);
    
    console.log('Webhook event:', body.event_type);
    console.log('Job ID:', body.job_id);
    
    // Verify signature
    const signature = req.headers.get('X-Uber-Signature');
    const environment = req.headers.get('X-Environment');
    
    console.log('Environment:', environment);
    
    if (signature) {
      const clientSecret = Deno.env.get('UBER_CLIENT_SECRET') ?? Deno.env.get('VITE_UBER_CLIENT_SECRET');
      if (!clientSecret) {
        console.error('Client secret not configured');
        return new Response('Server configuration error', { status: 500, headers: corsHeaders });
      }
      
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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Only process success events
    if (body.event_type !== 'eats.report.success') {
      console.log('Ignoring non-success event:', body.event_type);
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    // Uber returns composite IDs <workflow_root>_<job_suffix>; the suffix from the
    // POST response can differ from the suffix in the webhook. Match on the shared root.
    const workflowRoot = body.job_id.split('_')[0];
    console.log('Looking up report. job_id:', body.job_id, 'workflow_root:', workflowRoot);

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, restaurant_id')
      .or(`workflow_id.eq.${body.job_id},job_id.eq.${body.job_id},workflow_id.like.${workflowRoot}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) {
      console.error('Error finding report:', reportError);
    }
    console.log('Matched report id:', report?.id ?? 'NONE');
    
    if (report) {
      console.log('Updating report:', report.id);
      
      // Update report with completion data
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          job_id: body.job_id,
          status: 'completed',
          sections: body.report_metadata.sections,
          start_time_ms: body.start_time_ms,
          end_time_ms: body.end_time_ms,
          completed_at: new Date().toISOString(),
        })
        .eq('id', report.id);
      
      if (updateError) {
        console.error('Failed to update report:', updateError);
      } else {
        console.log('Report updated successfully');
        
        // Parse CSV automatically if it's a data report
        const parseableReports = [
          'CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT',
          'MENU_ITEM_FEEDBACK_REPORT',
          'ORDER_HISTORY_REPORT',
          'ORDER_ERRORS_MENU_ITEM_REPORT',
          'ORDER_ERRORS_TRANSACTION_REPORT',
          'DOWNTIME_REPORT',
        ];
        
        // Route PAYMENT_DETAILS_REPORT to parse-payment-report
        if (body.report_type === 'PAYMENT_DETAILS_REPORT') {
          console.log('Routing PAYMENT_DETAILS_REPORT to parse-payment-report');
          const { data: reportData } = await supabase
            .from('reports')
            .select('restaurant_id')
            .eq('id', report.id)
            .maybeSingle();

          if (reportData && body.report_metadata.sections.length > 0) {
            const section = body.report_metadata.sections[0];
            try {
              await supabase.functions.invoke('parse-payment-report', {
                body: {
                  reportId: report.id,
                  downloadUrl: section.download_url,
                  restaurantId: reportData.restaurant_id,
                },
              });
              console.log('Payment report parsed successfully');
            } catch (parseError) {
              console.error('Failed to parse payment report:', parseError);
            }
          }
        } else if (parseableReports.includes(body.report_type)) {
          console.log('Auto-parsing report:', body.report_type);
          
          // Get restaurant_id from report
          const { data: reportData } = await supabase
            .from('reports')
            .select('restaurant_id')
            .eq('id', report.id)
            .maybeSingle();
          
          if (reportData && body.report_metadata.sections.length > 0) {
            // Parse first section (main data)
            const section = body.report_metadata.sections[0];
            
            try {
              await supabase.functions.invoke('parse-report-csv', {
                body: {
                  reportId: report.id,
                  downloadUrl: section.download_url,
                  reportType: body.report_type,
                  restaurantId: reportData.restaurant_id,
                },
              });
              console.log('Report parsed successfully');
            } catch (parseError) {
              console.error('Failed to parse report:', parseError);
            }
          }
        }
      }
    } else {
      console.warn('No matching report found for job_id', body.job_id, '— skipping insert (restaurant_id unknown).');
    }
    
    // Log webhook event
    await supabase.from('webhook_logs').insert({
      event_type: body.event_type,
      webhook_uuid: body.webhook_meta.webhook_msg_uuid,
      payload: body,
      processed_at: new Date().toISOString(),
    });
    
    console.log('Webhook processed successfully');
    
    return new Response(null, { status: 200, headers: corsHeaders });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(null, { status: 200, headers: corsHeaders });
  }
});
