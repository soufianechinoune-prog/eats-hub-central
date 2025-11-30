// INSEE Commune Density Data - Grille de densité 2025
// 7 levels of density classification (DENS7)

export interface CommuneDensity {
  code: string;      // CODGEO - Code commune (5 digits)
  name: string;      // LIBGEO - Nom commune
  department: string; // DEP - Department code (2-3 digits)
  population: number; // PMUN22 - Population 2022
  dens7: number;     // DENS7 - 7-level density (1-7)
}

// 7 density levels with labels and colors for expansion planning
export const DENS7_LEVELS = [
  { 
    level: 1, 
    label: "Paris", 
    color: "hsl(280, 70%, 45%)", // Purple - very dense
    priority: "high",
    description: "Densité maximale - Paris"
  },
  { 
    level: 2, 
    label: "Centres urbains intermédiaires", 
    color: "hsl(0, 70%, 50%)", // Red - very high
    priority: "high",
    description: "Grandes agglomérations hors Paris"
  },
  { 
    level: 3, 
    label: "Petites villes", 
    color: "hsl(25, 80%, 50%)", // Orange - high
    priority: "high",
    description: "Villes moyennes et petites"
  },
  { 
    level: 4, 
    label: "Ceintures urbaines", 
    color: "hsl(45, 80%, 50%)", // Yellow-orange - medium-high
    priority: "medium",
    description: "Périphéries des grandes villes"
  },
  { 
    level: 5, 
    label: "Bourgs ruraux", 
    color: "hsl(100, 50%, 50%)", // Light green - medium
    priority: "low",
    description: "Bourgs et villages ruraux"
  },
  { 
    level: 6, 
    label: "Rural à habitat dispersé", 
    color: "hsl(180, 40%, 60%)", // Teal - low
    priority: "none",
    description: "Zones rurales dispersées"
  },
  { 
    level: 7, 
    label: "Rural très dispersé", 
    color: "hsl(210, 30%, 70%)", // Light blue-gray - very low
    priority: "none",
    description: "Zones rurales très peu denses"
  },
];

// Get color for a density level
export const getDens7Color = (level: number): string => {
  const found = DENS7_LEVELS.find(l => l.level === level);
  return found?.color || "hsl(0, 0%, 70%)";
};

// Get level info
export const getDens7Info = (level: number) => {
  return DENS7_LEVELS.find(l => l.level === level);
};

// Priority expansion zones (levels 1-4)
export const isExpansionPriority = (level: number): boolean => {
  return level >= 1 && level <= 4;
};

// High priority zones (levels 1-3)
export const isHighPriority = (level: number): boolean => {
  return level >= 1 && level <= 3;
};

