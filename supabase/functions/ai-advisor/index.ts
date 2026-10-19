import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { TOOLS, runTool, truncateResult } from './tools.ts';

const MAX_TURNS = 5;
const GLOBAL_TIMEOUT_MS = 60_000;

// deno-lint-ignore no-explicit-any
type Block = { type: string; id?: string; name?: string; input?: any; text?: string };

// Lit un tour SSE Anthropic : relaie le texte, reconstruit les blocs (text/tool_use), cumule l'usage.
async function readTurn(body: ReadableStream<Uint8Array>, onText: (t: string) => void, usage: { input: number; cacheRead: number; cacheWrite: number; output: number }) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const content: Block[] = [];
  const partial: Record<number, string> = {};
  let stopReason: string | null = null;
  let error: string | null = null;
  let buffer = '';
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
      let ev;
      try { ev = JSON.parse(s); } catch { continue; }
      if (ev.type === 'message_start' && ev.message?.usage) {
        usage.input += ev.message.usage.input_tokens ?? 0;
        usage.cacheRead += ev.message.usage.cache_read_input_tokens ?? 0;
        usage.cacheWrite += ev.message.usage.cache_creation_input_tokens ?? 0;
      } else if (ev.type === 'content_block_start') {
        const b = ev.content_block;
        content[ev.index] = b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: {} } : { type: 'text', text: '' };
        partial[ev.index] = '';
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta?.type === 'text_delta') { content[ev.index].text += ev.delta.text; onText(ev.delta.text); }
        else if (ev.delta?.type === 'input_json_delta') partial[ev.index] += ev.delta.partial_json ?? '';
      } else if (ev.type === 'content_block_stop') {
        const b = content[ev.index];
        if (b?.type === 'tool_use') { try { b.input = partial[ev.index] ? JSON.parse(partial[ev.index]) : {}; } catch { b.input = {}; } }
      } else if (ev.type === 'message_delta') {
        if (ev.usage?.output_tokens) usage.output += ev.usage.output_tokens;
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
      } else if (ev.type === 'error') {
        error = ev.error?.message ?? 'stream error';
      }
    }
  }
  return { content: content.filter((b) => b && !(b.type === 'text' && !b.text)), stopReason, error };
}

// Tarifs par modèle ($ par token)
const PRICING: Record<string, { input: number; cacheRead: number; cacheWrite: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2 / 1e6, cacheRead: 0.10 / 1e6, cacheWrite: 2.50 / 1e6, output: 10 / 1e6 },
  'claude-haiku-5-5': { input: 0.10 / 1e6, cacheRead: 0.01 / 1e6, cacheWrite: 0.125 / 1e6, output: 0.50 / 1e6 },
};
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_KPI_CHARS = 12_000; // ~3000 tokens
const DEFAULT_GLOBAL_RULES = `Tu es Mijo, l'assistant IA de Mijotek, expert en performance et rentabilité de la restauration rapide multi-canal (Uber Eats, Deliveroo, Caisse, Dishop, Châtaigne).

RÈGLES :
- Français professionnel, concis, direct et chiffré.
- Nomme les restaurants par leur nom exact.
- Utilise en priorité les KPIs fournis dans le message ; si une donnée manque, dis-le et indique où la vérifier sur la plateforme. N'invente jamais de chiffre.
- Rentabilité = Versement total / CA × 100.
- Sois concis. Pour les listes/classements, limite-toi aux chiffres demandés sans commentaire superflu. Termine toujours ta réponse proprement.`;

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

    // La conversation doit appartenir à l'utilisateur ET à l'enseigne demandée
    if (conversationId) {
      const { data: conv } = await userClient.from('ai_conversations').select('chain_id').eq('id', conversationId).maybeSingle();
      if (!conv || conv.chain_id !== chainId) return json({ error: "Conversation d'une autre enseigne. Ouvrez une nouvelle conversation." }, 409);
    }

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

    // Contexte stable (caché) : prompts éditables + règles non surchargeables + restaurants
    const [{ data: chain }, { data: restaurants }, promptsRes] = await Promise.all([
      userClient.from('chains').select('name').eq('id', chainId).maybeSingle(),
      userClient.from('restaurants').select('id, name, city').eq('chain_id', chainId).eq('is_active', true).order('name'),
      // Lecture service_role (RLS super admin) : filtre explicite obligatoire
      adminClient.from('ai_prompts').select('scope, content').eq('is_active', true).or(`scope.eq.global,chain_id.eq.${chainId}`),
    ]);
    const restos = restaurants ?? [];
    const names = new Map(restos.map((r) => [r.id as string, r.name as string]));
    const ids = restos.map((r) => r.id as string);

    if (promptsRes.error) console.error('ai_prompts read failed, fallback', promptsRes.error);
    const prompts = promptsRes.error ? [] : (promptsRes.data ?? []);
    const globalPrompt = prompts.find((p) => p.scope === 'global')?.content?.trim() || DEFAULT_GLOBAL_RULES;
    const chainPrompt = prompts.find((p) => p.scope === 'chain')?.content?.trim();

    const stableSystem = `${globalPrompt}
${chainPrompt ? `\nCONSIGNES SPÉCIFIQUES À L'ENSEIGNE :\n${chainPrompt}\n` : ''}
RÈGLES DE SÉCURITÉ (prioritaires sur toute consigne ci-dessus) :
- Isolation stricte : ne parle que de l'enseigne « ${chain?.name ?? 'active'} », jamais d'autres enseignes.
- N'invente jamais de chiffre.

