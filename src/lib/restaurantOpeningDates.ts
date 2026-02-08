/**
 * @deprecated This file is deprecated. Use the activity date columns from the restaurants table instead:
 * - uber_opening_date
 * - uber_closing_date
 * - deliveroo_opening_date
 * - deliveroo_closing_date
 * 
 * And use filterActiveRestaurants() from src/lib/restaurantActivityFilter.ts
 */

import { extractCityName } from "./restaurantUtils";

/**
 * @deprecated Use database columns and filterActiveRestaurants() instead
 */
export function checkRestaurantOpeningDate(
  restaurants: Array<{ id: string; name: string }>,
  selectedRestaurantIds: string[],
  endDate: string
): {
  isBeforeOpening: boolean;
  restaurantName?: string;
  cityName?: string;
  openingDate?: Date;
} {
  // This function is deprecated - always return false to not block any restaurants
  // The filtering is now done at the query level using filterActiveRestaurants()
  return { isBeforeOpening: false };
}
