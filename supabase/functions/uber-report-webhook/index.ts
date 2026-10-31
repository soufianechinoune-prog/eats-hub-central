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
    
    if (!signature) {
      return new Response('Missing signature', { status: 401, headers: corsHeaders });
    }
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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing server configuration');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Route orders.notification events → uber_live_orders (live mode)
    if (body.event_type === 'orders.notification') {
      try {
        const payload: any = body as any;
        const meta = payload?.meta ?? {};
        const uberOrderId: string | undefined =
          meta.resource_id ?? payload?.order_id ?? payload?.id;
        const uberStoreId: string | undefined =
          meta.user_id ?? meta.store_id ?? payload?.store_id;
        const status: string | undefined = meta.status ?? payload?.status;
        const rawEventTime = payload?.event_time;
        let eventTime: string;
        if (typeof rawEventTime === 'number') {
          eventTime = new Date(rawEventTime).toISOString();
        } else if (typeof rawEventTime === 'string' && /^\d+$/.test(rawEventTime)) {
          eventTime = new Date(Number(rawEventTime)).toISOString();
        } else if (typeof rawEventTime === 'string') {
          eventTime = rawEventTime;
        } else {
          eventTime = new Date().toISOString();
        }

        if (!uberOrderId || !uberStoreId) {
          console.warn('[orders.notification] missing order/store id', { meta });
          return new Response(null, { status: 200, headers: corsHeaders });
        }

        // Resolve restaurant + chain via mapping
        const { data: mapping } = await supabase
          .from('restaurant_uber_ids')
          .select('restaurant_id, restaurants:restaurant_id(chain_id)')
          .eq('uber_store_id', uberStoreId)
          .maybeSingle();

        const restaurantId: string | null = mapping?.restaurant_id ?? null;
        const chainId: string | null = (mapping as any)?.restaurants?.chain_id ?? null;

        // Try to extract amount if Uber included it in the event
        const grossAmount: number | null =
          payload?.order?.payment?.charges?.total?.amount != null
            ? Number(payload.order.payment.charges.total.amount) / 100
            : payload?.gross_amount_incl_vat ?? null;

        const { error: liveErr } = await supabase
          .from('uber_live_orders')
          .upsert(
            {
              uber_order_id: uberOrderId,
              uber_store_id: uberStoreId,
              restaurant_id: restaurantId,
              chain_id: chainId,
              status: status ?? null,
              gross_amount_incl_vat: grossAmount,
              order_placed_at: eventTime,
              last_event_at: new Date().toISOString(),
              raw_payload: payload,
            },
            { onConflict: 'uber_order_id' },
          );

        if (liveErr) {
          console.error('[orders.notification] upsert failed', liveErr);
        } else {
          console.log('[orders.notification] upserted', uberOrderId, 'store=', uberStoreId, 'restaurant=', restaurantId);
        }
      } catch (e) {
        console.error('[orders.notification] handler error', e);
      }
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Only process success events for report flow
    if (body.event_type !== 'eats.report.success') {
      console.log('Ignoring non-success event:', body.event_type);
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    // Strict match: Uber returns the SAME composite job_id as the workflow_id stored at POST.
    // The previous LIKE prefix fallback caused races (multiple reports share the same root).
    console.log('Looking up report by strict workflow_id =', body.job_id);

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, restaurant_id')
      .eq('workflow_id', body.job_id)
      .maybeSingle();

    if (reportError) {
      throw new Error('Report lookup failed');
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
        throw new Error('Report update failed');
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
              console.log('Downloading payment CSV');
              const csvResp = await fetch(section.download_url);
              if (!csvResp.ok) {
                throw new Error(`CSV download failed: ${csvResp.status} ${csvResp.statusText}`);
              }
              const csvContent = await csvResp.text();
              console.log('CSV downloaded, length:', csvContent.length);

              const { data: parseData, error: parseInvokeError } = await supabase.functions.invoke('parse-payment-report', {
                body: {
                  csvContent,
                  reportType: 'payment_order_level',
                  dryRun: false,
                  reportId: report.id,
                  restaurantId: reportData.restaurant_id,
                  dataSource: 'uber_api',
                },
              });
              if (parseInvokeError || parseData?.success !== true) throw new Error('Payment import failed');
              await supabase.from('reports').update({ error_message: null }).eq('id', report.id);
              console.log('Payment report parsed successfully');
            } catch (parseError) {
              await supabase.from('reports').update({ error_message: 'Payment import failed; awaiting webhook retry' }).eq('id', report.id);
              throw new Error('Payment import failed; retry required');
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
              const { data: parsed, error: parseInvokeError } = await supabase.functions.invoke('parse-report-csv', {
                body: {
                  reportId: report.id,
                  downloadUrl: section.download_url,
                  reportType: body.report_type,
                  restaurantId: reportData.restaurant_id,
                },
              });
              if (parseInvokeError || parsed?.success === false) throw new Error('Report import failed');
              await supabase.from('reports').update({ error_message: null }).eq('id', report.id);
              console.log('Report parsed successfully');
            } catch (parseError) {
              await supabase.from('reports').update({ error_message: 'Import failed; awaiting webhook retry' }).eq('id', report.id);
              throw new Error('Report import failed; retry required');
            }
          }
        }
      }
    } else {
      throw new Error('Report not yet registered; retry required');
    }

    // ============================================================
    // Backfill historique : marquer le job correspondant comme "done"
    // (le worker a stocké workflow_id dans backfill_jobs.report_id)
    // ============================================================
    try {
      // Match exact OR substring (un job peut avoir plusieurs workflow_id séparés par ',' quand
      // la plage > 30j a été découpée en sous-rapports par le worker).
      const { data: bfJobs, error: bfErr } = await supabase
        .from('backfill_jobs')
        .select('id, status, restaurant_name, month_start, report_id')
        .eq('report_id', body.job_id)
        .limit(1);
      const bfJob = bfJobs && bfJobs.length > 0 ? bfJobs[0] : null;

      if (bfErr) {
        console.error('Backfill job lookup error:', bfErr);
      } else if (bfJob) {
        await supabase
          .from('backfill_jobs')
          .update({
            status: 'done',
            completed_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bfJob.id);
        console.log(`Backfill job ${bfJob.id} marked as done (${bfJob.restaurant_name} ${bfJob.month_start})`);
      }
    } catch (bfErr) {
      console.error('Failed to update backfill job:', bfErr);
    }

    // Log webhook event
    await supabase.from('webhook_logs').insert({
      event_type: body.event_type,
      webhook_uuid: body.webhook_meta.webhook_msg_uuid,
      payload: { job_id: body.job_id, report_type: body.report_type, section_count: body.report_metadata.sections.length },
      processed_at: new Date().toISOString(),
    });
    
    console.log('Webhook processed successfully');
    
    return new Response(null, { status: 200, headers: corsHeaders });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(null, { status: 503, headers: corsHeaders });
  }
});
