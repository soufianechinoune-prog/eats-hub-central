// Parser FR du ORDER_ERRORS_TRANSACTION_REPORT Uber (CSV API en français).
// Écrit dans order_errors. Colonnes Uber FR :
// Restaurant, Id. externe du restaurant, Pays, Code pays, Ville,
// UUID du processus, Id. de la commande, UUID de la commande,
// Heure de la commande, Heure d'acceptation par le marchand, Heure du remboursement,
// Problème avec la commande, Articles incorrects, Code de devise, Montant moyen des commandes,
// Client remboursé, Remboursement pris en charge par le commerçant, Remboursement non pris en charge par le commerçant,
// Type de commande honorée, Canal de commande, Marque Eats

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += c;
  }
  result.push(current.trim());
  return result;
}

function parseNum(v: string): number | null {
  if (!v || v.trim() === '') return null;
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseDateTime(s: string): string | null {
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+00:00`;
}

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { csvContent, restaurantId, dryRun = false } = await req.json();

    if (!csvContent) throw new Error('csvContent required');

    console.log(`[parse-order-errors-fr] dryRun=${dryRun}, restaurantId=${restaurantId || 'none'}`);

    const { data: restaurants } = await supabase.from('restaurants').select('id, name');
    const byName = new Map<string, string>();
    for (const r of restaurants || []) byName.set(normalizeName(r.name), r.id);
    const { data: aliases } = await supabase.from('restaurant_name_aliases').select('normalized_name, restaurant_id');
    for (const a of aliases || []) byName.set(a.normalized_name, a.restaurant_id);

    const lines = csvContent.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      return new Response(JSON.stringify({ success: true, parsed: 0, inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    const idx = (name: string) => headers.indexOf(name.toLowerCase());

    const cRest = idx('restaurant');
    const cUuid = idx('uuid de la commande');
    const cOrderId = idx('id. de la commande');
    const cOrderTime = idx('heure de la commande');
    const cRefundTime = idx("heure du remboursement");
    const cProblem = idx('problème avec la commande');
    const cItems = idx('articles incorrects');
    const cAmount = idx('montant moyen des commandes');
    const cRefundCust = idx('client remboursé');
    const cChannel = idx('canal de commande');

    if (cUuid < 0 || cProblem < 0) {
      throw new Error(`Missing FR columns. Got: ${headers.join(' | ')}`);
    }

    const records: any[] = [];
    const unmatched = new Set<string>();
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < headers.length - 2) continue;

      let rid = restaurantId;
      if (!rid) {
        const name = row[cRest];
        rid = byName.get(normalizeName(name));
        if (!rid) { unmatched.add(name); skipped++; continue; }
      }

      const uberOrderId = row[cUuid] || row[cOrderId];
      if (!uberOrderId) { skipped++; continue; }

      records.push({
        restaurant_id: rid,
        uber_order_id: uberOrderId,
        error_type: 'TRANSACTION_ERROR',
        error_category: row[cProblem] || null,
        item_title: row[cItems] || '',
        error_description: row[cProblem] || null,
        financial_impact: parseNum(row[cRefundCust]),
        order_amount: parseNum(row[cAmount]),
        error_date: parseDateTime(row[cOrderTime]),
        refund_datetime: parseDateTime(row[cRefundTime]),
        order_channel: row[cChannel] || null,
      });
    }

    // Dedup on (restaurant_id, uber_order_id, item_title) — matches order_errors_dedup_idx
    const uniq = new Map<string, any>();
    for (const r of records) uniq.set(`${r.restaurant_id}|${r.uber_order_id}|${r.item_title}`, r);
    const dedup = Array.from(uniq.values());

    let inserted = 0;
    let errors = 0;
    if (!dryRun && dedup.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < dedup.length; i += batchSize) {
        const batch = dedup.slice(i, i + batchSize);
        const { error } = await supabase
          .from('order_errors')
          .upsert(batch, { onConflict: 'restaurant_id,uber_order_id,item_title' });
        if (error) {
          console.error('Upsert error:', error);
          errors += batch.length;
        } else {
          inserted += batch.length;
        }
        if (i + batchSize < dedup.length) await new Promise((r) => setTimeout(r, 200));
      }
    } else if (dryRun) inserted = dedup.length;

    console.log(`[parse-order-errors-fr] parsed=${records.length} dedup=${dedup.length} inserted=${inserted} skipped=${skipped} errors=${errors} unmatched=${unmatched.size}`);

    return new Response(
      JSON.stringify({ success: true, parsed: records.length, inserted, skipped, errors, unmatched: Array.from(unmatched) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[parse-order-errors-fr] fatal:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
