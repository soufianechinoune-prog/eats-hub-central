import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listChainsTool from "./tools/list-chains";
import listRestaurantsTool from "./tools/list-restaurants";
import getRestaurantTool from "./tools/get-restaurant";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref
// (Vite inlines VITE_SUPABASE_PROJECT_ID at build time, so this stays import-safe).
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cs-delivery-performance-mcp",
  title: "CS Delivery Performance",
  version: "0.1.0",
  instructions:
    "Multi-tenant analytics for delivery brands (Uber Eats, Deliveroo, POS). Use `list_chains` to discover brands the user can access, `list_restaurants` to list their restaurants (optionally filtered by chain_id), and `get_restaurant` for full details on one restaurant. All tools respect the signed-in user's brand access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listChainsTool, listRestaurantsTool, getRestaurantTool],
});
