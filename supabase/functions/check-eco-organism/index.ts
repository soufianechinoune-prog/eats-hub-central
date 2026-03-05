import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { siret } = await req.json();

    if (!siret || typeof siret !== 'string' || siret.trim().length < 9) {
      return new Response(
        JSON.stringify({ error: 'SIRET invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanSiret = siret.replace(/\s/g, '').trim();

    // Query both ADEME datasets in parallel
    const adherentsUrl = `https://data.ademe.fr/data-fair/api/v1/datasets/rep-adherents-eo-fin-annee/lines?q_fields=identifiant_societe&q=${encodeURIComponent(cleanSiret)}&size=100`;
    const iduUrl = `https://data.ademe.fr/data-fair/api/v1/datasets/rep-producteurs-idu/lines?q_fields=Identifiant_societe&q=${encodeURIComponent(cleanSiret)}&size=100`;

    const [adherentsResponse, iduResponse] = await Promise.all([
      fetch(adherentsUrl),
      fetch(iduUrl),
    ]);

    if (!adherentsResponse.ok) {
      const text = await adherentsResponse.text();
      console.error('ADEME adherents API error:', adherentsResponse.status, text);
      return new Response(
        JSON.stringify({ error: 'Erreur API ADEME (adhérents)', status: adherentsResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adherentsData = await adherentsResponse.json();
    const results = (adherentsData.results || []).map((r: Record<string, unknown>) => ({
      identifiant_societe: r.identifiant_societe,
      raison_sociale: r.raison_sociale,
      filiere: r.filiere,
      raison_sociale_ecoorganisme: r.raison_sociale_ecoorganisme,
      categorie_agrement: r.categorie_agrement,
      date_debutvalidite_inscription: r.date_debutvalidite_inscription,
      date_finvalidite_inscription: r.date_finvalidite_inscription,
    }));

    // Parse IDU data
    let iduResults: Array<Record<string, unknown>> = [];
    if (iduResponse.ok) {
      const iduData = await iduResponse.json();
      iduResults = (iduData.results || []).map((r: Record<string, unknown>) => ({
        identifiant_unique: r.Identifiant_unique,
        immatriculation: r.Immatriculation,
        filiere: r.Filiere,
        identifiant_societe: r.Identifiant_societe,
        raison_sociale: r.Raison_Sociale,
        categories_agrement: r.Categories_agrement,
        pays: r.Pays,
      }));
    } else {
      console.error('ADEME IDU API error:', iduResponse.status);
    }

    return new Response(
      JSON.stringify({ siret: cleanSiret, count: results.length, results, idu_count: iduResults.length, idu_results: iduResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
