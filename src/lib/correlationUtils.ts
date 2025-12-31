/**
 * Calculate the Pearson correlation coefficient between two arrays
 * Returns a value between -1 and 1
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Calculate R² (coefficient of determination)
 * Returns a value between 0 and 1
 */
export function calculateRSquared(x: number[], y: number[]): number {
  const r = calculatePearsonCorrelation(x, y);
  return r * r;
}

/**
 * Calculate linear regression (y = slope * x + intercept)
 */
export function calculateLinearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  if (x.length !== y.length || x.length === 0) {
    return { slope: 0, intercept: 0 };
  }
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n };
  }
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

/**
 * Get correlation strength interpretation
 */
export function getCorrelationStrength(r: number): {
  label: string;
  color: string;
  description: string;
} {
  const absR = Math.abs(r);
  const isPositive = r >= 0;
  
  if (absR >= 0.7) {
    return {
      label: isPositive ? "Forte positive" : "Forte négative",
      color: isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
      description: isPositive 
        ? "Les notes et les performances évoluent ensemble" 
        : "Les notes et les performances évoluent en sens inverse"
    };
  } else if (absR >= 0.4) {
    return {
      label: isPositive ? "Modérée positive" : "Modérée négative",
      color: "text-amber-600 dark:text-amber-400",
      description: "Il existe une relation partielle entre les notes et les performances"
    };
  } else if (absR >= 0.2) {
    return {
      label: "Faible",
      color: "text-muted-foreground",
      description: "La relation entre notes et performances est peu significative"
    };
  } else {
    return {
      label: "Aucune",
      color: "text-muted-foreground",
      description: "Pas de lien apparent entre les notes et les performances"
    };
  }
}
