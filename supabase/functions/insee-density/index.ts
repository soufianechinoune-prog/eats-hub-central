import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Public OpenDataSoft API - INSEE 200m grid data for all France (2.3M+ records)
const API_URL = "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/demographyref-france-donnees-carroyees-200m/records";

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

    console.log(`Fetching density data for ${validDepartments.length} valid departments`);

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
    
    // Fetch each department individually using refine parameter (works with array fields)
    for (const dept of validDepartments) {
      const deptCode = dept.toString().padStart(2, '0');
      
      const params = new URLSearchParams({
        limit: '50',
        select: 'geo_point_2d,pop_carr,dep_code',
        where: 'pop_carr > 100',
        order_by: 'pop_carr DESC',
        'refine': `dep_code:${deptCode}`,
      });

      const url = `${API_URL}?${params.toString()}`;
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`API returned ${response.status} for dept ${deptCode}`);
          continue;
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          console.log(`Dept ${deptCode}: ${data.results.length} records`);
          
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
                dep_code: Array.isArray(r.dep_code) ? r.dep_code[0] : r.dep_code,
                id: `${deptCode}_${r.geo_point_2d.lat}_${r.geo_point_2d.lon}`
              }
            }));
          
          allFeatures.push(...features);
        }
      } catch (fetchError) {
        console.warn(`Failed to fetch dept ${deptCode}:`, fetchError);
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
