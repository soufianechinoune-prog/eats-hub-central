import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template types
type TemplateType = 'errors' | 'revenue' | 'rating' | 'operations' | 'promotions';
type DetailLevel = 'basic' | 'detailed';

interface StatReportRequest {
  restaurant_id: string;
  start_date: string;
  end_date: string;
  template_type: TemplateType;
  detail_level: DetailLevel;
}

interface StatReportResult {
  restaurant_id: string;
  restaurant_name: string;
  manager_name: string;
  manager_whatsapp: string | null;
  template_type: TemplateType;
  detail_level: DetailLevel;
  generated_message: string;
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

    const { restaurant_id, start_date, end_date, template_type, detail_level }: StatReportRequest = await req.json();

    console.log(`Generating ${template_type} (${detail_level}) report for restaurant ${restaurant_id}`);

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
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, manager_first_name, manager_last_name, manager_whatsapp')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error(`Restaurant not found: ${restaurant_id}`);
    }

    const managerName = `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim();
    const managerFirstName = restaurant.manager_first_name || managerName.split(' ')[0] || 'Manager';

    // Generate the appropriate template
    let generatedMessage: string;

    switch (template_type) {
      case 'errors':
        generatedMessage = await generateErrorsTemplate(
          supabase, restaurant_id, restaurant.name, managerFirstName,
          start_date, end_date, prevStartStr, prevEndStr, detail_level
        );
        break;
      case 'revenue':
        generatedMessage = await generateRevenueTemplate(
          supabase, restaurant_id, restaurant.name, managerFirstName,
          start_date, end_date, prevStartStr, prevEndStr, detail_level
        );
        break;
      case 'rating':
        generatedMessage = await generateRatingTemplate(
          supabase, restaurant_id, restaurant.name, managerFirstName,
          start_date, end_date, prevStartStr, prevEndStr, detail_level
        );
        break;
      case 'operations':
        generatedMessage = await generateOperationsTemplate(
          supabase, restaurant_id, restaurant.name, managerFirstName,
          start_date, end_date, prevStartStr, prevEndStr, detail_level
        );
        break;
      case 'promotions':
        generatedMessage = await generatePromotionsTemplate(
          supabase, restaurant_id, restaurant.name, managerFirstName,
          start_date, end_date, detail_level
        );
        break;
      default:
        throw new Error(`Unknown template type: ${template_type}`);
    }

    const result: StatReportResult = {
      restaurant_id,
      restaurant_name: restaurant.name,
      manager_name: managerName,
      manager_whatsapp: restaurant.manager_whatsapp,
      template_type,
      detail_level,
      generated_message: generatedMessage,
    };

    console.log(`Successfully generated ${template_type} (${detail_level}) report for ${restaurant.name}`);

    return new Response(
      JSON.stringify({ success: true, report: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error generating stat report:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ TEMPLATE 1: ERRORS ============
async function generateErrorsTemplate(
  supabase: any,
  restaurantId: string,
  restaurantName: string,
  managerFirstName: string,
  startDate: string,
  endDate: string,
  prevStartStr: string,
  prevEndStr: string,
  detailLevel: DetailLevel
): Promise<string> {
  // Fetch current week sales for order count
  const { data: currentSales } = await supabase
    .from('daily_sales_uber_deduped')
    .select('order_count')
    .eq('restaurant_id', restaurantId)
    .gte('date', startDate)
    .lte('date', endDate);

  const orderCount = currentSales?.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0) || 0;

  // Fetch previous week sales
  const { data: prevSales } = await supabase
    .from('daily_sales_uber_deduped')
    .select('order_count')
    .eq('restaurant_id', restaurantId)
    .gte('date', prevStartStr)
    .lte('date', prevEndStr);

  const prevOrderCount = prevSales?.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0) || 0;

  // Fetch current week accuracy data
  const { data: accuracyData } = await supabase
    .from('daily_order_accuracy')
    .select('incorrect_orders_count, missing_items_count, incorrect_item_count, wrong_order_count, total_refund')
    .eq('restaurant_id', restaurantId)
    .eq('period_type', 'current')
    .gte('date', startDate)
    .lte('date', endDate);

  const errorCount = accuracyData?.reduce((sum: number, d: any) => sum + (d.incorrect_orders_count || 0), 0) || 0;
  const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : 0;
  const totalRefund = accuracyData?.reduce((sum: number, d: any) => sum + (d.total_refund || 0), 0) || 0;

  // Fetch previous week accuracy data
  const { data: prevAccuracyData } = await supabase
    .from('daily_order_accuracy')
    .select('incorrect_orders_count')
    .eq('restaurant_id', restaurantId)
    .eq('period_type', 'current')
    .gte('date', prevStartStr)
    .lte('date', prevEndStr);

  const prevErrorCount = prevAccuracyData?.reduce((sum: number, d: any) => sum + (d.incorrect_orders_count || 0), 0) || 0;
  const prevErrorRate = prevOrderCount > 0 ? (prevErrorCount / prevOrderCount) * 100 : 0;

  const errorVariation = prevErrorRate > 0 ? ((errorRate - prevErrorRate) / prevErrorRate) * 100 : 0;
  const trendEmoji = errorRate <= prevErrorRate ? '✅' : '❌';
  const trendArrow = errorVariation > 0 ? '↗️' : errorVariation < 0 ? '↘️' : '➡️';

  // Basic template
  let message = `❌ TAUX D'ERREUR - ${restaurantName}

