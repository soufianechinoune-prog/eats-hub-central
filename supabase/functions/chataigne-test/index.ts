import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE = 'https://server.chataigne.ai/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) return json({ ok: false, reason: 'missing_key' }, 200)
  const cleanKey = key.trim()

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'full'
  const headers = { 'x-api-key': cleanKey, Accept: 'application/json' }

  const call = async (path: string, ms = 40000) => {
    const t = Date.now()
    try {
      const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(ms) })
      const txt = await r.text()
      let body: unknown
      try { body = JSON.parse(txt) } catch { body = txt.slice(0, 500) }
      return { status: r.status, ms: Date.now() - t, body }
    } catch (e) {
      return { status: null, ms: Date.now() - t, error: String(e) }
    }
  }

  if (mode === 'probe') {
    const orgRes = await call('/organizations', 15000)
    const orgId = (orgRes as any)?.body?.data?.[0]?.id
    const paths = [
      `/organizations/${orgId}/locations`,
      `/locations?organization_id=${orgId}`,
      `/organizations/${orgId}`,
    ]
    const out: Record<string, unknown> = {}
    for (const p of paths) {
      const r = await call(p, 12000)
      out[p] = { status: r.status, ms: r.ms, error: (r as any).error, bodyPreview: JSON.stringify((r as any).body ?? '').slice(0, 1500) }
    }
    return json({ mode, orgId, results: out })
  }

  const org = await call('/organizations', 20000)
  const firstOrgId = (org as any)?.body?.data?.[0]?.id
  let loc = firstOrgId
    ? await call(`/organizations/${firstOrgId}/locations?limit=100`, 40000)
    : await call('/locations', 20000)
  // paginate if needed
  const collected: any[] = Array.isArray((loc as any)?.body?.data) ? [...(loc as any).body.data] : []
  if (firstOrgId && collected.length > 0) {
    let offset = collected.length
    for (let i = 0; i < 10; i++) {
      const next = await call(`/organizations/${firstOrgId}/locations?limit=100&offset=${offset}`, 40000)
      const arr = (next as any)?.body?.data
      if (!Array.isArray(arr) || arr.length === 0) break
      const fresh = arr.filter((a: any) => !collected.some((c) => c.id === a.id))
      if (fresh.length === 0) break
      collected.push(...fresh)
      offset += arr.length
    }
    loc = { ...(loc as any), body: { ...(loc as any).body, data: collected } }
  }
  const locBody: any = (loc as any).body
  const rawList: any[] = Array.isArray(locBody)
    ? locBody
    : Array.isArray(locBody?.data) ? locBody.data
    : Array.isArray(locBody?.locations) ? locBody.locations
    : Array.isArray(locBody?.results) ? locBody.results
    : []

  const locations = rawList.map((l) => ({
    id: l?.id,
    organization_id: l?.organization_id ?? l?.organizationId ?? null,
    name: l?.name ?? null,
    timezone: l?.timezone ?? null,
    currency: l?.currency ?? null,
  }))

  let financials_status: number | null = null
  let financials_sample: unknown = null
  if (locations.length > 0 && locations[0].id) {
    const fin = await call(`/locations/${locations[0].id}/analytics/financials`)
    financials_status = (fin as any).status
    financials_sample = (fin as any).body ?? (fin as any).error
  }

  return json({
    ok: loc.status === 200,
    locations_status: loc.status,
    locations_ms: loc.ms,
    locations_error: (loc as any).error ?? null,
    organization_id: locations[0]?.organization_id ?? null,
    locations_count: locations.length,
    locations,
    financials_status,
    financials_sample,
    ...(locations.length === 0 ? { locations_raw: locBody ?? null } : {}),
  })
})
