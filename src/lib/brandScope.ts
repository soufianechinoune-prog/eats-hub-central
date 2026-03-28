import { supabase } from "@/integrations/supabase/client";

export interface BrandRestaurantScope {
  restaurantIds: string[];
  restaurantNames: string[];
  normalizedManagerPhones: string[];
}

export interface ResolveBrandScopedRestaurantIdsParams {
  selectedRestaurantIds?: string[] | null;
  selectedChainId: string | null;
  isNetworkView?: boolean;
  chainRestaurantIds?: string[] | null;
  pinnedRestaurantIds?: string[] | null;
}

export const EMPTY_BRAND_SCOPE_RESTAURANT_IDS = [
  "00000000-0000-0000-0000-000000000000",
];

const normalizeScopedPhone = (phone: string | null | undefined) =>
  (phone ?? "").replace(/\D/g, "");

export async function fetchBrandRestaurantScope(
  selectedChainId: string | null,
): Promise<BrandRestaurantScope | null> {
  if (!selectedChainId) return null;

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, manager_whatsapp")
    .eq("chain_id", selectedChainId)
    .eq("is_active", true);

  if (error) throw error;

  const restaurants = data ?? [];

  return {
    restaurantIds: restaurants.map((restaurant) => restaurant.id),
    restaurantNames: restaurants.map((restaurant) => restaurant.name).filter(Boolean),
    normalizedManagerPhones: restaurants
      .map((restaurant) => normalizeScopedPhone(restaurant.manager_whatsapp))
      .filter(Boolean),
  };
}

export function resolveBrandScopedRestaurantIds({
  selectedRestaurantIds,
  selectedChainId,
  isNetworkView = false,
  chainRestaurantIds,
  pinnedRestaurantIds,
}: ResolveBrandScopedRestaurantIdsParams): string[] | null {
  const availableChainIds = chainRestaurantIds ?? [];
  const availablePinnedIds = pinnedRestaurantIds ?? [];
  const sanitizedSelectedIds = (selectedRestaurantIds ?? []).filter((id) =>
    !selectedChainId || availableChainIds.includes(id),
  );

  if (sanitizedSelectedIds.length > 0) {
    return sanitizedSelectedIds;
  }

  if (selectedChainId) {
    if (availableChainIds.length === 0) {
      return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    }

    if (isNetworkView) {
      return availableChainIds;
    }

    return availablePinnedIds.length > 0 ? availablePinnedIds : availableChainIds;
  }

  if (isNetworkView) {
    return null;
  }

  return availablePinnedIds.length > 0 ? availablePinnedIds : null;
}

export function hasBrandScopedRestaurantIds(
  scope: BrandRestaurantScope | null,
  restaurantIds?: string[] | null,
  restaurantId?: string | null,
) {
  if (!scope) return true;

  const ids = restaurantIds && restaurantIds.length > 0
    ? restaurantIds
    : restaurantId
      ? [restaurantId]
      : [];

  return ids.some((id) => scope.restaurantIds.includes(id));
}

export function hasBrandScopedRecipients(
  scope: BrandRestaurantScope | null,
  recipients?: Array<{ restaurant_id?: string | null }> | null,
) {
  if (!scope) return true;
  if (!recipients || recipients.length === 0) return false;

  return recipients.some((recipient) =>
    recipient.restaurant_id ? scope.restaurantIds.includes(recipient.restaurant_id) : false,
  );
}

export function hasBrandScopedMessage(
  scope: BrandRestaurantScope | null,
  message: {
    restaurant_id?: string | null;
    restaurant_name?: string | null;
    recipient_phone?: string | null;
    sender_phone?: string | null;
  },
) {
  if (!scope) return true;

  if (message.restaurant_id && scope.restaurantIds.includes(message.restaurant_id)) {
    return true;
  }

  if (message.restaurant_name && scope.restaurantNames.includes(message.restaurant_name)) {
    return true;
  }

  const phones = [message.recipient_phone, message.sender_phone]
    .map((phone) => normalizeScopedPhone(phone))
    .filter(Boolean);

  return phones.some((phone) => scope.normalizedManagerPhones.includes(phone));
}
