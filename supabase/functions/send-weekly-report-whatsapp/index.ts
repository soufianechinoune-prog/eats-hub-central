import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://cs-delivery-performance.com'

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))

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

    // 1) Generate (or refresh) report
    const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-weekly-uber-report`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chainId, weekStart: weekStartIn }),
    })
    if (!genResp.ok) throw new Error(`generate failed: ${await genResp.text()}`)
    const gen = await genResp.json()

    // 2) Recipients (WhatsApp)
    const { data: recipients, error: recErr } = await supabase
      .from('weekly_report_recipients')
      .select('phone, name')
      .eq('chain_id', chainId)
      .eq('active', true)
      .eq('channel', 'whatsapp')
      .not('phone', 'is', null)
    if (recErr) throw recErr

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reportId: gen.reportId, sent: [], warning: 'no whatsapp recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const t = gen.totals ?? {}
    const publicUrl = `${APP_URL}/r/wr/${gen.downloadToken}`

    const message =
      `📊 *Rapport ${gen.chainName} — Uber Eats*\n` +
      `Semaine du ${gen.weekLabel}\n\n` +
      `💶 CA brut : ${fmtEur(t.ca_brut_ttc)} TTC (${fmtEur(t.ca_brut_ht)} HT)\n` +
      `💰 CA net après commissions : ${fmtEur(t.ca_net_ht)} HT\n` +
      `🧾 Frais Uber : ${fmtEur((t.commission_uber || 0) + (t.marketing_fee || 0) + (t.service_fee || 0))}\n` +
      `📦 Commandes : ${fmtInt(t.orders_count)}\n` +
      `🏦 Versement Uber : ${fmtEur(t.payout_total)}\n\n` +
      `📥 Détail complet (XLSX + CSV) :\n${publicUrl}\n\n` +
      `_Lien valable 30 jours._`

    // 3) Send via existing send-whatsapp
    const waPayload = {
      recipients: recipients.map((r) => ({
        phone: r.phone as string,
        name: r.name ?? '',
        restaurantName: gen.chainName,
      })),
      message,
      message_type: 'report',
      skip_campaign: false,
      report_start_date: gen.weekStart,
      report_end_date: gen.weekEnd,
    }

    const waResp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waPayload),
    })

    const waResult = await waResp.json().catch(() => ({}))
    const sentPhones: string[] = (waResult?.results ?? [])
      .filter((r: any) => r.success)
      .map((r: any) => r.phone)

    // 4) Update weekly_reports
    await supabase
      .from('weekly_reports')
      .update({
        sent_via_whatsapp: sentPhones.length > 0,
        whatsapp_batch_id: waResult?.batch_id ?? null,
        sent_phones: sentPhones,
        status: sentPhones.length > 0 ? 'sent' : (waResp.ok ? 'generated' : 'error'),
        sent_at: sentPhones.length > 0 ? new Date().toISOString() : null,
        error_message: waResp.ok ? null : JSON.stringify(waResult).slice(0, 2000),
      })
      .eq('id', gen.reportId)

    // 5) Log in-app notification (best-effort for each super_admin)
    try {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin')
      if (admins) {
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          chain_id: chainId,
          type: 'weekly_report',
          severity: sentPhones.length > 0 ? 'info' : 'warning',
          title: `Rapport hebdo ${gen.chainName} — ${gen.weekLabel}`,
          body: sentPhones.length > 0
            ? `Envoyé via WhatsApp à ${sentPhones.length} destinataire(s)`
            : `Génération OK mais échec envoi WhatsApp`,
          link: '/reports/weekly',
          metadata: { reportId: gen.reportId, weekStart: gen.weekStart },
        }))
        if (rows.length) await supabase.from('notifications').insert(rows)
      }
    } catch (e) {
      console.error('notification insert failed', e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportId: gen.reportId,
        publicUrl,
        sent: sentPhones,
        waResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-weekly-report-whatsapp error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
