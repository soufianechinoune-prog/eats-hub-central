import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const format = (url.searchParams.get('format') || 'xlsx').toLowerCase()

    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: report, error } = await supabase
      .from('weekly_reports')
      .select('id, chain_id, week_start, week_end, xlsx_path, csv_path, token_expires_at, totals')
      .eq('download_token', token)
      .maybeSingle()

    if (error || !report) {
      return new Response(JSON.stringify({ error: 'invalid token' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (report.token_expires_at && new Date(report.token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'token expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Metadata mode (no format=file) → return summary for the public download page
    if (format === 'meta') {
      const { data: chain } = await supabase
        .from('chains')
        .select('name, logo_url')
        .eq('id', report.chain_id)
        .maybeSingle()
      return new Response(
        JSON.stringify({
          chainName: chain?.name ?? '',
          chainLogo: chain?.logo_url ?? null,
          weekStart: report.week_start,
          weekEnd: report.week_end,
          totals: report.totals,
          hasXlsx: !!report.xlsx_path,
          hasCsv: !!report.csv_path,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const path = format === 'csv' ? report.csv_path : report.xlsx_path
    if (!path) {
      return new Response(JSON.stringify({ error: `${format} not available` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('weekly-reports')
      .createSignedUrl(path, 300)

    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: 'signing failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: signed.signedUrl },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
