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
    const clean = (siret || "").replace(/\s/g, "").trim();

    if (!/^\d{14}$/.test(clean)) {
      return new Response(JSON.stringify({ valid: false, error: "Format invalide" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(
      `https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/${clean}`
    );

    if (response.ok) {
      const data = await response.json();
      const etab = data.etablissement;
      const ul = etab?.unite_legale;

      return new Response(JSON.stringify({
        valid: true,
        denomination: ul?.denomination || `${ul?.prenom_1 || ""} ${ul?.nom || ""}`.trim() || "Entreprise",
        adresse: [etab?.numero_voie, etab?.type_voie, etab?.libelle_voie, etab?.code_postal, etab?.libelle_commune].filter(Boolean).join(" "),
        etat: etab?.etat_administratif === "A" ? "Actif" : "Fermé",
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
