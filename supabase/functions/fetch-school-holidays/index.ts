import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping des départements vers les zones scolaires
const DEPARTMENT_TO_ZONE: Record<string, string> = {
  // Zone A
  "01": "A", "03": "A", "07": "A", "15": "A", "26": "A", "38": "A", "42": "A",
  "43": "A", "63": "A", "69": "A", "73": "A", "74": "A", // Académie Lyon, Clermont-Ferrand, Grenoble
  "21": "A", "25": "A", "39": "A", "58": "A", "70": "A", "71": "A", "89": "A", "90": "A", // Besançon, Dijon
  "24": "A", "33": "A", "40": "A", "47": "A", "64": "A", // Bordeaux
  "19": "A", "23": "A", "87": "A", // Limoges
  "16": "A", "17": "A", "79": "A", "86": "A", // Poitiers
  
  // Zone B
  "14": "B", "27": "B", "50": "B", "61": "B", "76": "B", // Normandie (Caen, Rouen)
  "02": "B", "59": "B", "60": "B", "62": "B", "80": "B", // Lille, Amiens
  "08": "B", "10": "B", "51": "B", "52": "B", "54": "B", "55": "B", "57": "B", 
  "67": "B", "68": "B", "88": "B", // Nancy-Metz, Reims, Strasbourg
  "18": "B", "28": "B", "36": "B", "37": "B", "41": "B", "45": "B", // Orléans-Tours
  "22": "B", "29": "B", "35": "B", "56": "B", // Rennes
  "44": "B", "49": "B", "53": "B", "72": "B", "85": "B", // Nantes
  
  // Zone C (Paris et région parisienne + Sud)
  "75": "C", "77": "C", "78": "C", "91": "C", "92": "C", "93": "C", "94": "C", "95": "C", // Île-de-France
  "09": "C", "11": "C", "12": "C", "30": "C", "31": "C", "32": "C", "34": "C", 
  "46": "C", "48": "C", "65": "C", "66": "C", "81": "C", "82": "C", // Montpellier, Toulouse
  "04": "C", "05": "C", "06": "C", "13": "C", "83": "C", "84": "C", // Aix-Marseille, Nice
  "2A": "C", "2B": "C", // Corse
};

interface SchoolHoliday {
  id: string;
  description: string;
  start_date: string;
  end_date: string;
  zones: string[];
  location: string;
  annee_scolaire: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year } = await req.json();
    const currentYear = year || new Date().getFullYear();
    
    // Fetch school holidays from data.gouv.fr API
    // API: https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records
    const apiUrl = new URL('https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records');
    apiUrl.searchParams.set('limit', '100');
    apiUrl.searchParams.set('refine', `annee_scolaire:${currentYear - 1}-${currentYear}`);
    // Also get next school year
    const apiUrl2 = new URL('https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records');
    apiUrl2.searchParams.set('limit', '100');
    apiUrl2.searchParams.set('refine', `annee_scolaire:${currentYear}-${currentYear + 1}`);
    
    console.log('Fetching school holidays from:', apiUrl.toString());
    
    const [response1, response2] = await Promise.all([
      fetch(apiUrl.toString()),
      fetch(apiUrl2.toString())
    ]);
    
    if (!response1.ok || !response2.ok) {
      throw new Error(`API error: ${response1.status} / ${response2.status}`);
    }
    
    const [data1, data2] = await Promise.all([
      response1.json(),
      response2.json()
    ]);
    
    const allRecords = [...(data1.results || []), ...(data2.results || [])];
    
    // Transform and deduplicate holidays
    const holidaysMap = new Map<string, SchoolHoliday>();
    
    for (const record of allRecords) {
      const description = record.description || '';
      const zones = record.zones?.split(',').map((z: string) => z.trim()) || [];
      const location = record.location || 'France métropolitaine';
      const startDate = record.start_date?.split('T')[0];
      const endDate = record.end_date?.split('T')[0];
      
      if (!startDate || !endDate) continue;
      
      // Create a unique key for each holiday period
      const key = `${description}-${startDate}-${endDate}`;
      
      if (holidaysMap.has(key)) {
        // Merge zones if holiday already exists
        const existing = holidaysMap.get(key)!;
        zones.forEach((z: string) => {
          if (!existing.zones.includes(z)) {
            existing.zones.push(z);
          }
        });
      } else {
        holidaysMap.set(key, {
          id: `holiday-${key}`,
          description,
          start_date: startDate,
          end_date: endDate,
          zones,
          location,
          annee_scolaire: record.annee_scolaire || '',
        });
      }
    }
    
    const holidays = Array.from(holidaysMap.values());
    
    console.log(`Found ${holidays.length} unique school holidays`);

    return new Response(
      JSON.stringify({ 
        holidays,
        departmentToZone: DEPARTMENT_TO_ZONE,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching school holidays:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
