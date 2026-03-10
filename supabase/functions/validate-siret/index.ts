import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ValidationResponse = {
  valid: boolean;
  denomination?: string;
  adresse?: string;
  etat?: string;
  rue?: string;
  codePostal?: string;
  ville?: string;
  siren?: string;
  activite?: string;
  formeJuridique?: string;
  dateCreation?: string;
  dirigeant?: { prenom?: string; nom?: string } | null;
  error?: string;
};

/** Parse "1 RUE DES ECLUSES 57100 THIONVILLE" → { rue, cp, ville } */
function parseAddress(raw: string): { rue: string; cp: string; ville: string } {
  const match = raw.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
  if (match) {
    return { rue: match[1].trim(), cp: match[2], ville: match[3].trim() };
  }
  return { rue: raw, cp: "", ville: "" };
}

async function fetchDirigeant(siren: string): Promise<{ prenom?: string; nom?: string } | null> {
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&page=1&per_page=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const dirigeants = data?.results?.[0]?.dirigeants;
    console.log('Dirigeants raw:', JSON.stringify(dirigeants));
    if (Array.isArray(dirigeants) && dirigeants.length > 0) {
      const d = dirigeants[0];
      const prenom = d.prenoms || d.prenom || undefined;
      const nom = d.nom || undefined;
      console.log('Extracted dirigeant:', { prenom, nom });
      return { prenom, nom };
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { siret } = await req.json();
    const clean = (siret || "").replace(/\s/g, "").trim();

    if (!/^\d{14}$/.test(clean)) {
      return new Response(
        JSON.stringify({ valid: false, error: "Format invalide" } satisfies ValidationResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siren = clean.slice(0, 9);

    const [etablissementRes, dirigeant] = await Promise.all([
      fetch(
        `https://api.recherche-entreprises.fabrique.social.gouv.fr/api/v1/etablissement/${clean}`,
        { headers: { Accept: "application/json" } }
      ),
      fetchDirigeant(siren),
    ]);

    if (!etablissementRes.ok) {
      if (etablissementRes.status === 404) {
        return new Response(JSON.stringify({ valid: false } satisfies ValidationResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const details = await etablissementRes.text();
      return new Response(
        JSON.stringify({
          valid: false,
          error: `API indisponible (${etablissementRes.status})${details ? `: ${details.slice(0, 200)}` : ""}`,
        } satisfies ValidationResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await etablissementRes.json();
    const fullAddress = data?.address || "";
    const parsed = parseAddress(fullAddress);

    const result: ValidationResponse = {
      valid: true,
      denomination: data?.simpleLabel || data?.label || "Entreprise",
      adresse: fullAddress || undefined,
      etat:
        data?.etatAdministratifEtablissement === "A" || data?.etatAdministratifUniteLegale === "A"
          ? "Actif"
          : "Fermé",
      rue: parsed.rue || undefined,
      codePostal: parsed.cp || undefined,
      ville: parsed.ville || undefined,
      siren,
      activite: data?.activitePrincipale || undefined,
      formeJuridique: data?.categorieJuridiqueUniteLegale || undefined,
      dateCreation: data?.dateCreationUniteLegale || data?.dateCreation || undefined,
      dirigeant,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        valid: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      } satisfies ValidationResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
