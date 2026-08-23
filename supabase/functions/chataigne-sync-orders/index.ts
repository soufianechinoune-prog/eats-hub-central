import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://server.chataigne.ai'
const CHAIN_ID = '110e05b8-5136-45cc-a385-265360104844'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- RGPD: expurgation ----------
const PII_KEYS = new Set([
  'customer_notes',
  'delivery_notes',
  'notes',
  'address',
  'first_name',
  'last_name',
  'full_name',
  'name_on_order',
  'phone',
  'phone_number',
  'email',
  'contact',
  'recipient',
])

function scrubDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrubDeep)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) continue
      out[k] = scrubDeep(val)
    }
    return out
  }
  return v
}

/** Returns { scrubbed, hasCustomer, customerLanguage } */
function scrubOrder(order: Record<string, unknown>) {
  const customer = order?.customer as Record<string, unknown> | null | undefined
  const hasCustomer = !!customer && typeof customer === 'object'
  const customerLanguage =
    hasCustomer && typeof customer?.language === 'string' ? (customer.language as string) : null

  const clone = { ...order }
  delete (clone as Record<string, unknown>).customer

  const fulfillment = clone.fulfillment as Record<string, unknown> | undefined
  if (fulfillment && typeof fulfillment === 'object') {
    const f = { ...fulfillment }
    delete f.address
    delete f.customer_notes
    delete f.delivery_notes
    delete f.contact
    delete f.recipient
    clone.fulfillment = f
  }

  const scrubbed = scrubDeep(clone) as Record<string, unknown>
  if (customerLanguage) scrubbed.customer_language = customerLanguage
  return { scrubbed, hasCustomer, customerLanguage }
}

// ---------- Pseudonymisation client (RGPD) ----------
// La cle client (id ou telephone) n'existe qu'en memoire, n'est jamais stockee ni loggee.
const HASH_SALT = Deno.env.get('CHATAIGNE_HASH_SALT') ?? ''

function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  d = d.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 && d.startsWith('0')) d = '33' + d.slice(1)
  if (d.length === 9 && d.startsWith('6')) d = '33' + d
  return d.length >= 8 ? d : null
}

/** Returns { key, source } — key is raw and must NEVER be persisted or logged. */
function extractClientKey(order: Record<string, unknown>): { key: string | null; source: 'customer_id' | 'phone' | null } {
  const c = (order?.customer ?? null) as Record<string, unknown> | null
  if (c && typeof c === 'object') {
    const id = c.id ?? c.customer_id ?? c.uuid ?? null
    if (id !== null && id !== undefined && String(id).trim() !== '') {
      return { key: `id:${String(id).trim()}`, source: 'customer_id' }
    }
    const phoneRaw = (c.phone ?? c.phone_number ?? c.mobile ?? null) as unknown
    if (typeof phoneRaw === 'string' && phoneRaw.trim()) {
      const n = normalizePhone(phoneRaw)
      if (n) return { key: `tel:${n}`, source: 'phone' }
    }
  }
  const topId = (order?.customer_id ?? null) as unknown
  if (typeof topId === 'string' && topId.trim()) return { key: `id:${topId.trim()}`, source: 'customer_id' }
  return { key: null, source: null }
}

