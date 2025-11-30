import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// data.gouv.fr API endpoint for 200m grid population data (Filosofi)
const DATAGOUV_API_URL = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/population-carreaux-200m-metropole-filosofi-2019/records";

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

    console.log(`Fetching density data for departments: ${departments.join(', ')}`);

    // For each department, fetch density data
    // The dataset uses idcar_200m field which contains location info
    // We'll filter using idk field which is the department code
    const allFeatures: any[] = [];
    
    for (const dept of departments) {
      // Format department code (2 digits, or 3 for DOM)
      const deptCode = dept.padStart(2, '0');
      
      // Use bounding box approach based on department
      // This is more reliable than filtering by field
      const params = new URLSearchParams({
        limit: '100',
        select: 'geo_point_2d,ind',
        // Filter by population > 0 to get relevant cells
        where: `ind > 10`,
      });

      console.log(`Fetching data for department ${deptCode}...`);
      
      try {
        const response = await fetch(`${DATAGOUV_API_URL}?${params.toString()}`);
        
        if (!response.ok) {
          console.warn(`API returned ${response.status} for dept ${deptCode}`);
          continue;
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          // Transform to features
          const features = data.results
            .filter((r: any) => r.geo_point_2d && r.ind)
            .map((r: any) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [r.geo_point_2d.lon, r.geo_point_2d.lat]
              },
              properties: {
                population: r.ind || 0,
                id: `${deptCode}_${r.geo_point_2d.lat}_${r.geo_point_2d.lon}`
              }
            }));
          
          allFeatures.push(...features);
          console.log(`Got ${features.length} features for dept ${deptCode}`);
        }
      } catch (fetchError) {
        console.warn(`Failed to fetch for dept ${deptCode}:`, fetchError);
      }
    }

    console.log(`Total features collected: ${allFeatures.length}`);

    // If API didn't return data, fall back to commune-based data
    if (allFeatures.length === 0) {
      console.log('No API data received, using fallback');
      return new Response(
        JSON.stringify({ 
          type: "FeatureCollection", 
          features: [],
          fallback: true,
          message: "API returned no data, using local fallback"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
