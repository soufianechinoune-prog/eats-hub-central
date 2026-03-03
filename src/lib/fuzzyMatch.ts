// Fuzzy matching utilities for product name comparison

/**
 * Normalize a product name for comparison
 */
export const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[""«»']/g, "") // Remove quotes
    .replace(/[🔥🌶️🧀🥓🍯🐐👧🧒❤💥🤩🫓🍔🌮🌯🍜🤤🍗✴✨💦]+/g, "") // Remove emojis
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Calculate Levenshtein distance between two strings
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
};

/**
 * Calculate similarity score between two strings (0-100)
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);

  if (norm1 === norm2) return 100;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(norm1, norm2);
  return Math.round((1 - distance / maxLen) * 100);
};

/**
 * Normalize a name more aggressively for loose matching
 * Removes hyphens and extra spaces to match different formats
 */
export const normalizeForLooseMatch = (name: string): string => {
  return normalizeName(name)
    .replace(/ - /g, " ")  // Replace " - " with simple space
    .replace(/-/g, " ")     // Remove remaining hyphens
    .replace(/\s+/g, " ")   // Normalize spaces
    .trim();
};

/**
 * Check if one city name starts with another (for partial matches like "Bonneuil" vs "Bonneuil sur Marne")
 */
export const cityStartsWith = (shortName: string, fullName: string): boolean => {
  const shortNorm = normalizeForLooseMatch(shortName);
  const fullNorm = normalizeForLooseMatch(fullName);
  
  // Extract city parts (after brand)
  const brandWords = ["chicken", "street", "cs"];
  const shortParts = shortNorm.split(" ").filter(w => !brandWords.includes(w));
  const fullParts = fullNorm.split(" ").filter(w => !brandWords.includes(w));
  
  const shortCity = shortParts.join(" ");
  let fullCity = fullParts.join(" ");
  
  // Remove common French suffixes like "sur marne", "sur orge", "en france"
  fullCity = fullCity
    .replace(/ sur [a-z]+$/, "")
    .replace(/ en [a-z]+$/, "")
    .replace(/ les [a-z]+$/, "")
    .trim();
  
  // Direct comparison after suffix removal
  if (shortCity === fullCity) return true;
  
  // Prefix check
  return fullCity.startsWith(shortCity) || shortCity.startsWith(fullCity);
};

/**
 * Extract the location part from a restaurant name (after the last " - ")
 */
export const extractLocationPart = (name: string): string => {
  const normalized = normalizeName(name);
  const parts = normalized.split(" - ");
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return normalized;
};

/**
 * Calculate similarity specifically for restaurant names
 * Compares only the city/location part when format is "Brand - City"
 */
export const calculateRestaurantSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);

  // Exact match = 100%
  if (norm1 === norm2) return 100;

  // Extract location parts
  const loc1 = extractLocationPart(str1);
  const loc2 = extractLocationPart(str2);

  // If both have a location extracted (format "Brand - City")
  if (loc1 !== norm1 && loc2 !== norm2) {
    // Check that brands match first
    const brand1 = norm1.split(" - ")[0].trim();
    const brand2 = norm2.split(" - ")[0].trim();

    if (brand1 !== brand2) return 0; // Different brands = no match

    // Compare only cities
    if (loc1 === loc2) return 100;
    return calculateSimilarity(loc1, loc2);
  }

  // Standard comparison for other cases
  return calculateSimilarity(str1, str2);
};

/**
 * Check if two names contain the same key words
 */
export const containsSameKeywords = (name1: string, name2: string): boolean => {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Extract significant words (length > 3)
  const words1 = new Set(norm1.split(" ").filter((w) => w.length > 3));
  const words2 = new Set(norm2.split(" ").filter((w) => w.length > 3));

  // Count common words
  let commonCount = 0;
  words1.forEach((w) => {
    if (words2.has(w)) commonCount++;
  });

  // At least 50% of words should match
  const minWords = Math.min(words1.size, words2.size);
  return minWords > 0 && commonCount >= minWords * 0.5;
};

/**
 * Clean a Deliveroo restaurant name for matching
 * Removes brand prefix, emojis, accents, normalizes spacing
 */
export const cleanDeliverooName = (name: string): string => {
  let cleaned = name
    .replace(/chicken\s*street\s*[-–—]\s*/gi, "")
    .replace(/cs\s+orign?ial\s+by\s+chicken\s+street/gi, "")
    .replace(/cs\s+/gi, "");
  
  return normalizeName(cleaned).trim();
};

/**
 * Clean a database restaurant name for matching
 * Removes "Chicken Street - " prefix, normalizes
 */
export const cleanDbRestaurantName = (name: string): string => {
  let cleaned = name
    .replace(/chicken\s*street\s*[-–—]\s*/gi, "");
  
  return normalizeName(cleaned).trim();
};

/**
 * Hardcoded overrides for known Deliveroo name discrepancies
 * Maps cleaned Deliveroo city name -> cleaned DB restaurant city name
 */
const DELIVEROO_OVERRIDES: Record<string, string> = {
  "grenoble": "echirolles",
  "lille centre": "lille flandres",
  "lille": "lille wazemmes",
  "boulogne": "boulogne-billancourt",
  "bussy": "bussy-saint-georges",
  "evry-courcouronnes": "courcouronnes",
  "crimee": "paris 19",
  "la chapelle": "paris 18 la chapelle",
  "gare de l'est": "paris gare de l'est",
  "marseille plombieres": "plombieres",
};

