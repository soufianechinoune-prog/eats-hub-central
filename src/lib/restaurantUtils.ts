/**
 * Extracts a shortened city name from a full restaurant name
 * @example "CHICKEN STREET ANTONY" → "Antony"
 * @example "CHICKEN STREET JUVISY-SUR-ORGE" → "Juvisy"
 * @example "CHICKEN STREET ATHIS-MONS" → "Athis-Mons"
 * @example "CHICKEN STREET BONNEUIL-SUR-MARNE" → "Bonneuil"
 */
export const extractCityName = (fullName: string): string => {
  // Remove common prefixes
  let cityPart = fullName
    .replace(/^CHICKEN STREET\s*/i, "")
    .replace(/^CS\s*/i, "")
    .replace(/^-\s*/, "")
    .trim();
  
  if (!cityPart) return fullName;
  
  // Handle compound names with "-SUR-" pattern (keep first part only)
  if (cityPart.toUpperCase().includes("-SUR-")) {
    cityPart = cityPart.split("-SUR-")[0];
  }
  
  // Capitalize properly: "ANTONY" → "Antony", "ATHIS-MONS" → "Athis-Mons"
  return cityPart
    .toLowerCase()
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
};
