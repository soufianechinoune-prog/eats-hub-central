import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function base(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/CHICKEN\s*STREET/g, " ")
    .replace(/TASTY\s*CROUSTY/g, " ")
    .replace(/\bTASTU\s*CROUSTY\b/g, " ")
    .replace(/\bTASTY\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// Expanded form: abbreviations resolved, so "ST ANTOINE" == "SAINT ANTOINE".
function expand(input: string): string {
  const words = base(input).split(" ").filter(Boolean).map((w) => {
    if (w === "ST") return "SAINT";
    if (w === "STE") return "SAINTE";
    if (w === "S" || w === "SR") return "SUR";
    if (w === "SS") return "SOUS";
    if (w === "LES" || w === "LES") return "LES";
    return w;
  });
  return words.join(" ");
}

function normalize(input: string): string {
  return expand(input).replace(/ /g, "");
}


type Row = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsError } = await callerClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const { data: isSuperAdmin } = await callerClient.rpc("is_super_admin");
    if (!isSuperAdmin) return json({ error: "Forbidden: super_admin only" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const files: { bucket: string; path: string; chainName: string }[] = body.files ?? [
      { bucket: "pos-credentials", path: "splash/cs.xlsx", chainName: "Chicken Street" },
      { bucket: "pos-credentials", path: "splash/tc.xlsx", chainName: "Tasty Crousty" },
    ];
    const dryRun = body.dry_run !== false; // safe by default

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: chains } = await admin.from("chains").select("id, name");
    const { data: restaurants } = await admin
      .from("restaurants")
      .select("id, name, chain_id");
    const { data: mappings } = await admin
      .from("splash360_restaurant_mapping")
      .select("restaurant_id, restaurant_splash_id");
    const { data: aliases } = await admin
      .from("restaurant_name_aliases")
      .select("restaurant_id, alias");

    const splashIdByResto = new Map<string, number>();
    for (const m of mappings ?? []) splashIdByResto.set(m.restaurant_id, m.restaurant_splash_id);

    const summary: Record<string, unknown>[] = [];
    const unmatched: { file: string; name: string }[] = [];
    const rowsToUpsert: Row[] = [];

    for (const f of files) {
      const chainKey = (s: string) =>
        (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const chain = (chains ?? []).find((c: any) => chainKey(c.name) === chainKey(f.chainName));

      if (!chain) return json({ error: `Chain introuvable: ${f.chainName}` }, 400);

      const index = new Map<string, string>();
      for (const r of restaurants ?? []) {
        if (r.chain_id !== chain.id) continue;
        index.set(normalize(r.name), r.id);
      }
      for (const a of aliases ?? []) {
        const r = (restaurants ?? []).find((x: any) => x.id === a.restaurant_id);
        if (!r || r.chain_id !== chain.id) continue;
        const key = normalize(a.alias);
        if (!index.has(key)) index.set(key, r.id);
      }

      const { data: file, error: dlError } = await admin.storage.from(f.bucket).download(f.path);
      if (dlError || !file) return json({ error: `Téléchargement impossible: ${f.path}` }, 400);

      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });

      let matched = 0;
      for (const row of rows) {
        const name = String(row["Nom du restaurant"] ?? "").trim();
        const clientId = String(row["Client ID"] ?? "").trim();
        const clientSecret = String(row["Client Secret"] ?? "").trim();
        const station = String(row["Station"] ?? "").trim() || "default";
        const stationType = String(row["Type de station"] ?? "").trim() || null;
        if (!name || !clientId || !clientSecret) continue;

        const overrides: Record<string, string> = body.overrides ?? {};
        const skip: string[] = (body.skip ?? []).map((s: string) => normalize(s));
        if (skip.includes(normalize(name))) continue;

        let restaurantId = overrides[name] ?? index.get(normalize(name));
        if (!restaurantId) {
          // Rattrapage prudent : mêmes mots significatifs et mêmes chiffres,
          // acceptée seulement si UNE seule candidate (sinon laissée à l'arbitrage manuel).
          const key = normalize(name);
          const digits = (s: string) => (s.match(/\d/g) ?? []).join("");
          const hits = [...index.entries()].filter(([k]) => {
            if (k.length <= 3) return false;
            if (digits(k) !== digits(key)) return false;
            return k.includes(key) || key.includes(k);
          });
          const uniq = new Set(hits.map(([, id]) => id));
          if (uniq.size === 1) restaurantId = [...uniq][0];
        }



        if (!restaurantId) {
          unmatched.push({ file: f.path, name });
          continue;
        }
        matched++;
        rowsToUpsert.push({
          restaurant_id: restaurantId,
          chain_id: chain.id,
          splash_restaurant_id: splashIdByResto.get(restaurantId) ?? null,
          station,
          station_type: stationType,
          splash_name: name,
          client_id: clientId,
          client_secret: clientSecret,
          is_active: true,
        });
      }

      summary.push({ file: f.path, chain: chain.name, rows: rows.length, matched });
    }

    // Détection des collisions de clé naturelle (restaurant + caisse) : deux accès
    // différents ne doivent jamais viser le même couple, sinon un accès serait perdu.
    const seen = new Map<string, Row>();
    const collisions: { restaurant_id: string; station: string; names: string[] }[] = [];
    const deduped: Row[] = [];
    for (const r of rowsToUpsert) {
      const key = `${r.restaurant_id}|${r.station}`;
      const prev = seen.get(key);
      if (prev) {
        collisions.push({
          restaurant_id: String(r.restaurant_id),
          station: String(r.station),
          names: [String(prev.splash_name), String(r.splash_name)],
        });
        continue;
      }
      seen.set(key, r);
      deduped.push(r);
    }

    let upserted = 0;
    if (!dryRun && deduped.length > 0) {
      for (let i = 0; i < deduped.length; i += 100) {
        const chunk = deduped.slice(i, i + 100);
        const { error } = await admin
          .from("splash_restaurant_credentials")
          .upsert(chunk, { onConflict: "restaurant_id,station" });
        if (error) return json({ error: error.message, summary, unmatched, collisions }, 500);
        upserted += chunk.length;
      }
    }


    // Never log or return secrets.
    return json({
      dry_run: dryRun,
      summary,
      candidates: rowsToUpsert.length,
      deduped: deduped.length,
      collisions,

      upserted,
      unmatched_count: unmatched.length,
      unmatched,
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
