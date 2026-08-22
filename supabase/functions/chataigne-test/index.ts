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

  const headers = { 'x-api-key': key, Accept: 'application/json' }

  try {
    const locRes = await fetch(`${BASE}/locations`, { headers })
    const locStatus = locRes.status
    const locText = await locRes.text()
    let locBody: any = null
    try { locBody = JSON.parse(locText) } catch { locBody = locText }

    const rawList: any[] = Array.isArray(locBody)
      ? locBody
      : Array.isArray(locBody?.data)
        ? locBody.data
        : Array.isArray(locBody?.locations)
          ? locBody.locations
          : Array.isArray(locBody?.results)
            ? locBody.results
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
      const finRes = await fetch(
        `${BASE}/locations/${locations[0].id}/analytics/financials`,
        { headers },
      )
      financials_status = finRes.status
      const finText = await finRes.text()
      try { financials_sample = JSON.parse(finText) } catch { financials_sample = finText }
    }

    return json({
      ok: locRes.ok,
      locations_status: locStatus,
      organization_id: locations[0]?.organization_id ?? null,
      locations_count: locations.length,
      locations,
      financials_status,
      financials_sample,
      ...(locations.length === 0 ? { locations_raw: locBody } : {}),
    })
  } catch (e) {
    return json({ ok: false, reason: 'fetch_error', error: String(e) }, 200)
  }
})