// Sample of major communes for visualization (populated from INSEE data)
// Focus on urban areas (DENS7 levels 1-4) which are relevant for Chicken Street expansion
// Format: [code, name, department, population, dens7, lat, lng]
export const MAJOR_COMMUNES: Array<[string, string, string, number, number, number, number]> = [
  // Paris (level 1)
  ["75056", "Paris", "75", 2133111, 1, 48.8566, 2.3522],
  
  // Île-de-France major urban centers (level 2)
  ["92012", "Boulogne-Billancourt", "92", 121334, 2, 48.8397, 2.2399],
  ["93066", "Saint-Denis", "93", 115103, 2, 48.9362, 2.3574],
  ["92044", "Levallois-Perret", "92", 66082, 2, 48.8933, 2.2873],
  ["94028", "Créteil", "94", 93344, 2, 48.7904, 2.4628],
  ["93001", "Aubervilliers", "93", 89823, 2, 48.9134, 2.3824],
  ["92051", "Neuilly-sur-Seine", "92", 59848, 2, 48.8847, 2.2688],
  ["93048", "Montreuil", "93", 111305, 2, 48.8638, 2.4484],
  ["94016", "Champigny-sur-Marne", "94", 77883, 2, 48.8176, 2.5159],
  ["93008", "Bobigny", "93", 54193, 2, 48.9106, 2.4378],
  ["92062", "Puteaux", "92", 44768, 2, 48.8851, 2.2389],
  ["92073", "Suresnes", "92", 49900, 2, 48.8712, 2.2292],
  ["91228", "Évry-Courcouronnes", "91", 68738, 2, 48.6297, 2.4400],
  ["78646", "Versailles", "78", 85862, 2, 48.8014, 2.1301],
  ["95127", "Cergy", "95", 67472, 2, 49.0363, 2.0638],
  ["77288", "Meaux", "77", 55750, 2, 48.9601, 2.8786],
  
  // Other major French cities (level 2)
  ["69123", "Lyon", "69", 522969, 2, 45.7578, 4.8320],
  ["13055", "Marseille", "13", 873076, 2, 43.2965, 5.3698],
  ["31555", "Toulouse", "31", 493465, 2, 43.6047, 1.4442],
  ["06088", "Nice", "06", 342522, 2, 43.7102, 7.2620],
  ["44109", "Nantes", "44", 320732, 2, 47.2184, -1.5536],
  ["34172", "Montpellier", "34", 299096, 2, 43.6108, 3.8767],
  ["67482", "Strasbourg", "67", 287228, 2, 48.5734, 7.7521],
  ["33063", "Bordeaux", "33", 260958, 2, 44.8378, -0.5792],
  ["59350", "Lille", "59", 236234, 2, 50.6292, 3.0573],
  ["35238", "Rennes", "35", 222485, 2, 48.1173, -1.6778],
  ["51454", "Reims", "51", 182211, 2, 49.2583, 4.0317],
  ["76540", "Rouen", "76", 113357, 2, 49.4432, 1.0993],
  ["42218", "Saint-Étienne", "42", 174082, 2, 45.4397, 4.3872],
  ["38185", "Grenoble", "38", 158454, 2, 45.1885, 5.7245],
  ["21231", "Dijon", "21", 159346, 2, 47.3220, 5.0415],
  ["49007", "Angers", "49", 157175, 2, 47.4784, -0.5632],
  ["37261", "Tours", "37", 136565, 2, 47.3941, 0.6848],
  ["30189", "Nîmes", "30", 150672, 2, 43.8367, 4.3601],
  ["63113", "Clermont-Ferrand", "63", 147865, 2, 45.7772, 3.0870],
  ["80021", "Amiens", "80", 136105, 2, 49.8941, 2.2958],
  
  // Petites villes (level 3)
  ["78498", "Poissy", "78", 40032, 3, 48.9287, 2.0490],
  ["91477", "Palaiseau", "91", 35568, 3, 48.7144, 2.2479],
  ["95500", "Pontoise", "95", 31786, 3, 49.0504, 2.1007],
  ["77186", "Fontainebleau", "77", 14969, 3, 48.4041, 2.7017],
  ["78551", "Saint-Germain-en-Laye", "78", 46440, 3, 48.8989, 2.0938],
  ["91027", "Arpajon", "91", 11356, 3, 48.5901, 2.2478],
  ["77305", "Montereau-Fault-Yonne", "77", 18918, 3, 48.3859, 2.9556],
  ["77317", "Noisiel", "77", 16318, 3, 48.8451, 2.6275],
  
  // Ceintures urbaines (level 4)
  ["78358", "Les Mureaux", "78", 33217, 4, 48.9877, 1.9171],
  ["91174", "Corbeil-Essonnes", "91", 51771, 4, 48.6144, 2.4826],
  ["77284", "Meaux", "77", 55750, 4, 48.9601, 2.8786],
  ["95306", "Herblay", "95", 30139, 4, 48.9933, 2.1650],
  ["78208", "Épône", "78", 6915, 4, 48.9553, 1.8178],
  
  // Additional cities where Chicken Street operates or could expand
  ["93007", "Blanc-Mesnil", "93", 55835, 2, 48.9385, 2.4618],
  ["93053", "Noisy-le-Grand", "93", 69756, 2, 48.8484, 2.5526],
  ["94080", "Vincennes", "94", 50046, 2, 48.8474, 2.4396],
  ["92050", "Nanterre", "92", 96689, 2, 48.8924, 2.2066],
  ["93029", "Drancy", "93", 73806, 2, 48.9296, 2.4449],
  ["92020", "Colombes", "92", 86368, 2, 48.9232, 2.2527],
  ["93005", "Aulnay-sous-Bois", "93", 85740, 2, 48.9385, 2.4934],
  ["94046", "Maisons-Alfort", "94", 56072, 2, 48.8058, 2.4383],
  ["91521", "Ris-Orangis", "91", 29186, 3, 48.6544, 2.4156],
  ["91315", "Juvisy-sur-Orge", "91", 16943, 3, 48.6908, 2.3831],
  ["92040", "Issy-les-Moulineaux", "92", 70465, 2, 48.8247, 2.2700],
  ["92019", "Clamart", "92", 53614, 2, 48.8024, 2.2641],
  ["92036", "Gennevilliers", "92", 48704, 2, 48.9326, 2.3019],
  ["94002", "Alfortville", "94", 44807, 2, 48.8057, 2.4200],
  ["91286", "Grigny", "91", 28950, 3, 48.6536, 2.3839],
  ["93072", "Sevran", "93", 52018, 2, 48.9436, 2.5309],
  ["93027", "La Courneuve", "93", 44707, 2, 48.9286, 2.3962],
  
  // Lyon metro area
  ["69266", "Villeurbanne", "69", 154320, 2, 45.7666, 4.8795],
  ["69256", "Vénissieux", "69", 66152, 2, 45.6967, 4.8861],
  ["69290", "Vaulx-en-Velin", "69", 52750, 2, 45.7869, 4.9198],
  ["69034", "Bron", "69", 43056, 2, 45.7383, 4.9128],
  ["69202", "Saint-Priest", "69", 47478, 2, 45.6969, 4.9450],
  
  // Marseille metro area
  ["13001", "Aix-en-Provence", "13", 147477, 2, 43.5297, 5.4474],
  ["13047", "Marignane", "13", 35145, 3, 43.4167, 5.2167],
  ["13117", "Vitrolles", "13", 35533, 3, 43.4600, 5.2483],
  
  // Toulouse metro area
  ["31149", "Colomiers", "31", 40922, 3, 43.6108, 1.3361],
  ["31557", "Tournefeuille", "31", 27968, 3, 43.5858, 1.3450],
  ["31069", "Blagnac", "31", 25138, 3, 43.6328, 1.3939],
  
  // Lille metro area
  ["59512", "Roubaix", "59", 98828, 2, 50.6892, 3.1746],
  ["59599", "Tourcoing", "59", 98665, 2, 50.7240, 3.1612],
  ["59653", "Villeneuve-d'Ascq", "59", 63744, 2, 50.6225, 3.1416],
  
  // Bordeaux metro area
  ["33281", "Mérignac", "33", 73197, 3, 44.8386, -0.6436],
  ["33449", "Pessac", "33", 64347, 3, 44.8063, -0.6314],
  ["33522", "Talence", "33", 43820, 3, 44.8006, -0.5872],
  
  // Nantes metro area
  ["44162", "Saint-Herblain", "44", 48148, 3, 47.2125, -1.6497],
  ["44143", "Rezé", "44", 43295, 3, 47.1833, -1.5500],
  
  // Senegal - Dakar (international expansion)
  ["SN001", "Dakar", "SN", 1146053, 2, 14.6928, -17.4467],
  
  // UAE - Dubai (international expansion)
  ["AE001", "Dubai", "AE", 3478300, 2, 25.2048, 55.2708],
  
  // Morocco - Marrakech (international expansion)  
  ["MA001", "Marrakech", "MA", 928850, 2, 31.6295, -7.9811],
];

