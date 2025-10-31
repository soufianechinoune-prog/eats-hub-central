import { MenuConfiguration } from "@/types";

export interface ValidationError {
  type: 'error' | 'warning';
  field: string;
  message: string;
  details?: string;
}

export const useMenuValidation = () => {
  const validateMenu = (config: MenuConfiguration): ValidationError[] => {
    const errors: ValidationError[] = [];

    // 1. No Menus Error
    if (!config.menus || config.menus.length === 0) {
      errors.push({
        type: 'error',
        field: 'menus',
        message: 'No Menus Error',
        details: 'All catalogs must have at least one menu. Add a menu with service_availability.',
      });
    }

    // 2. No Hours Errors & 3. Short Hours Errors
    if (config.menus) {
      config.menus.forEach((menu, index) => {
        if (!menu.service_availability || menu.service_availability.length === 0) {
          errors.push({
            type: 'error',
            field: `menus[${index}].service_availability`,
            message: 'No Hours Error',
            details: `Menu "${menu.title?.translations?.en_us || menu.id}" must have service_availability on at least one day.`,
          });
        } else {
          // Check for short hours (< 60 minutes)
          menu.service_availability.forEach((availability) => {
            availability.time_periods?.forEach((period) => {
              const duration = calculateDuration(period.start_time, period.end_time);
              if (duration < 60 && duration !== 1440) { // 1440 = full day (00:00 to 23:59)
                errors.push({
                  type: 'error',
                  field: `menus[${index}].service_availability`,
                  message: 'Short Hours Error',
                  details: `${availability.day_of_week}: ${period.start_time} - ${period.end_time} is less than 60 minutes. Must be at least 60 minutes or 24 hours.`,
                });
              }
            });
          });
        }
      });
    }

    // 4. Invalid UUID Errors
    if (config.items) {
      config.items.forEach((item, index) => {
        if (!item.id || item.id.trim() === '') {
          errors.push({
            type: 'error',
            field: `items[${index}].id`,
            message: 'Invalid Item ID',
            details: `Item at index ${index} has an empty or invalid ID.`,
          });
        }
      });
    }

    // 5. Invalid Visibility Errors - Check for overlapping time ranges
    if (config.items) {
      config.items.forEach((item, index) => {
        if (item.visibility_info?.hours) {
          item.visibility_info.hours.forEach((hourConfig, hourIndex) => {
            const overlaps = checkTimeOverlaps(hourConfig.hours_of_week || []);
            if (overlaps.length > 0) {
              errors.push({
                type: 'error',
                field: `items[${index}].visibility_info`,
                message: 'Invalid Visibility Error',
                details: `Item "${item.title?.translations?.en_us || item.id}" has overlapping time ranges: ${overlaps.join(', ')}`,
              });
            }
          });
        }
      });
    }

    // 6. Invalid Price Info Errors - Check for excessive prices
    const MAX_PRICE = 37500; // $375 in cents
    if (config.items) {
      config.items.forEach((item, index) => {
        if (item.price_info?.price && item.price_info.price > MAX_PRICE) {
          errors.push({
            type: 'error',
            field: `items[${index}].price_info.price`,
            message: 'Invalid Price Error',
            details: `Item "${item.title?.translations?.en_us || item.id}" price (${item.price_info.price / 100}) exceeds maximum allowed value ($375).`,
          });
        }
      });
    }

    // 7. Missing Categories/Items in Menus
    if (config.menus) {
      config.menus.forEach((menu, index) => {
        if (!menu.category_ids || menu.category_ids.length === 0) {
          errors.push({
            type: 'warning',
            field: `menus[${index}].category_ids`,
            message: 'Empty Menu',
            details: `Menu "${menu.title?.translations?.en_us || menu.id}" has no categories assigned.`,
          });
        }
      });
    }

    return errors;
  };

  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    // Handle 24-hour case (00:00 to 23:59)
    if (startTime === "00:00" && endTime === "23:59") {
      return 1440; // Full day
    }
    
    // Handle overnight case
    if (endMinutes <= startMinutes) {
      endMinutes += 1440; // Add 24 hours
    }
    
    return endMinutes - startMinutes;
  };

  const checkTimeOverlaps = (hoursOfWeek: Array<{
    day_of_week: string;
    time_periods?: Array<{ start_time: string; end_time: string }>;
  }>): string[] => {
    const overlaps: string[] = [];
    
    hoursOfWeek.forEach((dayConfig) => {
      const periods = dayConfig.time_periods || [];
      
      for (let i = 0; i < periods.length; i++) {
        for (let j = i + 1; j < periods.length; j++) {
          const period1 = periods[i];
          const period2 = periods[j];
          
          if (timeRangesOverlap(period1.start_time, period1.end_time, period2.start_time, period2.end_time)) {
            overlaps.push(
              `${dayConfig.day_of_week}: ${period1.start_time}-${period1.end_time} overlaps with ${period2.start_time}-${period2.end_time}`
            );
          }
        }
      }
    });
    
    return overlaps;
  };

  const timeRangesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    const [s1h, s1m] = start1.split(':').map(Number);
    const [e1h, e1m] = end1.split(':').map(Number);
    const [s2h, s2m] = start2.split(':').map(Number);
    const [e2h, e2m] = end2.split(':').map(Number);
    
    const s1 = s1h * 60 + s1m;
    const e1 = e1h * 60 + e1m;
    const s2 = s2h * 60 + s2m;
    const e2 = e2h * 60 + e2m;
    
    return (s1 < e2 && e1 > s2);
  };

  return { validateMenu };
};
