import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHandler } from "./protocol.ts";

Deno.serve(createHandler({
  secret: () => Deno.env.get("SPLASH_WEBHOOK_SECRET"),
  corsHeaders,
  persist: async (event) => {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Service configuration missing");
    const admin = createClient(url, serviceKey);
    const { data: candidates, error: mappingError } = await admin
      .from("splash_restaurant_credentials")
      .select("id, restaurant_id, chain_id")
      .eq("client_id", event.clientId).eq("is_active", true).limit(2);
    if (mappingError) throw new Error("Mapping unavailable");
    const candidate = candidates?.length === 1 ? candidates[0] : null;
    let mapped = false;
    if (candidate) {
      const { data: restaurant, error } = await admin.from("restaurants").select("chain_id").eq("id", candidate.restaurant_id).maybeSingle();
      if (error) throw new Error("Restaurant unavailable");
      mapped = restaurant?.chain_id === candidate.chain_id;
    }
    const { error } = await admin.from("splash_webhook_events").upsert({
      webhook_id: event.webhookId,
      event_type: event.eventType,
      station_credentials_id: mapped && candidate ? candidate.id : null,
      restaurant_id: mapped && candidate ? candidate.restaurant_id : null,
      chain_id: mapped && candidate ? candidate.chain_id : null,
      payload: event.payload,
      status: mapped ? "pending" : "unmapped",
    }, { onConflict: "webhook_id", ignoreDuplicates: true });
    if (error) throw new Error("Event storage unavailable");
  },
}));