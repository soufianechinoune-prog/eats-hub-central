import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://server.chataigne.ai'
const CHAIN_ID = '110e05b8-5136-45cc-a385-265360104844'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const toDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || v.length < 10) return null
  const d = v.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) return json({ ok: false, reason: 'missing_key' }, 200)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const mode = body?.mode === 'backfill' ? 'backfill' : 'incremental'
  const days = Number.isFinite(body?.days) ? Math.max(1, Math.floor(body.days)) : mode === 'backfill' ? 90 : 3
  // optional chunking so long backfills can be run in slices
  const offset = Number.isFinite(body?.offset) ? Math.max(0, Math.floor(body.offset)) : 0
  const limit = Number.isFinite(body?.limit) ? Math.max(1, Math.floor(body.limit)) : null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  const startedAt = new Date()
  const t0 = Date.now()

  const { data: runRow } = await supabase
    .from('chataigne_sync_runs')
    .insert({
      chain_id: CHAIN_ID,
      status: 'running',
      period_from: from.toISOString(),
      period_to: to.toISOString(),
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single()

  const runId = runRow?.id ?? null

  const finish = async (
    status: string,
    locationsSynced: number,
    rowsUpserted: number,
    errorMessage: string | null,
  ) => {
    if (!runId) return
    await supabase
      .from('chataigne_sync_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        locations_synced: locationsSynced,
        rows_upserted: rowsUpserted,
        error_message: errorMessage,
      })
      .eq('id', runId)
  }

  try {
    let q = supabase
      .from('chataigne_location_mapping')
      .select('chataigne_location_id, restaurant_id, chain_id, currency')
      .order('chataigne_location_id', { ascending: true })
    if (limit) q = q.range(offset, offset + limit - 1)
    else if (offset) q = q.range(offset, offset + 9999)

    const { data: mappings, error: mErr } = await q
    if (mErr) throw mErr

    const headers = { 'x-api-key': key.trim(), Accept: 'application/json' }
    const qs = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`

    const call = async (path: string) => {
      const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(30000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    }

    let processed = 0
    let failed = 0
    let rowsUpserted = 0
    let grossTotal = 0
    let minDate: string | null = null
    let maxDate: string | null = null
    const errors: { location: string; error: string }[] = []

    for (const m of mappings ?? []) {
      const locId = m.chataigne_location_id as string
      try {
        const fin: any = await call(`/v1/locations/${locId}/analytics/financials?${qs}`)
        const ord: any = await call(`/v1/locations/${locId}/analytics/orders?${qs}`)

        const avg = num(fin?.summary?.average_order_value)
        const byDate = new Map<string, { gross: number | null; count: number | null }>()

        for (const d of Array.isArray(fin?.daily) ? fin.daily : []) {
          const day = toDate(d?.date)
          if (!day) continue
          const e = byDate.get(day) ?? { gross: null, count: null }
          e.gross = num(d?.gross_order_value)
          byDate.set(day, e)
        }
        for (const d of Array.isArray(ord?.daily) ? ord.daily : []) {
          const day = toDate(d?.date)
          if (!day) continue
          const e = byDate.get(day) ?? { gross: null, count: null }
          const c = num(d?.order_count)
          e.count = c === null ? null : Math.round(c)
          byDate.set(day, e)
        }

        const rows = [...byDate.entries()].map(([day, v]) => {
          grossTotal += v.gross ?? 0
          if (!minDate || day < minDate) minDate = day
          if (!maxDate || day > maxDate) maxDate = day
          return {
            chain_id: m.chain_id ?? CHAIN_ID,
            restaurant_id: m.restaurant_id,
            chataigne_location_id: locId,
            date: day,
            service_type: 'all',
            currency: m.currency,
            gross_order_value: v.gross,
            average_order_value: avg,
            order_count: v.count,
            updated_at: new Date().toISOString(),
          }
        })

        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500)
          const { error } = await supabase
            .from('chataigne_daily_analytics')
            .upsert(chunk, { onConflict: 'chataigne_location_id,date,service_type' })
          if (error) throw error
          rowsUpserted += chunk.length
        }

        processed++
      } catch (e) {
        failed++
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`chataigne-sync-analytics location ${locId} failed: ${msg}`)
        errors.push({ location: locId, error: msg })
      }
      await sleep(150)
    }

    const total = (mappings ?? []).length
    const status = total > 0 && processed === 0 ? 'failed' : 'done'
    await finish(
      status,
      processed,
      rowsUpserted,
      failed > 0 ? `${failed} location(s) en erreur` : null,
    )

    return json({
      ok: status === 'done',
      mode,
      days,
      period: { from: from.toISOString(), to: to.toISOString() },
      locations_total: total,
      locations_processed: processed,
      locations_failed: failed,
      rows_upserted: rowsUpserted,
      date_range: { min: minDate, max: maxDate },
      gross_order_value_total: Math.round(grossTotal * 100) / 100,
      errors: errors.slice(0, 20),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('chataigne-sync-analytics failed:', msg)
    await finish('failed', 0, 0, msg)
    return json({ ok: false, error: msg }, 500)
  }
})
