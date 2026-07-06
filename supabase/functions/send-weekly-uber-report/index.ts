import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({}))
    const chainId: string | undefined = body.chainId
    const weekStartIn: string | undefined = body.weekStart
    if (!chainId) {
      return new Response(JSON.stringify({ error: 'chainId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) generate (or reuse) report
    const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-weekly-uber-report`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chainId, weekStart: weekStartIn }),
    })
    if (!genResp.ok) {
      const txt = await genResp.text()
      throw new Error(`generate failed: ${txt}`)
    }
    const gen = await genResp.json()

    // 2) signed URL (7 days)
    const { data: signed, error: signErr } = await supabase.storage
      .from('weekly-reports')
      .createSignedUrl(gen.xlsxPath, 60 * 60 * 24 * 7)
    if (signErr) throw signErr

    // 3) recipients
    const { data: recipients, error: recErr } = await supabase
      .from('weekly_report_recipients')
      .select('email')
      .eq('chain_id', chainId)
      .eq('active', true)
    if (recErr) throw recErr

    const emails = (recipients ?? []).map((r) => r.email)
    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reportId: gen.reportId, sent: [], warning: 'no recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const t = gen.totals ?? {}
    const templateData = {
      chainName: gen.chainName,
      weekLabel: gen.weekLabel,
      caBrutTtc: t.ca_brut_ttc,
      caNetHt: t.ca_net_ht,
      ordersCount: t.orders_count,
      payoutTotal: t.payout_total,
      downloadUrl: signed.signedUrl,
    }

    const sent: string[] = []
    const errors: any[] = []
    for (const email of emails) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateName: 'weekly-uber-report',
            recipientEmail: email,
            idempotencyKey: `weekly-uber-${chainId}-${gen.weekStart}-${email}`,
            templateData,
          }),
        })
        if (!r.ok) {
          const txt = await r.text()
          errors.push({ email, error: txt })
        } else {
          sent.push(email)
        }
      } catch (e) {
        errors.push({ email, error: String(e) })
      }
    }

    // update report row
    await supabase
      .from('weekly_reports')
      .update({
        status: errors.length && !sent.length ? 'error' : 'sent',
        sent_to: sent,
        sent_at: new Date().toISOString(),
        error_message: errors.length ? JSON.stringify(errors).slice(0, 2000) : null,
      })
      .eq('id', gen.reportId)

    return new Response(
      JSON.stringify({ success: true, reportId: gen.reportId, sent, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-weekly-uber-report error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
