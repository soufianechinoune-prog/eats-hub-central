import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
const parisDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 3660) {
    return json({ ok: false, error: 'Invalid days' }, 400)
  }
  if (body.chain_id !== undefined && (typeof body.chain_id !== 'string' || !UUID_RE.test(body.chain_id))) {
    return json({ ok: false, error: 'Invalid chain_id' }, 400)
  }
  // Rebuild every entire Paris day touched by the window, from completed orders.
  const now = new Date()
  const start = parisDay(new Date(now.getTime() - days * 86400000))
  const end = parisDay(now)

  const { data: mappings, error: mappingError } = await supabase
    .from('chataigne_location_mapping').select('chain_id, chataigne_location_id')
  if (mappingError) return json({ ok: false, error: mappingError.message }, 500)
  const byChain = new Map<string, string[]>()
  for (const m of mappings ?? []) {
    if (!m.chain_id || (body.chain_id && m.chain_id !== body.chain_id)) continue
    const list = byChain.get(m.chain_id) ?? []
    list.push(m.chataigne_location_id)
    byChain.set(m.chain_id, list)
  }

  const results: Record<string, unknown>[] = []
  for (const [chainId, locations] of byChain) {
    const t0 = Date.now()
    const { data: run } = await supabase.from('chataigne_sync_runs').insert({
      chain_id: chainId, status: 'running', period_from: start, period_to: end, started_at: new Date().toISOString(),
    }).select('id').single()
    const { data: rows, error } = await supabase.rpc('rebuild_chataigne_daily_from_orders', {
      p_chain_id: chainId, p_start: start, p_end: end, p_location_ids: locations,
    })
    if (run?.id) {
      await supabase.from('chataigne_sync_runs').update({
        status: error ? 'failed' : 'done', rows_upserted: error ? 0 : rows ?? 0,
        locations_synced: error ? 0 : locations.length, error_message: error?.message ?? null,
        finished_at: new Date().toISOString(), duration_ms: Date.now() - t0,
      }).eq('id', run.id)
    }
    results.push({ chain_id: chainId, ok: !error, locations: locations.length, rows_upserted: rows ?? 0, error: error?.message ?? null })
  }
  const allOk = results.every((r) => r.ok)
  return json({ ok: allOk, mode, days, period: { from: start, to: end }, chains: results,
    source: 'completed_orders_paris_days' }, allOk ? 200 : 500)
})
