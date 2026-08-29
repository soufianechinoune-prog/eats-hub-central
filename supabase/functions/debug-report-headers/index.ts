// Temporary diagnostic: download a stored Uber report CSV and return its header line.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const workflowId: string = body.workflow_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: report, error } = await supabase
      .from('reports')
      .select('id, status, sections, created_at')
      .eq('workflow_id', workflowId)
      .maybeSingle();

    if (error) throw error;
    if (!report) return new Response(JSON.stringify({ found: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (report.status !== 'completed') {
      return new Response(JSON.stringify({ found: true, status: report.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = (report.sections as any[])[0]?.download_url;
    const resp = await fetch(url);
    const text = await resp.text();
    const lines = text.split('\n');
    const headers = (lines[0] ?? '').replace(/\r$/, '').split(',').map((h) => h.replace(/^"|"$/g, ''));

    return new Response(
      JSON.stringify({
        http_status: resp.status,
        total_lines: lines.length,
        header_count: headers.length,
        headers,
        sample_row: (lines[1] ?? '').replace(/\r$/, ''),
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