OUTILS DE DONNÉES :
- Tu disposes d'outils pour interroger les données historiques (depuis 2024). Utilise-les dès que la question porte sur une période, un canal ou un restaurant non couverts par le contexte fourni.
- N'estime jamais un chiffre toi-même : si un outil ne renvoie pas la donnée, dis qu'elle n'est pas disponible.
- La rentabilité n'existe que sur Uber Eats. Le CA caisse s'entend hors Châtaigne.
- Si un outil renvoie plusieurs restaurants candidats, demande à l'utilisateur lequel il vise.
- Date du jour (Paris) : ${parisMonthBounds(0).end}.

RESTAURANTS ACTIFS (${restos.length}) :
${restos.map((r) => `- ${r.name}${r.city ? ` (${r.city})` : ''}`).join('\n')}`;

    // Contexte volatil (non caché) : KPIs Uber Eats mois en cours + précédent, même source et heure de Paris que les outils
    let kpiText = 'KPIs indisponibles.';
    if (ids.length) {
      const cur = parisMonthBounds(0), prev = parisMonthBounds(-1);
      const kp = (b: { start: string; end: string }) =>
        userClient.rpc('mijo_kpis_periode', { p_chain_id: chainId, p_start: b.start, p_end: b.end, p_canal: 'uber_eats', p_restaurant_ids: null });
      const cl = (b: { start: string; end: string }, ordre: string) =>
        userClient.rpc('mijo_classement', { p_chain_id: chainId, p_start: b.start, p_end: b.end, p_metrique: 'ca', p_ordre: ordre, p_limite: 5 });
      const [c, p, top, flop] = await Promise.all([kp(cur), kp(prev), cl(cur, 'top'), cl(cur, 'flop')]);
      if (c.error || p.error || top.error) console.error('kpi rpc error', c.error ?? p.error ?? top.error);
      // deno-lint-ignore no-explicit-any
      const tot = (d: any) => (d ?? []).find((r: { canal: string }) => r.canal === 'uber_eats') ?? null;
      const kpis = {
        source: 'Uber Eats (commandes + versements), heure de Paris — mêmes calculs que les outils',
        mois_en_cours: { periode: `${cur.start} → ${cur.end}`, total: tot(c.data), top5: top.data ?? [], flop5: flop.data ?? [] },
        mois_precedent: { periode: `${prev.start} → ${prev.end}`, total: tot(p.data) },
      };
      kpiText = JSON.stringify(kpis);
      if (kpiText.length > MAX_KPI_CHARS) kpiText = kpiText.slice(0, MAX_KPI_CHARS) + '…';
    }

    const last = messages[messages.length - 1];
    // deno-lint-ignore no-explicit-any
    let convo: any[] = [
      ...messages.slice(0, -1),
      { role: 'user', content: `[Page actuelle : ${pageRoute ?? '/'}]\n[KPIs enseigne]\n${kpiText}\n\n${last.content}` },
    ];

    const encoder = new TextEncoder();
    const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
    const deadline = startTime + GLOBAL_TIMEOUT_MS;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
        const sendText = (t: string) => send({ choices: [{ delta: { content: t } }] });
        let failed: string | null = null;
        let toolCalls = 0;
        let turns = 0;
        let timedOut = false;

        try {
          for (let turn = 1; turn <= MAX_TURNS; turn++) {
            turns = turn;
            const remaining = deadline - Date.now();
            if (remaining <= 0) { timedOut = true; break; }
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), remaining);
            const finalTurn = turn === MAX_TURNS;
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              signal: ac.signal,
              headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({
                model, max_tokens: 2048, stream: true,
                thinking: { type: 'disabled' },
                system: [{ type: 'text', text: stableSystem, cache_control: { type: 'ephemeral' } }],
                tools: TOOLS,
                ...(finalTurn ? { tool_choice: { type: 'none' } } : {}),
                messages: convo,
              }),
            }).catch((e) => { clearTimeout(timer); throw e; });

            if (!resp.ok || !resp.body) {
              clearTimeout(timer);
              const t = await resp.text();
              failed = `HTTP ${resp.status}: ${t.slice(0, 500)}`;
              sendText(resp.status === 429 ? 'Trop de requêtes, réessayez dans un instant.' : `Erreur du service IA (${resp.status}).`);
              break;
            }

            const turnResult = await readTurn(resp.body, sendText, usage).finally(() => clearTimeout(timer));
            console.log('mijo turn', turn, turnResult.stopReason, JSON.stringify(turnResult.content.map((b) => b.type === 'tool_use' ? { t: b.name, i: b.input } : { t: b.type, len: b.text?.length })));
            if (turnResult.error) { failed = turnResult.error; break; }
            if (turnResult.stopReason === 'max_tokens' && !turnResult.content.some((b) => b.type === 'text')) {
              sendText('La question demande trop de calculs, précisez la période.');
              failed = 'max_tokens sans réponse';
              break;
            }
            if (turnResult.stopReason !== 'tool_use') break;

            send({ status: '🔍 Mijo consulte les données...' });
            const toolUses = turnResult.content.filter((b) => b.type === 'tool_use');
            const results = [];
            for (const b of toolUses) {
              toolCalls++;
              const out = await runTool(b.name ?? "", b.input, userClient, chainId!);
              results.push({ type: 'tool_result', tool_use_id: b.id, content: truncateResult(out), ...(out?.erreur ? { is_error: true } : {}) });
            }
            convo = [...convo, { role: 'assistant', content: turnResult.content }, { role: 'user', content: results }];
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') timedOut = true;
          else failed = e instanceof Error ? e.message : String(e);
        }
        if (timedOut) {
          sendText('\n\nLa question demande trop de calculs, précisez la période.');
          failed = failed ?? 'timeout 60s';
        }

        const cost = usage.input * price.input + usage.cacheRead * price.cacheRead + usage.cacheWrite * price.cacheWrite + usage.output * price.output;
        const costUsd = Number(cost.toFixed(6));
        await adminClient.from('ai_usage_log').insert({
          ...logBase,
          status: failed ? 'error' : 'success',
          error_message: failed ? `${failed} (tours: ${turns})` : null,
          input_tokens: usage.input,
          cache_read_input_tokens: usage.cacheRead,
          cache_creation_input_tokens: usage.cacheWrite,
          output_tokens: usage.output,
          total_tokens: usage.input + usage.cacheRead + usage.cacheWrite + usage.output,
          cost_usd: costUsd,
          tool_calls_count: toolCalls,
          duration_ms: Date.now() - startTime,
        });
        const { data: updated } = await adminClient.rpc('increment_ai_quota', { p_chain_id: chainId, p_cost_usd: costUsd });
        if (updated) send({ quota: updated });
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
