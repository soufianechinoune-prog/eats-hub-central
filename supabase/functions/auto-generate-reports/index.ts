import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATA_REPORTS = [
  'CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT',
  'MENU_ITEM_FEEDBACK_REPORT',
  'ORDER_HISTORY_REPORT',
  'ORDER_ERRORS_MENU_ITEM_REPORT',
  'ORDER_ERRORS_TRANSACTION_REPORT',
  'DOWNTIME_REPORT',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-generating reports for all restaurants');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active restaurants with Uber connection
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id')
      .eq('is_active', true)
      .not('uber_store_id', 'is', null);

    if (restaurantsError) {
      throw restaurantsError;
    }

    console.log(`Found ${restaurants?.length || 0} restaurants`);

    // Calculate date range (last 7 days)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // T-2 (Uber requirement)
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const results = [];

    for (const restaurant of restaurants || []) {
      console.log(`Generating reports for ${restaurant.name}`);

      for (const reportType of DATA_REPORTS) {
        try {
          const { data, error } = await supabase.functions.invoke('uber-create-report', {
            body: {
              restaurantId: restaurant.id,
              reportType,
              startDate: startDateStr,
              endDate: endDateStr,
            },
          });

          if (error) {
            console.error(`Failed to create ${reportType} for ${restaurant.name}:`, error);
            results.push({
              restaurant: restaurant.name,
              reportType,
              status: 'error',
              error: error.message,
            });
          } else {
            console.log(`Created ${reportType} for ${restaurant.name}: ${data.workflow_id}`);
            results.push({
              restaurant: restaurant.name,
              reportType,
              status: 'success',
              workflow_id: data.workflow_id,
            });
          }

          // Wait 2 seconds between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error: any) {
          console.error(`Error creating ${reportType}:`, error);
          results.push({
            restaurant: restaurant.name,
            reportType,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_reports: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-generate-reports:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
