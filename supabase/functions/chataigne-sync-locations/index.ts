import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://server.chataigne.ai/v1'
const ORG_ID = 'busorg_fJF9DesU33'
const CHAIN_ID = '110e05b8-5136-45cc-a385-265360104844'

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const STOP = [
  'chicken street',
  'chickenstreet',
  'original by chicken street',
  'cs original',
  'original',
  'cs',
]

const normalizeLabel = (s: string) => {
  let v = strip(s)
  for (const w of STOP) {
    v = v.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ')
  }
  return v.replace(/\s+/g, ' ').trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) return json({ ok: false, reason: 'missing_key' }, 200)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const startedAt = new Date()
  const t0 = Date.now()

  const finish = async (
    status: string,
    locationsSynced: number,
    errorMessage: string | null = null,
  ) => {
    await supabase.from('chataigne_sync_runs').insert({
      chain_id: CHAIN_ID,
      status,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      locations_synced: locationsSynced,
      rows_upserted: locationsSynced,
      error_message: errorMessage,
    })
  }

  try {
    const headers = { 'x-api-key': key.trim(), Accept: 'application/json' }
    const all: any[] = []
    let cursor: string | null = null
    let firstShape: string[] | null = null

    for (let page = 0; page < 30; page++) {
      const qs = new URLSearchParams({ limit: '100' })
      if (cursor) qs.set('starting_after', cursor)
      const url = `${BASE}/organizations/${ORG_ID}/locations?${qs.toString()}`
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(40000) })
      if (!r.ok) throw new Error(`locations HTTP ${r.status}`)
      const body = await r.json()
      if (!firstShape) {
        firstShape = body && typeof body === 'object' ? Object.keys(body) : ['<array>']
        console.log('locations response top-level keys:', JSON.stringify(firstShape))
      }
      const arr: any[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.locations)
            ? body.locations
            : Array.isArray(body?.results)
              ? body.results
              : []
      if (arr.length === 0) break
      const fresh = arr.filter((a) => !all.some((c) => c.id === a.id))
      if (fresh.length === 0) break
      all.push(...fresh)
      cursor = arr[arr.length - 1]?.id ?? null
      if (!body?.has_more || !cursor) break
    }


    // Restaurants Chicken Street
    const { data: restaurants, error: rErr } = await supabase
      .from('restaurants')
      .select('id, name, city')
      .eq('chain_id', CHAIN_ID)
    if (rErr) throw rErr

    const candidates = (restaurants ?? []).map((r) => ({
      id: r.id,
      keys: new Set(
        [normalizeLabel(r.name ?? ''), normalizeLabel(r.city ?? '')].filter(Boolean),
      ),
    }))

    const rows = all.map((l) => {
      const rawLabel: string = l?.name ?? ''
      const norm = normalizeLabel(rawLabel)
      let matchedId: string | null = null

      if (norm) {
        const exact = candidates.filter((c) => c.keys.has(norm))
        if (exact.length === 1) {
          matchedId = exact[0].id
        } else if (exact.length === 0) {
          // containment match, only if strictly unique
          const partial = candidates.filter((c) =>
            [...c.keys].some(
              (k) => k.length >= 4 && norm.length >= 4 && (k === norm || k.startsWith(norm + ' ') || norm.startsWith(k + ' ')),
            ),
          )
          if (partial.length === 1) matchedId = partial[0].id
        }
      }

      return {
        chain_id: CHAIN_ID,
        chataigne_org_id: ORG_ID,
        chataigne_location_id: l?.id,
        raw_label: rawLabel || null,
        timezone: l?.timezone ?? null,
        currency: l?.currency ?? null,
        restaurant_id: matchedId,
        match_method: matchedId ? 'auto_name' : null,
        matched_at: matchedId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }
    }).filter((r) => !!r.chataigne_location_id)

    // Preserve existing manual matches: don't overwrite an existing restaurant_id with null
    const { data: existing } = await supabase
      .from('chataigne_location_mapping')
      .select('chataigne_location_id, restaurant_id, match_method, matched_at')
      .eq('chain_id', CHAIN_ID)

    const existingMap = new Map(
      (existing ?? []).map((e) => [e.chataigne_location_id, e]),
    )

    for (const row of rows) {
      const prev = existingMap.get(row.chataigne_location_id)
      if (prev?.restaurant_id && !row.restaurant_id) {
        row.restaurant_id = prev.restaurant_id
        row.match_method = prev.match_method
        row.matched_at = prev.matched_at
      }
    }

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200)
      const { error } = await supabase
        .from('chataigne_location_mapping')
        .upsert(chunk, { onConflict: 'chataigne_location_id' })
      if (error) throw error
    }

    const unmatched = rows.filter((r) => !r.restaurant_id).map((r) => r.raw_label)

    await finish('success', rows.length)

    return json({
      ok: true,
      response_shape: firstShape,
      total_locations: rows.length,
      matched: rows.length - unmatched.length,
      unmatched_count: unmatched.length,
      unmatched,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('chataigne-sync-locations failed:', msg)
    await finish('error', 0, msg)
    return json({ ok: false, error: msg }, 500)
  }
})
