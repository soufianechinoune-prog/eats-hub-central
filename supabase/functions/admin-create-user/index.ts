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

    // Verify caller is super_admin
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

    // Parse body
    const { email, role, chain_ids } = await req.json();
    if (!email || !role || !Array.isArray(chain_ids)) {
      return new Response(JSON.stringify({ error: "Missing email, role, or chain_ids" }), { status: 400, headers: corsHeaders });
    }
    if (!["importer", "client"].includes(role)) {
      return new Response(JSON.stringify({ error: "Role must be 'importer' or 'client'" }), { status: 400, headers: corsHeaders });
    }

    // Use service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create user with temporary password
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: "ChangeMe123!",
      email_confirm: true,
    });

    if (createError) {
      // If user already exists, return specific error
      if (createError.message?.includes("already been registered")) {
        return new Response(JSON.stringify({ error: "Un compte existe déjà avec cet email" }), { status: 409, headers: corsHeaders });
      }
      throw createError;
    }

    // Insert user_chain_access entries
    const accessRows = chain_ids.map((chain_id: string) => ({
      user_id: newUser.user.id,
      chain_id,
      role,
    }));

    const { error: accessError } = await adminClient
      .from("user_chain_access")
      .insert(accessRows);

    if (accessError) {
      // Cleanup: delete created user if access insert fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw accessError;
    }

    return new Response(
      JSON.stringify({ user: { id: newUser.user.id, email: newUser.user.email }, access_count: chain_ids.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-create-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