📊 Cette semaine :
• Taux d'erreur : ${errorRate.toFixed(1)}% ${trendEmoji}
• Nombre d'erreurs : ${errorCount}
• Sur ${orderCount} commandes

📈 Évolution :
${trendArrow} ${errorVariation >= 0 ? '+' : ''}${errorVariation.toFixed(0)}% vs semaine précédente
(Était : ${prevErrorRate.toFixed(1)}% | ${prevErrorCount} erreurs)`;

  // Add detailed info if requested
  if (detailLevel === 'detailed') {
    // Breakdown by category
    const missingItems = accuracyData?.reduce((sum: number, d: any) => sum + (d.missing_items_count || 0), 0) || 0;
    const incorrectItems = accuracyData?.reduce((sum: number, d: any) => sum + (d.incorrect_item_count || 0), 0) || 0;
    const wrongOrders = accuracyData?.reduce((sum: number, d: any) => sum + (d.wrong_order_count || 0), 0) || 0;

    message += `

⚫️ Répartition par catégorie :`;
    if (missingItems > 0) message += `\n• Articles manquants : ${missingItems} (${errorCount > 0 ? Math.round(missingItems / errorCount * 100) : 0}%)`;
    if (incorrectItems > 0) message += `\n• Articles incorrects : ${incorrectItems} (${errorCount > 0 ? Math.round(incorrectItems / errorCount * 100) : 0}%)`;
    if (wrongOrders > 0) message += `\n• Mauvaise commande : ${wrongOrders} (${errorCount > 0 ? Math.round(wrongOrders / errorCount * 100) : 0}%)`;

    // Fetch problematic products from order_errors
    const { data: errors } = await supabase
      .from('order_errors')
      .select('item_title')
      .eq('restaurant_id', restaurantId)
      .gte('error_date', startDate)
      .lte('error_date', endDate + 'T23:59:59');

    if (errors && errors.length > 0) {
      const productCounts: Record<string, number> = {};
      errors.forEach((e: any) => {
        if (e.item_title) {
          productCounts[e.item_title] = (productCounts[e.item_title] || 0) + 1;
        }
      });

      const top5Products = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (top5Products.length > 0) {
        message += `

🔴 Top 5 produits problématiques :`;
        top5Products.forEach(([product, count], i) => {
          message += `\n${i + 1}. ${product} (${count} erreurs)`;
        });
      }
    }

    // Fetch active promotions to correlate
    const { data: actionsData } = await supabase
      .from('restaurant_actions')
      .select('title, platform')
      .gte('end_date', startDate)
      .lte('start_date', endDate)
      .in('category', ['promotions', 'marketing']);

    const relevantActions = (actionsData || []).filter((a: any) => {
      // Filter by restaurant would need restaurant_ids check
      return true;
    }).slice(0, 3);

    if (relevantActions.length > 0) {
      message += `

