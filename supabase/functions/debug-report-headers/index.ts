// Temporary diagnostic: download a stored Uber report CSV and inspect headers + "other payments" breakdown.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

// Split full CSV text into records, honoring quoted fields that contain newlines
const splitRecords = (text: string): string[] => {
  const records: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQ = !inQ; cur += c; continue; }
    if (c === '\n' && !inQ) { records.push(cur.replace(/\r$/, '')); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim().length) records.push(cur.replace(/\r$/, ''));
  return records;
};

const norm = (s: string) =>
  (s ?? '')
    .replace(/\u2019/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const toNum = (v: string): number => {
  if (!v) return 0;
  const cleaned = v.replace(/\u00a0/g, '').replace(/\s/g, '').replace(/[€]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const workflowId: string = body.workflow_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: report, error } = await supabase
      .from('reports')
      .select('id, status, sections, created_at')
      .eq('workflow_id', workflowId)
      .maybeSingle();

    if (error) throw error;
    if (!report) return new Response(JSON.stringify({ found: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (report.status !== 'completed') {
      return new Response(JSON.stringify({ found: true, status: report.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = (report.sections as any[])[0]?.download_url;
    const resp = await fetch(url);
    const text = await resp.text();
    const records = splitRecords(text);

    // The Uber 2026 format has 2 header rows; real keys live on the row with the most non-empty cells among the first 2
    const r0 = parseCsvLine(records[0] ?? '');
    const r1 = parseCsvLine(records[1] ?? '');
    const count0 = r0.filter((c) => c.trim()).length;
    const count1 = r1.filter((c) => c.trim()).length;
    const headerIdx = count1 > count0 ? 1 : 0;
    const headers = headerIdx === 1 ? r1 : r0;

    const idxOf = (...names: string[]) => {
      const wanted = names.map(norm);
      return headers.findIndex((h) => wanted.includes(norm(h)));
    };
    const idxContains = (...frags: string[]) =>
      headers.findIndex((h) => frags.every((f) => norm(h).includes(norm(f))));

    const iDesc = idxOf('Description des autres paiements');
    let iAmt = idxOf('Autres paiements (TVA incluse)', 'Autres paiements (TVA incluses)');
    if (iAmt < 0) iAmt = idxContains('autres paiements', 'tva incluse');
    const iAmtHt = idxContains('autres paiements', 'hors tva');
    const iMarketing = headers.findIndex((h) => norm(h).includes('marketing'));
    const iOrderId = idxContains('numéro de commande');

    // Neighbour columns to sample (fees / marketing) for the example row
    const neighbourIdx: number[] = [];
    headers.forEach((h, i) => {
      const n = norm(h);
      if (
        n.includes('marketing') ||
        n.includes('frais de service') ||
        n.includes('mise en relation') ||
        n.includes('marketplace') ||
        n.includes('autres paiements') ||
        n.includes('description des autres') ||
        n.includes('facturation rétroactive') ||
        n.includes('facturation retroactive') ||
        n.includes('id. du restaurant') ||
        n.includes('date de versement') ||
        n.includes('numéro de commande')
      ) neighbourIdx.push(i);
    });

    type Agg = { description: string; rows: number; sum_incl_vat: number; sum_excl_vat: number; sample: Record<string, string> };
    const groups = new Map<string, Agg>();
    let dataRows = 0;

    for (let i = headerIdx + 1; i < records.length; i++) {
      const row = parseCsvLine(records[i]);
      if (row.length < 3) continue;
      dataRows++;
      const desc = (row[iDesc] ?? '').trim();
      const amt = iAmt >= 0 ? toNum(row[iAmt] ?? '') : 0;
      const amtHt = iAmtHt >= 0 ? toNum(row[iAmtHt] ?? '') : 0;
      if (!desc && amt === 0) continue;
      const key = desc || '(vide)';
      let g = groups.get(key);
      if (!g) {
        const sample: Record<string, string> = {};
        for (const ni of neighbourIdx) sample[headers[ni]] = row[ni] ?? '';
        g = { description: key, rows: 0, sum_incl_vat: 0, sum_excl_vat: 0, sample };
        groups.set(key, g);
      }
      g.rows++;
      g.sum_incl_vat += amt;
      g.sum_excl_vat += amtHt;
    }

    const breakdown = [...groups.values()]
      .map((g) => ({ ...g, sum_incl_vat: Math.round(g.sum_incl_vat * 100) / 100, sum_excl_vat: Math.round(g.sum_excl_vat * 100) / 100 }))
      .sort((a, b) => b.rows - a.rows);

    return new Response(
      JSON.stringify({
        http_status: resp.status,
        total_records: records.length,
        data_rows: dataRows,
        header_row_index: headerIdx,
        header_count: headers.length,
        column_indices: { desc: iDesc, other_incl_vat: iAmt, other_excl_vat: iAmtHt, marketing: iMarketing, order_id: iOrderId },
        marketing_header: iMarketing >= 0 ? headers[iMarketing] : null,
        other_payments_breakdown: breakdown,
        headers,
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
