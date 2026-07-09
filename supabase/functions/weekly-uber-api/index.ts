import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  try {
    const url = new URL(req.url)
    const apiKey =
      req.headers.get('x-api-key') ||
      (req.headers.get('authorization')?.startsWith('ApiKey ')
        ? req.headers.get('authorization')!.slice(7)
        : null)

    if (!apiKey) return json({ error: 'missing x-api-key header' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const keyHash = await sha256Hex(apiKey)
    const { data: keyRow, error: keyErr } = await supabase
      .from('api_keys')
      .select('id, chain_id, revoked_at')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (keyErr) return json({ error: 'auth error' }, 500)
    if (!keyRow || keyRow.revoked_at) return json({ error: 'invalid api key' }, 401)

    // fire-and-forget last_used_at
    supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id)
      .then(() => {})

    const chainId = keyRow.chain_id
    const listOnly = url.searchParams.get('list') === '1'
    const weekStart = url.searchParams.get('weekStart')
    const weekEnd = url.searchParams.get('weekEnd')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const granularity = (url.searchParams.get('granularity') || 'all').toLowerCase()

    // Chain info
    const { data: chain } = await supabase
      .from('chains')
      .select('id, name')
      .eq('id', chainId)
      .maybeSingle()

    // Mode LIST: renvoie toutes les semaines disponibles avec totaux stockés
    if (listOnly) {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('week_start, week_end, totals, status, updated_at')
        .eq('chain_id', chainId)
        .order('week_start', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      const RAW_KEYS = ['ca_brut_ttc', 'ca_brut_ht', 'commission_uber', 'marketing_fee', 'service_fee', 'net_payout', 'meal_voucher_amount']
      return json({
        chain: chain,
        weeks: (data ?? []).map((r) => {
          const t = (r.totals ?? {}) as Record<string, unknown>
          const totals: Record<string, unknown> = {}
          for (const k of RAW_KEYS) if (k in t) totals[k] = t[k]
          return {
            weekStart: r.week_start,
            weekEnd: r.week_end,
            status: r.status,
            updatedAt: r.updated_at,
            totals,
          }
        }),
      })
    }

    // Détermination des semaines à retourner
    let weeks: { start: string; end: string }[] = []

    if (weekStart) {
      weeks = [{ start: weekStart, end: weekEnd || addDays(weekStart, 6) }]
    } else if (from && to) {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('week_start, week_end')
        .eq('chain_id', chainId)
        .gte('week_start', from)
        .lte('week_start', to)
        .order('week_start', { ascending: true })
      if (error) return json({ error: error.message }, 500)
      weeks = (data ?? []).map((r) => ({ start: r.week_start, end: r.week_end }))
    } else {
      // par défaut : dernière semaine disponible
      const { data } = await supabase
        .from('weekly_reports')
        .select('week_start, week_end')
        .eq('chain_id', chainId)
        .order('week_start', { ascending: false })
        .limit(1)
      if (data?.[0]) weeks = [{ start: data[0].week_start, end: data[0].week_end }]
    }

    if (weeks.length === 0) {
      return json({ chain, weeks: [] })
    }

    const results: any[] = []
    for (const w of weeks) {
      const { data: agg, error } = await supabase.rpc('get_weekly_uber_report', {
        p_chain_id: chainId,
        p_week_start: w.start,
        p_week_end: w.end,
      })
      if (error) {
        results.push({ weekStart: w.start, weekEnd: w.end, error: error.message })
        continue
      }
      const r: any = { weekStart: w.start, weekEnd: w.end }
      if (granularity === 'network' || granularity === 'all') r.network = agg?.network ?? {}
      if (granularity === 'by_day' || granularity === 'all') r.byDay = agg?.by_day ?? []
      if (granularity === 'by_restaurant' || granularity === 'all') r.byRestaurant = agg?.by_restaurant ?? []
      if (granularity === 'by_day_restaurant' || granularity === 'all') r.byDayRestaurant = agg?.by_day_restaurant ?? []
      results.push(r)
    }

    return json({ chain, weeks: results })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
