// Parser FR du DOWNTIME_REPORT Uber (CSV API en français).
// Écrit dans hourly_availability (1 ligne par heure × restaurant).
// Colonnes Uber FR :
// Restaurant, Id. externe du restaurant, Pays, Code pays, Ville, Date,
// Ouverture du restaurant à, Disponibilité du menu, Restaurant en ligne, Restaurant hors ligne

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

function parseInt0(v: string): number {
  if (!v) return 0;
  const n = parseInt(v.replace(',', '.'), 10);
  return isNaN(n) ? 0 : n;
}

// "2026-01-06 00:00:00.000" → "2026-01-06T00:00:00+00:00"
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

    console.log(`[parse-downtime-fr] dryRun=${dryRun}, restaurantId=${restaurantId || 'none'}`);

    // Restaurant lookup
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

    const colRestaurant = idx('restaurant');
    const colHour = idx('ouverture du restaurant à');
    const colMenuAvail = idx('disponibilité du menu');
    const colOnline = idx('restaurant en ligne');
    const colOffline = idx('restaurant hors ligne');

    if (colHour < 0 || colMenuAvail < 0) {
      throw new Error(`Missing FR columns. Got: ${headers.join(' | ')}`);
    }

    const records: any[] = [];
    let unmatchedNames = new Set<string>();
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < headers.length - 2) continue;

      let rid = restaurantId;
      if (!rid) {
        const name = row[colRestaurant];
        rid = byName.get(normalizeName(name));
        if (!rid) {
          unmatchedNames.add(name);
          skipped++;
          continue;
        }
      }

      const hourStart = parseDateTime(row[colHour]);
      if (!hourStart) { skipped++; continue; }

      records.push({
        restaurant_id: rid,
        hour_start: hourStart,
        menu_availability_minutes: parseInt0(row[colMenuAvail]),
        online_minutes: parseInt0(row[colOnline]),
        offline_minutes: parseInt0(row[colOffline]),
        platform: 'uber_eats',
      });
    }

    // Dedup (restaurant_id + hour_start)
    const uniq = new Map<string, any>();
    for (const r of records) uniq.set(`${r.restaurant_id}|${r.hour_start}`, r);
    const dedup = Array.from(uniq.values());

    let inserted = 0;
    let errors = 0;
    if (!dryRun && dedup.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < dedup.length; i += batchSize) {
        const batch = dedup.slice(i, i + batchSize);
        const { error } = await supabase
          .from('hourly_availability')
          .upsert(batch, { onConflict: 'restaurant_id,hour_start,platform' });
        if (error) {
          console.error('Upsert error:', error);
          errors += batch.length;
        } else {
          inserted += batch.length;
        }
        if (i + batchSize < dedup.length) await new Promise((r) => setTimeout(r, 200));
      }
    } else if (dryRun) inserted = dedup.length;

    console.log(`[parse-downtime-fr] parsed=${records.length} dedup=${dedup.length} inserted=${inserted} skipped=${skipped} errors=${errors} unmatched=${unmatchedNames.size}`);
    if (unmatchedNames.size > 0) console.warn('Unmatched restaurants:', Array.from(unmatchedNames).slice(0, 10));

    return new Response(
      JSON.stringify({ success: true, parsed: records.length, inserted, skipped, errors, unmatched: Array.from(unmatchedNames) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[parse-downtime-fr] fatal:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