async function hashClientKey(key: string | null): Promise<string | null> {
  if (!key || !HASH_SALT) return null
  const bytes = new TextEncoder().encode(`${HASH_SALT}|${key}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------- helpers ----------
const asNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

/** money may be a number or { amount, currency } */
function money(v: unknown): { amount: number | null; currency: string | null } {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return {
      amount: asNum(o.amount ?? o.value ?? o.total),
      currency: typeof o.currency === 'string' ? o.currency : null,
    }
  }
  return { amount: asNum(v), currency: null }
}

const ts = (v: unknown): string | null => (typeof v === 'string' && v.length >= 8 ? v : null)

type FlatItem = {
  item_id: string | null
  item_name: string | null
  item_type: string | null
  quantity: number | null
  unit_price_amount: number | null
  currency: string | null
  parent_item_id: string | null
  depth: number
  raw: unknown
}

function flattenItems(items: unknown, currencyFallback: string | null): FlatItem[] {
  const out: FlatItem[] = []

  const push = (node: Record<string, unknown>, depth: number, parentId: string | null, type: string) => {
    const m = money(node.unit_price ?? node.price ?? node.unit_amount ?? node.amount)
    const id = (node.id ?? node.item_id ?? node.product_id ?? null) as string | null
    out.push({
      item_id: id ? String(id) : null,
      item_name:
        (typeof node.name === 'string' && node.name) ||
        (typeof node.product_name === 'string' && node.product_name) ||
        (typeof node.label === 'string' && node.label) ||
        null,
      item_type: (typeof node.type === 'string' ? node.type : null) ?? type,
      quantity: asNum(node.quantity ?? node.qty) ?? null,
      unit_price_amount: m.amount,
      currency: m.currency ?? currencyFallback,
      parent_item_id: parentId,
      depth,
      raw: scrubDeep(node),
    })

    const childKeysD1 = ['products', 'sub_products', 'bundle_items', 'menu_items', 'children']
    const childKeysD2 = ['options', 'modifiers', 'option_groups', 'modifier_groups', 'extras']

    // Chataigne bundles: `lines` are group wrappers holding the real sub-products in `items`
    if (Array.isArray(node.lines)) {
      for (const line of node.lines as unknown[]) {
        if (!line || typeof line !== 'object') continue
        const ln = line as Record<string, unknown>
        if (Array.isArray(ln.items)) {
          for (const c of ln.items as unknown[]) {
            if (c && typeof c === 'object')
              push(c as Record<string, unknown>, Math.min(depth + 1, 2), id ? String(id) : parentId, 'sub_product')
          }
        } else {
          push(ln, Math.min(depth + 1, 2), id ? String(id) : parentId, 'sub_product')
        }
      }
    }
    for (const key of childKeysD1) {
      const arr = node[key]
      if (Array.isArray(arr)) {
        for (const c of arr) if (c && typeof c === 'object') push(c as Record<string, unknown>, Math.min(depth + 1, 2), id ? String(id) : parentId, 'sub_product')
      }
    }
    for (const key of childKeysD2) {
      const arr = node[key]
      if (Array.isArray(arr)) {
        for (const g of arr) {
          if (!g || typeof g !== 'object') continue
          const gg = g as Record<string, unknown>
          // group wrapper (contains nested options) vs direct option
          const nested = ['options', 'modifiers', 'items', 'values'].find((k) => Array.isArray(gg[k]))
          if (nested) {
            for (const o of gg[nested] as unknown[]) {
              if (o && typeof o === 'object') push(o as Record<string, unknown>, 2, id ? String(id) : parentId, 'option')
            }
          } else {
            push(gg, 2, id ? String(id) : parentId, 'option')
          }
        }
      }
    }
  }

  if (Array.isArray(items)) {
    for (const it of items) if (it && typeof it === 'object') push(it as Record<string, unknown>, 0, null, 'item')
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) return json({ ok: false, reason: 'missing_key' }, 200)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const mode: 'test' | 'backfill' | 'incremental' =
    body?.mode === 'test' || body?.mode === 'backfill' ? body.mode : 'incremental'
  const days = Number.isFinite(body?.days)
    ? Math.max(1, Math.floor(body.days))
    : mode === 'backfill'
      ? 90
      : 3
  const locationFilter: string | null =
    typeof body?.location_id === 'string' && body.location_id.trim() ? body.location_id.trim() : null
  // optional batching over the mapping list (keeps long backfills under the exec limit)
  const offset = Number.isFinite(body?.offset) ? Math.max(0, Math.floor(body.offset)) : 0
  const batchLimit = Number.isFinite(body?.limit) ? Math.max(1, Math.floor(body.limit)) : null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  const t0 = Date.now()
  const startedAt = new Date()

  const { data: runRow } = await supabase
    .from('chataigne_sync_runs')
    .insert({
      chain_id: CHAIN_ID,
      status: 'running',
      period_from: from.toISOString(),
      period_to: to.toISOString(),
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single()
  const runId = runRow?.id ?? null

  const finish = async (status: string, locations: number, rows: number, err: string | null) => {
    if (!runId) return
    await supabase
      .from('chataigne_sync_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        locations_synced: locations,
        rows_upserted: rows,
        error_message: err,
      })
      .eq('id', runId)
  }

  const headers = { 'x-api-key': key.trim(), Accept: 'application/json' }
  const call = async (path: string) => {
    const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${path.split('?')[0]}`)
    return await r.json()
  }

  try {
    let q = supabase
      .from('chataigne_location_mapping')
      .select('chataigne_location_id, restaurant_id, chain_id, currency')
      .order('chataigne_location_id', { ascending: true })
    if (locationFilter) q = q.eq('chataigne_location_id', locationFilter)
    else if (batchLimit) q = q.range(offset, offset + batchLimit - 1)
    else if (offset) q = q.range(offset, offset + 9999)
    const { data: mappings, error: mErr } = await q
    if (mErr) throw mErr

    // Does the endpoint accept from/to filters? probe once.
    let dateFilterSupported = false
    if ((mappings ?? []).length > 0) {
      const probeLoc = mappings![0].chataigne_location_id
      try {
        await call(
          `/v1/locations/${probeLoc}/orders?limit=1&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        )
        dateFilterSupported = true
      } catch {
        dateFilterSupported = false
      }
    }

    let processed = 0
    let failed = 0
    let ordersUpserted = 0
    let itemRowsInserted = 0
    const errors: { location: string; error: string }[] = []

    for (const m of mappings ?? []) {
      const locId = m.chataigne_location_id as string
      try {
        let cursor: string | null = null
        let stop = false
        let pages = 0

        while (!stop && pages < 100) {
          pages++
          const qs = new URLSearchParams({ limit: '50' })
          if (cursor) qs.set('starting_after', cursor)
          if (dateFilterSupported) {
            qs.set('from', from.toISOString())
            qs.set('to', to.toISOString())
          }
          const page: any = await call(`/v1/locations/${locId}/orders?${qs.toString()}`)
          const arr: any[] = Array.isArray(page)
            ? page
            : Array.isArray(page?.data)
              ? page.data
              : Array.isArray(page?.orders)
                ? page.orders
                : Array.isArray(page?.results)
                  ? page.results
                  : []
          if (arr.length === 0) break

          for (const listOrder of arr) {
            const createdAt = ts(listOrder?.created_at ?? listOrder?.createdAt)
            if (createdAt && new Date(createdAt).getTime() < from.getTime()) {
              stop = true
              continue
            }

            let full: Record<string, unknown> = listOrder
            if (!Array.isArray(listOrder?.items) || listOrder.items.length === 0) {
              const oid = listOrder?.id ?? listOrder?.order_id
              if (oid) {
                try {
                  const detail: any = await call(`/v1/locations/${locId}/orders/${oid}`)
                  full = (detail?.data && typeof detail.data === 'object' ? detail.data : detail) ?? listOrder
                } catch (_) {
                  /* keep list version */
                }
              }
            }

            const orderId = String(full?.id ?? full?.order_id ?? '')
            if (!orderId) continue

            const { scrubbed, hasCustomer, customerLanguage } = scrubOrder(full)

            const total = money(full?.total ?? full?.total_amount ?? full?.amount)
            const currency =
              total.currency ??
              (typeof full?.currency === 'string' ? (full.currency as string) : null) ??
              (m.currency as string | null) ??
              null

            const payment = (full?.payment ?? {}) as Record<string, unknown>
            const pay = money(payment?.amount ?? payment?.total ?? full?.payment_amount)

            const charges: any[] = Array.isArray(full?.charges)
              ? (full.charges as any[])
              : Array.isArray((full as any)?.fees)
                ? ((full as any).fees as any[])
                : []
            const serviceCharge = charges
              .filter((c) => String(c?.type ?? c?.name ?? '').toLowerCase().includes('service'))
              .reduce((s, c) => s + (money(c?.amount ?? c).amount ?? 0), 0)

            const rawDiscounts: any[] = Array.isArray(full?.discounts) ? (full.discounts as any[]) : []
            const discounts = rawDiscounts.map((d) => ({
              name: typeof d?.name === 'string' ? d.name : (d?.code ?? null),
              amount: money(d?.amount ?? d?.value ?? d).amount,
            }))
            const discountTotal = discounts.reduce((s, d) => s + (d.amount ?? 0), 0)

            const items = flattenItems(full?.items, currency)

            const fulfillment = (full?.fulfillment ?? {}) as Record<string, unknown>

            const orderRow = {
              chataigne_order_id: orderId,
              short_id: (full?.short_id ?? full?.reference ?? null) as string | null,
              chain_id: (m.chain_id as string) ?? CHAIN_ID,
              restaurant_id: m.restaurant_id,
              chataigne_location_id: locId,
              channel: (full?.channel ?? null) as string | null,
              service_type: (full?.service_type ?? fulfillment?.type ?? null) as string | null,
              status: (full?.status ?? null) as string | null,
              status_version: asNum(full?.status_version),
              order_datetime: createdAt ?? ts(full?.created_at),
              source_updated_at: ts(full?.updated_at),
              expected_pickup_time: ts(fulfillment?.expected_pickup_time ?? full?.expected_pickup_time),
              expected_delivery_time: ts(
                fulfillment?.expected_delivery_time ?? full?.expected_delivery_time,
              ),
              customer_language: customerLanguage,
              has_customer: hasCustomer,
              total_amount: total.amount,
              currency,
              payment_status: (payment?.status ?? full?.payment_status ?? null) as string | null,
              payment_amount: pay.amount,
              service_charge_amount: serviceCharge || null,
              discount_total_amount: discountTotal || null,
              discounts: discounts.length ? discounts : null,
              item_count: Array.isArray(full?.items) ? (full.items as unknown[]).length : null,
              raw_payload: scrubbed,
              updated_at: new Date().toISOString(),
            }

            const { error: oErr } = await supabase
              .from('chataigne_orders')
              .upsert(orderRow, { onConflict: 'chataigne_order_id' })
            if (oErr) throw oErr
            ordersUpserted++

            await supabase.from('chataigne_order_items').delete().eq('chataigne_order_id', orderId)

            if (items.length) {
              const rows = items.map((it) => ({
                chataigne_order_id: orderId,
                chain_id: (m.chain_id as string) ?? CHAIN_ID,
                restaurant_id: m.restaurant_id,
                chataigne_location_id: locId,
                order_datetime: orderRow.order_datetime,
                item_id: it.item_id,
                item_name: it.item_name,
                item_type: it.item_type,
                quantity: it.quantity === null ? null : Math.round(it.quantity),
                unit_price_amount: it.unit_price_amount,
                currency: it.currency,
                parent_item_id: it.parent_item_id,
                depth: it.depth,
                raw: it.raw,
              }))
              for (let i = 0; i < rows.length; i += 500) {
                const chunk = rows.slice(i, i + 500)
                const { error: iErr } = await supabase.from('chataigne_order_items').insert(chunk)
                if (iErr) throw iErr
                itemRowsInserted += chunk.length
              }
            }
          }

          const last = arr[arr.length - 1]
          cursor = (last?.id ?? last?.order_id ?? null) as string | null
          const hasMore = page?.has_more === true || (Array.isArray(page) && arr.length === 50)
          if (!hasMore || !cursor) break
        }

        processed++
      } catch (e) {
        failed++
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`chataigne-sync-orders location ${locId} failed: ${msg}`)
        errors.push({ location: locId, error: msg })
      }
      await sleep(150)
    }

    const total = (mappings ?? []).length
    const status = total > 0 && processed === 0 ? 'failed' : 'done'
    await finish(status, processed, ordersUpserted, failed ? `${failed} location(s) en erreur` : null)

    return json({
      ok: status === 'done',
      mode,
      days,
      date_filter_supported: dateFilterSupported,
      period: { from: from.toISOString(), to: to.toISOString() },
      locations_total: total,
      locations_processed: processed,
      locations_failed: failed,
      orders_upserted: ordersUpserted,
      item_rows_inserted: itemRowsInserted,
      errors: errors.slice(0, 20),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('chataigne-sync-orders failed:', msg)
    await finish('failed', 0, 0, msg)
    return json({ ok: false, error: msg }, 500)
  }
})
