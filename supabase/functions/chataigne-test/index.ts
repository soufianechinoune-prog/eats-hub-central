import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE = 'https://server.chataigne.ai'
const LOC = 'loc_51oqv3UojF'

const PII_HINTS = [
  'first_name', 'last_name', 'full_name', 'customer_name', 'contact_name',
  'recipient_name', 'client_name', 'phone', 'tel', 'email', 'mail',

  'address', 'adresse', 'street', 'postal', 'zip', 'city', 'lat', 'lng',
  'longitude', 'latitude', 'contact', 'recipient', 'note', 'comment',
  'instruction', 'company', 'building', 'floor', 'door',
  'external_id', 'customer_id', 'whatsapp', 'instagram', 'handle', 'avatar',
  'birth', 'gender', 'ip', 'device',
]

// Non-personal keys that would otherwise be caught by the hints above
const SAFE_KEYS = new Set([
  'location_name', 'status_name', 'product_name', 'item_name', 'option_name',
  'category_name', 'menu_name', 'modifier_name', 'variant_name',
  'payment_method_name', 'service_type_name', 'channel_name', 'brand_name',
  'currency', 'created_at', 'updated_at', 'order_count', 'orders_count',
  'total_orders', 'average_order_value',
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
  if (Array.isArray(value)) return value.map((v) => sanitize(v))
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
      headers: { 'x-api-key': key, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* keep null */ }
    return { url, status: res.status, json, raw: text.slice(0, 300) }
  } catch (e) {
    return { url, status: 0, json: null, raw: `error: ${(e as Error).message}` }
  }
}

function extractArray(j: unknown): Record<string, unknown>[] {
  if (Array.isArray(j)) return j as Record<string, unknown>[]
  if (j && typeof j === 'object') {
    const o = j as Record<string, unknown>
    for (const k of ['data', 'orders', 'customers', 'results', 'items']) {
      if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[]
    }
  }
  return []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'CHATAIGNE_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const safeRaw = (s: string) => s.replace(key, '***')

  // 1) ORDERS
  const list = await tryFetch(`${BASE}/v1/locations/${LOC}/orders?limit=5`, key)
  const orders = list.status === 200 ? extractArray(list.json) : []

  let ordersListShape: unknown = null
  if (list.json && typeof list.json === 'object' && !Array.isArray(list.json)) {
    const o = list.json as Record<string, unknown>
    ordersListShape = {
      top_level_keys: Object.keys(o),
      pagination: Object.fromEntries(
        Object.entries(o).filter(([k]) =>
          ['has_more', 'next_cursor', 'cursor', 'starting_after', 'total', 'count', 'limit', 'page', 'meta'].includes(k),
        ),
      ),
    }
  } else if (Array.isArray(list.json)) {
    ordersListShape = { top_level_keys: '(array)', pagination: null }
  } else {
    ordersListShape = { error: safeRaw(list.raw ?? '') }
  }

  let ordersDetailStatus: number | null = null
  let orderSchema: unknown = null
  const firstId = orders[0] ? ((orders[0].id as string) ?? (orders[0].order_id as string) ?? null) : null
  if (firstId) {
    const d = await tryFetch(`${BASE}/v1/locations/${LOC}/orders/${firstId}`, key)
    ordersDetailStatus = d.status
    orderSchema = d.status === 200 && d.json ? sanitize(d.json) : sanitize(orders[0])
  } else if (orders[0]) {
    orderSchema = sanitize(orders[0])
  }

  // 2) CUSTOMERS
  const cust = await tryFetch(`${BASE}/v1/locations/${LOC}/customers?limit=3`, key)

  return new Response(JSON.stringify({
    orders_list_status: list.status,
    orders_detail_status: ordersDetailStatus,
    orders_count: orders.length,
    orders_list_shape: ordersListShape,
    order_schema: orderSchema,
    customers_status: cust.status,
    customers_error: cust.status === 200 ? null : safeRaw(cust.raw ?? ''),
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
