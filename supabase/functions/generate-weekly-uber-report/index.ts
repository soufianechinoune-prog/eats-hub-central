import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import ExcelJS from 'npm:exceljs@4.4.0'

// Compute previous Monday..Sunday in Europe/Paris timezone from a reference date
function computePreviousWeek(ref: Date): { start: string; end: string; label: string } {
  const parisNow = new Date(ref.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const day = parisNow.getDay() // 0=Sun ... 6=Sat
  const daysSinceMonday = (day + 6) % 7 // 0 if Mon
  const thisMonday = new Date(parisNow)
  thisMonday.setDate(parisNow.getDate() - daysSinceMonday)
  const prevMonday = new Date(thisMonday)
  prevMonday.setDate(thisMonday.getDate() - 7)
  const prevSunday = new Date(prevMonday)
  prevSunday.setDate(prevMonday.getDate() + 6)
  const iso = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  const label = `${prevMonday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${prevSunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
  return { start: iso(prevMonday), end: iso(prevSunday), label }
}

const CURRENCY_FMT = '#,##0.00 €;[Red]-#,##0.00 €;-'
const INT_FMT = '#,##0'

function addMetricColumns(sheet: any, firstCol: string) {
  // columns for CA + fees + orders + payout
  const cols: any[] = []
  cols.push({ header: 'CA brut TTC', key: 'ca_brut_ttc', width: 15, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'CA brut HT', key: 'ca_brut_ht', width: 15, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'CA net TTC', key: 'ca_net_ttc', width: 15, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'CA net HT', key: 'ca_net_ht', width: 15, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'Commission Uber', key: 'commission_uber', width: 16, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'Marketing', key: 'marketing_fee', width: 14, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'Frais de service', key: 'service_fee', width: 16, style: { numFmt: CURRENCY_FMT } })
  cols.push({ header: 'Commandes', key: 'orders_count', width: 12, style: { numFmt: INT_FMT } })
  cols.push({ header: 'Versement Uber', key: 'payout_total', width: 16, style: { numFmt: CURRENCY_FMT } })
  return cols
}

function styleHeader(row: any) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  row.alignment = { vertical: 'middle', horizontal: 'center' }
  row.height = 22
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({}))
    const chainId: string | undefined = body.chainId
    const weekStartIn: string | undefined = body.weekStart
    const weekEndIn: string | undefined = body.weekEnd
    if (!chainId) {
      return new Response(JSON.stringify({ error: 'chainId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let weekStart: string
    let weekEnd: string
    let weekLabel: string
    if (weekStartIn && weekEndIn) {
      weekStart = weekStartIn
      weekEnd = weekEndIn
      const s = new Date(weekStart + 'T00:00:00')
      const e = new Date(weekEnd + 'T00:00:00')
      weekLabel = `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    } else {
      const wk = computePreviousWeek(new Date())
      weekStart = wk.start
      weekEnd = wk.end
      weekLabel = wk.label
    }

    // Fetch chain name
    const { data: chain } = await supabase.from('chains').select('name').eq('id', chainId).maybeSingle()
    const chainName = chain?.name ?? 'Marque'

    // Aggregate
    const { data: agg, error: aggErr } = await supabase.rpc('get_weekly_uber_report', {
      p_chain_id: chainId,
      p_week_start: weekStart,
      p_week_end: weekEnd,
    })
    if (aggErr) throw aggErr

    const network = agg?.network ?? {}
    const byDay = (agg?.by_day ?? []) as any[]
    const byResto = (agg?.by_restaurant ?? []) as any[]
    const byDayResto = (agg?.by_day_restaurant ?? []) as any[]

    // Build XLSX
    const wb = new ExcelJS.Workbook()
    wb.creator = 'CS Delivery Performance'
    wb.created = new Date()

    // 1. Réseau
    const s1 = wb.addWorksheet('Réseau')
    s1.columns = [{ header: 'Semaine', key: 'week', width: 34 }, ...addMetricColumns(s1, 'B')]
    styleHeader(s1.getRow(1))
    s1.addRow({ week: `Total réseau — ${weekLabel}`, ...network })
    s1.views = [{ state: 'frozen', ySplit: 1 }]

    // 2. Par jour
    const s2 = wb.addWorksheet('Par jour')
    s2.columns = [{ header: 'Jour', key: 'local_date', width: 14 }, ...addMetricColumns(s2, 'B')]
    styleHeader(s2.getRow(1))
    for (const d of byDay) s2.addRow(d)
    const totalRow2 = s2.addRow({
      local_date: 'TOTAL',
      ...network,
    })
    totalRow2.font = { bold: true }
    s2.getColumn('local_date').numFmt = 'yyyy-mm-dd'
    s2.views = [{ state: 'frozen', ySplit: 1 }]

    // 3. Par restaurant
    const s3 = wb.addWorksheet('Par restaurant')
    s3.columns = [{ header: 'Restaurant', key: 'restaurant_name', width: 30 }, ...addMetricColumns(s3, 'B')]
    styleHeader(s3.getRow(1))
    for (const r of byResto) s3.addRow(r)
    const totalRow3 = s3.addRow({ restaurant_name: 'TOTAL', ...network })
    totalRow3.font = { bold: true }
    s3.views = [{ state: 'frozen', ySplit: 1 }]

    // 4. Jour x Restaurant
    const s4 = wb.addWorksheet('Jour x Restaurant')
    s4.columns = [
      { header: 'Jour', key: 'local_date', width: 12 },
      { header: 'Restaurant', key: 'restaurant_name', width: 30 },
      ...addMetricColumns(s4, 'C'),
    ]
    styleHeader(s4.getRow(1))
    for (const r of byDayResto) s4.addRow(r)
    s4.getColumn('local_date').numFmt = 'yyyy-mm-dd'
    s4.views = [{ state: 'frozen', ySplit: 1 }]
    s4.autoFilter = { from: 'A1', to: 'K1' }

    const buffer = await wb.xlsx.writeBuffer()
    const bytes = new Uint8Array(buffer as ArrayBuffer)

    // Upload to storage
    const slug = chainName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const path = `${chainId}/${weekStart}_${slug}_uber-weekly.xlsx`
    const { error: upErr } = await supabase.storage
      .from('weekly-reports')
      .upload(path, bytes, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      })
    if (upErr) throw upErr

    const totals = {
      ca_brut_ttc: Number(network.ca_brut_ttc ?? 0),
      ca_brut_ht: Number(network.ca_brut_ht ?? 0),
      ca_net_ttc: Number(network.ca_net_ttc ?? 0),
      ca_net_ht: Number(network.ca_net_ht ?? 0),
      commission_uber: Number(network.commission_uber ?? 0),
      marketing_fee: Number(network.marketing_fee ?? 0),
      service_fee: Number(network.service_fee ?? 0),
      orders_count: Number(network.orders_count ?? 0),
      payout_total: Number(network.payout_total ?? 0),
    }

    // Upsert weekly_reports row
    const { data: existing } = await supabase
      .from('weekly_reports')
      .select('id')
      .eq('chain_id', chainId)
      .eq('week_start', weekStart)
      .maybeSingle()

    let reportId: string
    if (existing) {
      const { error } = await supabase
        .from('weekly_reports')
        .update({
          week_end: weekEnd,
          xlsx_path: path,
          status: 'generated',
          totals,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw error
      reportId = existing.id
    } else {
      const { data, error } = await supabase
        .from('weekly_reports')
        .insert({
          chain_id: chainId,
          week_start: weekStart,
          week_end: weekEnd,
          xlsx_path: path,
          status: 'generated',
          totals,
        })
        .select('id')
        .single()
      if (error) throw error
      reportId = data.id
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportId,
        chainName,
        weekStart,
        weekEnd,
        weekLabel,
        xlsxPath: path,
        totals,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('generate-weekly-uber-report error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
