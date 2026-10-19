import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Tarifs par modèle ($ par token)
const PRICING: Record<string, { input: number; cacheRead: number; cacheWrite: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2 / 1e6, cacheRead: 0.10 / 1e6, cacheWrite: 2.50 / 1e6, output: 10 / 1e6 },
  'claude-haiku-5-5': { input: 0.10 / 1e6, cacheRead: 0.01 / 1e6, cacheWrite: 0.125 / 1e6, output: 0.50 / 1e6 },
};
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_KPI_CHARS = 12_000; // ~3000 tokens

interface Message { role: 'user' | 'assistant'; content: string }
interface ProfitRow { day: string; restaurant_id: string; sales: number; payout: number; net_payout: number; meal_voucher: number; item_promo_incl_vat: number; orders_count: number }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parisMonthBounds(offset: number) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: f(start), end: f(end) };
}

const r0 = (n: number) => Math.round(n);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

function summarize(rows: ProfitRow[], names: Map<string, string>) {
  const byResto = new Map<string, { ca: number; versement: number; commandes: number }>();
  let ca = 0, versement = 0, commandes = 0;
  for (const r of rows) {
    const s = Number(r.sales) || 0;
    const v = (Number(r.net_payout) || 0) + (Number(r.meal_voucher) || 0);
    const c = Number(r.orders_count) || 0;
    ca += s; versement += v; commandes += c;
    const cur = byResto.get(r.restaurant_id) ?? { ca: 0, versement: 0, commandes: 0 };
    cur.ca += s; cur.versement += v; cur.commandes += c;
    byResto.set(r.restaurant_id, cur);
  }
  const ranked = [...byResto.entries()]
    .filter(([, v]) => v.ca > 0)
    .map(([id, v]) => ({ restaurant: names.get(id) ?? id, ca: r0(v.ca), versement: r0(v.versement), rentabilite_pct: pct(v.versement, v.ca), commandes: v.commandes }))
    .sort((a, b) => b.ca - a.ca);
  return {
    total: { ca: r0(ca), versement: r0(versement), rentabilite_pct: pct(versement, ca), commandes },
    top5: ranked.slice(0, 5),
    flop5: ranked.length > 5 ? ranked.slice(-5).reverse() : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401);

    // userClient : auth.uid() réel pour droits + quota. adminClient : écritures d'audit uniquement.
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(url, serviceKey);

    const { data: { user }, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
    if (authError || !user) return json({ error: 'Session invalide ou expirée' }, 401);

    const body = await req.json().catch(() => null) as { messages?: Message[]; chainId?: string; pageContext?: string; conversationId?: string } | null;
    const messages = (body?.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-20);
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'Aucune question fournie' }, 400);
    const pageRoute = typeof body?.pageContext === 'string' ? body.pageContext.slice(0, 200) : null;
    const conversationId = body?.conversationId && UUID_RE.test(body.conversationId) ? body.conversationId : null;

    // Enseigne
    let chainId = body?.chainId && UUID_RE.test(body.chainId) ? body.chainId : null;
    if (!chainId) {
      const { data } = await userClient.from('user_chain_access').select('chain_id').eq('user_id', user.id).not('chain_id', 'is', null).limit(1).maybeSingle();
      chainId = data?.chain_id ?? null;
    }
    if (!chainId) return json({ error: 'Aucune enseigne accessible' }, 403);

    const [{ data: hasAccess }, { data: isSuperAdmin }] = await Promise.all([
      userClient.rpc('user_has_chain_access', { p_chain_id: chainId }),
      userClient.rpc('is_super_admin'),
    ]);
    if (!hasAccess && !isSuperAdmin) return json({ error: 'Accès non autorisé à cette enseigne' }, 403);

    // Quota — fail closed
    const { data: quota, error: quotaErr } = await userClient.rpc('get_or_create_monthly_ai_quota', { p_chain_id: chainId });
    if (quotaErr || !quota) {
      console.error('quota check failed', quotaErr);
      return json({ error: 'Impossible de vérifier le quota. Requête interrompue par sécurité.' }, 500);
    }
    const q = quota as { used_questions: number; monthly_limit_questions: number; is_exceeded: boolean; enabled?: boolean; model?: string };
    const model = q.model && q.model in PRICING ? q.model : DEFAULT_MODEL;
    const price = PRICING[model];
    const logBase = { chain_id: chainId, user_id: user.id, conversation_id: conversationId, model, page_route: pageRoute };
    if (q.enabled === false) {
      await adminClient.from('ai_usage_log').insert({ ...logBase, status: 'quota_exceeded', error_message: 'option_disabled', duration_ms: Date.now() - startTime });
      return json({ error: "L'option IA n'est pas activée pour votre compte. Contactez Mijotek.", code: 'option_disabled', quota: q }, 403);
    }
    if (q.is_exceeded) {
      await adminClient.from('ai_usage_log').insert({ ...logBase, status: 'quota_exceeded', duration_ms: Date.now() - startTime, error_message: `Quota atteint (${q.used_questions}/${q.monthly_limit_questions})` });
      return json({ error: `Quota mensuel atteint (${q.used_questions}/${q.monthly_limit_questions} questions).`, quota: q }, 429);
    }

    if (!anthropicKey) return json({ error: "Mijo n'est pas encore activé : clé Claude en attente de configuration." }, 503);

    // Contexte stable (caché) : restaurants de l'enseigne
    const [{ data: chain }, { data: restaurants }] = await Promise.all([
      userClient.from('chains').select('name').eq('id', chainId).maybeSingle(),
      userClient.from('restaurants').select('id, name, city').eq('chain_id', chainId).eq('is_active', true).order('name'),
    ]);
    const restos = restaurants ?? [];
    const names = new Map(restos.map((r) => [r.id as string, r.name as string]));
    const ids = restos.map((r) => r.id as string);

    const stableSystem = `Tu es Mijo, l'assistant IA de Mijotek, expert en performance et rentabilité de la restauration rapide multi-canal (Uber Eats, Deliveroo, Caisse, Dishop, Châtaigne).

RÈGLES :
- Français professionnel, concis, direct et chiffré.
- Isolation stricte : ne parle que de l'enseigne « ${chain?.name ?? 'active'} », jamais d'autres enseignes.
- Nomme les restaurants par leur nom exact.
- Utilise en priorité les KPIs fournis dans le message ; si une donnée manque, dis-le et indique où la vérifier sur la plateforme. N'invente jamais de chiffre.
- Rentabilité = Versement total / CA × 100.
- Sois concis. Pour les listes/classements, limite-toi aux chiffres demandés sans commentaire superflu. Termine toujours ta réponse proprement.

RESTAURANTS ACTIFS (${restos.length}) :
${restos.map((r) => `- ${r.name}${r.city ? ` (${r.city})` : ''}`).join('\n')}`;

    // Contexte volatil (non caché) : KPIs mois en cours + mois précédent
    let kpiText = 'KPIs indisponibles.';
    if (ids.length) {
      const cur = parisMonthBounds(0), prev = parisMonthBounds(-1);
      const [c, p] = await Promise.all([
        userClient.rpc('get_profitability_monthly', { p_start_date: cur.start, p_end_date: cur.end, p_restaurant_ids: ids }),
        userClient.rpc('get_profitability_monthly', { p_start_date: prev.start, p_end_date: prev.end, p_restaurant_ids: ids }),
      ]);
      if (c.error || p.error) console.error('kpi rpc error', c.error ?? p.error);
      const kpis = {
        source: 'Uber Eats (commandes + versements)',
        mois_en_cours: { periode: `${cur.start} → ${cur.end}`, ...summarize((c.data ?? []) as ProfitRow[], names) },
        mois_precedent: { periode: `${prev.start} → ${prev.end}`, total: summarize((p.data ?? []) as ProfitRow[], names).total },
      };
      kpiText = JSON.stringify(kpis);
      if (kpiText.length > MAX_KPI_CHARS) kpiText = kpiText.slice(0, MAX_KPI_CHARS) + '…';
    }

    // Page + KPIs injectés dans le dernier message utilisateur (hors cache)
    const last = messages[messages.length - 1];
    const apiMessages = [
      ...messages.slice(0, -1),
      { role: 'user' as const, content: `[Page actuelle : ${pageRoute ?? '/'}]\n[KPIs enseigne]\n${kpiText}\n\n${last.content}` },
    ];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        stream: true,
        system: [{ type: 'text', text: stableSystem, cache_control: { type: 'ephemeral' } }],
        messages: apiMessages,
      }),
    });

    if (!resp.ok || !resp.body) {
      const errText = await resp.text();
      console.error('Anthropic error', resp.status, errText);
      await adminClient.from('ai_usage_log').insert({ ...logBase, status: 'error', duration_ms: Date.now() - startTime, error_message: `HTTP ${resp.status}: ${errText.slice(0, 500)}` });
      return json({ error: resp.status === 429 ? 'Trop de requêtes, réessayez dans un instant.' : `Erreur du service IA (${resp.status})` }, resp.status === 429 ? 429 : 502);
    }

    const reader = resp.body.getReader();
