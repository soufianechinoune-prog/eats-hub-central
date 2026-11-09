// Uber Direct — ingestion LECTURE SEULE des courses (GET /deliveries uniquement).
// Interdit : create/update/cancel delivery, webhooks. Aucune donnée client/coursier stockée.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

const CS_CHAIN_ID = '110e05b8-5136-45cc-a385-265360104844'
const API = 'https://api.uber.com/v1/customers'
const TOKEN_URL = 'https://auth.uber.com/oauth/v2/token'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({
  mode: z.enum(['probe', 'sync']).default('sync'),
  start_dt: z.string().datetime({ offset: true }).optional(),
  end_dt: z.string().datetime({ offset: true }).optional(),
  days_back: z.number().int().min(0).max(40).optional(),
  max_pages: z.number().int().min(1).max(500).default(200),
})

type Rec = Record<string, unknown>
const obj = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null)

// Lignes de frais présentes dans le manifeste (pas des produits)
const isDeliveryFee = (n: string) => /frais\s+de\s+livraison|delivery\s+fee/i.test(n)
const isServiceFee = (n: string) => /frais\s+de\s+service|service\s+fee/i.test(n)

function haversineKm(a: Rec, b: Rec): number | null {
  const la1 = num(a.lat), lo1 = num(a.lng), la2 = num(b.lat), lo2 = num(b.lng)
  if (la1 == null || lo1 == null || la2 == null || lo2 == null) return null
  const R = 6371, r = Math.PI / 180
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1000) / 1000
}

function parseAddress(raw: unknown): Rec {
  if (typeof raw === 'string') { try { return obj(JSON.parse(raw)) } catch { return {} } }
  return obj(raw)
}

// Copie expurgée conservée pour l'audit (montants, statuts, horodatages, manifeste).
function sanitized(d: Rec) {
  const pick = (w: Rec) => ({ status: w.status ?? null, status_timestamp: w.status_timestamp ?? null })
  const dropAddr = obj(obj(d.dropoff).detailed_address)
  return {
    id: d.id, external_id: d.external_id ?? null, status: d.status, complete: d.complete ?? null,
    fee: d.fee ?? null, currency: d.currency ?? null, tip: d.tip ?? null,
    created: d.created ?? null, updated: d.updated ?? null,
    pickup_eta: d.pickup_eta ?? null, dropoff_eta: d.dropoff_eta ?? null,
    batch_id: d.batch_id ?? null, dropoff_sequence_number: d.dropoff_sequence_number ?? null,
    undeliverable_reason: d.undeliverable_reason ?? null, refunds: d.refunds ?? null, manifest: d.manifest ?? null, manifest_items: d.manifest_items ?? null,
    pickup: { ...pick(obj(d.pickup)), name: obj(d.pickup).name ?? null, external_store_id: obj(d.pickup).external_store_id ?? null },
    dropoff: { ...pick(obj(d.dropoff)), city: dropAddr.city ?? null, zip_code: dropAddr.zip_code ?? dropAddr.postal_code ?? null },
  }
}

function toRow(d: Rec, mapping: Map<string, { restaurant_id: string | null; chain_id: string }>) {
  const pickup = obj(d.pickup), dropoff = obj(d.dropoff), manifest = obj(d.manifest)
  const storeId = str(pickup.external_store_id) ?? str(d.external_store_id)
  const items = Array.isArray(d.manifest_items) ? (d.manifest_items as Rec[]) : []
  let products = 0, allLines = 0, delFee: number | null = null, svcFee: number | null = null
  for (const it of items) {
    const name = String(it.name ?? '')
    const line = (num(it.price) ?? 0) * (num(it.quantity) ?? 1)
    allLines += line
    if (isDeliveryFee(name)) delFee = (delFee ?? 0) + line
    else if (isServiceFee(name)) svcFee = (svcFee ?? 0) + line
    else products += line
  }
  const totalValue = num(manifest.total_value)
  // Constat API : total_value = somme de TOUTES les lignes du manifeste (frais inclus), remises déduites.
  // Remise = somme(prix × qté, toutes lignes) − total_value, bornée à ≥ 0
  const discount = totalValue != null && items.length ? Math.max(0, Math.round(allLines - totalValue)) : null
  const created = str(d.created)
  const delivered = str(dropoff.status_timestamp)
  const deliveredMin = d.status === 'delivered' && created && delivered
    ? Math.round(((Date.parse(delivered) - Date.parse(created)) / 60000) * 10) / 10 : null
  const dropAddr = obj(dropoff.detailed_address)
  const map = storeId ? mapping.get(storeId) : undefined
  return {
    id: String(d.id),
    chain_id: map?.chain_id ?? CS_CHAIN_ID,
    external_id: str(d.external_id),
    external_store_id: storeId,
    pickup_name: str(pickup.name),
    restaurant_id: map?.restaurant_id ?? null,
    status: str(d.status),
    complete: typeof d.complete === 'boolean' ? d.complete : null,
    currency: str(d.currency),
    fee_cents: num(d.fee),
    tip_cents: num(d.tip),
    basket_value_cents: totalValue,
    products_gross_cents: items.length ? Math.round(products) : null,
    discount_cents: discount,
    client_delivery_fee_cents: delFee != null ? Math.round(delFee) : null,
    client_service_fee_cents: svcFee != null ? Math.round(svcFee) : null,
    distance_km: haversineKm(obj(pickup.location), obj(dropoff.location)),
    delivered_in_min: deliveredMin,
    created_at_uber: created,
    updated_at_uber: str(d.updated),
    batch_id: str(d.batch_id),
    dropoff_sequence_number: num(d.dropoff_sequence_number),
    undeliverable_reason: str(d.undeliverable_reason),
    refunds: d.refunds ?? null,
    dropoff_city: str(dropAddr.city),
    dropoff_zip: str(dropAddr.zip_code) ?? str(dropAddr.postal_code),
    raw_sanitized: sanitized(d),
    synced_at: new Date().toISOString(),
  }
}

