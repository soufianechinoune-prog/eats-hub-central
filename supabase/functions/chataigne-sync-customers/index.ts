import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://server.chataigne.ai/v1'

const BRANDS = {
  chicken_street: {
    orgId: 'busorg_fJF9DesU33',
    chainId: '110e05b8-5136-45cc-a385-265360104844',
    keyEnv: 'CHATAIGNE_API_KEY',
  },
  tasty_crousty: {
    orgId: 'busorg_gJbsiqEWr2',
    chainId: 'ce67f809-d017-41c5-8bd0-a98086cd3881',
    keyEnv: 'CHATAIGNE_API_KEY_TASTY_CROUSTY',
  },
} as const


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Pseudonymisation identique à chataigne-sync-orders : la clé brute reste en mémoire
const HASH_SALT = Deno.env.get('CHATAIGNE_HASH_SALT') ?? ''

async function hashClientKey(key: string | null): Promise<string | null> {
  if (!key || !HASH_SALT) return null
  const bytes = new TextEncoder().encode(`${HASH_SALT}|${key}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const ts = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const asInt = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null

function consentOf(c: Record<string, unknown>): { status: string | null; changed: string | null } {
  const mc = c.marketing_consent as Record<string, unknown> | null | undefined
  if (mc && typeof mc === 'object') {
    const s = typeof mc.status === 'string' ? mc.status.toLowerCase() : null
    return { status: s, changed: ts(mc.changed_at ?? mc.updated_at) }
  }
  if (typeof c.marketing_consent === 'boolean') {
    return { status: c.marketing_consent ? 'opted_in' : 'opted_out', changed: null }
  }
  if (typeof c.marketing_opt_in === 'boolean') {
    return { status: c.marketing_opt_in ? 'opted_in' : 'opted_out', changed: null }
  }
  return { status: null, changed: null }
}

/** Commandes embarquées d'un client (aucune PII lue) */
function embeddedOrders(c: Record<string, unknown>): { shortId: string | null; createdAt: string | null }[] {
  const o = c.orders as unknown
  const arr: unknown[] = Array.isArray(o)
    ? o
    : o && typeof o === 'object' && Array.isArray((o as Record<string, unknown>).data)
      ? ((o as Record<string, unknown>).data as unknown[])
      : []
  return arr.map((x) => {
    const r = (x ?? {}) as Record<string, unknown>
    return {
      shortId: typeof r.short_id === 'string' && r.short_id.trim() ? r.short_id.trim() : null,
      createdAt: ts(r.created_at),
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('CHATAIGNE_API_KEY')
  if (!key) return json({ ok: false, reason: 'missing_key' }, 200)
  if (!HASH_SALT) return json({ ok: false, reason: 'missing_hash_salt' }, 200)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const maxPages = Number.isFinite(body?.max_pages as number)
    ? Math.max(1, Math.floor(body.max_pages as number))
    : 300
  const startAfter = typeof body?.starting_after === 'string' ? (body.starting_after as string) : null
  // pages parcourues sans écriture, pour reprendre un import interrompu sans stocker de curseur
  const skipPages = Number.isFinite(body?.skip_pages as number)
    ? Math.max(0, Math.floor(body.skip_pages as number))
    : 0

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const t0 = Date.now()
  const headers = { 'x-api-key': key.trim(), Accept: 'application/json' }

  try {
    let cursor: string | null = startAfter
    let pages = 0
    let fetched = 0
    let upserted = 0
    let skippedNoId = 0
    const consentCounts: Record<string, number> = { opted_in: 0, opted_out: 0, inconnu: 0 }

    while (pages < maxPages) {
      pages++
      const qs = new URLSearchParams({ limit: '100', include: 'orders', min_completed_orders: '1' })
      if (cursor) qs.set('starting_after', cursor)

      const res = await fetch(`${BASE}/organizations/${ORG_ID}/customers?${qs.toString()}`, {
        headers,
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} page ${pages}`)
      const page = (await res.json()) as Record<string, unknown>

      const arr: Record<string, unknown>[] = Array.isArray(page)
        ? (page as unknown as Record<string, unknown>[])
        : Array.isArray(page?.data)
          ? (page.data as Record<string, unknown>[])
          : []
      if (arr.length === 0) break

      if (pages <= skipPages) {
        const lastSkipped = arr[arr.length - 1]
        cursor = (lastSkipped?.id as string | undefined) ?? null
        if (page?.has_more !== true || !cursor) {
          cursor = null
          break
        }
        continue
      }

      fetched += arr.length

      // Rattachement au code_client déjà pseudonymisé dans chataigne_orders :
      // l'API org expose un id client différent de celui des commandes, on relie
      // donc via (short_id, date de commande) des commandes embarquées.
      const shortIds = new Set<string>()
      for (const c of arr) {
        for (const o of embeddedOrders(c)) {
          if (o.shortId) shortIds.add(o.shortId)
        }
      }
      const matchMap = new Map<string, { code: string; t: number }[]>()
      if (shortIds.size > 0) {
        const { data: ordRows, error: ordErr } = await supabase
          .from('chataigne_orders')
          .select('short_id, code_client, order_datetime')
          .in('short_id', [...shortIds])
          .not('code_client', 'is', null)
        if (ordErr) throw ordErr
        for (const r of ordRows ?? []) {
          const sid = String((r as Record<string, unknown>).short_id ?? '')
          if (!sid) continue
          const list = matchMap.get(sid) ?? []
          list.push({
            code: String((r as Record<string, unknown>).code_client),
            t: new Date(String((r as Record<string, unknown>).order_datetime)).getTime(),
          })
          matchMap.set(sid, list)
        }
      }

      const rows: Record<string, unknown>[] = []
      for (const c of arr) {
        let codeClient: string | null = null
        for (const o of embeddedOrders(c)) {
          const candidates = o.shortId ? matchMap.get(o.shortId) : undefined
          if (!candidates || candidates.length === 0) continue
          if (candidates.length === 1) {
            codeClient = candidates[0].code
            break
          }
          const target = o.createdAt ? new Date(o.createdAt).getTime() : NaN
          const best = Number.isNaN(target)
            ? candidates[0]
            : candidates.reduce((a, b) => (Math.abs(a.t - target) <= Math.abs(b.t - target) ? a : b))
          codeClient = best.code
          break
        }
        if (!codeClient) {
          skippedNoId++
          continue
        }
        const { status, changed } = consentOf(c)
        consentCounts[status === 'opted_in' || status === 'opted_out' ? status : 'inconnu']++

        rows.push({
          code_client: codeClient,
          chain_id: CHAIN_ID,
          marketing_consent_status: status,
          marketing_consent_changed_at: changed,
          completed_orders_count: asInt(c.completed_orders_count ?? c.completed_orders),
          language: typeof c.language === 'string' ? c.language : null,
          source_created_at: ts(c.created_at),
          source_updated_at: ts(c.updated_at),
          synced_at: new Date().toISOString(),
        })
      }

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const { error } = await supabase
          .from('chataigne_customers')
          .upsert(chunk, { onConflict: 'code_client' })
        if (error) throw error
        upserted += chunk.length
      }

      const hasMore = page?.has_more === true
      const last = arr[arr.length - 1]
      cursor = (last?.id as string | undefined) ?? null
      if (!hasMore || !cursor) {
        cursor = null
        break
      }

      await sleep(120)
    }

    return json({
      ok: true,
      pages,
      customers_fetched: fetched,
      customers_upserted: upserted,
      skipped_without_id: skippedNoId,
      consent: consentCounts,
      next_starting_after: cursor,
      duration_ms: Date.now() - t0,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('chataigne-sync-customers failed:', msg)
    return json({ ok: false, error: msg }, 500)
  }
})