const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let failed: string | null = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const s = line.slice(6).trim();
              if (!s) continue;
              try {
                const ev = JSON.parse(s);
                if (ev.type === 'message_start' && ev.message?.usage) {
                  usage.input = ev.message.usage.input_tokens ?? 0;
                  usage.cacheRead = ev.message.usage.cache_read_input_tokens ?? 0;
                  usage.cacheWrite = ev.message.usage.cache_creation_input_tokens ?? 0;
                } else if (ev.type === 'content_block_delta' && ev.delta?.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ev.delta.text } }] })}\n\n`));
                } else if (ev.type === 'message_delta' && ev.usage) {
                  usage.output = ev.usage.output_tokens ?? usage.output;
                } else if (ev.type === 'error') {
                  failed = ev.error?.message ?? 'stream error';
                }
              } catch { /* fragment */ }
            }
          }
        } catch (e) {
          failed = e instanceof Error ? e.message : String(e);
        }

        const cost = usage.input * price.input + usage.cacheRead * price.cacheRead + usage.cacheWrite * price.cacheWrite + usage.output * price.output;
        const costUsd = Number(cost.toFixed(6));
        await adminClient.from('ai_usage_log').insert({
          ...logBase,
          status: failed ? 'error' : 'success',
          error_message: failed,
          input_tokens: usage.input,
          cache_read_input_tokens: usage.cacheRead,
          cache_creation_input_tokens: usage.cacheWrite,
          output_tokens: usage.output,
          total_tokens: usage.input + usage.cacheRead + usage.cacheWrite + usage.output,
          cost_usd: costUsd,
          duration_ms: Date.now() - startTime,
        });
        const { data: updated } = await adminClient.rpc('increment_ai_quota', { p_chain_id: chainId, p_cost_usd: costUsd });
        if (updated) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ quota: updated })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream; charset=utf-8' } });
  } catch (error) {
    console.error('AI Advisor error', error);
    return json({ error: error instanceof Error ? error.message : 'Erreur interne' }, 500);
  }
});
