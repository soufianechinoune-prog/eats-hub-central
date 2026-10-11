import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CHAIN_ID = '110e05b8-5136-45cc-a385-265360104844'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
const parisDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey) return json({ ok: false, error: 'Missing configuration' }, 500)
  const authorization = req.headers.get('Authorization') ?? ''
  const supabase = createClient(url, serviceKey)
  if (authorization !== `Bearer ${serviceKey}`) {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: user, error } = await caller.auth.getUser()
    if (error || !user.user) return json({ ok: false, error: 'Unauthorized' }, 401)
    const { data: admin, error: roleError } = await caller.rpc('is_super_admin')
    if (roleError || admin !== true) return json({ ok: false, error: 'Forbidden' }, 403)
  }
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ ok: false, error: 'Invalid JSON' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'Invalid body' }, 400)
  const mode = body.mode === 'backfill' ? 'backfill' : 'incremental'
  const days = body.days ?? (mode === 'backfill' ? 90 : 3)
  const offset = body.offset ?? 0
  const limit = body.limit ?? null
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 3660 ||
      typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 ||
      (limit !== null && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1))) {
    return json({ ok: false, error: 'Invalid days, offset or limit' }, 400)
  }
  // Preserve the rolling window's touched dates, but rebuild each entire Paris day.
  const now = new Date()
  const start = parisDay(new Date(now.getTime() - days * 86400000))
  const end = parisDay(now)
  const t0 = Date.now()
  const { data: run, error: runError } = await supabase.from('chataigne_sync_runs').insert({
    chain_id: CHAIN_ID, status: 'running', period_from: start, period_to: end, started_at: now.toISOString(),
  }).select('id').single()
  if (runError) return json({ ok: false, error: runError.message }, 500)
  const finish = async (status: string, rows: number, locations: number, error: string | null) => {
    if (!run?.id) return
    await supabase.from('chataigne_sync_runs').update({
      status, rows_upserted: rows, locations_synced: locations, error_message: error,
      finished_at: new Date().toISOString(), duration_ms: Date.now() - t0,
    }).eq('id', run.id)
  }
  try {
    let query = supabase.from('chataigne_location_mapping').select('chataigne_location_id')
      .eq('chain_id', CHAIN_ID).order('chataigne_location_id')
    if (limit !== null) query = query.range(offset, offset + limit - 1)
    else if (offset) query = query.range(offset, offset + 9999)
    const { data: mappings, error: mappingError } = await query
    if (mappingError) throw mappingError
    const locations = (mappings ?? []).map((m) => m.chataigne_location_id)
    const { data: rows, error } = await supabase.rpc('rebuild_chataigne_daily_from_orders', {
      p_chain_id: CHAIN_ID, p_start: start, p_end: end, p_location_ids: locations,
    })
    if (error) throw error
    await finish('done', rows ?? 0, locations.length, null)
    return json({ ok: true, mode, days, period: { from: start, to: end },
      locations_total: locations.length, locations_processed: locations.length,
      locations_failed: 0, rows_upserted: rows ?? 0, source: 'completed_orders_paris_days' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finish('failed', 0, 0, message)
    return json({ ok: false, error: message }, 500)
  }
})