/** Brands to ignore (not part of the network) */
const IGNORED_BRANDS = ["bangkok factory", "tous les etablissements"];

export interface DeliverooMatchResult {
  deliverooName: string;
  matchedRestaurantId: string | null;
  matchedRestaurantName: string | null;
  confidence: number;
  isOverride: boolean;
  isIgnored: boolean;
  isAlreadyLinked: boolean;
}

/**
 * Match a Deliveroo name against a list of restaurants from the database
 */
export const matchDeliverooToRestaurant = (
  deliverooName: string,
  restaurants: { id: string; name: string; deliveroo_store_id: string | null }[],
  existingMappings: { restaurant_id: string; deliveroo_store_name: string }[] = []
): DeliverooMatchResult => {
  // Check if already linked via multi-mapping table
  const multiMapping = existingMappings.find(m => m.deliveroo_store_name === deliverooName);
  if (multiMapping) {
    const linkedRestaurant = restaurants.find(r => r.id === multiMapping.restaurant_id);
    return {
      deliverooName,
      matchedRestaurantId: multiMapping.restaurant_id,
      matchedRestaurantName: linkedRestaurant?.name || null,
      confidence: 100,
      isOverride: false,
      isIgnored: false,
      isAlreadyLinked: true,
    };
  }

  // Fallback: check legacy single-mapping column
  const alreadyLinked = restaurants.find(r => r.deliveroo_store_id === deliverooName);
  if (alreadyLinked) {
    return {
      deliverooName,
      matchedRestaurantId: alreadyLinked.id,
      matchedRestaurantName: alreadyLinked.name,
      confidence: 100,
      isOverride: false,
      isIgnored: false,
      isAlreadyLinked: true,
    };
  }

  const cleanedDeliveroo = cleanDeliverooName(deliverooName);

  // Check if should be ignored
  if (IGNORED_BRANDS.some(b => cleanedDeliveroo.includes(b) || normalizeName(deliverooName).includes(b))) {
    return {
      deliverooName,
      matchedRestaurantId: null,
      matchedRestaurantName: null,
      confidence: 0,
      isOverride: false,
      isIgnored: true,
      isAlreadyLinked: false,
    };
  }

  // Check hardcoded overrides
  const overrideTarget = DELIVEROO_OVERRIDES[cleanedDeliveroo];
  if (overrideTarget) {
    const match = restaurants.find(r => {
      const cleanedDb = cleanDbRestaurantName(r.name);
      return cleanedDb === overrideTarget || cleanedDb.includes(overrideTarget);
    });
    if (match) {
      return {
        deliverooName,
        matchedRestaurantId: match.id,
        matchedRestaurantName: match.name,
        confidence: 95,
        isOverride: true,
        isIgnored: false,
        isAlreadyLinked: false,
      };
    }
  }

  // Fuzzy matching: compare cleaned names
  let bestMatch: { id: string; name: string } | null = null;
  let bestScore = 0;

  for (const r of restaurants) {
    const cleanedDb = cleanDbRestaurantName(r.name);
    
    // Exact match after cleaning
    if (cleanedDeliveroo === cleanedDb) {
      return {
        deliverooName,
        matchedRestaurantId: r.id,
        matchedRestaurantName: r.name,
        confidence: 100,
        isOverride: false,
        isIgnored: false,
        isAlreadyLinked: false,
      };
    }

    // Loose match (removing hyphens, suffixes)
    const looseDeliveroo = normalizeForLooseMatch(cleanedDeliveroo);
    const looseDb = normalizeForLooseMatch(cleanedDb);
    if (looseDeliveroo === looseDb) {
      return {
        deliverooName,
        matchedRestaurantId: r.id,
        matchedRestaurantName: r.name,
        confidence: 95,
        isOverride: false,
        isIgnored: false,
        isAlreadyLinked: false,
      };
    }

    // City starts with check
    if (cityStartsWith(cleanedDeliveroo, cleanedDb) || cityStartsWith(cleanedDb, cleanedDeliveroo)) {
      const score = 85;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = r;
      }
      continue;
    }

    // Levenshtein similarity
    const similarity = calculateSimilarity(cleanedDeliveroo, cleanedDb);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = r;
    }
  }

  return {
    deliverooName,
    matchedRestaurantId: bestMatch?.id || null,
    matchedRestaurantName: bestMatch?.name || null,
    confidence: bestScore,
    isOverride: false,
    isIgnored: false,
    isAlreadyLinked: false,
  };
};

export interface MatchCandidate {
  id: string;
  name: string;
  price_uber: number | null;
  price_deliveroo: number | null;
  similarity: number;
}

/**
 * Find potential matches for a product name
 */
export const findPotentialMatches = (
  targetName: string,
  candidates: { id: string; name: string; price_uber: number | null; price_deliveroo: number | null }[],
  minSimilarity: number = 60
): MatchCandidate[] => {
  const matches: MatchCandidate[] = [];

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(targetName, candidate.name);

    if (similarity >= minSimilarity || containsSameKeywords(targetName, candidate.name)) {
      matches.push({
        ...candidate,
        similarity: Math.max(similarity, containsSameKeywords(targetName, candidate.name) ? 65 : 0),
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
};
