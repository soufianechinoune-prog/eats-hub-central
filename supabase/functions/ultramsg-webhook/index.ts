import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to normalize phone numbers
const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/[\s\-\.\(\)]/g, '');
};

// Format phone number for Ultramsg API
const formatPhoneForUltramsg = (phone: string): string => {
  let formatted = phone.replace(/[\s\-\.\(\)\+]/g, '');
  if (!formatted.startsWith('33') && formatted.startsWith('0')) {
    formatted = '33' + formatted.substring(1);
  }
  return formatted;
};

// Mapping des départements vers les zones scolaires
const DEPARTMENT_TO_ZONE: Record<string, string> = {
  // Zone A
  "01": "A", "03": "A", "07": "A", "15": "A", "26": "A", "38": "A", "42": "A",
  "43": "A", "63": "A", "69": "A", "73": "A", "74": "A",
  "21": "A", "25": "A", "39": "A", "58": "A", "70": "A", "71": "A", "89": "A", "90": "A",
  "24": "A", "33": "A", "40": "A", "47": "A", "64": "A",
  "19": "A", "23": "A", "87": "A",
  "16": "A", "17": "A", "79": "A", "86": "A",
  // Zone B
  "14": "B", "27": "B", "50": "B", "61": "B", "76": "B",
  "02": "B", "59": "B", "60": "B", "62": "B", "80": "B",
  "08": "B", "10": "B", "51": "B", "52": "B", "54": "B", "55": "B", "57": "B",
  "67": "B", "68": "B", "88": "B",
  "18": "B", "28": "B", "36": "B", "37": "B", "41": "B", "45": "B",
  "22": "B", "29": "B", "35": "B", "56": "B",
  "44": "B", "49": "B", "53": "B", "72": "B", "85": "B",
  // Zone C
  "75": "C", "77": "C", "78": "C", "91": "C", "92": "C", "93": "C", "94": "C", "95": "C",
  "09": "C", "11": "C", "12": "C", "30": "C", "31": "C", "32": "C", "34": "C",
  "46": "C", "48": "C", "65": "C", "66": "C", "81": "C", "82": "C",
  "04": "C", "05": "C", "06": "C", "13": "C", "83": "C", "84": "C",
  "2A": "C", "2B": "C",
};

// Get school zone from postal code
const getSchoolZoneFromPostalCode = (postalCode: string | null): string | null => {
  if (!postalCode || postalCode.length < 2) return null;
  const dept = postalCode.substring(0, 2);
  return DEPARTMENT_TO_ZONE[dept] || null;
};

// Check if the message looks like a query (not just a simple response)
const isQueryMessage = (message: string): boolean => {
  const simpleResponses = /^(ok|oui|non|👍|✅|❌|merci|super|parfait|cool|d'accord|top|nice|bien)$/i;
  if (simpleResponses.test(message.trim())) return false;
  if (message.length < 4) return false;
  
  // Keywords that indicate a query - enriched with new data types AND rush/prediction
  const queryKeywords = /\b(quel|combien|comment|pourquoi|quand|où|ca|chiffre|commande|panier|conversion|rapport|hier|aujourd|semaine|mois|performance|vente|revenue|stat|note|avis|client|plat|produit|erreur|temps|prépa|préparation|livraison|retard|fermeture|downtime|top|flop|meilleur|pire|améliorer|rush|chargé|achalandage|prévision|anticiper|événement|match|foot|vacances|fête|férié)/i;
  const questionMark = message.includes('?');
  
  return queryKeywords.test(message) || questionMark || message.length > 10;
};

// Check if message is an interactive report menu response (1-5 for basic, 1+ for detailed)
const isInteractiveMenuResponse = (message: string): { isMenu: boolean; reportType: string | null; detailLevel: 'basic' | 'detailed' } => {
  const trimmed = message.trim().toLowerCase();
  
  // Template type mapping
  const templateTypes: Record<number, string> = {
    1: 'errors',
    2: 'revenue',
    3: 'rating',
    4: 'operations',
    5: 'promotions',
  };
  
  // Check for detailed version first: "1+", "1 +", "1détail", "1 détail", "1 detail", etc.
  const detailedPatterns = [
    /^([1-5])\s*\+$/,                    // "1+"
    /^([1-5])\s+\+$/,                    // "1 +"
    /^([1-5])\s*d[ée]tail/i,             // "1détail", "1 détail"
    /^([1-5])\s*details?/i,              // "1detail", "1 details"
    /^([1-5])[️⃣]?\s*\+$/,               // "1️⃣+"
  ];
  
  for (const pattern of detailedPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (templateTypes[num]) {
        return { isMenu: true, reportType: templateTypes[num], detailLevel: 'detailed' };
      }
    }
  }
  
  // Check for basic version: "1", "1️⃣", "1.", "1-", etc.
  const basicPatterns = [
    /^([1-5])[️⃣\.\-:\)\s]?$/,           // "1", "1.", "1-", "1:"
    /^([1-5])$/,                         // just the number
  ];
  
  for (const pattern of basicPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (templateTypes[num]) {
        return { isMenu: true, reportType: templateTypes[num], detailLevel: 'basic' };
      }
    }
  }
  
  // Also match text-based responses (default to basic)
  if (/erreur|détail\s*erreur/i.test(trimmed)) {
    const isDetailed = /\+|détaillé|complet/i.test(trimmed);
    return { isMenu: true, reportType: 'errors', detailLevel: isDetailed ? 'detailed' : 'basic' };
  }
  if (/^ca\b|chiffre|revenue|commande/i.test(trimmed) && trimmed.length < 25) {
    const isDetailed = /\+|détaillé|complet/i.test(trimmed);
    return { isMenu: true, reportType: 'revenue', detailLevel: isDetailed ? 'detailed' : 'basic' };
  }
  if (/note|avis|rating|client/i.test(trimmed) && trimmed.length < 25) {
    const isDetailed = /\+|détaillé|complet/i.test(trimmed);
    return { isMenu: true, reportType: 'rating', detailLevel: isDetailed ? 'detailed' : 'basic' };
  }
  if (/opéra|temps|prépa|attente/i.test(trimmed) && trimmed.length < 25) {
    const isDetailed = /\+|détaillé|complet/i.test(trimmed);
    return { isMenu: true, reportType: 'operations', detailLevel: isDetailed ? 'detailed' : 'basic' };
  }
  if (/promo|promotion|offre/i.test(trimmed) && trimmed.length < 25) {
    const isDetailed = /\+|détaillé|complet/i.test(trimmed);
    return { isMenu: true, reportType: 'promotions', detailLevel: isDetailed ? 'detailed' : 'basic' };
  }
  
  return { isMenu: false, reportType: null, detailLevel: 'basic' };
};

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function calculateEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Get French public holidays for a given year
function getFrenchPublicHolidays(year: number): { date: string; name: string }[] {
  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const holidays = [
    { date: `${year}-01-01`, name: "Jour de l'An" },
    { date: `${year}-05-01`, name: "Fête du Travail" },
    { date: `${year}-05-08`, name: "Victoire 1945" },
    { date: `${year}-07-14`, name: "Fête Nationale" },
    { date: `${year}-08-15`, name: "Assomption" },
    { date: `${year}-11-01`, name: "Toussaint" },
    { date: `${year}-11-11`, name: "Armistice 1918" },
    { date: `${year}-12-25`, name: "Noël" },
  ];

  // Calculate Easter-based holidays
  const easter = calculateEasterDate(year);
  
  // Lundi de Pâques (Easter Monday)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({ date: formatDate(easterMonday), name: "Lundi de Pâques" });

  // Ascension (39 days after Easter)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  holidays.push({ date: formatDate(ascension), name: "Ascension" });

  // Lundi de Pentecôte (50 days after Easter)
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 50);
  holidays.push({ date: formatDate(pentecost), name: "Lundi de Pentecôte" });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// Fetch contextual events (school holidays + football matches + public holidays)
