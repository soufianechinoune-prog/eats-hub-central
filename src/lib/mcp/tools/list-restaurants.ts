import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_restaurants",
  title: "List restaurants",
  description:
    "List restaurants the signed-in user has access to. Optionally filter by chain_id (brand) and active status.",
  inputSchema: {
    chain_id: z.string().uuid().optional().describe("Filter by brand/chain UUID."),
    only_active: z
      .boolean()
      .optional()
      .describe("If true, only return active restaurants. Defaults to true."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("Max rows to return (default 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ chain_id, only_active, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("restaurants")
      .select(
        "id, chain_id, name, city, postal_code, is_active, uber_store_id, deliveroo_store_id",
      )
      .order("name")
      .limit(limit ?? 200);
    if (chain_id) query = query.eq("chain_id", chain_id);
    if (only_active !== false) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { restaurants: data ?? [], count: data?.length ?? 0 },
    };
  },
});
