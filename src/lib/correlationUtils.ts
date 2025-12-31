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
export function getCorrelationStrength(r: number, xLabel: string = "les notes"): {
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
        ? `${xLabel} et les performances évoluent ensemble` 
        : `${xLabel} et les performances évoluent en sens inverse`
    };
  } else if (absR >= 0.4) {
    return {
      label: isPositive ? "Modérée positive" : "Modérée négative",
      color: "text-amber-600 dark:text-amber-400",
      description: `Il existe une relation partielle entre ${xLabel} et les performances`
    };
  } else if (absR >= 0.2) {
    return {
      label: "Faible",
      color: "text-muted-foreground",
      description: `La relation entre ${xLabel} et les performances est peu significative`
    };
  } else {
    return {
      label: "Aucune",
      color: "text-muted-foreground",
      description: `Pas de lien apparent entre ${xLabel} et les performances`
    };
  }
}

/**
 * Get detailed explanation for correlation statistics
 */
export function getDetailedExplanation(r: number, rSquared: number, label: string, xLabel: string = "les notes"): {
  shortDescription: string;
  whatItMeans: string;
  interpretation: string;
  actionAdvice: string;
  rExplanation: string;
} {
  const percentage = Math.round(rSquared * 100);
  const isPositive = r >= 0;
  const absR = Math.abs(r);
  
  // Determine if this is weather-related
  const isWeatherCorrelation = xLabel.toLowerCase().includes("température") || xLabel.toLowerCase().includes("précipitation");
  
  // Short description based on R² percentage
  let shortDescription: string;
  let whatItMeans: string;
  let interpretation: string;
  let actionAdvice: string;
  
  if (percentage < 10) {
    shortDescription = `Seulement ${percentage}% des variations du ${label} sont liées à ${xLabel}.`;
    if (isWeatherCorrelation) {
      whatItMeans = `${xLabel} n'a quasiment aucun impact mesurable sur cette métrique. D'autres facteurs (jour, promotions, saisonnalité) sont bien plus déterminants.`;
      interpretation = "La corrélation est trop faible pour tirer des conclusions. Les variations observées sont probablement dues à d'autres facteurs.";
      actionAdvice = "La météo n'influence pas significativement vos performances. Concentrez-vous sur d'autres leviers.";
    } else {
      whatItMeans = "Les notes clients n'ont quasiment aucun impact mesurable sur cette métrique. D'autres facteurs (météo, jour, promotions, saisonnalité) sont bien plus déterminants.";
      interpretation = "La corrélation est trop faible pour tirer des conclusions. Les variations observées sont probablement dues au hasard ou à des facteurs externes.";
      actionAdvice = "Concentrez vos efforts sur d'autres leviers d'amélioration (opérations, marketing, disponibilité) plutôt que sur les notes.";
    }
  } else if (percentage < 25) {
    shortDescription = `${percentage}% des variations du ${label} peuvent être associées à ${xLabel}.`;
    if (isWeatherCorrelation) {
      whatItMeans = `Il existe une légère relation entre ${xLabel} et cette métrique, mais elle reste faible.`;
      interpretation = "Une tendance existe mais elle n'est pas assez forte pour être exploitable directement.";
      actionAdvice = "Surveillez les prévisions météo mais n'en faites pas votre priorité de planification.";
    } else {
      whatItMeans = "Il existe une légère relation entre les notes et cette métrique, mais elle reste faible. D'autres facteurs ont plus d'influence.";
      interpretation = "Une tendance existe mais elle n'est pas assez forte pour être exploitable directement.";
      actionAdvice = "Maintenez la qualité de service tout en explorant d'autres pistes d'amélioration.";
    }
  } else if (percentage < 50) {
    shortDescription = `${percentage}% des variations du ${label} sont expliquées par ${xLabel}.`;
    if (isWeatherCorrelation) {
      whatItMeans = `${xLabel} a un impact modéré sur cette métrique. C'est un facteur à prendre en compte pour la planification.`;
      interpretation = "La relation est significative : adapter votre stratégie à la météo peut avoir un effet mesurable.";
      actionAdvice = "Utilisez les prévisions météo pour anticiper la demande et ajuster vos stocks/effectifs.";
    } else {
      whatItMeans = "Les notes ont un impact modéré sur cette métrique. C'est un facteur à prendre en compte parmi d'autres.";
      interpretation = "La relation est significative : améliorer les notes devrait avoir un effet positif mesurable.";
      actionAdvice = "Investir dans l'amélioration des notes clients peut générer des résultats concrets sur cette métrique.";
    }
  } else if (percentage < 70) {
    shortDescription = `${percentage}% des variations du ${label} sont liées à ${xLabel} - c'est significatif !`;
    if (isWeatherCorrelation) {
      whatItMeans = `${xLabel} est un facteur important de cette métrique. L'impact est clairement mesurable.`;
      interpretation = "La corrélation est forte : la météo influence directement vos performances.";
      actionAdvice = "Planifiez vos ressources et promotions en fonction des prévisions météo pour maximiser vos résultats.";
    } else {
      whatItMeans = "Les notes sont un facteur important de cette métrique. L'impact est clairement mesurable.";
      interpretation = "La corrélation est forte : les notes influencent directement les performances.";
      actionAdvice = "Priorisez les actions d'amélioration de la satisfaction client pour booster cette métrique.";
    }
  } else {
    shortDescription = `${percentage}% des variations du ${label} dépendent de ${xLabel} - corrélation très forte !`;
    if (isWeatherCorrelation) {
      whatItMeans = `${xLabel} est LE facteur déterminant de cette métrique. L'impact est majeur et direct.`;
      interpretation = "Corrélation exceptionnelle : la météo et les performances sont intimement liées.";
      actionAdvice = "La météo doit être au cœur de votre planification opérationnelle et marketing.";
    } else {
      whatItMeans = "Les notes sont LE facteur déterminant de cette métrique. L'impact est majeur et direct.";
      interpretation = "Corrélation exceptionnelle : les notes et les performances sont intimement liées.";
      actionAdvice = "La satisfaction client doit être votre priorité absolue pour améliorer cette métrique.";
    }
  }
  
  // R explanation based on sign and strength
  let rExplanation: string;
  if (isPositive) {
    if (absR >= 0.4) {
      rExplanation = `Quand ${xLabel} augmente, le ${label} a tendance à augmenter aussi (et inversement).`;
    } else {
      rExplanation = `Tendance légère : ${xLabel} et le ${label} évoluent dans le même sens.`;
    }
  } else {
    if (absR >= 0.4) {
      if (isWeatherCorrelation) {
        rExplanation = `Quand ${xLabel} augmente, le ${label} a tendance à baisser. Cela peut indiquer un comportement saisonnier de vos clients.`;
      } else {
        rExplanation = `Quand les notes montent, le ${label} a tendance à baisser (relation inverse). Cela peut s'expliquer par un effet de décalage temporel.`;
      }
    } else {
      rExplanation = `Légère tendance inverse entre ${xLabel} et ${label}. Probablement dû au hasard ou à d'autres facteurs.`;
    }
  }
  
  return {
    shortDescription,
    whatItMeans,
    interpretation,
    actionAdvice,
    rExplanation
  };
}
