// Dishop API connector — Étape 1
// Modes supportés:
//   - "test_auth"  : récupère un access_token puis le valide (renvoie scopes)
//   - "list_shops" : tente de lister les shops Dishop pour le company_id
//
// Auth: la fonction prend un chain_connection_id, lit les credentials
// (client_id, client_secret, company_id) depuis chain_pos_connections,
// puis appelle Dishop. JWT utilisateur vérifié.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// JSZip for unzipping Dishop weekly export archives
import JSZip from "npm:jszip@3.10.1";
console.log("[dishop-api] module loaded v3-inspect-zip");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISHOP_BASE = "https://api.dishop.co";

interface RequestBody {
  mode: "test_auth" | "list_shops" | "probe" | "diag_accounting" | "inspect_zip";
  chain_connection_id: string;
  // Optional overrides for diag_accounting
  company_id_override?: string;
  week?: string; // e.g. "2026-W22" or yyyy-mm-dd
}

interface DishopCredentials {
  client_id?: string;
  client_secret?: string;
  company_id?: string;
}

async function getAccessToken(creds: DishopCredentials): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  const res = await fetch(`${DISHOP_BASE}/v1/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dishop auth failed (${res.status}): ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Dishop auth: invalid JSON response: ${text.slice(0, 200)}`);
  }
}

