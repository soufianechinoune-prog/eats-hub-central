import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AMP Metropole OpenDataSoft API - Public access to INSEE 200m grid data
const API_URL = "https://data.ampmetropole.fr/api/explore/v2.1/catalog/datasets/donnees-carroyees-a-200m-france/records";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { departments } = await req.json();

    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      return new Response(
        JSON.stringify({ error: "departments array is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter valid French department codes (2 digits, or 2A/2B for Corsica, or 97x for DOM)
    const validDepartments = departments.filter((dept: string) => {
      const normalized = dept.toString().padStart(2, '0');
      return /^[0-9]{2}$|^2[AB]$|^97[1-6]$/.test(normalized);
    });

    console.log(`Fetching density data for ${validDepartments.length} valid departments: ${validDepartments.join(', ')}`);

    if (validDepartments.length === 0) {
      console.log('No valid French departments provided');
      return new Response(
        JSON.stringify({ 
          type: "FeatureCollection", 
          features: [],
          message: "No valid French departments provided"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allFeatures: any[] = [];
    
    // Batch departments to reduce API calls
    const batchSize = 10;
    for (let i = 0; i < validDepartments.length; i += batchSize) {
      const batch = validDepartments.slice(i, i + batchSize);
      
      // Build WHERE clause using dep_code field
      const whereConditions = batch.map((dept: string) => {
        const deptCode = dept.toString().padStart(2, '0');
        return `dep_code='${deptCode}'`;
      }).join(' OR ');

      const params = new URLSearchParams({
        limit: '100',
        select: 'geo_point_2d,pop_carr,dep_code',
        where: `(${whereConditions}) AND pop_carr > 50`,
        order_by: 'pop_carr DESC', // Get most populated cells first
      });

      const url = `${API_URL}?${params.toString()}`;
      console.log(`Fetching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(validDepartments.length/batchSize)}`);
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`API returned ${response.status} for batch: ${batch.join(', ')}`);
          const errorText = await response.text();
          console.warn(`Error: ${errorText.substring(0, 200)}`);
          continue;
        }

        const data = await response.json();
        console.log(`Received ${data.results?.length || 0} records for departments ${batch.join(', ')}`);
        
        if (data.results && data.results.length > 0) {
          const features = data.results
            .filter((r: any) => r.geo_point_2d && r.pop_carr)
            .map((r: any) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [r.geo_point_2d.lon, r.geo_point_2d.lat]
              },
              properties: {
                population: r.pop_carr || 0,
                dep_code: r.dep_code || '',
                id: `${r.dep_code}_${r.geo_point_2d.lat}_${r.geo_point_2d.lon}`
              }
            }));
          
          allFeatures.push(...features);
        }
      } catch (fetchError) {
        console.warn(`Failed to fetch batch ${batch.join(', ')}:`, fetchError);
      }
    }

    console.log(`Total features collected: ${allFeatures.length}`);

    const geojson = {
      type: "FeatureCollection",
      features: allFeatures
    };

    return new Response(
      JSON.stringify(geojson),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in insee-density function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
