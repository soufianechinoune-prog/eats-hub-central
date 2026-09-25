import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE = 'https://server.chataigne.ai/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const key = Deno.env.get('CHATAIGNE_API_KEY_TASTY_CROUSTY')?.trim()
  const out: Record<string, unknown> = { key_present: !!key }
  if (key) {
    for (const p of ['/me', '/organizations', '/organization', '/locations', '/api-keys/me', '/whoami']) {
      try {
        const r = await fetch(`${BASE}${p}`, { headers: { 'x-api-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
        const t = (await r.text()).replaceAll(key, '***')
        out[p] = { status: r.status, body: t.slice(0, 1500) }
      } catch (e) { out[p] = { error: (e as Error).message } }
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
