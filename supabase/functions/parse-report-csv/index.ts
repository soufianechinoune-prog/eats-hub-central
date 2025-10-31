import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reportId, downloadUrl, reportType, restaurantId } = await req.json();

    console.log('Parsing report:', reportType, 'for restaurant:', restaurantId);

    // Download CSV
    const csvResponse = await fetch(downloadUrl);
    if (!csvResponse.ok) {
      throw new Error('Failed to download CSV');
    }

    const csvText = await csvResponse.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.log('Empty or invalid CSV');
      return new Response(JSON.stringify({ success: true, parsed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    console.log(`Parsed ${rows.length} rows for ${reportType}`);

    // Parse based on report type
    switch (reportType) {
      case 'CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT':
        await parseCustomerFeedback(supabase, restaurantId, rows);
        break;
      
      case 'MENU_ITEM_FEEDBACK_REPORT':
        await parseMenuItemFeedback(supabase, restaurantId, rows);
        break;
      
      case 'ORDER_HISTORY_REPORT':
        await parseOrderHistory(supabase, restaurantId, rows);
        break;
      
      case 'ORDER_ERRORS_MENU_ITEM_REPORT':
      case 'ORDER_ERRORS_TRANSACTION_REPORT':
        await parseOrderErrors(supabase, restaurantId, rows, reportType);
        break;
      
      case 'DOWNTIME_REPORT':
        await parseDowntime(supabase, restaurantId, rows);
        break;
      
      default:
        console.log('Report type not configured for parsing:', reportType);
    }

    return new Response(
      JSON.stringify({ success: true, parsed: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error parsing report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function parseCustomerFeedback(supabase: any, restaurantId: string, rows: any[]) {
  for (const row of rows) {
    const data = {
      restaurant_id: restaurantId,
      uber_order_id: row.order_id || row.Order_ID,
      overall_rating: parseFloat(row.overall_rating || row.Overall_Rating) || null,
      food_rating: parseFloat(row.food_rating || row.Food_Rating) || null,
      delivery_rating: parseFloat(row.delivery_rating || row.Delivery_Rating) || null,
      customer_comment: row.comment || row.Customer_Comment || null,
      review_date: row.review_date || row.Review_Date || new Date().toISOString(),
    };

    await supabase.from('customer_reviews').upsert(data, {
      onConflict: 'uber_order_id',
      ignoreDuplicates: false,
    });
  }
}

async function parseMenuItemFeedback(supabase: any, restaurantId: string, rows: any[]) {
  for (const row of rows) {
    const data = {
      restaurant_id: restaurantId,
      item_id: row.item_id || row.Item_ID,
      item_title: row.item_name || row.Item_Name || 'Unknown',
      rating: parseFloat(row.rating || row.Rating) || 0,
      thumb_up: parseInt(row.thumbs_up || row.Thumbs_Up) || 0,
      thumb_down: parseInt(row.thumbs_down || row.Thumbs_Down) || 0,
      comment: row.comment || row.Comment || null,
      review_date: row.date || row.Date || new Date().toISOString(),
    };

    await supabase.from('menu_item_reviews').insert(data);
  }
}

async function parseOrderHistory(supabase: any, restaurantId: string, rows: any[]) {
  for (const row of rows) {
    const prepTime = parseInt(row.preparation_time || row.Preparation_Time) || null;
    const deliveryTime = parseInt(row.delivery_time || row.Delivery_Time) || null;
    const estimatedTime = parseInt(row.estimated_time || row.Estimated_Time) || null;
    
    const data = {
      restaurant_id: restaurantId,
      uber_order_id: row.order_id || row.Order_ID,
      courier_name: row.courier_name || row.Courier_Name || null,
      courier_id: row.courier_id || row.Courier_ID || null,
      preparation_time_minutes: prepTime,
      delivery_time_minutes: deliveryTime,
      total_time_minutes: (prepTime || 0) + (deliveryTime || 0),
      estimated_time_minutes: estimatedTime,
      delay_minutes: estimatedTime ? ((prepTime || 0) + (deliveryTime || 0) - estimatedTime) : null,
      delivery_status: row.status || row.Status,
      delivery_date: row.delivered_at || row.Delivered_At || new Date().toISOString(),
    };

    await supabase.from('delivery_stats').upsert(data, {
      onConflict: 'uber_order_id',
      ignoreDuplicates: false,
    });
  }
}

async function parseOrderErrors(supabase: any, restaurantId: string, rows: any[], reportType: string) {
  for (const row of rows) {
    const data = {
      restaurant_id: restaurantId,
      uber_order_id: row.order_id || row.Order_ID,
      error_type: reportType.includes('MENU_ITEM') ? 'MENU_ITEM_ERROR' : 'TRANSACTION_ERROR',
      error_category: row.error_category || row.Error_Category || row.error_type || row.Error_Type,
      item_id: row.item_id || row.Item_ID || null,
      item_title: row.item_name || row.Item_Name || null,
      error_description: row.description || row.Description || row.error_message || row.Error_Message,
      financial_impact: parseFloat(row.financial_impact || row.Financial_Impact) || null,
      error_date: row.error_date || row.Error_Date || new Date().toISOString(),
    };

    await supabase.from('order_errors').insert(data);
  }
}

async function parseDowntime(supabase: any, restaurantId: string, rows: any[]) {
  for (const row of rows) {
    const start = row.downtime_start || row.Downtime_Start;
    const end = row.downtime_end || row.Downtime_End;
    
    let duration = parseInt(row.duration_minutes || row.Duration_Minutes) || null;
    if (!duration && start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      duration = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
    }

    const data = {
      restaurant_id: restaurantId,
      downtime_start: start,
      downtime_end: end,
      duration_minutes: duration,
      reason: row.reason || row.Reason || null,
      downtime_type: row.type || row.Type || 'UNKNOWN',
    };

    await supabase.from('downtime_logs').insert(data);
  }
}
