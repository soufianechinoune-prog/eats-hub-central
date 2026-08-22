import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE = 'https://server.chataigne.ai'
const LOC = 'loc_51oqv3UojF'

const PII_HINTS = [
  'name', 'first_name', 'last_name', 'phone', 'tel', 'email', 'mail',
  'address', 'adresse', 'street', 'postal', 'zip', 'city', 'lat', 'lng',
  'longitude', 'latitude', 'customer', 'contact', 'recipient', 'note',
  'comment', 'instruction', 'company', 'building', 'floor', 'door', 'code',
]

const SAFE_KEYS = new Set([
  'product_name', 'item_name', 'category_name', 'location_name', 'status_name',
  'name_id',
])

function isPii(key: string): boolean {
  const k = key.toLowerCase()
  if (SAFE_KEYS.has(k)) return false
  return PII_HINTS.some((h) => k.includes(h))
}

function mask(value: unknown): string {
  const t = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  return `<masqué:${t}>`
}

function sanitize(value: unknown, parentKey = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => sanitize(v, parentKey))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isPii(k)) {
        out[k] = mask(v)
      } else {
        out[k] = sanitize(v, k)
      }
    }
    return out
  }
  return value
}

async function tryFetch(url: string, key: string) {
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': key, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* keep null */ }
    return { url, status: res.status, json, raw: json ? null : text.slice(0, 300) }
  } catch (e) {
    return { url, status: 0, json: null, raw: `error: ${(e as Error).message}` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'CHATAIGNE_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const candidates = [
    `${BASE}/v1/locations/${LOC}/orders?limit=5`,
    `${BASE}/v1/locations/${LOC}/orders`,
    `${BASE}/v1/orders?location_id=${LOC}&limit=5`,
    `${BASE}/v1/locations/${LOC}/order?limit=5`,
  ]

  const attempts: { url: string; status: number }[] = []
  let listOk: { url: string; status: number; json: unknown; raw: string | null } | null = null

  for (const url of candidates) {
    const r = await tryFetch(url, key)
    attempts.push({ url: r.url.replace(key, '***'), status: r.status })
    if (r.status === 200) { listOk = r; break }
  }

  let listShape: unknown = null
  let ordersCount = 0
  let firstOrderId: string | null = null
  let ordersArr: Record<string, unknown>[] = []

  if (listOk?.json && typeof listOk.json === 'object') {
    const j = listOk.json as Record<string, unknown>
    const topKeys = Array.isArray(j) ? ['<array>'] : Object.keys(j)
    ordersArr = Array.isArray(j)
      ? (j as Record<string, unknown>[])
      : (Array.isArray(j.data) ? j.data as Record<string, unknown>[]
        : Array.isArray(j.orders) ? j.orders as Record<string, unknown>[]
        : Array.isArray(j.results) ? j.results as Record<string, unknown>[] : [])
    ordersCount = ordersArr.length
    firstOrderId = (ordersArr[0]?.id as string) ?? (ordersArr[0]?.order_id as string) ?? null
    listShape = {
      top_level_keys: topKeys,
      pagination: {
        has_more: Array.isArray(j) ? null : j.has_more ?? null,
        next_cursor_hint: firstOrderId ? `starting_after=<last order id>` : null,
        observed_pagination_keys: topKeys.filter((k) => /more|cursor|next|page|total|count|after/i.test(k)),
      },
      item_keys_sample: ordersArr[0] ? Object.keys(ordersArr[0]) : [],
    }
  }

  let detailStatus = 0
  let orderSchema: unknown = null
  if (firstOrderId) {
    const d = await tryFetch(`${BASE}/v1/locations/${LOC}/orders/${firstOrderId}`, key)
    detailStatus = d.status
    if (d.status === 200 && d.json) orderSchema = sanitize(d.json)
    else if (ordersArr[0]) orderSchema = sanitize(ordersArr[0])
  } else if (ordersArr[0]) {
    orderSchema = sanitize(ordersArr[0])
  }

  return new Response(JSON.stringify({
    ok: !!listOk,
    attempts,
    list_url: listOk?.url ?? null,
    list_status: listOk?.status ?? attempts.at(-1)?.status ?? 0,
    list_shape: listShape,
    orders_count: ordersCount,
    detail_status: detailStatus,
    order_schema: orderSchema,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