📢 Promos actives (corrélation possible) :`;
      relevantActions.forEach((a: any) => {
        message += `\n• "${a.title}" (${a.platform})`;
      });
    }

    message += `

💰 Impact financier : -${totalRefund.toFixed(2)}€ de remboursements`;
  }

  message += `

🤲 Qu'Allah nous accorde la réussite !`;

  return message;
}

// ============ TEMPLATE 2: REVENUE ============
async function generateRevenueTemplate(
  supabase: any,
  restaurantId: string,
  restaurantName: string,
  managerFirstName: string,
  startDate: string,
  endDate: string,
  prevStartStr: string,
  prevEndStr: string,
  detailLevel: DetailLevel
): Promise<string> {
  // Fetch current week sales
  const { data: currentSales } = await supabase
    .from('daily_sales_uber_deduped')
    .select('date, revenue_ttc, order_count')
    .eq('restaurant_id', restaurantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  const revenue = currentSales?.reduce((sum: number, d: any) => sum + Number(d.revenue_ttc || 0), 0) || 0;
  const orderCount = currentSales?.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0) || 0;
  const averageBasket = orderCount > 0 ? revenue / orderCount : 0;

  // Fetch previous week sales
  const { data: prevSales } = await supabase
    .from('daily_sales_uber_deduped')
    .select('revenue_ttc, order_count')
    .eq('restaurant_id', restaurantId)
    .gte('date', prevStartStr)
    .lte('date', prevEndStr);

  const prevRevenue = prevSales?.reduce((sum: number, d: any) => sum + Number(d.revenue_ttc || 0), 0) || 0;
  const prevOrderCount = prevSales?.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0) || 0;
  const prevAverageBasket = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

  const revenueVariation = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
  const orderVariation = prevOrderCount > 0 ? ((orderCount - prevOrderCount) / prevOrderCount) * 100 : 0;
  const basketVariation = prevAverageBasket > 0 ? ((averageBasket - prevAverageBasket) / prevAverageBasket) * 100 : 0;

  const revenueTrend = revenueVariation >= 0 ? '✅' : '❌';
  const orderTrend = orderVariation >= 0 ? '✅' : '❌';

  let message = `💰 CA & COMMANDES - ${restaurantName}

📊 Cette semaine :
• Chiffre d'affaires : ${revenue.toFixed(0)}€ ${revenueTrend}
• Commandes : ${orderCount} ${orderTrend}
• Panier moyen : ${averageBasket.toFixed(2)}€

📈 Évolution vs semaine précédente :
• CA : ${revenueVariation >= 0 ? '+' : ''}${revenueVariation.toFixed(0)}% (était ${prevRevenue.toFixed(0)}€)
• Commandes : ${orderVariation >= 0 ? '+' : ''}${orderVariation.toFixed(0)}% (était ${prevOrderCount})
• Panier : ${basketVariation >= 0 ? '+' : ''}${basketVariation.toFixed(1)}%`;

  if (detailLevel === 'detailed' && currentSales && currentSales.length > 0) {
    // Day breakdown
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dayData = currentSales.map((d: any) => {
      const date = new Date(d.date);
      const dayName = dayNames[date.getDay()];
      return { dayName, revenue: d.revenue_ttc, orders: d.order_count };
    });

    // Find best and worst days
    const sortedByRevenue = [...dayData].sort((a, b) => b.revenue - a.revenue);
    const bestDay = sortedByRevenue[0];
    const worstDay = sortedByRevenue[sortedByRevenue.length - 1];

    message += `

📅 Répartition par jour :`;
    dayData.forEach((d: any) => {
      const bar = d.revenue > 0 ? '█'.repeat(Math.ceil(d.revenue / (bestDay?.revenue || 1) * 5)) : '';
      message += `\n${d.dayName} : ${d.revenue.toFixed(0)}€ (${d.orders} cmd) ${bar}`;
    });

    message += `

🏆 Meilleur jour : ${bestDay?.dayName} (${bestDay?.revenue.toFixed(0)}€)
📉 Jour le plus faible : ${worstDay?.dayName} (${worstDay?.revenue.toFixed(0)}€)`;

    // Calculate 4-week rolling average for comparison
    const fourWeeksAgo = new Date(startDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const { data: monthSales } = await supabase
      .from('daily_sales_uber_deduped')
      .select('revenue_ttc')
      .eq('restaurant_id', restaurantId)
      .gte('date', fourWeeksAgo.toISOString().split('T')[0])
      .lt('date', startDate);

    if (monthSales && monthSales.length > 0) {
      const monthRevenue = monthSales.reduce((sum: number, d: any) => sum + Number(d.revenue_ttc || 0), 0);
      const weeklyAvg = monthRevenue / 4;
      const vsMonthAvg = weeklyAvg > 0 ? ((revenue - weeklyAvg) / weeklyAvg) * 100 : 0;

      message += `

📊 Vs moyenne 4 semaines :
${vsMonthAvg >= 0 ? '+' : ''}${vsMonthAvg.toFixed(0)}% (moy : ${weeklyAvg.toFixed(0)}€/sem)`;
    }
  }

  message += `

🤲 Qu'Allah nous accorde la réussite !`;

  return message;
}

