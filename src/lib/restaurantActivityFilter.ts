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
  /** Date de première activité réelle détectée automatiquement (caisse en priorité) */
  first_activity_date?: string | null;
  /** 'cash' | 'uber' | 'deliveroo' */
  first_activity_source?: string | null;
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
 * Date d'ouverture effective d'un restaurant.
 * Priorité: date saisie manuellement (Uber / Deliveroo), sinon première activité réelle détectée.
 */
export function getEffectiveOpeningDate(restaurant: RestaurantWithDates): {
  date: string | null;
  isAuto: boolean;
  source: string | null;
} {
  const manual = [restaurant.uber_opening_date, restaurant.deliveroo_opening_date]
    .filter((d): d is string => !!d)
    .sort();
  if (manual.length > 0) {
    return { date: manual[0], isAuto: false, source: 'manual' };
  }
  if (restaurant.first_activity_date) {
    return {
      date: restaurant.first_activity_date,
      isAuto: true,
      source: restaurant.first_activity_source || 'cash',
    };
  }
  return { date: null, isAuto: false, source: null };
}

/**
 * Check if a restaurant was active on at least one platform during the given period.
 * L'ouverture effective (manuelle ou détectée automatiquement) fait foi : un restaurant
 * qui n'avait aucune activité sur la période n'est pas considéré actif.
 */
export function isActiveForPeriod(
  restaurant: RestaurantWithDates,
  startDate: Date,
  endDate: Date
): boolean {
  const startStr = formatDateLocal(startDate);
  const endStr = formatDateLocal(endDate);

  const opening = getEffectiveOpeningDate(restaurant);

  // Ouvert après la fin de la période → non comparable
  if (opening.date && opening.date > endStr) return false;

  const closings = [restaurant.uber_closing_date, restaurant.deliveroo_closing_date]
    .filter((d): d is string => !!d)
    .sort();

  const uberConfigured = !!restaurant.uber_opening_date || !!restaurant.uber_closing_date;
  const deliverooConfigured = !!restaurant.deliveroo_opening_date || !!restaurant.deliveroo_closing_date;

  // Fermé sur les deux plateformes configurées avant le début de la période
  if (uberConfigured && deliverooConfigured) {
    const uberClosedBefore = !!restaurant.uber_closing_date && restaurant.uber_closing_date < startStr;
    const deliverooClosedBefore = !!restaurant.deliveroo_closing_date && restaurant.deliveroo_closing_date < startStr;
    const uberOpenLate = !!restaurant.uber_opening_date && restaurant.uber_opening_date > endStr;
    const deliverooOpenLate = !!restaurant.deliveroo_opening_date && restaurant.deliveroo_opening_date > endStr;
    const uberActive = !uberClosedBefore && !uberOpenLate;
    const deliverooActive = !deliverooClosedBefore && !deliverooOpenLate;
    if (!uberActive && !deliverooActive) return false;
    return true;
  }

  if (closings.length > 0 && closings[closings.length - 1] < startStr) return false;

  return true;
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