// Index by commune code for fast lookup
export const COMMUNE_DENSITY_INDEX: Record<string, CommuneDensity> = {};
MAJOR_COMMUNES.forEach(([code, name, department, population, dens7]) => {
  COMMUNE_DENSITY_INDEX[code] = { code, name, department, population, dens7 } as CommuneDensity;
});

// Get communes by density level
export const getCommunesByDensityLevel = (level: number): typeof MAJOR_COMMUNES => {
  return MAJOR_COMMUNES.filter(([, , , , dens7]) => dens7 === level);
};

// Get all priority expansion communes (levels 1-4)
export const getExpansionPriorityCommunes = (): typeof MAJOR_COMMUNES => {
  return MAJOR_COMMUNES.filter(([, , , , dens7]) => isExpansionPriority(dens7));
};

// Get high priority communes (levels 1-3)
export const getHighPriorityCommunes = (): typeof MAJOR_COMMUNES => {
  return MAJOR_COMMUNES.filter(([, , , , dens7]) => isHighPriority(dens7));
};

// Statistics by density level
export const getDensityStats = () => {
  const stats = DENS7_LEVELS.map(level => {
    const communes = getCommunesByDensityLevel(level.level);
    const totalPop = communes.reduce((sum, [, , , pop]) => sum + pop, 0);
    return {
      ...level,
      communeCount: communes.length,
      totalPopulation: totalPop,
    };
  });
  return stats;
};

// Filter communes by department
export const getCommunesByDepartment = (dep: string): typeof MAJOR_COMMUNES => {
  return MAJOR_COMMUNES.filter(([, , department]) => department === dep);
};

// GeoJSON generation for map visualization
export const generateCommuneDensityGeoJSON = (
  filteredLevels: number[] = [1, 2, 3, 4, 5, 6, 7]
): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = MAJOR_COMMUNES
    .filter(([, , , , dens7]) => filteredLevels.includes(dens7))
    .map(([code, name, department, population, dens7, lat, lng]) => ({
      type: "Feature" as const,
      properties: {
        code,
        name,
        department,
        population,
        dens7,
        color: getDens7Color(dens7),
        label: getDens7Info(dens7)?.label,
        priority: getDens7Info(dens7)?.priority,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [lng, lat],
      },
    }));

  return {
    type: "FeatureCollection",
    features,
  };
};
