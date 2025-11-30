// Simplified population density data for French departments (habitants/km²)
// Source: INSEE 2023
export const FRANCE_DEPARTMENT_DENSITY: Record<string, { name: string; density: number; center: [number, number] }> = {
  "01": { name: "Ain", density: 106, center: [5.35, 46.20] },
  "02": { name: "Aisne", density: 72, center: [3.62, 49.46] },
  "03": { name: "Allier", density: 46, center: [3.33, 46.57] },
  "04": { name: "Alpes-de-Haute-Provence", density: 24, center: [6.24, 44.09] },
  "05": { name: "Hautes-Alpes", density: 26, center: [6.26, 44.67] },
  "06": { name: "Alpes-Maritimes", density: 252, center: [7.12, 43.93] },
  "07": { name: "Ardèche", density: 58, center: [4.42, 44.75] },
  "08": { name: "Ardennes", density: 54, center: [4.62, 49.62] },
  "09": { name: "Ariège", density: 31, center: [1.50, 42.93] },
  "10": { name: "Aube", density: 51, center: [4.08, 48.32] },
  "11": { name: "Aude", density: 60, center: [2.35, 43.10] },
  "12": { name: "Aveyron", density: 32, center: [2.67, 44.27] },
  "13": { name: "Bouches-du-Rhône", density: 401, center: [5.05, 43.55] },
  "14": { name: "Calvados", density: 124, center: [-0.37, 49.10] },
  "15": { name: "Cantal", density: 26, center: [2.67, 45.03] },
  "16": { name: "Charente", density: 59, center: [0.15, 45.75] },
  "17": { name: "Charente-Maritime", density: 92, center: [-0.75, 45.75] },
  "18": { name: "Cher", density: 42, center: [2.50, 47.08] },
  "19": { name: "Corrèze", density: 40, center: [1.88, 45.37] },
  "21": { name: "Côte-d'Or", density: 60, center: [4.77, 47.42] },
  "22": { name: "Côtes-d'Armor", density: 87, center: [-2.78, 48.45] },
  "23": { name: "Creuse", density: 21, center: [2.05, 46.08] },
  "24": { name: "Dordogne", density: 46, center: [0.72, 45.13] },
  "25": { name: "Doubs", density: 103, center: [6.35, 47.17] },
  "26": { name: "Drôme", density: 79, center: [5.17, 44.67] },
  "27": { name: "Eure", density: 97, center: [1.00, 49.10] },
  "28": { name: "Eure-et-Loir", density: 73, center: [1.33, 48.30] },
  "29": { name: "Finistère", density: 135, center: [-4.10, 48.40] },
  "2A": { name: "Corse-du-Sud", density: 36, center: [8.98, 41.85] },
  "2B": { name: "Haute-Corse", density: 39, center: [9.25, 42.40] },
  "30": { name: "Gard", density: 125, center: [4.17, 44.00] },
  "31": { name: "Haute-Garonne", density: 213, center: [1.25, 43.30] },
  "32": { name: "Gers", density: 30, center: [0.45, 43.67] },
  "33": { name: "Gironde", density: 164, center: [-0.58, 44.85] },
  "34": { name: "Hérault", density: 189, center: [3.42, 43.60] },
  "35": { name: "Ille-et-Vilaine", density: 158, center: [-1.67, 48.10] },
  "36": { name: "Indre", density: 33, center: [1.58, 46.80] },
  "37": { name: "Indre-et-Loire", density: 98, center: [0.70, 47.25] },
  "38": { name: "Isère", density: 162, center: [5.75, 45.28] },
  "39": { name: "Jura", density: 52, center: [5.70, 46.75] },
  "40": { name: "Landes", density: 44, center: [-0.77, 43.95] },
  "41": { name: "Loir-et-Cher", density: 52, center: [1.33, 47.58] },
  "42": { name: "Loire", density: 159, center: [4.17, 45.73] },
  "43": { name: "Haute-Loire", density: 45, center: [3.88, 45.08] },
  "44": { name: "Loire-Atlantique", density: 207, center: [-1.68, 47.35] },
  "45": { name: "Loiret", density: 98, center: [2.17, 47.90] },
  "46": { name: "Lot", density: 33, center: [1.60, 44.62] },
  "47": { name: "Lot-et-Garonne", density: 62, center: [0.50, 44.35] },
  "48": { name: "Lozère", density: 15, center: [3.50, 44.52] },
  "49": { name: "Maine-et-Loire", density: 114, center: [-0.55, 47.45] },
  "50": { name: "Manche", density: 82, center: [-1.25, 49.00] },
  "51": { name: "Marne", density: 70, center: [4.17, 49.00] },
  "52": { name: "Haute-Marne", density: 29, center: [5.17, 48.10] },
  "53": { name: "Mayenne", density: 59, center: [-0.77, 48.15] },
  "54": { name: "Meurthe-et-Moselle", density: 140, center: [6.17, 48.83] },
  "55": { name: "Meuse", density: 30, center: [5.38, 49.00] },
  "56": { name: "Morbihan", density: 108, center: [-2.75, 47.75] },
  "57": { name: "Moselle", density: 168, center: [6.67, 49.08] },
  "58": { name: "Nièvre", density: 31, center: [3.50, 47.08] },
  "59": { name: "Nord", density: 452, center: [3.17, 50.43] },
  "60": { name: "Oise", density: 140, center: [2.42, 49.42] },
  "61": { name: "Orne", density: 47, center: [0.08, 48.62] },
  "62": { name: "Pas-de-Calais", density: 220, center: [2.17, 50.50] },
  "63": { name: "Puy-de-Dôme", density: 81, center: [3.08, 45.72] },
  "64": { name: "Pyrénées-Atlantiques", density: 88, center: [-0.77, 43.25] },
  "65": { name: "Hautes-Pyrénées", density: 51, center: [0.15, 43.03] },
  "66": { name: "Pyrénées-Orientales", density: 114, center: [2.52, 42.60] },
  "67": { name: "Bas-Rhin", density: 234, center: [7.50, 48.67] },
  "68": { name: "Haut-Rhin", density: 216, center: [7.25, 47.87] },
  "69": { name: "Rhône", density: 569, center: [4.62, 45.87] },
  "70": { name: "Haute-Saône", density: 44, center: [6.08, 47.62] },
  "71": { name: "Saône-et-Loire", density: 64, center: [4.50, 46.67] },
  "72": { name: "Sarthe", density: 92, center: [0.17, 47.95] },
  "73": { name: "Savoie", density: 71, center: [6.42, 45.50] },
  "74": { name: "Haute-Savoie", density: 166, center: [6.42, 46.00] },
  "75": { name: "Paris", density: 20755, center: [2.35, 48.86] },
  "76": { name: "Seine-Maritime", density: 199, center: [0.97, 49.65] },
  "77": { name: "Seine-et-Marne", density: 240, center: [2.97, 48.62] },
  "78": { name: "Yvelines", density: 631, center: [1.83, 48.83] },
  "79": { name: "Deux-Sèvres", density: 62, center: [-0.33, 46.55] },
  "80": { name: "Somme", density: 92, center: [2.33, 49.92] },
  "81": { name: "Tarn", density: 66, center: [2.17, 43.80] },
  "82": { name: "Tarn-et-Garonne", density: 67, center: [1.25, 44.08] },
  "83": { name: "Var", density: 174, center: [6.25, 43.42] },
  "84": { name: "Vaucluse", density: 157, center: [5.17, 44.00] },
  "85": { name: "Vendée", density: 102, center: [-1.25, 46.67] },
  "86": { name: "Vienne", density: 63, center: [0.50, 46.58] },
  "87": { name: "Haute-Vienne", density: 68, center: [1.25, 45.87] },
  "88": { name: "Vosges", density: 63, center: [6.42, 48.17] },
  "89": { name: "Yonne", density: 46, center: [3.58, 47.83] },
  "90": { name: "Territoire de Belfort", density: 232, center: [6.92, 47.63] },
  "91": { name: "Essonne", density: 716, center: [2.25, 48.53] },
  "92": { name: "Hauts-de-Seine", density: 9200, center: [2.22, 48.84] },
  "93": { name: "Seine-Saint-Denis", density: 6850, center: [2.48, 48.92] },
  "94": { name: "Val-de-Marne", density: 5559, center: [2.47, 48.78] },
  "95": { name: "Val-d'Oise", density: 968, center: [2.17, 49.08] },
};

