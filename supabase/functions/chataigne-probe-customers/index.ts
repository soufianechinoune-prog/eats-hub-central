import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE = 'https://server.chataigne.ai/v1'
const ORG_ID = 'busorg_fJF9DesU33'

const PII_HINTS = [
  'first_name', 'last_name', 'full_name', 'customer_name', 'contact_name',
  'recipient_name', 'client_name', 'phone', 'tel', 'email', 'mail',
  'address', 'adresse', 'street', 'postal', 'zip', 'city', 'lat', 'lng',
  'longitude', 'latitude', 'contact', 'recipient', 'note', 'comment',
  'instruction', 'company', 'building', 'floor', 'door',
  'external_id', 'customer_id', 'whatsapp', 'instagram', 'handle', 'avatar',
  'birth', 'gender', 'ip', 'device',
]

const SAFE_KEYS = new Set([
  'id', 'code_client', 'code', 'location_name', 'status_name', 'product_name',
  'item_name', 'option_name', 'category_name', 'menu_name', 'modifier_name',
  'variant_name', 'payment_method_name', 'service_type_name', 'channel_name',
  'brand_name', 'currency', 'created_at', 'updated_at', 'order_count',
  'orders_count', 'total_orders', 'average_order_value', 'completed_orders',
  'first_order_at', 'last_order_at', 'total_spent', 'lifetime_value',
  'total_amount', 'gross_amount', 'net_amount', 'marketing_opt_in',
  'marketing_consent', 'consent', 'consents', 'channels', 'language',
  'customer_code', 'hash', 'code_hash',
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

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => sanitize(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isPii(k) ? mask(v) : sanitize(v)
    }
    return out
  }
  return value
}

async function tryFetch(url: string, key: string) {
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* keep null */ }
    return { url, status: res.status, json, raw: text.slice(0, 400) }
  } catch (e) {
    return { url, status: 0, json: null, raw: `error: ${(e as Error).message}` }
  }
}

function shapeOf(j: unknown) {
  if (Array.isArray(j)) return { type: 'array', length: j.length, sample: sanitize(j[0]) }
  if (j && typeof j === 'object') {
    const o = j as Record<string, unknown>
    const top: Record<string, unknown> = { top_level_keys: Object.keys(o) }
    for (const [k, v] of Object.entries(o)) {
      if (Array.isArray(v)) top[`${k}:array_len`] = v.length
      else if (v && typeof v === 'object') top[`${k}:keys`] = Object.keys(v)
      else if (typeof v === 'number' || typeof v === 'boolean') top[`${k}`] = v
    }
    return top
  }
  return { type: typeof j }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'CHATAIGNE_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1) Petit échantillon : schéma du customer avec orders imbriquées
  const sample = await tryFetch(
    `${BASE}/organizations/${ORG_ID}/customers?limit=2&min_completed_orders=1&include=orders`,
    key,
  )

  // 2) Échantillon plus grand pour les stats de pagination / volume
  const bigger = await tryFetch(
    `${BASE}/organizations/${ORG_ID}/customers?limit=100&min_completed_orders=1&include=orders`,
    key,
  )

  let pagination: unknown = null
  if (bigger.json && typeof bigger.json === 'object' && !Array.isArray(bigger.json)) {
    const o = bigger.json as Record<string, unknown>
    pagination = Object.fromEntries(
      Object.entries(o).filter(([k]) =>
        ['has_more', 'next_cursor', 'cursor', 'starting_after', 'total', 'count', 'limit', 'page', 'meta'].includes(k),
      ),
    )
  }
  const biggerArr = Array.isArray(bigger.json)
    ? bigger.json
    : Array.isArray((bigger.json as any)?.data)
      ? (bigger.json as any).data
      : Array.isArray((bigger.json as any)?.customers)
        ? (bigger.json as any).customers
        : []

  // Stats : distribution du nombre de commandes embarquées
  let withOrders = 0
  let maxOrders = 0
  for (const c of biggerArr) {
    const orders = (c as any)?.orders
    if (Array.isArray(orders)) {
      withOrders++
      maxOrders = Math.max(maxOrders, orders.length)
    }
  }

  return new Response(JSON.stringify({
    sample_status: sample.status,
    sample_error: sample.status === 200 ? null : (sample.raw ?? '').slice(0, 300),
    sample_shape: sample.status === 200 ? shapeOf(sample.json) : null,
    bigger_status: bigger.status,
    bigger_count: biggerArr.length,
    pagination,
    customers_with_orders: withOrders,
    max_orders_embedded: maxOrders,
    first_customer_schema: biggerArr[0] ? sanitize(biggerArr[0]) : null,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
