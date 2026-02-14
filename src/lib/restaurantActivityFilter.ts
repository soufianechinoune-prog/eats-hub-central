import { format } from "date-fns";

/**
 * Interface for restaurants with platform activity dates
 */
export interface RestaurantWithDates {
  id: string;
  name: string;
  uber_opening_date?: string | null;
  uber_closing_date?: string | null;
  deliveroo_opening_date?: string | null;
  deliveroo_closing_date?: string | null;
}

/**
 * Format date as YYYY-MM-DD for comparison
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a restaurant was active on at least one platform during the given period.
 * A restaurant is considered active if:
 * - Uber Eats: (opening_date is null OR <= endDate) AND (closing_date is null OR >= startDate)
 * - Deliveroo: same logic
 * Returns true if at least one platform was active.
 */
function isActiveForPeriod(
  restaurant: RestaurantWithDates,
  startDate: Date,
  endDate: Date
): boolean {
  const startStr = formatDateLocal(startDate);
  const endStr = formatDateLocal(endDate);

  const uberConfigured = !!restaurant.uber_opening_date || !!restaurant.uber_closing_date;
  const deliverooConfigured = !!restaurant.deliveroo_opening_date || !!restaurant.deliveroo_closing_date;

  // If no platform is configured at all, consider always active (backward compat)
  if (!uberConfigured && !deliverooConfigured) return true;

  const uberActive = uberConfigured &&
    (!restaurant.uber_opening_date || restaurant.uber_opening_date <= endStr) &&
    (!restaurant.uber_closing_date || restaurant.uber_closing_date >= startStr);

  const deliverooActive = deliverooConfigured &&
    (!restaurant.deliveroo_opening_date || restaurant.deliveroo_opening_date <= endStr) &&
    (!restaurant.deliveroo_closing_date || restaurant.deliveroo_closing_date >= startStr);

  return uberActive || deliverooActive;
}

/**
 * Filter restaurants to only include those that were active during the specified period.
 * Restaurants without any platform dates are considered always active.
 * 
 * @param restaurants - List of restaurants with activity dates
 * @param startDate - Start of the analysis period
 * @param endDate - End of the analysis period
 * @returns Filtered list of restaurants that were active during the period
 */
export function filterActiveRestaurants<T extends RestaurantWithDates>(
  restaurants: T[],
  startDate: Date,
  endDate: Date
): T[] {
  return restaurants.filter(r => isActiveForPeriod(r, startDate, endDate));
}

/**
 * Get the count of restaurants excluded due to activity dates
 */
export function getExcludedCount<T extends RestaurantWithDates>(
  allRestaurants: T[],
  startDate: Date,
  endDate: Date
): number {
  const activeCount = filterActiveRestaurants(allRestaurants, startDate, endDate).length;
  return allRestaurants.length - activeCount;
}