async function fetchContextualEvents(
  supabaseUrl: string, 
  postalCode: string | null
): Promise<{ holidays: any[]; matches: any[]; publicHolidays: any[]; zone: string | null }> {
  const zone = getSchoolZoneFromPostalCode(postalCode);
  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  let holidays: any[] = [];
  let matches: any[] = [];
  let publicHolidays: any[] = [];

  // Calculate French public holidays for current year
  const currentYear = now.getFullYear();
  publicHolidays = getFrenchPublicHolidays(currentYear).filter((h: any) => {
    const holidayDate = new Date(h.date);
    return holidayDate >= now && holidayDate <= in14Days;
  });

  try {
    // Fetch school holidays
    const holidaysResponse = await fetch(
      `${supabaseUrl}/functions/v1/fetch-school-holidays`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: now.getFullYear() })
      }
    );
    
    if (holidaysResponse.ok) {
      const holidaysData = await holidaysResponse.json();
      if (holidaysData.holidays) {
        holidays = holidaysData.holidays.filter((h: any) => {
          const startDate = new Date(h.start_date);
          const endDate = new Date(h.end_date);
          // Event is upcoming or ongoing
          const isRelevant = endDate >= now && startDate <= in14Days;
          // Event concerns this zone (or all zones if not specified)
          const concernsZone = !zone || h.zones?.length === 0 || h.zones?.includes(`Zone ${zone}`);
          return isRelevant && concernsZone;
        }).slice(0, 3); // Limit to 3 events
      }
    }
  } catch (e) {
    console.error('Error fetching school holidays:', e);
  }

  try {
    // Fetch football matches
    const matchesResponse = await fetch(
      `${supabaseUrl}/functions/v1/fetch-football-matches`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    
    if (matchesResponse.ok) {
      const matchesData = await matchesResponse.json();
      if (matchesData.matches) {
        matches = matchesData.matches.filter((m: any) => {
          const matchDate = new Date(m.date);
          return matchDate >= now && matchDate <= in14Days;
        }).slice(0, 3); // Limit to 3 matches
      }
    }
  } catch (e) {
    console.error('Error fetching football matches:', e);
  }

  return { holidays, matches, publicHolidays, zone };
}

