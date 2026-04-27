import { supabase } from "@/integrations/supabase/client";
import { activateStoreIntegration } from "@/services/uberService";

/**
 * Multi-restaurant Uber Manager linking helpers.
 *
 * Workflow:
 *   1. OAuth callback creates a "master" uber_connections row (restaurant_id NULL, is_master=true)
 *   2. fetchStores() returns all stores accessible to that Uber account
 *   3. autoMatchStoresToRestaurants() proposes pairings via name normalization
 *   4. User reviews/edits, then bulkLinkStores() persists associations + activates POS
 */

export type UberStore = {
  id: string;
  name: string;
  address?: string;
  raw?: any;
};

export type RestaurantOption = {
  id: string;
  name: string;
  city?: string | null;
  uber_store_id?: string | null;
};

export type MatchSuggestion = {
  store: UberStore;
  /** "exact" = same normalized name, "fuzzy" = close enough, "none" = no match */
  matchType: "exact" | "fuzzy" | "none" | "already_linked";
  /** Matched restaurant id (suggested pre-selection). Null if matchType === 'none'. */
  suggestedRestaurantId: string | null;
  /** Already-linked store info (if any) */
  existingLink?: { restaurantId: string; uberStoreId: string };
};

export type LinkAction =
  | { kind: "link"; storeId: string; restaurantId: string }
  | { kind: "create"; storeId: string; newRestaurantName: string; newRestaurantAddress?: string; chainId: string }
  | { kind: "ignore"; storeId: string };

// ---------------------------------------------------------------------------
// Name normalization (mirrors imports/resolution-identite-restaurants-v4)
// ---------------------------------------------------------------------------

export const normalizeForMatch = (raw: string | null | undefined): string => {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/^chicken\s*street\s*-?\s*/g, "")
    .replace(/^cs\s*-?\s*/g, "")
    .replace(/[^a-z0-9]/g, "");
};

/** Tiny Levenshtein for fuzzy fallback (small strings only) */
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
};

// ---------------------------------------------------------------------------
// Auto-matching
// ---------------------------------------------------------------------------

export const autoMatchStoresToRestaurants = async (
  stores: UberStore[],
  restaurants: RestaurantOption[],
): Promise<MatchSuggestion[]> => {
  // Index restaurants by normalized name
  const byNorm = new Map<string, RestaurantOption>();
  restaurants.forEach((r) => {
    const n = normalizeForMatch(r.name);
    if (n) byNorm.set(n, r);
  });

  // Fetch already-linked stores in one go
  const { data: existing } = await supabase
    .from("uber_connection_stores")
    .select("uber_store_id, restaurant_id");
  const existingByStore = new Map<string, string>();
  (existing ?? []).forEach((row) => existingByStore.set(row.uber_store_id, row.restaurant_id));

  return stores.map<MatchSuggestion>((store) => {
    const alreadyLinkedTo = existingByStore.get(store.id);
    if (alreadyLinkedTo) {
      return {
        store,
        matchType: "already_linked",
        suggestedRestaurantId: alreadyLinkedTo,
        existingLink: { restaurantId: alreadyLinkedTo, uberStoreId: store.id },
      };
    }

    const normStore = normalizeForMatch(store.name);

    // Exact
    const exact = byNorm.get(normStore);
    if (exact) {
      return { store, matchType: "exact", suggestedRestaurantId: exact.id };
    }

    // Fuzzy: best Levenshtein <= 2 over names with similar length
    let best: { restaurant: RestaurantOption; distance: number } | null = null;
    for (const r of restaurants) {
      const n = normalizeForMatch(r.name);
      if (!n || Math.abs(n.length - normStore.length) > 4) continue;
      const d = levenshtein(n, normStore);
      if (d <= 2 && (!best || d < best.distance)) {
        best = { restaurant: r, distance: d };
      }
    }
    if (best) {
      return { store, matchType: "fuzzy", suggestedRestaurantId: best.restaurant.id };
    }

    return { store, matchType: "none", suggestedRestaurantId: null };
  });
};

// ---------------------------------------------------------------------------
// Bulk apply
// ---------------------------------------------------------------------------

export type BulkLinkResult = {
  linked: number;
  created: number;
  ignored: number;
  posActivated: number;
  posFailed: number;
  errors: { storeId: string; message: string }[];
};

export const bulkLinkStores = async ({
  connectionId,
  accessToken,
  storeMap, // storeId -> UberStore (for snapshots)
  actions,
}: {
  connectionId: string;
  accessToken: string;
  storeMap: Map<string, UberStore>;
  actions: LinkAction[];
}): Promise<BulkLinkResult> => {
  const result: BulkLinkResult = {
    linked: 0,
    created: 0,
    ignored: 0,
    posActivated: 0,
    posFailed: 0,
    errors: [],
  };

  for (const action of actions) {
    if (action.kind === "ignore") {
      result.ignored += 1;
      continue;
    }

    const store = storeMap.get(action.storeId);
    if (!store) {
      result.errors.push({ storeId: action.storeId, message: "Store introuvable dans la liste" });
      continue;
    }

    try {
      let restaurantId: string;

      if (action.kind === "create") {
        const { data: newResto, error: createErr } = await supabase
          .from("restaurants")
          .insert({
            name: action.newRestaurantName,
            address: action.newRestaurantAddress ?? store.address ?? null,
            chain_id: action.chainId,
            uber_store_id: store.id,
            status: "actif",
          } as any)
          .select("id")
          .single();
        if (createErr || !newResto) throw createErr ?? new Error("Échec création restaurant");
        restaurantId = newResto.id;
        result.created += 1;
      } else {
        restaurantId = action.restaurantId;
        // Persist uber_store_id on the restaurant for downstream calls
        await supabase
          .from("restaurants")
          .update({ uber_store_id: store.id } as any)
          .eq("id", restaurantId);
      }

      // Insert link row
      const { error: linkErr } = await supabase
        .from("uber_connection_stores")
        .insert({
          connection_id: connectionId,
          restaurant_id: restaurantId,
          uber_store_id: store.id,
          store_name: store.name,
          store_address: store.address ?? null,
        } as any);
      if (linkErr) throw linkErr;

      result.linked += 1;

      // Activate POS integration (best-effort)
      try {
        await activateStoreIntegration(accessToken, store.id);
        await supabase
          .from("uber_connection_stores")
          .update({
            activated_at: new Date().toISOString(),
            pos_activation_status: "activated",
          } as any)
          .eq("uber_store_id", store.id);
        result.posActivated += 1;
      } catch (posErr: any) {
        result.posFailed += 1;
        await supabase
          .from("uber_connection_stores")
          .update({
            pos_activation_status: "failed",
            pos_activation_error: posErr?.message ?? String(posErr),
          } as any)
          .eq("uber_store_id", store.id);
      }
    } catch (err: any) {
      result.errors.push({ storeId: action.storeId, message: err?.message ?? String(err) });
    }
  }

  return result;
};
