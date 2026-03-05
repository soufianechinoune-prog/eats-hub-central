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
  error?: string;
};

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

    const response = await fetch(
      `https://api.recherche-entreprises.fabrique.social.gouv.fr/api/v1/etablissement/${clean}`,
      {
        headers: { "Accept": "application/json" },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({ valid: false } satisfies ValidationResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const details = await response.text();
      return new Response(
        JSON.stringify({
          valid: false,
          error: `API indisponible (${response.status})${details ? `: ${details.slice(0, 200)}` : ""}`,
        } satisfies ValidationResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const result: ValidationResponse = {
      valid: true,
      denomination: data?.simpleLabel || data?.label || "Entreprise",
      adresse: data?.address || undefined,
      etat:
        data?.etatAdministratifEtablissement === "A" || data?.etatAdministratifUniteLegale === "A"
          ? "Actif"
          : "Fermé",
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
