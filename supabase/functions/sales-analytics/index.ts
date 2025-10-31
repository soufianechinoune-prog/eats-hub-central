import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesAnalytics {
  overview: {
    total_revenue: number;
    total_orders: number;
    average_order_value: number;
    total_items_sold: number;
    total_tax_collected: number;
    total_delivery_fees: number;
    total_tips: number;
  };
  top_products: Array<{
    item_title: string;
    quantity_sold: number;
    total_revenue: number;
    average_price: number;
  }>;
  revenue_by_day: Array<{
    date: string;
    revenue: number;
    orders_count: number;
  }>;
  tax_breakdown: {
    total_tax: number;
    by_rate: Array<{
      rate: number;
      amount: number;
    }>;
  };
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

    console.log('Generating sales analytics for:', restaurantId, startDate, endDate);

    // Get all orders in date range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('order_datetime', startDate)
      .lte('order_datetime', endDate);

    if (ordersError) {
      throw ordersError;
    }

    // Calculate overview metrics
    const totalRevenue = (orders || []).reduce((sum, o) => sum + (o.gross_amount || 0), 0);
    const totalOrders = (orders || []).length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalTax = (orders || []).reduce((sum, o) => sum + (o.tax_amount || 0), 0);
    const totalDeliveryFees = (orders || []).reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const totalTips = (orders || []).reduce((sum, o) => sum + (o.tip_amount || 0), 0);

    // Get order items
    const orderIds = (orders || []).map(o => o.id);
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) {
      throw itemsError;
    }

    const totalItemsSold = (items || []).reduce((sum, i) => sum + i.quantity, 0);

    // Top products analysis
    const productsMap = new Map<string, { quantity: number; revenue: number; count: number }>();
    
    for (const item of items || []) {
      const existing = productsMap.get(item.item_title) || { quantity: 0, revenue: 0, count: 0 };
      productsMap.set(item.item_title, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.total_price || 0),
        count: existing.count + 1,
      });
    }

    const topProducts = Array.from(productsMap.entries())
      .map(([title, data]) => ({
        item_title: title,
        quantity_sold: data.quantity,
        total_revenue: data.revenue,
        average_price: data.count > 0 ? data.revenue / data.quantity : 0,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 20);

    // Revenue by day
    const revenueByDayMap = new Map<string, { revenue: number; count: number }>();
    
    for (const order of orders || []) {
      const date = new Date(order.order_datetime).toISOString().split('T')[0];
      const existing = revenueByDayMap.get(date) || { revenue: 0, count: 0 };
      revenueByDayMap.set(date, {
        revenue: existing.revenue + (order.gross_amount || 0),
        count: existing.count + 1,
      });
    }

    const revenueByDay = Array.from(revenueByDayMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        orders_count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Tax breakdown by rate
    const taxByRateMap = new Map<number, number>();
    
    for (const item of items || []) {
      if (item.tax_rate && item.tax_amount) {
        const existing = taxByRateMap.get(item.tax_rate) || 0;
        taxByRateMap.set(item.tax_rate, existing + item.tax_amount);
      }
    }

    const taxBreakdown = {
      total_tax: totalTax,
      by_rate: Array.from(taxByRateMap.entries())
        .map(([rate, amount]) => ({ rate, amount }))
        .sort((a, b) => b.amount - a.amount),
    };

    const analytics: SalesAnalytics = {
      overview: {
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        average_order_value: avgOrderValue,
        total_items_sold: totalItemsSold,
        total_tax_collected: totalTax,
        total_delivery_fees: totalDeliveryFees,
        total_tips: totalTips,
      },
      top_products: topProducts,
      revenue_by_day: revenueByDay,
      tax_breakdown: taxBreakdown,
    };

    return new Response(
      JSON.stringify(analytics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
