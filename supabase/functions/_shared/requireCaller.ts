import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Contrôle d'accès des fonctions serveur déclarées `verify_jwt = false`.
 *
 * Laisse passer :
 *  - un utilisateur connecté à Mijotek (session valide) ;
 *  - une autre fonction serveur (clé de service).
 * Refuse tout le reste (appel sans compte, clé publique seule).
 *
 * Renvoie `null` si l'appel est autorisé, sinon la réponse 401 à retourner telle quelle.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function refuse(): Response {
  return new Response(JSON.stringify({ error: "Non autorisé" }), {
    status: 401,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export async function requireCaller(req: Request): Promise<Response | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return refuse();

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return null;

  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !serviceKey) return refuse();
  try {
    const { data, error } = await createClient(url, serviceKey).auth.getUser(token);
    if (error || !data?.user) return refuse();
    return null;
  } catch {
    return refuse();
  }
}