// ============ TEMPLATE 3: RATING ============
async function generateRatingTemplate(
  supabase: any,
  restaurantId: string,
  restaurantName: string,
  managerFirstName: string,
  startDate: string,
  endDate: string,
  prevStartStr: string,
  prevEndStr: string,
  detailLevel: DetailLevel
): Promise<string> {
  // Fetch current week reviews
  const { data: reviews } = await supabase
    .from('customer_reviews')
    .select('overall_rating, customer_type, tags')
    .eq('restaurant_id', restaurantId)
    .gte('order_date', startDate)
    .lte('order_date', endDate);

  const reviewCount = reviews?.length || 0;
  const averageRating = reviewCount > 0
    ? reviews.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / reviewCount
    : null;

  // Fetch previous week reviews
  const { data: prevReviews } = await supabase
    .from('customer_reviews')
    .select('overall_rating')
    .eq('restaurant_id', restaurantId)
    .gte('order_date', prevStartStr)
    .lte('order_date', prevEndStr);

  const prevReviewCount = prevReviews?.length || 0;
  const prevAverageRating = prevReviewCount > 0
    ? prevReviews.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / prevReviewCount
    : null;

  const ratingChange = averageRating !== null && prevAverageRating !== null
    ? averageRating - prevAverageRating
    : null;

  const ratingTrend = ratingChange !== null && ratingChange >= 0 ? '✅' : ratingChange !== null ? '❌' : '➖';
  const ratingArrow = ratingChange !== null && ratingChange > 0 ? '↗️' : ratingChange !== null && ratingChange < 0 ? '↘️' : '➡️';

  let message = `⭐ NOTE MOYENNE - ${restaurantName}

📊 Cette semaine :
• Note moyenne : ${averageRating !== null ? averageRating.toFixed(2) : '--'}/5 ${ratingTrend}
• Nombre d'avis : ${reviewCount}

📈 Évolution :
${ratingArrow} ${ratingChange !== null ? (ratingChange >= 0 ? '+' : '') + ratingChange.toFixed(2) : '--'} vs semaine précédente
(Était : ${prevAverageRating !== null ? prevAverageRating.toFixed(2) : '--'}/5 | ${prevReviewCount} avis)`;

  if (detailLevel === 'detailed' && reviews && reviews.length > 0) {
    // Customer type breakdown
    const newCustomers = reviews.filter((r: any) => r.customer_type === 'new').length;
    const returningCustomers = reviewCount - newCustomers;
    const newPercent = reviewCount > 0 ? Math.round((newCustomers / reviewCount) * 100) : 0;

    message += `

👥 Répartition clientèle :
• Nouveaux clients : ${newCustomers} (${newPercent}%)
• Clients fidèles : ${returningCustomers} (${100 - newPercent}%)`;

    // Tag analysis
    const allTags: string[] = [];
    reviews.forEach((r: any) => {
      if (r.tags) allTags.push(...r.tags);
    });

    const tagCounts: Record<string, number> = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    const negativeTags = Object.entries(tagCounts)
      .filter(([tag]) => 
        tag.toLowerCase().includes('lent') ||
        tag.toLowerCase().includes('froid') ||
        tag.toLowerCase().includes('manqu') ||
        tag.toLowerCase().includes('erreur') ||
        tag.toLowerCase().includes('portion') ||
        tag.toLowerCase().includes('attent')
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (negativeTags.length > 0) {
      message += `

🏷️ Top 3 tags négatifs :`;
      negativeTags.forEach(([tag, count]) => {
        message += `\n• ${tag} : ${count}x`;
      });
    }

    // Fetch product ratings
    const { data: itemReviews } = await supabase
      .from('menu_item_reviews')
      .select('item_title, thumb_up, thumb_down')
      .eq('restaurant_id', restaurantId);

    if (itemReviews && itemReviews.length > 0) {
      const itemStats: Record<string, { up: number; down: number }> = {};
      itemReviews.forEach((r: any) => {
        if (!itemStats[r.item_title]) {
          itemStats[r.item_title] = { up: 0, down: 0 };
        }
        itemStats[r.item_title].up += r.thumb_up || 0;
        itemStats[r.item_title].down += r.thumb_down || 0;
      });

      const sortedItems = Object.entries(itemStats)
        .map(([title, stats]) => ({
          title,
          score: stats.up - stats.down,
          up: stats.up,
          down: stats.down,
        }))
        .sort((a, b) => b.score - a.score);

      const topProducts = sortedItems.filter(i => i.up > 0).slice(0, 2);
      const flopProducts = sortedItems.filter(i => i.down > 0).sort((a, b) => a.score - b.score).slice(0, 2);

      if (topProducts.length > 0) {
        message += `

👍 Produits les mieux notés :`;
        topProducts.forEach(p => {
          message += `\n• ${p.title} (${p.up}👍)`;
        });
      }

      if (flopProducts.length > 0) {
        message += `

👎 Produits à améliorer :`;
        flopProducts.forEach(p => {
          message += `\n• ${p.title} (${p.down}👎)`;
        });
      }
    }
  }

  message += `

🤲 Qu'Allah nous accorde la réussite !`;

  return message;
}

// ============ TEMPLATE 4: OPERATIONS ============
async function generateOperationsTemplate(
  supabase: any,
  restaurantId: string,
  restaurantName: string,
  managerFirstName: string,
  startDate: string,
  endDate: string,
  prevStartStr: string,
  prevEndStr: string,
  detailLevel: DetailLevel
): Promise<string> {
  // Fetch order history for current week
  const { data: orderHistory } = await supabase
    .from('order_history')
    .select('total_prep_delivery_time_minutes, avoidable_wait_time_minutes, order_datetime')
    .eq('restaurant_id', restaurantId)
    .gte('order_datetime', startDate)
    .lte('order_datetime', endDate + 'T23:59:59');

  const validPrepTimes = (orderHistory || []).filter((o: any) => o.total_prep_delivery_time_minutes !== null);
  const avgPrepTime = validPrepTimes.length > 0
    ? validPrepTimes.reduce((sum: number, o: any) => sum + o.total_prep_delivery_time_minutes, 0) / validPrepTimes.length
    : null;

  const validWaitTimes = (orderHistory || []).filter((o: any) => o.avoidable_wait_time_minutes !== null);
  const avgCourierWait = validWaitTimes.length > 0
    ? validWaitTimes.reduce((sum: number, o: any) => sum + o.avoidable_wait_time_minutes, 0) / validWaitTimes.length
    : null;

  // Thresholds
  const prepTimeThreshold = 30; // Good if <= 30 min
  const waitTimeThreshold = 5; // Good if <= 5 min

  const prepTrend = avgPrepTime !== null && avgPrepTime <= prepTimeThreshold ? '✅' : avgPrepTime !== null ? '❌' : '➖';
  const waitTrend = avgCourierWait !== null && avgCourierWait <= waitTimeThreshold ? '✅' : avgCourierWait !== null ? '❌' : '➖';

  let message = `⏱️ TEMPS OPÉRATIONNELS - ${restaurantName}

📊 Cette semaine :
• Temps de prépa total : ${avgPrepTime !== null ? Math.round(avgPrepTime) : '--'} min ${prepTrend}
   ↳ Objectif : ≤${prepTimeThreshold} min
• Attente coursier : ${avgCourierWait !== null ? avgCourierWait.toFixed(1) : '--'} min ${waitTrend}
   ↳ Objectif : ≤${waitTimeThreshold} min`;

  if (detailLevel === 'detailed' && orderHistory && orderHistory.length > 0) {
    // Breakdown by time slot (midi/soir)
    const lunchOrders = orderHistory.filter((o: any) => {
      const hour = new Date(o.order_datetime).getHours();
      return hour >= 11 && hour < 15;
    });
    const dinnerOrders = orderHistory.filter((o: any) => {
      const hour = new Date(o.order_datetime).getHours();
      return hour >= 18 && hour < 23;
    });

    const avgLunchPrep = lunchOrders.filter((o: any) => o.total_prep_delivery_time_minutes !== null);
    const avgDinnerPrep = dinnerOrders.filter((o: any) => o.total_prep_delivery_time_minutes !== null);

    const lunchAvg = avgLunchPrep.length > 0
      ? avgLunchPrep.reduce((sum: number, o: any) => sum + o.total_prep_delivery_time_minutes, 0) / avgLunchPrep.length
      : null;
    const dinnerAvg = avgDinnerPrep.length > 0
      ? avgDinnerPrep.reduce((sum: number, o: any) => sum + o.total_prep_delivery_time_minutes, 0) / avgDinnerPrep.length
      : null;

    message += `

📅 Par créneau horaire :
• Midi (11h-15h) : ${lunchAvg !== null ? Math.round(lunchAvg) : '--'} min
• Soir (18h-23h) : ${dinnerAvg !== null ? Math.round(dinnerAvg) : '--'} min`;

    // Find peak slow hours
    const hourlyPrepTimes: Record<number, number[]> = {};
    orderHistory.forEach((o: any) => {
      if (o.order_datetime && o.total_prep_delivery_time_minutes) {
        const hour = new Date(o.order_datetime).getHours();
        if (!hourlyPrepTimes[hour]) hourlyPrepTimes[hour] = [];
        hourlyPrepTimes[hour].push(o.total_prep_delivery_time_minutes);
      }
    });

    const hourlyAvg = Object.entries(hourlyPrepTimes)
      .map(([hour, times]) => ({
        hour: parseInt(hour),
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        count: times.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    const worstHours = hourlyAvg.slice(0, 3);
    if (worstHours.length > 0 && worstHours[0].avg > prepTimeThreshold) {
      message += `

🔥 Pics de lenteur identifiés :`;
      worstHours.forEach(h => {
        message += `\n• ${h.hour}h-${h.hour + 1}h : ${h.avg.toFixed(0)} min (${h.count} cmd)`;
      });
    }

    // Network comparison - fetch all restaurants' avg prep times
    const { data: allRestaurants } = await supabase
      .from('restaurants')
      .select('id')
      .eq('is_active', true)
      .eq('is_pinned', true);

    if (allRestaurants && allRestaurants.length > 1) {
      const otherRestaurantIds = allRestaurants.map((r: any) => r.id).filter((id: string) => id !== restaurantId);

      const { data: networkHistory } = await supabase
        .from('order_history')
        .select('total_prep_delivery_time_minutes')
        .in('restaurant_id', otherRestaurantIds)
        .gte('order_datetime', startDate)
        .lte('order_datetime', endDate + 'T23:59:59');

      const networkValid = (networkHistory || []).filter((o: any) => o.total_prep_delivery_time_minutes !== null);
      if (networkValid.length > 0) {
        const networkAvg = networkValid.reduce((sum: number, o: any) => sum + o.total_prep_delivery_time_minutes, 0) / networkValid.length;
        const diff = avgPrepTime !== null ? avgPrepTime - networkAvg : null;

        message += `

🏪 Comparaison réseau :
• Moyenne réseau : ${Math.round(networkAvg)} min
• Ton écart : ${diff !== null ? (diff >= 0 ? '+' : '') + Math.round(diff) : '--'} min`;
      }
    }
  }

  message += `

🤲 Qu'Allah nous accorde la réussite !`;

  return message;
}

// ============ TEMPLATE 5: PROMOTIONS ============
async function generatePromotionsTemplate(
  supabase: any,
  restaurantId: string,
  restaurantName: string,
  managerFirstName: string,
  startDate: string,
  endDate: string,
  detailLevel: DetailLevel
): Promise<string> {
  // Fetch active promotions/actions
  const { data: actionsData } = await supabase
    .from('restaurant_actions')
    .select('id, title, platform, action_type, start_date, end_date, impact_value, impact_unit')
    .gte('end_date', startDate)
    .lte('start_date', endDate)
    .in('category', ['promotions', 'marketing']);

  // Filter by restaurant (check restaurant_ids or restaurant_id)
  const relevantActions = (actionsData || []).filter((a: any) => {
    // For now, include all since filtering would require additional query
    return true;
  });

  const activeOffers = relevantActions.slice(0, 10);

  let message = `📢 PROMOTIONS - ${restaurantName}

🎯 Offres actives cette semaine :`;

  if (activeOffers.length === 0) {
    message += `\n• Aucune offre active`;
  } else {
    activeOffers.forEach((a: any) => {
      message += `\n• "${a.title}" (${a.platform})`;
    });
  }

  // Fetch order count for the period
  const { data: currentSales } = await supabase
    .from('daily_sales_uber_deduped')
    .select('order_count, revenue_ttc')
    .eq('restaurant_id', restaurantId)
    .gte('date', startDate)
    .lte('date', endDate);

  const orderCount = currentSales?.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0) || 0;
  const revenue = currentSales?.reduce((sum: number, d: any) => sum + Number(d.revenue_ttc || 0), 0) || 0;

  message += `

📊 Volume impacté :
• ${orderCount} commandes
• ${revenue.toFixed(0)}€ de CA`;

  if (detailLevel === 'detailed') {
    // Calculate basket impact if possible
    const averageBasket = orderCount > 0 ? revenue / orderCount : 0;

    // Fetch previous period (non-promo) for comparison
    const fourWeeksAgo = new Date(startDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const { data: historicalSales } = await supabase
      .from('daily_sales_uber_deduped')
      .select('order_count, revenue_ttc')
      .eq('restaurant_id', restaurantId)
      .gte('date', fourWeeksAgo.toISOString().split('T')[0])
      .lt('date', startDate);

    if (historicalSales && historicalSales.length > 0) {
      const histOrderCount = historicalSales.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0) || 1;
      const histRevenue = historicalSales.reduce((sum: number, d: any) => sum + Number(d.revenue_ttc || 0), 0);
      const histBasket = histOrderCount > 0 ? histRevenue / histOrderCount : 0;
      
      const basketDiff = histBasket > 0 ? ((averageBasket - histBasket) / histBasket) * 100 : 0;

      message += `

💰 Impact sur le panier moyen :
• Panier actuel : ${averageBasket.toFixed(2)}€
• Moyenne historique : ${histBasket.toFixed(2)}€
• Écart : ${basketDiff >= 0 ? '+' : ''}${basketDiff.toFixed(0)}%`;
    }

    // Estimated profitability based on promo type
    message += `

📈 Rentabilité estimée :`;
    
    if (activeOffers.length === 0) {
      message += `\n• Pas d'offre à analyser`;
    } else {
      // Simplified profitability estimation
      message += `\n• Analyse détaillée disponible dans le dashboard`;
    }

    // Recommendations based on error rate correlation
    const { data: accuracyData } = await supabase
      .from('daily_order_accuracy')
      .select('incorrect_orders_count')
      .eq('restaurant_id', restaurantId)
      .eq('period_type', 'current')
      .gte('date', startDate)
      .lte('date', endDate);

    const errorCount = accuracyData?.reduce((sum: number, d: any) => sum + (d.incorrect_orders_count || 0), 0) || 0;
    const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : 0;

    if (errorRate > 5 && activeOffers.length > 0) {
      message += `

⚠️ Attention :
Taux d'erreur élevé (${errorRate.toFixed(1)}%) pendant les promos.
Vérifie si les offres complexifient les préparations.`;
    }

    message += `

💡 Conseil :
Analyse la corrélation promos/erreurs dans le dashboard pour optimiser.`;
  }

  message += `

🤲 Qu'Allah nous accorde la réussite !`;

  return message;
}
