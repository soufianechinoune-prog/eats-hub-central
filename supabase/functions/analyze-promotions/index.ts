import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromotionAnalysis {
  promotion_id: string;
  promotion_title: string;
  orders_count: number;
  total_discount: number;
  total_revenue: number;
  average_order_value: number;
  start_date: string;
  end_date: string;
  items_sold: Array<{
    item_title: string;
    quantity: number;
    revenue: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { restaurantId, startDate, endDate } = await req.json();

    console.log('Analyzing promotions for restaurant:', restaurantId);

    // Get all promotions for the restaurant in the date range
    const { data: promotions, error: promoError } = await supabase
      .from('promotions')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (promoError) {
      throw promoError;
    }

    const analysis: PromotionAnalysis[] = [];

    for (const promotion of promotions || []) {
      // Get orders with this promotion
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, gross_amount, promotion_discount, order_datetime')
        .eq('restaurant_id', restaurantId)
        .eq('promotion_id', promotion.id || '')
        .gte('order_datetime', startDate || '2020-01-01')
        .lte('order_datetime', endDate || '2099-12-31');

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        continue;
      }

      const orderIds = (orders || []).map(o => o.id);
      
      // Get items sold with this promotion
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('item_title, quantity, total_price')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
      }

      // Aggregate items data
      const itemsMap = new Map<string, { quantity: number; revenue: number }>();
      
      for (const item of items || []) {
        const existing = itemsMap.get(item.item_title) || { quantity: 0, revenue: 0 };
        itemsMap.set(item.item_title, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.total_price || 0),
        });
      }

      const itemsSold = Array.from(itemsMap.entries()).map(([title, data]) => ({
        item_title: title,
        quantity: data.quantity,
        revenue: data.revenue,
      })).sort((a, b) => b.revenue - a.revenue);

      // Calculate metrics
      const totalRevenue = (orders || []).reduce((sum, o) => sum + (o.gross_amount || 0), 0);
      const totalDiscount = (orders || []).reduce((sum, o) => sum + (o.promotion_discount || 0), 0);
      const ordersCount = (orders || []).length;
      const avgOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0;

      analysis.push({
        promotion_id: promotion.id,
        promotion_title: promotion.title,
        orders_count: ordersCount,
        total_discount: totalDiscount,
        total_revenue: totalRevenue,
        average_order_value: avgOrderValue,
        start_date: promotion.start_at,
        end_date: promotion.end_at,
        items_sold: itemsSold.slice(0, 10), // Top 10 items
      });
    }

    // Also get orders without promotions for comparison
    const { data: ordersNoPromo, error: noPromoError } = await supabase
      .from('orders')
      .select('id, gross_amount, order_datetime')
      .eq('restaurant_id', restaurantId)
      .is('promotion_id', null)
      .gte('order_datetime', startDate || '2020-01-01')
      .lte('order_datetime', endDate || '2099-12-31');

    if (!noPromoError && ordersNoPromo) {
      const noPromoRevenue = ordersNoPromo.reduce((sum, o) => sum + (o.gross_amount || 0), 0);
      const noPromoAvg = ordersNoPromo.length > 0 ? noPromoRevenue / ordersNoPromo.length : 0;

      analysis.push({
        promotion_id: 'no_promotion',
        promotion_title: 'Sans promotion',
        orders_count: ordersNoPromo.length,
        total_discount: 0,
        total_revenue: noPromoRevenue,
        average_order_value: noPromoAvg,
        start_date: startDate,
        end_date: endDate,
        items_sold: [],
      });
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error analyzing promotions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
