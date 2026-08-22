import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE = 'https://server.chataigne.ai'
const LOC = 'loc_51oqv3UojF'
const ORG = 'busorg_fJF9DesU33'

const PII_HINTS = [
  'name', 'first_name', 'last_name', 'phone', 'tel', 'email', 'mail',
  'address', 'adresse', 'street', 'postal', 'zip', 'city', 'lat', 'lng',
  'longitude', 'latitude', 'contact', 'recipient', 'note', 'comment',
  'instruction', 'company', 'building', 'floor', 'door', 'code',
  'external_id', 'customer_id', 'whatsapp', 'instagram', 'handle', 'avatar',
  'birth', 'gender', 'ip', 'device',
]

const SAFE_KEYS = new Set([
  'location_name', 'status_name', 'loyalty_status', 'order_count',
  'orders_count', 'total_orders', 'total_spent', 'created_at', 'updated_at',
  'first_order_at', 'last_order_at', 'average_order_value', 'currency',
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
    for (const k of ['data', 'customers', 'results', 'items']) {
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

  const candidates = [
    { base: `${BASE}/v1/locations/${LOC}`, url: `${BASE}/v1/locations/${LOC}/customers?limit=3` },
    { base: `${BASE}/v1/organizations/${ORG}`, url: `${BASE}/v1/organizations/${ORG}/customers?limit=3` },
  ]

  const endpoints: Record<string, { status: number; error?: string; count?: number }> = {}
  let okBase: string | null = null
  let firstCustomer: Record<string, unknown> | null = null

  for (const c of candidates) {
    const r = await tryFetch(c.url, key)
    const arr = r.status === 200 ? extractArray(r.json) : []
    endpoints[c.url] = {
      status: r.status,
      ...(r.status === 200 ? { count: arr.length } : { error: (r.raw ?? '').replace(key, '***') }),
    }
    if (r.status === 200 && !okBase) {
      okBase = c.base
      firstCustomer = arr[0] ?? null
    }
  }

  let customerSchema: unknown = null
  if (okBase && firstCustomer) {
    const id = (firstCustomer.id as string) ?? (firstCustomer.customer_id as string) ?? null
    if (id) {
      const d = await tryFetch(`${okBase}/customers/${id}`, key)
      endpoints[`${okBase}/customers/{id}`] = { status: d.status }
      customerSchema = d.status === 200 && d.json ? sanitize(d.json) : sanitize(firstCustomer)
    } else {
      customerSchema = sanitize(firstCustomer)
    }
  }

  return new Response(JSON.stringify({
    endpoints,
    accessible: !!okBase,
    customer_schema: customerSchema,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
