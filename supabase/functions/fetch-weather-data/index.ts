import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherDataPoint {
  date: string;
  temperature_max: number;
  temperature_min: number;
  temperature_avg: number;
  precipitation_mm: number;
  weather_code: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, start_date, end_date } = await req.json();

    if (!restaurant_id || !start_date || !end_date) {
      throw new Error("Missing required parameters: restaurant_id, start_date, end_date");
    }

    console.log(`Fetching weather data for restaurant ${restaurant_id} from ${start_date} to ${end_date}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get restaurant coordinates
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, latitude, longitude, city')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error(`Restaurant not found: ${restaurantError?.message}`);
    }

    let latitude = restaurant.latitude;
    let longitude = restaurant.longitude;

    // If no coordinates, use city-based defaults for France
    if (!latitude || !longitude) {
      console.log(`No coordinates for restaurant ${restaurant.name}, using Paris defaults`);
      // Default to Paris coordinates
      latitude = 48.8566;
      longitude = 2.3522;
    }

    console.log(`Using coordinates: lat=${latitude}, lon=${longitude}`);

    // Check existing weather data to avoid duplicates
    const { data: existingData } = await supabase
      .from('weather_data')
      .select('date')
      .eq('restaurant_id', restaurant_id)
      .gte('date', start_date)
      .lte('date', end_date);

    const existingDates = new Set(existingData?.map(d => d.date) || []);
    console.log(`Found ${existingDates.size} existing weather records`);

    // Fetch weather data from Open-Meteo Archive API
    const openMeteoUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
    openMeteoUrl.searchParams.set('latitude', latitude.toString());
    openMeteoUrl.searchParams.set('longitude', longitude.toString());
    openMeteoUrl.searchParams.set('start_date', start_date);
    openMeteoUrl.searchParams.set('end_date', end_date);
    openMeteoUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,weather_code');
    openMeteoUrl.searchParams.set('timezone', 'Europe/Paris');

    console.log(`Calling Open-Meteo API: ${openMeteoUrl.toString()}`);

    const weatherResponse = await fetch(openMeteoUrl.toString());
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      throw new Error(`Open-Meteo API error: ${weatherResponse.status} - ${errorText}`);
    }

    const weatherData = await weatherResponse.json();
    console.log(`Received ${weatherData.daily?.time?.length || 0} days of weather data`);

    if (!weatherData.daily || !weatherData.daily.time) {
      throw new Error("No weather data returned from Open-Meteo");
    }

    // Transform and filter data
    const weatherRecords: WeatherDataPoint[] = [];
    for (let i = 0; i < weatherData.daily.time.length; i++) {
      const date = weatherData.daily.time[i];
      
      // Skip if we already have data for this date
      if (existingDates.has(date)) {
        continue;
      }

      weatherRecords.push({
        date,
        temperature_max: weatherData.daily.temperature_2m_max[i],
        temperature_min: weatherData.daily.temperature_2m_min[i],
        temperature_avg: weatherData.daily.temperature_2m_mean[i],
        precipitation_mm: weatherData.daily.precipitation_sum[i] || 0,
        weather_code: weatherData.daily.weather_code[i],
      });
    }

    console.log(`${weatherRecords.length} new weather records to insert`);

    // Insert new weather data
    if (weatherRecords.length > 0) {
      const insertData = weatherRecords.map(record => ({
        restaurant_id,
        ...record,
      }));

      const { error: insertError } = await supabase
        .from('weather_data')
        .insert(insertData);

      if (insertError) {
        throw new Error(`Failed to insert weather data: ${insertError.message}`);
      }

      console.log(`Successfully inserted ${weatherRecords.length} weather records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        restaurant_id,
        records_inserted: weatherRecords.length,
        records_skipped: existingDates.size,
        date_range: { start_date, end_date },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in fetch-weather-data:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
