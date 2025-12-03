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

// Check if the message looks like a query (not just a simple response)
const isQueryMessage = (message: string): boolean => {
  const simpleResponses = /^(ok|oui|non|👍|✅|❌|merci|super|parfait|cool|d'accord|top|nice|bien)$/i;
  if (simpleResponses.test(message.trim())) return false;
  if (message.length < 4) return false;
  
  // Keywords that indicate a query - enriched with new data types
  const queryKeywords = /\b(quel|combien|comment|pourquoi|quand|où|ca|chiffre|commande|panier|conversion|rapport|hier|aujourd|semaine|mois|performance|vente|revenue|stat|note|avis|client|plat|produit|erreur|temps|prépa|préparation|livraison|retard|fermeture|downtime|top|flop|meilleur|pire|améliorer)/i;
  const questionMark = message.includes('?');
  
  return queryKeywords.test(message) || questionMark || message.length > 10;
};

// Fetch restaurant performance data - ENRICHED with all available data
async function fetchRestaurantData(supabase: any, restaurantId: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  // Fetch monthly revenue for current month
  const { data: currentMonthRevenue } = await supabase
    .from('monthly_revenue')
    .select('revenue_ttc, order_count, average_basket')
    .eq('restaurant_id', restaurantId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .maybeSingle();

  // Fetch previous month for comparison
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const { data: prevMonthRevenue } = await supabase
    .from('monthly_revenue')
    .select('revenue_ttc, order_count, average_basket')
    .eq('restaurant_id', restaurantId)
    .eq('year', prevYear)
    .eq('month', prevMonth)
    .maybeSingle();

  // Fetch yesterday's revenue from daily_revenue
  const { data: yesterdayRevenue } = await supabase
    .from('daily_revenue')
    .select('revenue_ttc, order_count, average_basket')
    .eq('restaurant_id', restaurantId)
    .eq('date', yesterdayStr)
    .maybeSingle();

  // Fetch current month conversion
  const { data: currentConversion } = await supabase
    .from('monthly_conversion')
    .select('visits, menu_views, add_to_cart, orders, overall_rate')
    .eq('restaurant_id', restaurantId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .maybeSingle();

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

  return {
    currentMonthData: {
      revenue: currentMonthRevenue?.revenue_ttc || 0,
      orders: currentMonthRevenue?.order_count || 0,
      averageBasket: currentMonthRevenue?.average_basket || 0,
    },
    previousMonth: {
      revenue: prevMonthRevenue?.revenue_ttc || 0,
      orders: prevMonthRevenue?.order_count || 0,
      averageBasket: prevMonthRevenue?.average_basket || 0,
    },
    yesterday: {
      revenue: yesterdayRevenue?.revenue_ttc || 0,
      orders: yesterdayRevenue?.order_count || 0,
      averageBasket: yesterdayRevenue?.average_basket || 0,
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

CAPACITÉS:
1. Répondre aux questions sur les performances (CA, commandes, conversion, frais)
2. Informer sur les avis clients et la note du restaurant
3. Donner les meilleurs/pires plats selon les avis
4. Informer sur les erreurs de commande et leur impact
5. Donner les temps de préparation et retards
6. Informer sur les temps d'arrêt et fermetures
7. Fournir des conseils d'amélioration basés sur toutes ces données
8. CRÉER DES ACTIONS - Ajoute ce tag: [ACTION:Titre|YYYY-MM-DD|categorie]
   Catégories: marketing, menu, promotion, operation, other
9. ENVOYER UN RAPPORT - Ajoute ce tag: [RAPPORT:type] (types: semaine, mois)

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
    
    // Validate category
    const validCategories = ['marketing', 'menu', 'promotion', 'operation', 'other'];
    const normalizedCategory = category.toLowerCase().trim();
    const finalCategory = validCategories.includes(normalizedCategory) ? normalizedCategory : 'other';
    
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

// Main handler for manager queries
async function handleManagerQuery(
  supabase: any,
  restaurant: any,
  query: string,
  phone: string
): Promise<void> {
  console.log(`=== CHATBOT PROCESSING ===`);
  console.log(`Restaurant: ${restaurant.name}`);
  console.log(`Query: ${query}`);

  // Detect intent and entities
  const { intent, entities } = detectIntent(query);
  console.log(`Detected intent: ${intent}`, entities);

  // Fetch restaurant performance data
  const restaurantData = await fetchRestaurantData(supabase, restaurant.id);
  console.log('Fetched restaurant data');

  // Build AI prompt
  const systemPrompt = buildManagerPrompt(restaurant, restaurantData);

  // Call AI
  const aiResult = await callAI(systemPrompt, query);
  const managerName = `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim();

  // Process action commands if present in AI response
  let finalResponse = aiResult.content;
  let actionCreated = false;
  let reportSent = false;
  
  if (finalResponse && finalResponse.includes('[ACTION:')) {
    const actionResult = await parseAndCreateAction(supabase, finalResponse, restaurant.id);
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
      restaurant.id, 
      restaurant.name, 
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

  // Log interaction to chatbot_interactions
  const interactionLog = {
    restaurant_id: restaurant.id,
    manager_phone: phone,
    manager_name: managerName || null,
    query,
    response: finalResponse,
    intent: finalIntent,
    detected_entities: { ...entities, action_created: actionCreated, report_sent: reportSent },
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
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
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
      
      // Try to find associated restaurant by manager_whatsapp
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, manager_first_name, manager_last_name, manager_whatsapp')
        .not('manager_whatsapp', 'is', null);
      
      // Find restaurant by comparing normalized phone numbers
      const restaurant = restaurants?.find((r: any) => {
        if (!r.manager_whatsapp) return false;
        const normalizedManagerPhone = normalizePhoneNumber(r.manager_whatsapp);
        return normalizedManagerPhone.includes(normalizedPhone) || normalizedPhone.includes(normalizedManagerPhone);
      }) || null;
      
      console.log('Associated restaurant:', restaurant?.name || 'None found');

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
          recipient_name: restaurant 
            ? `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim() 
            : null,
          restaurant_id: restaurant?.id || null,
          restaurant_name: restaurant?.name || null,
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

      // === CHATBOT LOGIC ===
      // Only respond if:
      // 1. The message is from a known restaurant manager
      // 2. The message looks like a query (not a simple response)
      if (restaurant && isQueryMessage(messageData.body)) {
        console.log('Query detected, activating chatbot...');
        // Handle asynchronously to not block the webhook response
        handleManagerQuery(supabase, restaurant, messageData.body, normalizedPhone)
          .catch(err => console.error('Chatbot error:', err));
      } else if (!restaurant) {
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