// Helper to get color based on density
export const getDensityColor = (density: number): string => {
  if (density >= 1000) return "rgba(127, 0, 255, 0.6)"; // Very high (purple)
  if (density >= 500) return "rgba(255, 0, 0, 0.5)"; // High (red)
  if (density >= 200) return "rgba(255, 127, 0, 0.45)"; // Medium-high (orange)
  if (density >= 100) return "rgba(255, 255, 0, 0.4)"; // Medium (yellow)
  if (density >= 50) return "rgba(0, 255, 0, 0.35)"; // Low-medium (green)
  return "rgba(0, 127, 255, 0.3)"; // Low (blue)
};

// Generate GeoJSON features for density visualization (circular approximation per department)
export const generateDensityFeatures = () => {
  return Object.entries(FRANCE_DEPARTMENT_DENSITY).map(([code, data]) => {
    // Create a circle approximation for each department
    const radiusKm = Math.sqrt(10000 / Math.PI); // ~56km approximate department size
    const points = 32;
    const coords: [number, number][] = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusKm * Math.cos(angle);
      const dy = radiusKm * Math.sin(angle);
      const latOffset = dy / 111;
      const lngOffset = dx / (111 * Math.cos(data.center[1] * Math.PI / 180));
      coords.push([data.center[0] + lngOffset, data.center[1] + latOffset]);
    }
    coords.push(coords[0]); // Close the polygon

    return {
      type: "Feature" as const,
      properties: {
        code,
        name: data.name,
        density: data.density,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
    };
  });
};

// Density legend levels for UI
export const DENSITY_LEGEND = [
  { label: "Très élevée (>1000)", color: "rgba(127, 0, 255, 0.6)", min: 1000 },
  { label: "Élevée (500-1000)", color: "rgba(255, 0, 0, 0.5)", min: 500 },
  { label: "Moyenne-haute (200-500)", color: "rgba(255, 127, 0, 0.45)", min: 200 },
  { label: "Moyenne (100-200)", color: "rgba(255, 255, 0, 0.4)", min: 100 },
  { label: "Faible-moyenne (50-100)", color: "rgba(0, 255, 0, 0.35)", min: 50 },
  { label: "Faible (<50)", color: "rgba(0, 127, 255, 0.3)", min: 0 },
];
