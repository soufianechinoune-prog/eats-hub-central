/**
 * Centralized performance thresholds for color coding metrics
 * Used across Overview table, exports, and comparison pages
 */

export const PERFORMANCE_THRESHOLDS = {
  rating: {
    good: 4.5,    // ≥ 4.5 = vert
    warning: 4.0, // 4.0-4.5 = orange, < 4.0 = rouge
  },
  profitability: {
    good: 60,     // ≥ 60% = vert
    warning: 50,  // 50-60% = orange, < 50% = rouge
  },
  prepTime: {
    good: 4,      // ≤ 4 min = vert
    warning: 6,   // 4-6 min = orange, > 6 min = rouge
  },
  totalDeliveryTime: {
    good: 30,     // ≤ 30 min = vert
    warning: 40,  // 30-40 min = orange, > 40 min = rouge
  },
  errorRate: {
    good: 2,      // < 2% = vert
    warning: 5,   // 2-5% = orange, > 5% = rouge
  },
  downtime: {
    good: 1,      // < 1h = vert
    warning: 3,   // 1-3h = orange, > 3h = rouge
  },
  availabilityRate: {
    good: 99,     // ≥ 99% = vert
    warning: 97,  // 97-99% = orange, < 97% = rouge
  },
  revenueVariation: {
    good: 0,      // > 0% = vert
    warning: -5,  // -5% à 0% = orange, < -5% = rouge
  },
};

export type MetricStatus = "good" | "warning" | "critical";

/**
 * Get the status of a metric based on thresholds
 * @param metric - The metric name
 * @param value - The metric value
 * @returns The status: 'good' | 'warning' | 'critical'
 */
export function getMetricStatus(
  metric: keyof typeof PERFORMANCE_THRESHOLDS,
  value: number | null | undefined
): MetricStatus {
  if (value == null || isNaN(value)) return "warning";

  const thresholds = PERFORMANCE_THRESHOLDS[metric];

  // Different logic for different metrics
  switch (metric) {
    case "rating":
    case "profitability":
    case "revenueVariation":
    case "availabilityRate":
      // Higher is better
      if (value >= thresholds.good) return "good";
      if (value >= thresholds.warning) return "warning";
      return "critical";

    case "prepTime":
    case "totalDeliveryTime":
    case "errorRate":
    case "downtime":
      // Lower is better
      if (value <= thresholds.good) return "good";
      if (value <= thresholds.warning) return "warning";
      return "critical";

    default:
      return "warning";
  }
}

/**
 * Get Tailwind CSS classes for a metric status
 * @param status - The metric status
 * @returns CSS classes for text color
 */
export function getStatusTextClass(status: MetricStatus): string {
  switch (status) {
    case "good":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "critical":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Get Tailwind CSS classes for a metric status background
 * @param status - The metric status
 * @returns CSS classes for background color
 */
export function getStatusBgClass(status: MetricStatus): string {
  switch (status) {
    case "good":
      return "bg-emerald-500/10";
    case "warning":
      return "bg-amber-500/10";
    case "critical":
      return "bg-red-500/10";
  }
}
