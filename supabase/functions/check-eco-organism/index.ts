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

    const url = `https://data.ademe.fr/data-fair/api/v1/datasets/rep-adherents-eo-fin-annee/lines?q_fields=identifiant_societe&q=${encodeURIComponent(cleanSiret)}&size=100`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error('ADEME API error:', response.status, text);
      return new Response(
        JSON.stringify({ error: 'Erreur API ADEME', status: response.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const results = (data.results || []).map((r: Record<string, unknown>) => ({
      identifiant_societe: r.identifiant_societe,
      raison_sociale: r.raison_sociale,
      filiere: r.filiere,
      raison_sociale_ecoorganisme: r.raison_sociale_ecoorganisme,
      categorie_agrement: r.categorie_agrement,
      date_debutvalidite_inscription: r.date_debutvalidite_inscription,
      date_finvalidite_inscription: r.date_finvalidite_inscription,
    }));

    return new Response(
      JSON.stringify({ siret: cleanSiret, count: results.length, results }),
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
