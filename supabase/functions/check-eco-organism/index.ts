import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { requireCaller } from '../_shared/requireCaller.ts';
import { cleanIdentifier, filterCompanyRows, uniqueNetworkSiren, type RestaurantIdentifier } from './sirenFallback.ts';

const bodySchema = z.object({ siret: z.string().transform(cleanIdentifier).pipe(z.string().regex(/^\d{9}(\d{5})?$/)), restaurant_id: z.string().uuid().optional() });

async function companyRows(dataset: string, field: string, identifier: string, prefix = false) {
  const rows: Record<string, unknown>[] = [];
  for (let skip = 0; ; skip += 100) {
    const url = `https://data.ademe.fr/data-fair/api/v1/datasets/${dataset}/lines?q_fields=${field}&q=${encodeURIComponent(prefix ? `${identifier}*` : identifier)}&size=100&skip=${skip}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Erreur API ADEME (${dataset}): ${response.status}`);
    const data = await response.json();
    const page: Record<string, unknown>[] = data.results || [];
    rows.push(...filterCompanyRows(page, field, identifier, prefix));
    if (page.length < 100 || skip + 100 >= data.total) break;
  }
  return rows;
}

async function lookup(identifier: string, prefix = false) {
  return Promise.all([
    companyRows('rep-adherents-eo-fin-annee', 'identifiant_societe', identifier, prefix),
    companyRows('rep-producteurs-idu', 'Identifiant_societe', identifier, prefix),
  ]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const denied = await requireCaller(req);
    if (denied) return denied;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'SIRET invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { siret: cleanSiret, restaurant_id } = parsed.data;
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) throw new Error('Configuration indisponible');
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    let authorizedQuery = caller.from('restaurants').select('id,siret,siren');
    authorizedQuery = restaurant_id ? authorizedQuery.eq('id', restaurant_id) : authorizedQuery.eq('siret', cleanSiret);
    const { data: accessible, error: accessError } = await authorizedQuery;
    if (accessError || !accessible?.some(r => cleanIdentifier(r.siret) === cleanSiret || (cleanSiret.length === 9 && cleanIdentifier(r.siren) === cleanSiret))) {
      return new Response(JSON.stringify({ error: 'Restaurant non accessible' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let [adherents, idus] = await lookup(cleanSiret);
    let matchMethod = 'siret';
    if (adherents.length === 0 && idus.length === 0) {
      const admin = createClient(url, serviceKey);
      const active: RestaurantIdentifier[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await admin.from('restaurants').select('id,siret,siren').eq('is_active', true).order('id').range(offset, offset + 999);
        if (error) throw error;
        active.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      if (uniqueNetworkSiren(cleanSiret, active)) {
        [adherents, idus] = await lookup(cleanSiret.slice(0, 9), true);
        matchMethod = 'siren';
      } else {
        matchMethod = 'siren_blocked';
      }
    }
    const results = adherents.map((r: Record<string, unknown>) => ({
      identifiant_societe: r.identifiant_societe,
      raison_sociale: r.raison_sociale,
      filiere: r.filiere,
      raison_sociale_ecoorganisme: r.raison_sociale_ecoorganisme,
      categorie_agrement: r.categorie_agrement,
      date_debutvalidite_inscription: r.date_debutvalidite_inscription,
      date_finvalidite_inscription: r.date_finvalidite_inscription,
    }));

    // Parse IDU data
    const iduResults = idus.map((r: Record<string, unknown>) => ({
        identifiant_unique: r.Identifiant_unique,
        immatriculation: r.Immatriculation,
        filiere: r.Filiere,
        identifiant_societe: r.Identifiant_societe,
        raison_sociale: r.Raison_Sociale,
        categories_agrement: r.Categories_agrement,
        pays: r.Pays,
      }));

    return new Response(
      JSON.stringify({ siret: cleanSiret, match_method: matchMethod, count: results.length, results, idu_count: iduResults.length, idu_results: iduResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur contrôle ADEME' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