async function getToken(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await admin.from('uber_direct_token_cache').select('access_token, expires_at').eq('id', 1).maybeSingle()
  if (data && Date.parse(data.expires_at) - Date.now() > 3600_000) return data.access_token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('UBER_DIRECT_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('UBER_DIRECT_CLIENT_SECRET') ?? '',
      grant_type: 'client_credentials', scope: 'eats.deliveries',
    }),
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  const t = await res.json()
  // Cache 29 jours max (limite Uber : 100 demandes/heure)
  const ttl = Math.min(Number(t.expires_in ?? 2592000), 29 * 86400) * 1000
  await admin.from('uber_direct_token_cache').upsert({ id: 1, access_token: t.access_token, expires_at: new Date(Date.now() + ttl).toISOString() })
  return t.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!, srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, srk)

  // Accès : service (cron) ou super admin uniquement
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  let allowed = bearer === srk
  if (!allowed && bearer) {
    const uc = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${bearer}` } } })
    const { data } = await uc.rpc('is_super_admin')
    allowed = data === true
  }
  if (!allowed) return json({ error: 'forbidden' }, 403)

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
  const p = parsed.data
  const end = p.end_dt ? new Date(p.end_dt) : new Date()
  const start = p.start_dt ? new Date(p.start_dt) : new Date(end.getTime() - (p.days_back ?? 3) * 86400_000)
  const customer = Deno.env.get('UBER_DIRECT_CUSTOMER_ID')
  if (!customer) return json({ error: 'missing customer id' }, 500)

  const { data: runRow } = await admin.from('uber_direct_sync_runs')
    .insert({ window_start: start.toISOString(), window_end: end.toISOString(), mode: p.mode }).select('id').single()
  try {
    const token = await getToken(admin)
    const { data: maps } = await admin.from('uber_direct_store_mapping').select('external_store_id, restaurant_id, chain_id')
    const mapping = new Map((maps ?? []).map((m) => [m.external_store_id, m]))

    let offset = 0, fetched = 0, upserted = 0, pages = 0
    const seenStores = new Map<string, string | null>()
    while (pages < p.max_pages) {
      const q = new URLSearchParams({ limit: '100', offset: String(offset), start_dt: start.toISOString(), end_dt: end.toISOString() })
      const res = await fetch(`${API}/${customer}/deliveries?${q}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`deliveries ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const body = await res.json()
      const list = (Array.isArray(body.data) ? body.data : []) as Rec[]
      pages++
      if (p.mode === 'probe') {
        const s = list[0] ? sanitized(list[0]) : null
        const d0 = obj(list[0])
        const pk = obj(d0.pickup), dk = obj(d0.dropoff)
        return json({ count_page: list.length, top_keys: list[0] ? Object.keys(list[0]) : [],
          pickup_keys: Object.keys(pk), dropoff_keys: Object.keys(dk),
          pickup_store: pk.external_store_id ?? null, pickup_loc_keys: Object.keys(obj(pk.location)),
          dropoff_addr_keys: Object.keys(obj(dk.detailed_address)), dropoff_types: Object.fromEntries(Object.entries(dk).map(([k, v]) => [k, typeof v])),
          state_changes: d0.state_changes ?? null, refunds_root: d0.refunds ?? null, batch_id: d0.batch_id ?? null, seq: d0.dropoff_sequence_number ?? null, external_store_id: list[0]?.external_store_id ?? null, sample: s, next_href: body.next_href ?? null })
      }
      // Bornage strict à la fenêtre demandée (au cas où le filtre serveur serait laxiste)
      const rows = list.map((d) => toRow(d, mapping)).filter((r) => {
        const t = r.created_at_uber ? Date.parse(r.created_at_uber) : NaN
        return t >= start.getTime() && t < end.getTime()
      })
      for (const r of rows) if (r.external_store_id) seenStores.set(r.external_store_id, r.pickup_name)
      fetched += list.length
      if (rows.length) {
        const { error } = await admin.from('uber_direct_deliveries').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(`upsert: ${error.message}`)
        upserted += rows.length
      }
      if (list.length < 100) break
      offset += 100
    }
    // Magasins inconnus : enregistrés non mappés (restaurant_id NULL), jamais devinés
    const unknown = [...seenStores].filter(([k]) => !mapping.has(k)).map(([k, n]) => ({ external_store_id: k, pickup_name: n, chain_id: CS_CHAIN_ID }))
    if (unknown.length) await admin.from('uber_direct_store_mapping').upsert(unknown, { onConflict: 'external_store_id', ignoreDuplicates: true })
    await admin.from('uber_direct_sync_runs').update({ finished_at: new Date().toISOString(), status: 'ok', fetched, upserted, pages }).eq('id', runRow?.id)
    return json({ ok: true, fetched, upserted, pages, new_unmapped_stores: unknown.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin.from('uber_direct_sync_runs').update({ finished_at: new Date().toISOString(), status: 'error', error: msg }).eq('id', runRow?.id)
    return json({ error: msg }, 502)
  }
})
