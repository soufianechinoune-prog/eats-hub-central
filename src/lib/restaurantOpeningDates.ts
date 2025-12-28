import { parseISO } from "date-fns";
import { extractCityName } from "./restaurantUtils";

/**
 * Map of restaurant names (uppercase) to their opening dates
 */
const RESTAURANT_OPENING_DATES: Record<string, Date> = {
  "ANTONY": new Date(2025, 10, 1), // November 1, 2025
};

/**
 * Checks if a specific restaurant opened after the selected date range
 * @param restaurants - List of restaurants with id and name
 * @param selectedRestaurantIds - IDs of selected restaurants
 * @param endDate - End date of the selected period (string format yyyy-MM-dd)
 * @returns Object with isBeforeOpening flag, restaurant name, and opening date if applicable
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
  // Only check when a single restaurant is selected
  const selectedRestaurants = restaurants.filter((r) =>
    selectedRestaurantIds.includes(r.id)
  );

  if (selectedRestaurants.length !== 1) {
    return { isBeforeOpening: false };
  }

  const restaurant = selectedRestaurants[0];
  const restaurantNameUpper = restaurant.name.toUpperCase();

  // Find if this restaurant has a known opening date
  const matchingKey = Object.keys(RESTAURANT_OPENING_DATES).find((key) =>
    restaurantNameUpper.includes(key)
  );

  if (!matchingKey) {
    return { isBeforeOpening: false };
  }

  const openingDate = RESTAURANT_OPENING_DATES[matchingKey];
  const endDateObj = parseISO(endDate);

  if (endDateObj < openingDate) {
    return {
      isBeforeOpening: true,
      restaurantName: restaurant.name,
      cityName: extractCityName(restaurant.name),
      openingDate,
    };
  }

  return { isBeforeOpening: false };
}