// Fetch restaurant performance data - ENRICHED with all available data
async function fetchRestaurantData(supabase: any, restaurantId: string, supabaseUrl: string, postalCode: string | null) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  // Fetch contextual events in parallel with other queries
  const contextualEventsPromise = fetchContextualEvents(supabaseUrl, postalCode);

  // Calculate month boundaries for current and previous month
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevMonthEnd = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]; // Last day of prev month

  // Fetch current month daily sales from daily_sales_uber
  const { data: currentMonthDailySales } = await supabase
    .from('daily_sales_uber')
    .select('revenue_ttc, order_count')
    .eq('restaurant_id', restaurantId)
    .gte('date', monthStart)
    .lte('date', yesterdayStr);

  // Aggregate current month data
  let currentMonthRevenue = { revenue_ttc: 0, order_count: 0, average_basket: 0 };
  if (currentMonthDailySales && currentMonthDailySales.length > 0) {
    const totalRevenue = currentMonthDailySales.reduce((sum: number, d: any) => sum + (d.revenue_ttc || 0), 0);
    const totalOrders = currentMonthDailySales.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0);
    currentMonthRevenue = {
      revenue_ttc: totalRevenue,
      order_count: totalOrders,
      average_basket: totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0
    };
  }

  // Fetch previous month daily sales from daily_sales_uber
  const { data: prevMonthDailySales } = await supabase
    .from('daily_sales_uber')
    .select('revenue_ttc, order_count')
    .eq('restaurant_id', restaurantId)
    .gte('date', prevMonthStart)
    .lte('date', prevMonthEnd);

  // Aggregate previous month data
  let prevMonthRevenue = { revenue_ttc: 0, order_count: 0, average_basket: 0 };
  if (prevMonthDailySales && prevMonthDailySales.length > 0) {
    const totalRevenue = prevMonthDailySales.reduce((sum: number, d: any) => sum + (d.revenue_ttc || 0), 0);
    const totalOrders = prevMonthDailySales.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0);
    prevMonthRevenue = {
      revenue_ttc: totalRevenue,
      order_count: totalOrders,
      average_basket: totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0
    };
  }

  // Fetch yesterday's revenue from daily_sales_uber
  const { data: yesterdayRevenueData } = await supabase
    .from('daily_sales_uber')
    .select('revenue_ttc, order_count, average_basket')
    .eq('restaurant_id', restaurantId)
    .eq('date', yesterdayStr)
    .maybeSingle();
  
  const yesterdayRevenue = yesterdayRevenueData || { revenue_ttc: 0, order_count: 0, average_basket: 0 };

  // Fetch current month conversion from daily_conversion
  const { data: dailyConversionData } = await supabase
    .from('daily_conversion')
    .select('visits, menu_views, add_to_cart, orders')
    .eq('restaurant_id', restaurantId)
    .gte('date', monthStart)
    .lte('date', yesterdayStr);

  // Aggregate conversion data
  let currentConversion = { visits: 0, menu_views: 0, add_to_cart: 0, orders: 0, overall_rate: 0 };
  if (dailyConversionData && dailyConversionData.length > 0) {
    const totalVisits = dailyConversionData.reduce((sum: number, d: any) => sum + (d.visits || 0), 0);
    const totalMenuViews = dailyConversionData.reduce((sum: number, d: any) => sum + (d.menu_views || 0), 0);
    const totalAddToCart = dailyConversionData.reduce((sum: number, d: any) => sum + (d.add_to_cart || 0), 0);
    const totalOrders = dailyConversionData.reduce((sum: number, d: any) => sum + (d.orders || 0), 0);
    currentConversion = {
      visits: totalVisits,
      menu_views: totalMenuViews,
      add_to_cart: totalAddToCart,
      orders: totalOrders,
      overall_rate: totalVisits > 0 ? Math.round((totalOrders / totalVisits) * 10000) / 100 : 0 // en %
    };
  }

  // Fetch current month fees
  const { data: currentFees } = await supabase
    .from('monthly_fees')
    .select('uber_fee, marketing_fee, offers_cost, ads_cost, net_payout')
    .eq('restaurant_id', restaurantId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .maybeSingle();

  // Fetch recent actions
  const { data: recentActions } = await supabase
    .from('restaurant_actions')
    .select('title, category, start_date, end_date')
    .or(`restaurant_id.eq.${restaurantId},restaurant_ids.cs.{${restaurantId}}`)
    .order('start_date', { ascending: false })
    .limit(5);

  // ========== NEW DATA: Customer Reviews ==========
  const { data: customerReviews } = await supabase
    .from('customer_reviews')
    .select('overall_rating, food_rating, delivery_rating, review_date, customer_comment, tags')
    .eq('restaurant_id', restaurantId)
    .order('review_date', { ascending: false })
    .limit(20);

  // Calculate review stats
  let reviewStats = {
    count: 0,
    avgOverall: 0,
    avgFood: 0,
    avgDelivery: 0,
    recentTags: [] as string[],
  };
  if (customerReviews && customerReviews.length > 0) {
    const validOverall = customerReviews.filter((r: any) => r.overall_rating != null);
    const validFood = customerReviews.filter((r: any) => r.food_rating != null);
    const validDelivery = customerReviews.filter((r: any) => r.delivery_rating != null);
    
    reviewStats.count = customerReviews.length;
    reviewStats.avgOverall = validOverall.length > 0 
      ? validOverall.reduce((sum: number, r: any) => sum + r.overall_rating, 0) / validOverall.length 
      : 0;
    reviewStats.avgFood = validFood.length > 0 
      ? validFood.reduce((sum: number, r: any) => sum + r.food_rating, 0) / validFood.length 
      : 0;
    reviewStats.avgDelivery = validDelivery.length > 0 
      ? validDelivery.reduce((sum: number, r: any) => sum + r.delivery_rating, 0) / validDelivery.length 
      : 0;
    
    // Collect tags
    const allTags = customerReviews.flatMap((r: any) => r.tags || []);
    const tagCounts = allTags.reduce((acc: any, tag: string) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
    reviewStats.recentTags = Object.entries(tagCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  // ========== NEW DATA: Menu Item Reviews ==========
  const { data: menuItemReviews } = await supabase
    .from('menu_item_reviews')
    .select('item_title, rating, thumb_up, thumb_down, tags')
    .eq('restaurant_id', restaurantId);

  // Calculate top/flop dishes
  let topDishes: { title: string; rating: number; thumbUp: number }[] = [];
  let flopDishes: { title: string; rating: number; thumbDown: number }[] = [];
  if (menuItemReviews && menuItemReviews.length > 0) {
    // Group by item
    const itemStats = menuItemReviews.reduce((acc: any, r: any) => {
      if (!acc[r.item_title]) {
        acc[r.item_title] = { ratings: [], thumbUp: 0, thumbDown: 0 };
      }
      if (r.rating) acc[r.item_title].ratings.push(r.rating);
      acc[r.item_title].thumbUp += r.thumb_up || 0;
      acc[r.item_title].thumbDown += r.thumb_down || 0;
      return acc;
    }, {});

    const itemArray = Object.entries(itemStats).map(([title, stats]: [string, any]) => ({
      title,
      avgRating: stats.ratings.length > 0 ? stats.ratings.reduce((a: number, b: number) => a + b, 0) / stats.ratings.length : 0,
      thumbUp: stats.thumbUp,
      thumbDown: stats.thumbDown,
    }));

    topDishes = itemArray
      .filter(i => i.avgRating > 0)
      .sort((a, b) => b.avgRating - a.avgRating || b.thumbUp - a.thumbUp)
      .slice(0, 3)
      .map(i => ({ title: i.title, rating: i.avgRating, thumbUp: i.thumbUp }));

    flopDishes = itemArray
      .filter(i => i.thumbDown > 0 || i.avgRating < 4)
      .sort((a, b) => b.thumbDown - a.thumbDown || a.avgRating - b.avgRating)
      .slice(0, 3)
      .map(i => ({ title: i.title, rating: i.avgRating, thumbDown: i.thumbDown }));
  }

  // ========== NEW DATA: Order Errors ==========
  const { data: orderErrors } = await supabase
    .from('order_errors')
    .select('error_type, error_category, financial_impact, item_title')
    .eq('restaurant_id', restaurantId)
    .gte('error_date', monthStart);

  let errorStats = {
    count: 0,
    totalImpact: 0,
    byType: {} as Record<string, number>,
  };
  if (orderErrors && orderErrors.length > 0) {
    errorStats.count = orderErrors.length;
    errorStats.totalImpact = orderErrors.reduce((sum: number, e: any) => sum + (e.financial_impact || 0), 0);
    errorStats.byType = orderErrors.reduce((acc: any, e: any) => {
      const type = e.error_type || 'Autre';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  // ========== NEW DATA: Delivery Stats ==========
  const { data: deliveryStats } = await supabase
    .from('delivery_stats')
    .select('preparation_time_minutes, delivery_time_minutes, delay_minutes')
    .eq('restaurant_id', restaurantId)
    .order('delivery_date', { ascending: false })
    .limit(50);

  let deliveryMetrics = {
    avgPrepTime: 0,
    avgDeliveryTime: 0,
    avgDelay: 0,
    sampleSize: 0,
  };
  if (deliveryStats && deliveryStats.length > 0) {
    const validPrep = deliveryStats.filter((d: any) => d.preparation_time_minutes != null);
    const validDelivery = deliveryStats.filter((d: any) => d.delivery_time_minutes != null);
    const validDelay = deliveryStats.filter((d: any) => d.delay_minutes != null);

    deliveryMetrics.sampleSize = deliveryStats.length;
    deliveryMetrics.avgPrepTime = validPrep.length > 0 
      ? validPrep.reduce((sum: number, d: any) => sum + d.preparation_time_minutes, 0) / validPrep.length 
      : 0;
    deliveryMetrics.avgDeliveryTime = validDelivery.length > 0 
      ? validDelivery.reduce((sum: number, d: any) => sum + d.delivery_time_minutes, 0) / validDelivery.length 
      : 0;
    deliveryMetrics.avgDelay = validDelay.length > 0 
      ? validDelay.reduce((sum: number, d: any) => sum + d.delay_minutes, 0) / validDelay.length 
      : 0;
  }

  // ========== NEW DATA: Downtime Logs ==========
  const { data: downtimeLogs } = await supabase
    .from('downtime_logs')
    .select('duration_minutes, reason, downtime_type')
    .eq('restaurant_id', restaurantId)
    .gte('downtime_start', monthStart);

  let downtimeStats = {
    totalMinutes: 0,
    count: 0,
    reasons: [] as string[],
  };
  if (downtimeLogs && downtimeLogs.length > 0) {
    downtimeStats.count = downtimeLogs.length;
    downtimeStats.totalMinutes = downtimeLogs.reduce((sum: number, d: any) => sum + (d.duration_minutes || 0), 0);
    downtimeStats.reasons = [...new Set(downtimeLogs.map((d: any) => d.reason as string).filter(Boolean))].slice(0, 3) as string[];
  }

  // Await contextual events
  const contextualEvents = await contextualEventsPromise;

  return {
    currentMonthData: {
      revenue: currentMonthRevenue.revenue_ttc,
      orders: currentMonthRevenue.order_count,
      averageBasket: currentMonthRevenue.average_basket,
    },
    previousMonth: {
      revenue: prevMonthRevenue.revenue_ttc,
      orders: prevMonthRevenue.order_count,
      averageBasket: prevMonthRevenue.average_basket,
    },
    yesterday: {
      revenue: yesterdayRevenue.revenue_ttc || 0,
      orders: yesterdayRevenue.order_count || 0,
      averageBasket: yesterdayRevenue.average_basket || 0,
    },
    conversion: {
      visits: currentConversion?.visits || 0,
      menuViews: currentConversion?.menu_views || 0,
      addToCart: currentConversion?.add_to_cart || 0,
      orders: currentConversion?.orders || 0,
      overallRate: currentConversion?.overall_rate || 0,
    },
    fees: {
      uberFee: currentFees?.uber_fee || 0,
      marketingFee: currentFees?.marketing_fee || 0,
      offersCost: currentFees?.offers_cost || 0,
      adsCost: currentFees?.ads_cost || 0,
      netPayout: currentFees?.net_payout || 0,
    },
    recentActions: recentActions || [],
    // NEW enriched data
    reviews: reviewStats,
    topDishes,
    flopDishes,
    errors: errorStats,
    delivery: deliveryMetrics,
    downtime: downtimeStats,
    // Contextual events for rush prediction
    contextualEvents,
    currentYear,
    currentMonth,
  };
}

// Build the system prompt for the AI - ENRICHED with all data
function buildManagerPrompt(restaurant: any, data: any): string {
  const monthNames = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const currentMonthName = monthNames[data.currentMonth];
  
  // Calculate variations
  const revenueVariation = data.previousMonth.revenue > 0 
    ? ((data.currentMonthData.revenue - data.previousMonth.revenue) / data.previousMonth.revenue * 100).toFixed(1)
    : 'N/A';

  const actionsText = data.recentActions.length > 0
    ? data.recentActions.map((a: any) => `- ${a.title} (${a.category})`).join('\n')
    : 'Aucune action récente';

  // Format top dishes
  const topDishesText = data.topDishes.length > 0
    ? data.topDishes.map((d: any, i: number) => `${i + 1}. ${d.title} (${d.rating.toFixed(1)}/5)`).join('\n')
    : 'Pas encore de données';

  // Format flop dishes
  const flopDishesText = data.flopDishes.length > 0
    ? data.flopDishes.map((d: any) => `- ${d.title}: ${d.rating.toFixed(1)}/5 (${d.thumbDown} 👎)`).join('\n')
    : 'Aucun plat signalé';

  // Format error types
  const errorTypesText = Object.entries(data.errors.byType).length > 0
    ? Object.entries(data.errors.byType).map(([type, count]) => `${type}: ${count}`).join(', ')
    : 'Aucune';

  // Format downtime
  const downtimeHours = Math.floor(data.downtime.totalMinutes / 60);
  const downtimeMinutes = data.downtime.totalMinutes % 60;
  const downtimeText = data.downtime.totalMinutes > 0
    ? `${downtimeHours}h${downtimeMinutes > 0 ? downtimeMinutes : ''}`
    : '0';
  const downtimeReasons = data.downtime.reasons.length > 0
    ? data.downtime.reasons.join(', ')
    : 'Aucune';

  // Format contextual events (school holidays + football matches + public holidays)
  const events = data.contextualEvents;
  let eventsSection = '';
  
  if (events) {
    const publicHolidayLines: string[] = [];
    const holidayLines: string[] = [];
    const matchLines: string[] = [];
    
    // Format public holidays
    if (events.publicHolidays && events.publicHolidays.length > 0) {
      events.publicHolidays.forEach((h: any) => {
        const holidayDate = new Date(h.date);
        const dateStr = holidayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
        publicHolidayLines.push(`- 🇫🇷 ${h.name} (${dateStr})`);
      });
    }
    
    // Format school holidays
    if (events.holidays && events.holidays.length > 0) {
      events.holidays.forEach((h: any) => {
        const startDate = new Date(h.start_date);
        const endDate = new Date(h.end_date);
        const now = new Date();
        const isOngoing = startDate <= now && endDate >= now;
        const status = isOngoing ? '🟢 EN COURS' : `📅 ${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
        holidayLines.push(`- ${h.description} (${status})`);
      });
    }
    
    // Format matches
    if (events.matches && events.matches.length > 0) {
      events.matches.forEach((m: any) => {
        const matchDate = new Date(m.date);
        const dateStr = matchDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        matchLines.push(`- ${m.homeTeam} vs ${m.awayTeam} (${dateStr} ${timeStr})`);
      });
    }

    if (publicHolidayLines.length > 0 || holidayLines.length > 0 || matchLines.length > 0) {
      eventsSection = `
📅 ÉVÉNEMENTS À VENIR (prochains 14 jours):
${events.zone ? `Zone scolaire: ${events.zone}` : ''}
${publicHolidayLines.length > 0 ? '🎉 Jours fériés:\n' + publicHolidayLines.join('\n') : ''}
${holidayLines.length > 0 ? '🏫 Vacances scolaires:\n' + holidayLines.join('\n') : ''}
${matchLines.length > 0 ? '⚽ Matchs Champions League:\n' + matchLines.join('\n') : ''}

📊 TENDANCES HISTORIQUES (jours de rush typiques):
- Jours fériés: +30-50% commandes (surtout en soirée)
- Vendredi soir: +35% commandes
- Samedi midi et soir: +45% commandes
- Dimanche soir: +20% commandes
- Heures de pointe: 12h-14h, 19h-21h

`;
    }
  }

  // If no events, still add rush trends
  if (!eventsSection) {
    eventsSection = `
📅 ÉVÉNEMENTS À VENIR:
Pas d'événement majeur détecté dans les 14 prochains jours.

📊 TENDANCES HISTORIQUES (jours de rush typiques):
- Vendredi soir: +35% commandes
- Samedi midi et soir: +45% commandes
- Dimanche soir: +20% commandes
- Heures de pointe: 12h-14h, 19h-21h

`;
  }

  return `Tu es l'assistant WhatsApp intelligent du restaurant "${restaurant.name}" de la chaîne Chicken Street.

MANAGER:
- Prénom: ${restaurant.manager_first_name || 'Manager'}
- Nom: ${restaurant.manager_last_name || ''}

DONNÉES DE PERFORMANCE - ${currentMonthName} ${data.currentYear}:

📊 CE MOIS (${currentMonthName}):
- CA: ${data.currentMonthData.revenue.toLocaleString('fr-FR')}€
- Commandes: ${data.currentMonthData.orders}
- Panier moyen: ${data.currentMonthData.averageBasket.toFixed(2)}€
- Variation vs mois précédent: ${revenueVariation}%

📅 HIER:
- CA: ${data.yesterday.revenue.toLocaleString('fr-FR')}€
- Commandes: ${data.yesterday.orders}
- Panier moyen: ${data.yesterday.averageBasket.toFixed(2)}€

📈 CONVERSION (ce mois):
- Visites: ${data.conversion.visits}
- Vues menu: ${data.conversion.menuViews}
- Ajouts panier: ${data.conversion.addToCart}
- Commandes: ${data.conversion.orders}
- Taux global: ${(data.conversion.overallRate * 100).toFixed(1)}%

💰 FRAIS (ce mois):
- Commission Uber: ${data.fees.uberFee.toLocaleString('fr-FR')}€
- Marketing: ${data.fees.marketingFee.toLocaleString('fr-FR')}€
- Offres: ${data.fees.offersCost.toLocaleString('fr-FR')}€
- Publicité: ${data.fees.adsCost.toLocaleString('fr-FR')}€
- Versement net: ${data.fees.netPayout.toLocaleString('fr-FR')}€

⭐ AVIS CLIENTS:
- Note moyenne: ${data.reviews.avgOverall > 0 ? data.reviews.avgOverall.toFixed(1) + '/5' : 'Pas de données'}
- Note nourriture: ${data.reviews.avgFood > 0 ? data.reviews.avgFood.toFixed(1) + '/5' : 'N/A'}
- Note livraison: ${data.reviews.avgDelivery > 0 ? data.reviews.avgDelivery.toFixed(1) + '/5' : 'N/A'}
- Nombre d'avis récents: ${data.reviews.count}
- Tags fréquents: ${data.reviews.recentTags.length > 0 ? data.reviews.recentTags.join(', ') : 'Aucun'}

🍗 TOP PLATS (meilleurs avis):
${topDishesText}

⚠️ PLATS À AMÉLIORER:
${flopDishesText}

❌ ERREURS DE COMMANDE (ce mois):
- Total: ${data.errors.count} erreurs
- Impact financier: -${data.errors.totalImpact.toLocaleString('fr-FR')}€
- Types: ${errorTypesText}

⏱️ TEMPS DE PRÉPARATION (50 dernières commandes):
- Temps moyen prépa: ${data.delivery.avgPrepTime > 0 ? Math.round(data.delivery.avgPrepTime) + ' min' : 'N/A'}
- Temps moyen livraison: ${data.delivery.avgDeliveryTime > 0 ? Math.round(data.delivery.avgDeliveryTime) + ' min' : 'N/A'}
- Retard moyen: ${data.delivery.avgDelay > 0 ? '+' + Math.round(data.delivery.avgDelay) + ' min' : '0 min'}

🔴 TEMPS D'ARRÊT (ce mois):
- Total: ${downtimeText}
- Nombre de fermetures: ${data.downtime.count}
- Raisons: ${downtimeReasons}

📋 ACTIONS RÉCENTES:
${actionsText}
${eventsSection}
CAPACITÉS:
1. Répondre aux questions sur les performances (CA, commandes, conversion, frais)
2. Informer sur les avis clients et la note du restaurant
3. Donner les meilleurs/pires plats selon les avis
4. Informer sur les erreurs de commande et leur impact
5. Donner les temps de préparation et retards
6. Informer sur les temps d'arrêt et fermetures
7. Fournir des conseils d'amélioration basés sur toutes ces données
8. PRÉDIRE LES JOURS DE RUSH basés sur les événements et tendances historiques
9. CRÉER DES ACTIONS - Ajoute ce tag: [ACTION:Titre|YYYY-MM-DD|categorie]
   Catégories disponibles: marketing, menu, promotions, operational, pricing, visuals
10. ENVOYER UN RAPPORT - Ajoute ce tag: [RAPPORT:type] (types: semaine, mois)

RÈGLES:
- CONCIS et DIRECT (c'est WhatsApp)
- Max 4-5 lignes
- Émojis pour lisibilité
- Tutoie le manager
- Si données à 0, dis "pas encore disponible"
- Sujets restaurant uniquement`;
}

// Detect intent from query - ENRICHED with new data types
function detectIntent(query: string): { intent: string; entities: Record<string, any> } {
  const lowerQuery = query.toLowerCase();
  const entities: Record<string, any> = {};
  
  // Detect period
  if (lowerQuery.includes('hier')) entities.period = 'yesterday';
  else if (lowerQuery.includes('aujourd')) entities.period = 'today';
  else if (lowerQuery.includes('semaine')) entities.period = 'week';
  else if (lowerQuery.includes('mois')) entities.period = 'month';
  
  // Detect metric - ENRICHED
  if (lowerQuery.includes('ca') || lowerQuery.includes('chiffre') || lowerQuery.includes('revenu') || lowerQuery.includes('vente')) {
    entities.metric = 'revenue';
  } else if (lowerQuery.includes('commande') && !lowerQuery.includes('erreur')) {
    entities.metric = 'orders';
  } else if (lowerQuery.includes('panier')) {
    entities.metric = 'basket';
  } else if (lowerQuery.includes('conversion') || lowerQuery.includes('taux')) {
    entities.metric = 'conversion';
  } else if (lowerQuery.includes('frais') || lowerQuery.includes('commission')) {
    entities.metric = 'fees';
  } else if (lowerQuery.includes('note') || lowerQuery.includes('avis') || lowerQuery.includes('étoile') || lowerQuery.includes('rating')) {
    entities.metric = 'reviews';
  } else if (lowerQuery.includes('plat') || lowerQuery.includes('produit') || lowerQuery.includes('meilleur') || lowerQuery.includes('top') || lowerQuery.includes('flop') || lowerQuery.includes('pire')) {
    entities.metric = 'dishes';
  } else if (lowerQuery.includes('erreur') || lowerQuery.includes('problème') || lowerQuery.includes('remboursement')) {
    entities.metric = 'errors';
  } else if (lowerQuery.includes('prépa') || lowerQuery.includes('livraison') || lowerQuery.includes('retard') || lowerQuery.includes('temps')) {
    entities.metric = 'delivery';
  } else if (lowerQuery.includes('fermeture') || lowerQuery.includes('arrêt') || lowerQuery.includes('downtime') || lowerQuery.includes('fermé')) {
    entities.metric = 'downtime';
  } else if (lowerQuery.includes('rush') || lowerQuery.includes('chargé') || lowerQuery.includes('achalandage') || lowerQuery.includes('prévision') || lowerQuery.includes('anticiper') || lowerQuery.includes('événement') || lowerQuery.includes('match') || lowerQuery.includes('foot') || lowerQuery.includes('vacances') || lowerQuery.includes('fête') || lowerQuery.includes('férié')) {
    entities.metric = 'rush_prediction';
  }
  
  // Detect intent
  let intent = 'unknown';
  if (lowerQuery.includes('rapport') || lowerQuery.includes('envoie') || lowerQuery.includes('pdf')) {
    intent = 'report_request';
  } else if (lowerQuery.includes('action') || lowerQuery.includes('rappel') || lowerQuery.includes('promo') || lowerQuery.includes('créer')) {
    intent = 'action_request';
  } else if (lowerQuery.includes('comparer') || lowerQuery.includes('vs') || lowerQuery.includes('versus')) {
    intent = 'comparison';
    entities.comparison = true;
  } else if (lowerQuery.includes('bonjour') || lowerQuery.includes('salut') || lowerQuery.includes('hello') || lowerQuery.includes('coucou')) {
    intent = 'greeting';
  } else if (entities.metric === 'rush_prediction') {
    intent = 'rush_prediction';
  } else if (entities.metric || entities.period) {
    intent = 'analytics';
  }
  
  return { intent, entities };
}

// Call Lovable AI to generate a response
interface AIResult {
  content: string | null;
  responseTimeMs: number;
  tokensUsed?: number;
  error?: string;
}

async function callAI(systemPrompt: string, userMessage: string): Promise<AIResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const startTime = Date.now();
  
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return { content: null, responseTimeMs: Date.now() - startTime, error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        max_tokens: 300,
      }),
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return { content: null, responseTimeMs, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;
    const tokensUsed = data.usage?.total_tokens;
    
    return { content, responseTimeMs, tokensUsed };
  } catch (error) {
    console.error('Error calling AI:', error);
    return { 
      content: null, 
      responseTimeMs: Date.now() - startTime, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Send WhatsApp reply via Ultramsg
async function sendWhatsAppReply(phone: string, message: string): Promise<boolean> {
  const INSTANCE_ID = Deno.env.get('ULTRAMSG_INSTANCE_ID');
  const TOKEN = Deno.env.get('ULTRAMSG_TOKEN');

  if (!INSTANCE_ID || !TOKEN) {
    console.error('Ultramsg credentials not configured');
    return false;
  }

  const formattedPhone = formatPhoneForUltramsg(phone);

  try {
    const response = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: TOKEN,
        to: formattedPhone,
        body: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ultramsg send error:', response.status, errorText);
      return false;
    }

    console.log(`✓ Chatbot reply sent to ${phone}`);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp reply:', error);
    return false;
  }
}

// Parse and create action from AI response
async function parseAndCreateAction(
  supabase: any,
  response: string,
  restaurantId: string
): Promise<{ modifiedResponse: string; actionCreated: boolean; actionTitle?: string }> {
  // Pattern: [ACTION:Titre|YYYY-MM-DD|categorie]
  const actionPattern = /\[ACTION:([^|]+)\|(\d{4}-\d{2}-\d{2})\|([^\]]+)\]/g;
  let modifiedResponse = response;
  let actionCreated = false;
  let actionTitle: string | undefined;

  const matches = [...response.matchAll(actionPattern)];
  
  for (const match of matches) {
    const [fullMatch, title, date, category] = match;
    
    // Validate and map category to valid database values
    const validCategories = ['marketing', 'menu', 'promotions', 'operational', 'pricing', 'visuals'];
    const categoryMapping: Record<string, string> = {
      'operation': 'operational',
      'promotion': 'promotions',
      'promo': 'promotions',
      'tarif': 'pricing',
      'prix': 'pricing',
      'visual': 'visuals',
      'other': 'operational',
    };
    const normalizedCategory = category.toLowerCase().trim();
    const mappedCategory = categoryMapping[normalizedCategory] || normalizedCategory;
    const finalCategory = validCategories.includes(mappedCategory) ? mappedCategory : 'operational';
    
    try {
      // Create the action in database
      const { error } = await supabase.from('restaurant_actions').insert({
        restaurant_id: restaurantId,
        restaurant_ids: [restaurantId],
        title: title.trim(),
        category: finalCategory,
        action_type: 'chatbot_created',
        start_date: date,
        description: `Action créée via WhatsApp chatbot`,
        platform: 'all',
      });

      if (error) {
        console.error('Error creating action:', error);
        modifiedResponse = modifiedResponse.replace(fullMatch, `❌ Erreur lors de la création de l'action "${title}"`);
      } else {
        console.log(`✓ Action created: ${title} for ${date}`);
        modifiedResponse = modifiedResponse.replace(fullMatch, `✅ Action "${title}" créée pour le ${formatDateFR(date)}`);
        actionCreated = true;
        actionTitle = title.trim();
      }
    } catch (err) {
      console.error('Exception creating action:', err);
      modifiedResponse = modifiedResponse.replace(fullMatch, `❌ Erreur: impossible de créer l'action`);
    }
  }

  return { modifiedResponse, actionCreated, actionTitle };
}

// Format date in French
function formatDateFR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${parseInt(day)} ${months[parseInt(month)]} ${year}`;
}

// Generate report text for WhatsApp
async function generateReport(
  supabase: any,
  restaurantId: string,
  restaurantName: string,
  reportType: 'semaine' | 'mois'
): Promise<string> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  let reportTitle = '';
  let periodStart = '';
  let periodEnd = now.toISOString().split('T')[0];

  if (reportType === 'semaine') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    periodStart = weekAgo.toISOString().split('T')[0];
    reportTitle = `📊 RAPPORT HEBDOMADAIRE\n${restaurantName}\n${formatDateFR(periodStart)} → ${formatDateFR(periodEnd)}`;
  } else {
    reportTitle = `📊 RAPPORT MENSUEL\n${restaurantName}\n${months[currentMonth]} ${currentYear}`;
  }

  // Fetch monthly data
  const { data: monthlyRevenue } = await supabase
    .from('monthly_revenue')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .maybeSingle();

  const { data: monthlyConversion } = await supabase
    .from('monthly_conversion')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .maybeSingle();

  const { data: monthlyFees } = await supabase
    .from('monthly_fees')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .maybeSingle();

  // Fetch previous month for comparison
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  const { data: prevRevenue } = await supabase
    .from('monthly_revenue')
    .select('revenue_ttc, order_count')
    .eq('restaurant_id', restaurantId)
    .eq('year', prevYear)
    .eq('month', prevMonth)
    .maybeSingle();

  // Calculate variations
  const revenue = monthlyRevenue?.revenue_ttc || 0;
  const orders = monthlyRevenue?.order_count || 0;
  const avgBasket = monthlyRevenue?.average_basket || 0;
  const prevRevenueVal = prevRevenue?.revenue_ttc || 0;
  const revenueVariation = prevRevenueVal > 0 
    ? ((revenue - prevRevenueVal) / prevRevenueVal * 100).toFixed(1) 
    : 'N/A';
  const variationEmoji = parseFloat(revenueVariation) >= 0 ? '📈' : '📉';

  // Calculate profitability
  const netPayout = monthlyFees?.net_payout || 0;
  const profitability = revenue > 0 ? ((netPayout / revenue) * 100).toFixed(1) : 'N/A';

  // Build report text
  let report = `${reportTitle}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  report += `💰 *CHIFFRE D'AFFAIRES*\n`;
  report += `• CA: ${revenue.toLocaleString('fr-FR')}€\n`;
  report += `• vs mois précédent: ${revenueVariation}% ${variationEmoji}\n\n`;
  
  report += `📦 *COMMANDES*\n`;
  report += `• Total: ${orders} commandes\n`;
  report += `• Panier moyen: ${avgBasket.toFixed(2)}€\n\n`;
  
  if (monthlyConversion) {
    const convRate = ((monthlyConversion.orders / monthlyConversion.visits) * 100) || 0;
    report += `📈 *CONVERSION*\n`;
    report += `• Visites: ${monthlyConversion.visits}\n`;
    report += `• Taux global: ${convRate.toFixed(1)}%\n\n`;
  }
  
  if (monthlyFees) {
    const totalFees = (monthlyFees.uber_fee || 0) + (monthlyFees.marketing_fee || 0) + 
                      (monthlyFees.offers_cost || 0) + (monthlyFees.ads_cost || 0);
    report += `💸 *FRAIS & RENTABILITÉ*\n`;
    report += `• Frais totaux: ${totalFees.toLocaleString('fr-FR')}€\n`;
    report += `• Versement net: ${netPayout.toLocaleString('fr-FR')}€\n`;
    report += `• Rentabilité: ${profitability}%\n\n`;
  }
  
  report += `━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `_Généré automatiquement par CS Advisor_`;

  return report;
}

// Parse and send report from AI response
async function parseAndSendReport(
  supabase: any,
  response: string,
  restaurantId: string,
  restaurantName: string,
  phone: string
): Promise<{ modifiedResponse: string; reportSent: boolean }> {
  // Pattern: [RAPPORT:type]
  const reportPattern = /\[RAPPORT:(semaine|mois)\]/gi;
  let modifiedResponse = response;
  let reportSent = false;

  const matches = [...response.matchAll(reportPattern)];
  
  for (const match of matches) {
    const [fullMatch, type] = match;
    const reportType = type.toLowerCase() as 'semaine' | 'mois';
    
    try {
      // Generate the report
      const reportText = await generateReport(supabase, restaurantId, restaurantName, reportType);
      
      // Send report via WhatsApp
      const sent = await sendWhatsAppReply(phone, reportText);
      
      if (sent) {
        console.log(`✓ Report sent: ${reportType}`);
        modifiedResponse = modifiedResponse.replace(fullMatch, `✅ Rapport ${reportType === 'semaine' ? 'hebdomadaire' : 'mensuel'} envoyé !`);
        reportSent = true;
        
        // Save report to message_history
        await supabase.from('message_history').insert({
          direction: 'outbound',
          recipient_phone: phone,
          restaurant_id: restaurantId,
          restaurant_name: restaurantName,
          message_content: reportText,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } else {
        modifiedResponse = modifiedResponse.replace(fullMatch, `❌ Erreur lors de l'envoi du rapport`);
      }
    } catch (err) {
      console.error('Exception sending report:', err);
      modifiedResponse = modifiedResponse.replace(fullMatch, `❌ Erreur: impossible d'envoyer le rapport`);
    }
  }

  return { modifiedResponse, reportSent };
}

// Handle interactive report menu responses (1-5 for basic, 1+ for detailed)
async function handleInteractiveReportRequest(
  supabase: any,
  restaurant: any,
  reportType: string,
  detailLevel: 'basic' | 'detailed',
  phone: string,
  managerFirstName: string
): Promise<void> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  
  if (!SUPABASE_URL) {
    console.error('SUPABASE_URL not configured');
    await sendWhatsAppReply(phone, "❌ Erreur de configuration. Réessaie plus tard.");
    return;
  }

  console.log(`=== INTERACTIVE REPORT REQUEST ===`);
  console.log(`Restaurant: ${restaurant.name}`);
  console.log(`Report type: ${reportType}`);
  console.log(`Detail level: ${detailLevel}`);
  console.log(`Phone: ${phone}`);

  // Calculate date range for last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Report type labels for user feedback
  const reportLabels: Record<string, string> = {
    errors: 'Taux d\'erreur',
    revenue: 'CA & Commandes',
    rating: 'Note moyenne',
    operations: 'Temps opérationnels',
    promotions: 'Promotions',
  };

  const reportLabel = reportLabels[reportType] || 'Rapport';
  const levelLabel = detailLevel === 'detailed' ? ' (détaillé)' : '';

  // Send "generating" acknowledgment immediately
  await sendWhatsAppReply(phone, `⏳ Génération du rapport "${reportLabel}${levelLabel}" en cours...`);

  try {
    // Call the generate-stat-report function with the specific report type and detail level
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-stat-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        start_date: startDateStr,
        end_date: endDateStr,
        template_type: reportType,
        detail_level: detailLevel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error generating stat report:', response.status, errorText);
      await sendWhatsAppReply(phone, `❌ Erreur lors de la génération du rapport. Réessaie plus tard.`);
      return;
    }

    const data = await response.json();
    
    if (!data.success || !data.report) {
      console.error('No report generated:', data);
      await sendWhatsAppReply(phone, `❌ Impossible de générer le rapport. Données insuffisantes.`);
      return;
    }

    const reportMessage = data.report.generated_message;

    // Send the report
    const sent = await sendWhatsAppReply(phone, reportMessage);

    if (sent) {
      console.log(`✓ Interactive report sent: ${reportType} (${detailLevel})`);
      
      // Log to message history
      await supabase.from('message_history').insert({
        direction: 'outbound',
        recipient_phone: phone,
        recipient_name: managerFirstName,
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        message_content: reportMessage,
        message_type: 'report',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      // Log to chatbot_interactions
      await supabase.from('chatbot_interactions').insert({
        restaurant_id: restaurant.id,
        manager_phone: phone,
        manager_name: managerFirstName,
        query: `[MENU_INTERACTIF:${reportType}:${detailLevel}]`,
        response: reportMessage.substring(0, 500),
        intent: 'interactive_report',
        detected_entities: { report_type: reportType, detail_level: detailLevel },
        was_successful: true,
      });
    } else {
      console.error('Failed to send interactive report');
    }
  } catch (error) {
    console.error('Exception in handleInteractiveReportRequest:', error);
    await sendWhatsAppReply(phone, `❌ Erreur technique. Réessaie plus tard.`);
  }
}

// Main handler for manager queries - NOW SUPPORTS MULTIPLE RESTAURANTS
async function handleManagerQuery(
  supabase: any,
  restaurants: any[], // Array of restaurants the manager has access to
  manager: any | null, // Manager info from managers table (can be null for legacy)
  query: string,
  phone: string
): Promise<void> {
  console.log(`=== CHATBOT PROCESSING ===`);
  console.log(`Manager: ${manager?.first_name || 'Unknown'} ${manager?.last_name || ''}`);
  console.log(`Restaurants (${restaurants.length}):`, restaurants.map(r => r.name).join(', '));
  console.log(`Query: ${query}`);

  // Detect intent and entities
  const { intent, entities } = detectIntent(query);
  console.log(`Detected intent: ${intent}`, entities);

  // Determine which restaurant(s) to query based on the message
  // Check if user is asking about a specific restaurant
  const lowerQuery = query.toLowerCase();
  let targetRestaurants = restaurants;
  
  // Try to match restaurant names in the query
  const matchedRestaurant = restaurants.find(r => {
    const restaurantName = r.name.toLowerCase();
    // Extract city name from restaurant name (e.g., "CHICKEN STREET BOURG-EN-BRESSE" -> "bourg")
    const cityMatch = restaurantName.match(/chicken street\s+(.+)/i);
    if (cityMatch) {
      const cityName = cityMatch[1].toLowerCase().split('-')[0]; // Get first part of hyphenated name
      return lowerQuery.includes(cityName) || lowerQuery.includes(restaurantName);
    }
    return lowerQuery.includes(restaurantName);
  });

  if (matchedRestaurant) {
    console.log(`Query targets specific restaurant: ${matchedRestaurant.name}`);
    targetRestaurants = [matchedRestaurant];
  }

  // Fetch data for all target restaurants
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const allRestaurantData: any[] = [];
  
  for (const restaurant of targetRestaurants) {
    const data = await fetchRestaurantData(supabase, restaurant.id, supabaseUrl, restaurant.postal_code);
    allRestaurantData.push({
      restaurant,
      data,
    });
  }
  console.log(`Fetched data for ${allRestaurantData.length} restaurant(s)`);

  // Build AI prompt with multi-restaurant context
  const systemPrompt = buildMultiRestaurantPrompt(manager, allRestaurantData);

  // Call AI
  const aiResult = await callAI(systemPrompt, query);
  const managerName = manager 
    ? `${manager.first_name || ''} ${manager.last_name || ''}`.trim()
    : `${targetRestaurants[0]?.manager_first_name || ''} ${targetRestaurants[0]?.manager_last_name || ''}`.trim();

  // Process action commands if present in AI response
  // Use the first/primary restaurant for action creation
  const primaryRestaurant = targetRestaurants.find(r => r.is_primary) || targetRestaurants[0];
  let finalResponse = aiResult.content;
  let actionCreated = false;
  let reportSent = false;
  
  if (finalResponse && finalResponse.includes('[ACTION:')) {
    const actionResult = await parseAndCreateAction(supabase, finalResponse, primaryRestaurant.id);
    finalResponse = actionResult.modifiedResponse;
    actionCreated = actionResult.actionCreated;
    
    if (actionCreated) {
      console.log(`✓ Action command processed: ${actionResult.actionTitle}`);
    }
  }

  // Process report commands if present in AI response
  if (finalResponse && finalResponse.includes('[RAPPORT:')) {
    const reportResult = await parseAndSendReport(
      supabase, 
      finalResponse, 
      primaryRestaurant.id, 
      primaryRestaurant.name, 
      phone
    );
    finalResponse = reportResult.modifiedResponse;
    reportSent = reportResult.reportSent;
    
    if (reportSent) {
      console.log(`✓ Report command processed`);
    }
  }

  // Determine final intent
  let finalIntent = intent;
  if (actionCreated) finalIntent = 'action_request';
  if (reportSent) finalIntent = 'report_request';

  // Log interaction to chatbot_interactions (use primary restaurant)
  const interactionLog = {
    restaurant_id: primaryRestaurant.id,
    manager_phone: phone,
    manager_name: managerName || null,
    query,
    response: finalResponse,
    intent: finalIntent,
    detected_entities: { 
      ...entities, 
      action_created: actionCreated, 
      report_sent: reportSent,
      restaurants_count: restaurants.length,
      target_restaurants: targetRestaurants.map(r => r.name),
    },
    response_time_ms: aiResult.responseTimeMs,
    ai_model: 'google/gemini-2.5-flash',
    tokens_used: aiResult.tokensUsed || null,
    was_successful: !!finalResponse,
    error_message: aiResult.error || null,
  };

  await supabase.from('chatbot_interactions').insert(interactionLog);
  console.log(`✓ Interaction logged (${aiResult.responseTimeMs}ms, intent: ${finalIntent})`);

  if (finalResponse) {
    console.log(`Final Response: ${finalResponse.substring(0, 100)}...`);
    
    // Send response via WhatsApp
    const sent = await sendWhatsAppReply(phone, finalResponse);
    
    if (sent) {
      // Save chatbot response to message_history
      await supabase.from('message_history').insert({
        direction: 'outbound',
        sender_phone: null,
        recipient_phone: phone,
        recipient_name: managerName,
        restaurant_id: primaryRestaurant.id,
        restaurant_name: primaryRestaurant.name,
        message_content: finalResponse,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      console.log('✓ Chatbot response saved to history');
    }
  } else {
    // Fallback message if AI fails
    const fallbackMessage = `Désolé, je n'ai pas pu traiter ta demande. Réessaie dans quelques instants ou contacte le support. 🙏`;
    await sendWhatsAppReply(phone, fallbackMessage);
    console.log('Sent fallback message due to AI error');
  }
}

// Build prompt for multiple restaurants
function buildMultiRestaurantPrompt(manager: any | null, restaurantDataList: any[]): string {
  const monthNames = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  
  const managerFirstName = manager?.first_name || restaurantDataList[0]?.restaurant?.manager_first_name || 'Manager';
  const managerLastName = manager?.last_name || restaurantDataList[0]?.restaurant?.manager_last_name || '';
  
  // If single restaurant, use the original detailed format
  if (restaurantDataList.length === 1) {
    const { restaurant, data } = restaurantDataList[0];
    return buildManagerPrompt({
      ...restaurant,
      manager_first_name: managerFirstName,
      manager_last_name: managerLastName,
    }, data);
  }
  
  // Multiple restaurants - build comparative prompt
  const currentMonth = restaurantDataList[0]?.data?.currentMonth || new Date().getMonth() + 1;
  const currentYear = restaurantDataList[0]?.data?.currentYear || new Date().getFullYear();
  const currentMonthName = monthNames[currentMonth];
  
  let restaurantSections = '';
  let totalRevenue = 0;
  let totalOrders = 0;
  let totalErrors = 0;
  
  for (const { restaurant, data } of restaurantDataList) {
    totalRevenue += data.currentMonthData.revenue || 0;
    totalOrders += data.currentMonthData.orders || 0;
    totalErrors += data.errors.count || 0;
    
    restaurantSections += `
📍 ${restaurant.name}:
- CA ce mois: ${data.currentMonthData.revenue.toLocaleString('fr-FR')}€
- Commandes: ${data.currentMonthData.orders}
- Panier moyen: ${data.currentMonthData.averageBasket.toFixed(2)}€
- Note moyenne: ${data.reviews.avgOverall > 0 ? data.reviews.avgOverall.toFixed(1) + '/5' : 'N/A'}
- Erreurs ce mois: ${data.errors.count}
- Temps prépa moyen: ${data.delivery.avgPrepTime > 0 ? Math.round(data.delivery.avgPrepTime) + ' min' : 'N/A'}
`;
  }

  return `Tu es l'assistant WhatsApp intelligent pour un manager multi-sites de la chaîne Chicken Street.

MANAGER:
- Prénom: ${managerFirstName}
- Nom: ${managerLastName}
- Nombre de restaurants gérés: ${restaurantDataList.length}

📊 VUE D'ENSEMBLE - ${currentMonthName} ${currentYear}:
- CA TOTAL: ${totalRevenue.toLocaleString('fr-FR')}€
- COMMANDES TOTAL: ${totalOrders}
- ERREURS TOTAL: ${totalErrors}

📍 DÉTAIL PAR RESTAURANT:
${restaurantSections}

CAPACITÉS:
1. Répondre aux questions sur les performances globales ou par restaurant
2. Comparer les performances entre restaurants
3. Identifier les restaurants nécessitant attention
4. Donner des conseils d'amélioration personnalisés par restaurant
5. PRÉDIRE LES JOURS DE RUSH basés sur les événements
6. CRÉER DES ACTIONS - Tag: [ACTION:Titre|YYYY-MM-DD|categorie]
7. ENVOYER UN RAPPORT - Tag: [RAPPORT:type]

RÈGLES:
- CONCIS et DIRECT (c'est WhatsApp)
- Max 6-8 lignes pour une vue multi-restaurants
- Émojis pour lisibilité
- Tutoie le manager
- Si le manager demande un restaurant spécifique, concentre-toi sur celui-là
- Si la question est générale, donne une vue d'ensemble comparative
- Sujets restaurant uniquement`;
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

    // Parse webhook payload from Ultramsg
    const payload = await req.json();
    
    // Log complete payload for debugging
    console.log('=== ULTRAMSG WEBHOOK RECEIVED ===');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    // Ultramsg wraps message data in a "data" object for received messages
    const messageData = payload.data || payload;

    // Handle incoming messages (new feature for bidirectional conversations)
    if (messageData.from && messageData.body && messageData.type === 'chat') {
      console.log('Processing incoming message from:', messageData.from);
      
      // Extract phone number (remove @c.us suffix if present)
      const senderPhone = messageData.from.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
      const normalizedPhone = normalizePhoneNumber(senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`);
      
      console.log('Normalized sender phone:', normalizedPhone);
      
      // === NEW: Try to find manager in the managers table first ===
      let manager: any = null;
      let managerRestaurants: any[] = [];
      
      // Try finding manager by normalized phone (various formats)
      const phoneVariants = [
        normalizedPhone,
        normalizedPhone.replace('+', ''),
        '+' + normalizedPhone.replace('+', ''),
        '0' + normalizedPhone.slice(-9), // French format
      ];
      
      for (const phoneVariant of phoneVariants) {
        const { data: foundManager } = await supabase
          .from('managers')
          .select('id, phone, first_name, last_name, email')
          .or(`phone.eq.${phoneVariant},phone.ilike.%${phoneVariant.slice(-9)}%`)
          .maybeSingle();
        
        if (foundManager) {
          manager = foundManager;
          break;
        }
      }
      
      if (manager) {
        console.log(`Found manager: ${manager.first_name} ${manager.last_name} (ID: ${manager.id})`);
        
        // Get all restaurants this manager has access to
        const { data: managerLinks } = await supabase
          .from('manager_restaurants')
          .select(`
            restaurant_id,
            role,
            is_primary,
            restaurants (
              id,
              name,
              manager_first_name,
              manager_last_name,
              postal_code
            )
          `)
          .eq('manager_id', manager.id);
        
        if (managerLinks && managerLinks.length > 0) {
          managerRestaurants = managerLinks
            .filter((link: any) => link.restaurants)
            .map((link: any) => ({
              ...link.restaurants,
              role: link.role,
              is_primary: link.is_primary,
              // Use manager info from managers table
              manager_first_name: manager.first_name,
              manager_last_name: manager.last_name,
            }));
          console.log(`Manager has access to ${managerRestaurants.length} restaurants:`, managerRestaurants.map((r: any) => r.name).join(', '));
        }
      }
      
      // === FALLBACK: Legacy logic using restaurants.manager_whatsapp ===
      if (managerRestaurants.length === 0) {
        console.log('No manager found in managers table, trying legacy lookup...');
        
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('id, name, manager_first_name, manager_last_name, manager_whatsapp, postal_code')
          .not('manager_whatsapp', 'is', null);
        
        // Find ALL restaurants matching this phone (not just the first one)
        const matchingRestaurants = restaurants?.filter((r: any) => {
          if (!r.manager_whatsapp) return false;
          const normalizedManagerPhone = normalizePhoneNumber(r.manager_whatsapp);
          return normalizedManagerPhone.includes(normalizedPhone) || normalizedPhone.includes(normalizedManagerPhone);
        }) || [];
        
        if (matchingRestaurants.length > 0) {
          managerRestaurants = matchingRestaurants;
          console.log(`Legacy lookup found ${managerRestaurants.length} restaurants:`, managerRestaurants.map((r: any) => r.name).join(', '));
        }
      }
      
      // For backwards compatibility, use first restaurant for message logging
      const primaryRestaurant = managerRestaurants.find((r: any) => r.is_primary) || managerRestaurants[0] || null;
      const managerName = manager 
        ? `${manager.first_name || ''} ${manager.last_name || ''}`.trim()
        : primaryRestaurant 
          ? `${primaryRestaurant.manager_first_name || ''} ${primaryRestaurant.manager_last_name || ''}`.trim()
          : null;
      
      console.log('Primary restaurant:', primaryRestaurant?.name || 'None found');

      // Check if this is an "echo" message (already sent as outbound in the last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      const { data: recentOutbound } = await supabase
        .from('message_history')
        .select('id')
        .eq('direction', 'outbound')
        .eq('recipient_phone', normalizedPhone)
        .eq('message_content', messageData.body)
        .gte('created_at', thirtySecondsAgo)
        .maybeSingle();

      if (recentOutbound) {
        console.log('Ignoring echo message - already exists as outbound');
        return new Response(
          JSON.stringify({ success: true, type: 'echo_ignored' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert incoming message into message_history
      const { error: insertError } = await supabase
        .from('message_history')
        .insert({
          direction: 'inbound',
          sender_phone: normalizedPhone,
          recipient_phone: normalizedPhone,
          recipient_name: managerName,
          restaurant_id: primaryRestaurant?.id || null,
          restaurant_name: primaryRestaurant?.name || null,
          message_content: messageData.body,
          ultramsg_message_id: messageData.id || messageData.sid || null,
          status: 'received',
          sent_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error inserting incoming message:', insertError);
      } else {
        console.log('Incoming message saved successfully');
      }

      // === INTERACTIVE MENU DETECTION ===
      // Check if this is a response to an interactive report menu (1, 2, 3, 4)
      const menuResponse = isInteractiveMenuResponse(messageData.body);
      
      if (managerRestaurants.length > 0 && menuResponse.isMenu && menuResponse.reportType) {
        console.log(`Interactive menu response detected: ${menuResponse.reportType} (${menuResponse.detailLevel})`);
        const primaryRestaurantForReport = managerRestaurants.find((r: any) => r.is_primary) || managerRestaurants[0];
        
        // Handle report generation asynchronously
        handleInteractiveReportRequest(
          supabase,
          primaryRestaurantForReport,
          menuResponse.reportType,
          menuResponse.detailLevel,
          normalizedPhone,
          manager?.first_name || primaryRestaurantForReport?.manager_first_name || 'Manager'
        ).catch((err: Error) => console.error('Interactive report error:', err));
        
        return new Response(
          JSON.stringify({ success: true, type: 'interactive_menu_response' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // === CHATBOT LOGIC ===
      // Only respond if:
      // 1. The message is from a known restaurant manager
      // 2. The message looks like a query (not a simple response)
      if (managerRestaurants.length > 0 && isQueryMessage(messageData.body)) {
        console.log('Query detected, activating chatbot...');
        // Handle asynchronously to not block the webhook response
        // Pass ALL restaurants the manager has access to
        handleManagerQuery(supabase, managerRestaurants, manager, messageData.body, normalizedPhone)
          .catch(err => console.error('Chatbot error:', err));
      } else if (managerRestaurants.length === 0) {
        console.log('No restaurant found for this phone, skipping chatbot');
      } else {
        console.log('Message does not appear to be a query, skipping chatbot');
      }

      return new Response(
        JSON.stringify({ success: true, type: 'incoming_message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle message ACK updates (existing functionality)
    const ackData = payload.data || payload;
    
    if (ackData.id && ackData.ack !== undefined) {
      console.log('=== PROCESSING ACK ===');
      console.log('ACK data:', JSON.stringify(ackData));
      
      let messageId = String(ackData.id);
      messageId = messageId.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
      if (messageId.startsWith('true_')) {
        messageId = messageId.replace('true_', '');
      }
      
      console.log('Extracted message ID:', messageId);
      
      const ack = parseInt(ackData.ack);
      console.log('ACK value:', ack);
      
      let newStatus = 'sent';
      let updateData: Record<string, unknown> = {};
      
      if (ack === 1) {
        newStatus = 'sent';
        updateData = { status: newStatus };
      } else if (ack === 2) {
        newStatus = 'delivered';
        updateData = { 
          status: newStatus,
          delivered_at: new Date().toISOString()
        };
      } else if (ack === 3) {
        newStatus = 'read';
        updateData = { 
          status: newStatus,
          read_at: new Date().toISOString()
        };
      }

      console.log(`Attempting to update message ${messageId} to status: ${newStatus}`);

      // Try multiple strategies to find the message
      let messageQuery = supabase
        .from('message_history')
        .select('id, campaign_id, status, ultramsg_message_id')
        .eq('ultramsg_message_id', messageId);
      
      let { data: msgData, error: fetchError } = await messageQuery.maybeSingle();

      if (!msgData && !fetchError) {
        console.log('Message not found with exact match, trying substring match');
        const { data: allMessages } = await supabase
          .from('message_history')
          .select('id, campaign_id, status, ultramsg_message_id')
          .not('ultramsg_message_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);
        
        msgData = allMessages?.find((msg: any) => 
          msg.ultramsg_message_id?.includes(messageId) || 
          messageId.includes(msg.ultramsg_message_id || '')
        ) || null;
        
        if (msgData) {
          console.log('Found message via substring match:', msgData.ultramsg_message_id);
        }
      }

      if (fetchError) {
        console.error('Error fetching message:', fetchError);
      }

      if (!msgData) {
        console.warn(`No message found for ID: ${messageId}`);
        return new Response(
          JSON.stringify({ success: true, type: 'ack_message_not_found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found message in database:', msgData.id);

      const { error } = await supabase
        .from('message_history')
        .update(updateData)
        .eq('id', msgData.id);

      if (error) {
        console.error('Error updating message status:', error);
      } else {
        console.log(`✓ Message ${messageId} successfully updated to ${newStatus}`);

        if (msgData?.campaign_id) {
          const campaignId = msgData.campaign_id;
          const previousStatus = msgData.status;
          
          console.log(`Message belongs to campaign ${campaignId}, previous status: ${previousStatus}`);
          
          if (newStatus === 'delivered' && previousStatus !== 'delivered' && previousStatus !== 'read') {
            const { data: campaign } = await supabase
              .from('message_campaigns')
              .select('delivered_count')
              .eq('id', campaignId)
              .single();
            
            if (campaign) {
              await supabase
                .from('message_campaigns')
                .update({ delivered_count: (campaign.delivered_count || 0) + 1 })
                .eq('id', campaignId);
              console.log('✓ Campaign delivered_count incremented');
            }
          } else if (newStatus === 'read' && previousStatus !== 'read') {
            const { data: campaign } = await supabase
              .from('message_campaigns')
              .select('read_count, delivered_count')
              .eq('id', campaignId)
              .single();
            
            if (campaign) {
              const updates: Record<string, number> = { read_count: (campaign.read_count || 0) + 1 };
              if (previousStatus !== 'delivered') {
                updates.delivered_count = (campaign.delivered_count || 0) + 1;
              }
              await supabase
                .from('message_campaigns')
                .update(updates)
                .eq('id', campaignId);
              console.log('✓ Campaign read_count incremented');
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, type: 'ack_processed', status: newStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle message delivery errors
    if (payload.id && payload.error) {
      console.log(`Message ${payload.id} failed: ${payload.error}`);
      
      const { error } = await supabase
        .from('message_history')
        .update({
          status: 'failed',
          error_message: payload.error
        })
        .eq('ultramsg_message_id', payload.id);

      if (error) {
        console.error('Error updating failed message:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in ultramsg-webhook:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
