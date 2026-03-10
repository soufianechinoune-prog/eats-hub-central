import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BodaccAnnonce {
  date: string;
  type: string;
  typeLabel: string;
  description: string;
  tribunal: string | null;
  lienBodacc: string | null;
  numeroBodacc: string | null;
}

function parseJsonField(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function classifyAnnonce(record: any): { type: string; typeLabel: string } {
  const famille = (record.familleavis_lib || record.familleavis || "").toLowerCase();
  const jugementObj = parseJsonField(record.jugement);
  const nature = (jugementObj?.nature || "").toLowerCase();
  const radiationObj = parseJsonField(record.radiationaurcs);

  // Procédures collectives (liquidation, redressement, sauvegarde)
  if (famille.includes("procédure") || famille.includes("collective") ||
      nature.includes("liquidation") || nature.includes("redressement") || nature.includes("sauvegarde")) {
    // Sub-classify
    if (nature.includes("liquidation")) return { type: "procedure_collective", typeLabel: "Liquidation judiciaire" };
    if (nature.includes("redressement")) return { type: "procedure_collective", typeLabel: "Redressement judiciaire" };
    if (nature.includes("sauvegarde")) return { type: "procedure_collective", typeLabel: "Sauvegarde" };
    return { type: "procedure_collective", typeLabel: "Procédure collective" };
  }
  if (radiationObj || famille.includes("radiation")) {
    return { type: "radiation", typeLabel: "Radiation" };
  }
  if (famille.includes("vente") || famille.includes("cession")) {
    return { type: "cession", typeLabel: "Vente / Cession" };
  }
  if (famille.includes("dépôt") || famille.includes("dpc")) {
    return { type: "depot_comptes", typeLabel: "Dépôt des comptes" };
  }
  if (famille.includes("modification") || famille.includes("immatriculation")) {
    return { type: "modification", typeLabel: "Modification" };
  }
  return { type: "autre", typeLabel: record.familleavis_lib || "Annonce" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { siren } = await req.json();
    const clean = (siren || "").replace(/\s/g, "").trim();

    if (!/^\d{9}$/.test(clean)) {
      return new Response(
        JSON.stringify({ annonces: [], error: "SIREN invalide (9 chiffres attendus)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre%20like%20%22${clean}%22&order_by=dateparution%20desc&limit=20`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("BODACC API error:", res.status, text);
      return new Response(
        JSON.stringify({ annonces: [], error: `API BODACC indisponible (${res.status})` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const results = data.results || [];

    const annonces: BodaccAnnonce[] = results.map((r: any) => {
      const { type, typeLabel } = classifyAnnonce(r);

      // Build human-readable description from structured fields
      const jugementObj = parseJsonField(r.jugement);
      const depotObj = parseJsonField(r.depot);
      const modifObj = parseJsonField(r.modificationsgenerales);
      const acteObj = parseJsonField(r.acte);
      const personnesObj = parseJsonField(r.listepersonnes);

      const descParts: string[] = [];
      if (jugementObj?.nature) descParts.push(jugementObj.nature);
      if (jugementObj?.complementJugement) descParts.push(jugementObj.complementJugement);
      if (depotObj?.typeDepot) descParts.push(depotObj.typeDepot);
      if (depotObj?.descriptif) descParts.push(depotObj.descriptif);
      if (modifObj?.descriptif) descParts.push(modifObj.descriptif);
      if (acteObj?.descriptif) descParts.push(acteObj.descriptif);
      if (personnesObj?.personne?.activite) descParts.push(`Activité : ${personnesObj.personne.activite}`);

      const description = descParts.join(" — ");

      return {
        date: r.dateparution || null,
        type,
        typeLabel,
        description: description || typeLabel,
        tribunal: r.tribunal || null,
        lienBodacc: r.url_complete || (r.publicationavisid
          ? `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${r.publicationavisid}`
          : null),
        numeroBodacc: r.numerodeparution || r.parution || null,
      };
    });

    return new Response(JSON.stringify({ annonces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-bodacc error:", error);
    return new Response(
      JSON.stringify({ annonces: [], error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
