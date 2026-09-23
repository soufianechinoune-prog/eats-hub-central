import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://server.chataigne.ai/v1'
const ORG_ID = 'busorg_fJF9DesU33'
const CHAIN_ID = '110e05b8-5136-45cc-a385-265360104844'

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
      const qs = new URLSearchParams({ limit: '100' })
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
      fetched += arr.length

      const rows: Record<string, unknown>[] = []
      for (const c of arr) {
        const rawId = c.id ?? c.customer_id ?? null
        if (rawId === null || rawId === undefined || String(rawId).trim() === '') {
          skippedNoId++
          continue
        }
        const codeClient = await hashClientKey(`id:${String(rawId).trim()}`)
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
      if (!hasMore || !cursor) break

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
