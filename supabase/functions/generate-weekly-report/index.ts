import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyKPIs {
  restaurant_id: string;
  restaurant_name: string;
  manager_name: string;
  manager_whatsapp: string | null;
  order_count: number;
  revenue: number;
  average_basket: number;
  order_variation: number | null;
  revenue_variation: number | null;
  average_rating: number | null;
  review_count: number;
  new_customer_percent: number | null;
  avg_prep_time: number | null;
  avg_courier_wait: number | null;
  error_rate: number | null;
  error_count: number;
  prev_error_rate: number | null;
  prev_error_count: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { restaurant_ids, start_date, end_date } = await req.json();

    console.log(`Generating weekly reports for ${restaurant_ids.length} restaurants from ${start_date} to ${end_date}`);

    // Calculate previous week for comparison
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const prevStartDate = new Date(startDateObj);
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    const prevEndDate = new Date(endDateObj);
    prevEndDate.setDate(prevEndDate.getDate() - 7);
    const prevStartStr = prevStartDate.toISOString().split('T')[0];
    const prevEndStr = prevEndDate.toISOString().split('T')[0];

    // Fetch restaurant info
    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, manager_first_name, manager_last_name, manager_whatsapp')
      .in('id', restaurant_ids);

    if (restaurantError) throw restaurantError;

    const reports: WeeklyKPIs[] = [];

    for (const restaurant of restaurants || []) {
      const restaurantId = restaurant.id;
      const managerName = `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim();

      // Fetch sales data for current week (use deduped view to avoid double-counting)
      const { data: currentSales } = await supabase
        .from('daily_sales_uber_deduped')
        .select('revenue_ttc, order_count')
        .eq('restaurant_id', restaurantId)
        .gte('date', start_date)
        .lte('date', end_date);

      // Fetch sales data for previous week (use deduped view to avoid double-counting)
      const { data: prevSales } = await supabase
        .from('daily_sales_uber_deduped')
        .select('revenue_ttc, order_count')
        .eq('restaurant_id', restaurantId)
        .gte('date', prevStartStr)
        .lte('date', prevEndStr);

      // Calculate current week totals
      const orderCount = currentSales?.reduce((sum, d) => sum + (d.order_count || 0), 0) || 0;
      const revenue = currentSales?.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0) || 0;
      const averageBasket = orderCount > 0 ? revenue / orderCount : 0;

      // Calculate previous week totals for variation
      const prevOrderCount = prevSales?.reduce((sum, d) => sum + (d.order_count || 0), 0) || 0;
      const prevRevenue = prevSales?.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0) || 0;

      const orderVariation = prevOrderCount > 0 ? ((orderCount - prevOrderCount) / prevOrderCount) * 100 : null;
      const revenueVariation = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

      // Fetch customer reviews for current week
      const { data: reviews } = await supabase
        .from('customer_reviews')
        .select('overall_rating, customer_type')
        .eq('restaurant_id', restaurantId)
        .gte('review_date', start_date)
        .lte('review_date', end_date + 'T23:59:59');

      const reviewCount = reviews?.length || 0;
      const averageRating = reviewCount > 0 && reviews
        ? reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / reviewCount
        : null;
      const newCustomerCount = reviews?.filter(r => r.customer_type === 'new')?.length || 0;
      const newCustomerPercent = reviewCount > 0 ? (newCustomerCount / reviewCount) * 100 : null;

      // Fetch order history for prep times (use total_prep_delivery_time for "Temps prep" KPI)
      const { data: orderHistory } = await supabase
        .from('order_history')
        .select('total_prep_delivery_time_minutes, avoidable_wait_time_minutes')
        .eq('restaurant_id', restaurantId)
        .gte('order_datetime', start_date)
        .lte('order_datetime', end_date + 'T23:59:59');

      const validPrepTimes = orderHistory?.filter(o => o.total_prep_delivery_time_minutes !== null) || [];
      const avgPrepTime = validPrepTimes.length > 0
        ? validPrepTimes.reduce((sum, o) => sum + (o.total_prep_delivery_time_minutes || 0), 0) / validPrepTimes.length
        : null;

      const validWaitTimes = orderHistory?.filter(o => o.avoidable_wait_time_minutes !== null) || [];
      const avgCourierWait = validWaitTimes.length > 0
        ? validWaitTimes.reduce((sum, o) => sum + (o.avoidable_wait_time_minutes || 0), 0) / validWaitTimes.length
        : null;

      // Fetch order accuracy from daily aggregated data (same source as dashboard)
      const { data: accuracyData } = await supabase
        .from('daily_order_accuracy')
        .select('incorrect_orders_count')
        .eq('restaurant_id', restaurantId)
        .eq('period_type', 'current')
        .gte('date', start_date)
        .lte('date', end_date);

      const errorCount = accuracyData?.reduce((sum, d) => sum + (d.incorrect_orders_count || 0), 0) || 0;
      const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : null;

      // Fetch previous week order accuracy
      const { data: prevAccuracyData } = await supabase
        .from('daily_order_accuracy')
        .select('incorrect_orders_count')
        .eq('restaurant_id', restaurantId)
        .eq('period_type', 'current')
        .gte('date', prevStartStr)
        .lte('date', prevEndStr);

      const prevErrorCount = prevAccuracyData?.reduce((sum, d) => sum + (d.incorrect_orders_count || 0), 0) || 0;
      const prevErrorRate = prevOrderCount > 0 ? (prevErrorCount / prevOrderCount) * 100 : null;

      reports.push({
        restaurant_id: restaurantId,
        restaurant_name: restaurant.name,
        manager_name: managerName,
        manager_whatsapp: restaurant.manager_whatsapp,
        order_count: orderCount,
        revenue,
        average_basket: averageBasket,
        order_variation: orderVariation,
        revenue_variation: revenueVariation,
        average_rating: averageRating,
        review_count: reviewCount,
        new_customer_percent: newCustomerPercent,
        avg_prep_time: avgPrepTime,
        avg_courier_wait: avgCourierWait,
        error_rate: errorRate,
        error_count: errorCount,
        prev_error_rate: prevErrorRate,
        prev_error_count: prevErrorCount,
      });

      console.log(`Generated report for ${restaurant.name}: ${orderCount} orders, ${revenue.toFixed(2)}€, errors: ${errorCount} (${errorRate?.toFixed(1) || '--'}%) vs prev: ${prevErrorCount} (${prevErrorRate?.toFixed(1) || '--'}%)`);
    }

    console.log(`Successfully generated ${reports.length} reports`);

    return new Response(
      JSON.stringify({ success: true, reports }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error generating weekly reports:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