async function validateToken(token: string): Promise<unknown> {
  const res = await fetch(`${DISHOP_BASE}/v1/api/oauth/token/validate`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dishop validate failed (${res.status}): ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getPermissions(token: string): Promise<unknown> {
  const res = await fetch(`${DISHOP_BASE}/v1/api/oauth/permissions`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text.slice(0, 500) };
  }
}

const SHOP_PATH_CANDIDATES = (companyId: string) => {
  const c = encodeURIComponent(companyId);
  return [
    `/v1/api/${c}/legal`,
    `/v1/api/${c}/shops`,
    `/v1/api/${c}/export-monthly-data/accounting-report`,
    `/v1/api/${c}/export-monthly-data/users`,
    `/v1/api/${c}/export-monthly-data/orders`,
    `/v1/api/${c}/export-monthly-data`,
    `/v1/api/${c}/webhooks`,
  ];
};

async function probeEndpoint(
  token: string,
  path: string,
): Promise<{ path: string; status: number; preview: string }> {
  try {
    const res = await fetch(`${DISHOP_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    return { path, status: res.status, preview: text.slice(0, 400) };
  } catch (e) {
    return { path, status: 0, preview: `exception ${(e as Error).message}` };
  }
}

async function listShops(
  token: string,
  companyId: string,
): Promise<{ shops: unknown[]; endpoint_used: string; raw?: unknown }> {
  const errors: string[] = [];
  for (const path of SHOP_PATH_CANDIDATES(companyId)) {
    const r = await probeEndpoint(token, path);
    if (r.status >= 200 && r.status < 300) {
      let data: any;
      try {
        data = JSON.parse(r.preview);
      } catch {
        data = { raw: r.preview };
      }
      const shops = Array.isArray(data)
        ? data
        : Array.isArray(data?.shops)
          ? data.shops
          : Array.isArray(data?.data)
            ? data.data
            : [];
      return { shops, endpoint_used: path, raw: data };
    }
    errors.push(`${path} → ${r.status} ${r.preview.slice(0, 120)}`);
  }
  throw new Error(
    `Aucun endpoint shops Dishop n'a répondu OK. Tentatives:\n${errors.join("\n")}`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: JWT utilisateur requis
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Vérifier que l'utilisateur est authentifié
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.mode || !body?.chain_connection_id) {
      return new Response(
        JSON.stringify({ error: "mode and chain_connection_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Lire la connexion (service role pour outrepasser RLS car on a déjà vérifié le JWT)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: conn, error: connErr } = await admin
      .from("chain_pos_connections")
      .select("id, chain_id, connector_id, credentials, is_active")
      .eq("id", body.chain_connection_id)
      .single();

    if (connErr || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection introuvable", details: connErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (conn.connector_id !== "dishop") {
      return new Response(
        JSON.stringify({ error: "Cette connexion n'est pas une connexion Dishop" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const creds = (conn.credentials || {}) as DishopCredentials;
    if (!creds.client_id || !creds.client_secret) {
      return new Response(
        JSON.stringify({ error: "Credentials Dishop manquants (client_id/client_secret)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Toujours générer un access token
    const tokenRes = await getAccessToken(creds);

    if (body.mode === "test_auth") {
      // 2. Valider le token pour récupérer les scopes
      let validation: unknown = null;
      try {
        validation = await validateToken(tokenRes.access_token);
      } catch (e) {
        validation = { error: (e as Error).message };
      }
      return new Response(
        JSON.stringify({
          ok: true,
          expires_in: tokenRes.expires_in,
          token_type: tokenRes.token_type,
          token_preview: tokenRes.access_token.slice(0, 24) + "…",
          validation,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.mode === "list_shops") {
      if (!creds.company_id) {
        return new Response(
          JSON.stringify({ error: "Company ID manquant dans les credentials" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const result = await listShops(tokenRes.access_token, creds.company_id);
      return new Response(
        JSON.stringify({
          ok: true,
          shops: result.shops,
          shop_count: result.shops.length,
          endpoint_used: result.endpoint_used,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.mode === "probe") {
      const companyId = creds.company_id || "";
      const paths = SHOP_PATH_CANDIDATES(companyId);
      const permissions = await getPermissions(tokenRes.access_token).catch(
        (e) => ({ error: (e as Error).message }),
      );
      const results = await Promise.all(
        paths.map((p) => probeEndpoint(tokenRes.access_token, p)),
      );
      return new Response(
        JSON.stringify({ ok: true, permissions, probes: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (body.mode === "diag_accounting") {
      const companyId = body.company_id_override || creds.company_id || "";
      // Try several casing variants & both weekly/monthly to nail down the issue
      const variants = [
        companyId,
        companyId.toLowerCase(),
        companyId.toUpperCase(),
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      const permissions = await getPermissions(tokenRes.access_token).catch(
        (e) => ({ error: (e as Error).message }),
      );

      const probes: Array<Record<string, unknown>> = [];
      for (const cid of variants) {
        const c = encodeURIComponent(cid);
        const paths = [
          `/v1/api/${c}/export-weekly-data/accounting-report`,
          `/v1/api/${c}/export-monthly-data/accounting-report`,
        ];
        for (const p of paths) {
          const url = `${DISHOP_BASE}${p}`;
          console.log("[dishop-diag] GET", url);
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${tokenRes.access_token}`,
              Accept: "application/json",
            },
          });
          const text = await res.text();
          console.log(
            "[dishop-diag] →",
            res.status,
            text.slice(0, 300).replace(/\n/g, " "),
          );
          probes.push({
            company_id_tried: cid,
            url,
            status: res.status,
            body_preview: text.slice(0, 4000),
          });
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          stored_company_id: creds.company_id,
          token_preview: tokenRes.access_token.slice(0, 24) + "…",
          permissions,
          probes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    if (body.mode === "inspect_zip") {
      const companyId = (body.company_id_override || creds.company_id || "").toLowerCase();
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "company_id manquant" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // 1. Request signed URL
      const url = `${DISHOP_BASE}/v1/api/${encodeURIComponent(companyId)}/export-weekly-data/accounting-report`;
      console.log("[dishop-inspect] GET", url);
      const metaRes = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenRes.access_token}`, Accept: "application/json" },
      });
      const metaText = await metaRes.text();
      if (!metaRes.ok) {
        return new Response(
          JSON.stringify({ error: `Dishop accounting-report ${metaRes.status}`, body: metaText.slice(0, 1000) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      let meta: any;
      try { meta = JSON.parse(metaText); } catch {
        return new Response(
          JSON.stringify({ error: "Dishop: réponse JSON invalide", preview: metaText.slice(0, 500) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const downloadUrl: string | undefined = meta?.exportDownloadUrl;
      if (!downloadUrl) {
        return new Response(
          JSON.stringify({ error: "Pas d'exportDownloadUrl dans la réponse Dishop", meta }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.log("[dishop-inspect] downloading ZIP…");
      const zipRes = await fetch(downloadUrl);
      if (!zipRes.ok) {
        return new Response(
          JSON.stringify({ error: `ZIP download ${zipRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const zipBuf = new Uint8Array(await zipRes.arrayBuffer());
      console.log("[dishop-inspect] ZIP size", zipBuf.length, "bytes");

      const zip = await JSZip.loadAsync(zipBuf);
      const files: Array<{
        name: string;
        size: number;
        compressed_size: number;
        is_dir: boolean;
        preview: string | null;
      }> = [];
      const entries = Object.values(zip.files) as any[];
      for (const entry of entries) {
        let preview: string | null = null;
        if (!entry.dir) {
          try {
            const txt = await entry.async("string");
            preview = txt.slice(0, 2000);
          } catch {
            preview = "[binaire]";
          }
        }
        files.push({
          name: entry.name,
          size: (entry as any)._data?.uncompressedSize ?? 0,
          compressed_size: (entry as any)._data?.compressedSize ?? 0,
          is_dir: !!entry.dir,
          preview,
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          download_url_preview: downloadUrl.slice(0, 150) + "…",
          zip_size_bytes: zipBuf.length,
          file_count: files.length,
          files,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    return new Response(JSON.stringify({ error: `Mode inconnu: ${body.mode}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[dishop-api] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
