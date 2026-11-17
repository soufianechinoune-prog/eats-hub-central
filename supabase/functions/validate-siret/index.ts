import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { requireCaller } from "../_shared/requireCaller.ts";
import { mapCompanySearch, type Company } from "./companySearch.ts";

const BodySchema = z.object({
  siret: z.string().max(64).transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{14}$/, "14 chiffres attendus")),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const refusal = await requireCaller(req);
  if (refusal) return json({ valid: false, error: "Non autorisé" }, 401);
  if (req.method !== "POST") return json({ valid: false, error: "Méthode non autorisée" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ valid: false, error: "Format invalide : 14 chiffres attendus" }, 400);
    const { siret } = parsed.data;
    const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
    url.searchParams.set("q", siret);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "1");
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return json({ valid: false, error: `Recherche officielle indisponible (${response.status})` }, 502);
    const data: { results?: Company[] } = await response.json();
    if (!Array.isArray(data.results)) return json({ valid: false, error: "Réponse officielle invalide" }, 502);
    return json(mapCompanySearch(data.results, siret));
  } catch (error) {
    console.error("Official company search failed:", error instanceof Error ? error.message : "Unknown error");
    return json({ valid: false, error: "Recherche officielle indisponible, réessayez plus tard" }, 502);
  }
});