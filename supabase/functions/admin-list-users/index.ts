import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsError } = await callerClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: isSuperAdmin } = await callerClient.rpc("is_super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), { status: 403, headers: corsHeaders });
    }

    // Use service role for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // List all auth users
    const { data: authData, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;

    // Get all user_chain_access entries with chain names
    const { data: accessData, error: accessError } = await adminClient
      .from("user_chain_access")
      .select("id, user_id, chain_id, role, chains(name)");
    if (accessError) throw accessError;

    // Build enriched user list
    const users = authData.users.map((u) => {
      const accesses = (accessData || []).filter((a: any) => a.user_id === u.id);
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        accesses: accesses.map((a: any) => ({
          access_id: a.id,
          role: a.role,
          chain_id: a.chain_id,
          chain_name: a.chain_id === null ? null : a.chains?.name || "Inconnue",
        })),
      };
    });

    return new Response(
      JSON.stringify({ users }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-list-users error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
