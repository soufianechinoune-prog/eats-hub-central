import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReportRequest {
  restaurant_ids: string[];
  start_date: string;
  end_date: string;
  report_type?: 'global' | 'errors' | 'reviews' | 'operations' | 'promotions';
  template_context?: {
    tone: "standard" | "congratulations" | "alert";
    include_recommendations: boolean;
    include_error_analysis: boolean;
    closing_message?: string;
    include_interactive_menu?: boolean;
  };
}

interface WeeklyKPIs {
  restaurant_id: string;
  restaurant_name: string;
  manager_name: string;
  manager_first_name: string;
  manager_whatsapp: string | null;
  order_count: number;
  revenue: number;
  average_basket: number;
  order_variation: number | null;
  revenue_variation: number | null;
  average_rating: number | null;
  prev_average_rating: number | null;
  review_count: number;
  new_customer_percent: number | null;
  avg_prep_time: number | null;
  avg_courier_wait: number | null;
  error_rate: number | null;
  prev_error_rate: number | null;
  error_count: number;
}

interface ErrorBreakdown {
  category: string;
  count: number;
  percentage: number;
}

interface ProblematicProduct {
  item_title: string;
  error_count: number;
}

interface ActiveOffer {
  title: string;
  platform: string;
  action_type: string;
}

interface EnrichedReportData {
  kpis: WeeklyKPIs;
  error_breakdown: ErrorBreakdown[];
  problematic_products: ProblematicProduct[];
  active_offers: ActiveOffer[];
}

interface AIReportResult {
  restaurant_id: string;
  restaurant_name: string;
  manager_name: string;
  manager_whatsapp: string | null;
  generated_message: string;
  kpis: WeeklyKPIs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('Missing LOVABLE_API_KEY');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { restaurant_ids, start_date, end_date, template_context, report_type = 'global' }: ReportRequest = await req.json();

    console.log(`Generating ${report_type} reports for ${restaurant_ids.length} restaurants from ${start_date} to ${end_date}`);

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

    const reports: AIReportResult[] = [];

    for (const restaurant of restaurants || []) {
      const restaurantId = restaurant.id;
      const managerName = `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim();
      const managerFirstName = restaurant.manager_first_name || managerName.split(' ')[0] || 'Manager';

      // ============ COLLECT KPIs (same as generate-weekly-report) ============

      // Fetch sales data for current week
      const { data: currentSales } = await supabase
        .from('daily_sales_uber')
        .select('revenue_ttc, order_count')
        .eq('restaurant_id', restaurantId)
        .gte('date', start_date)
        .lte('date', end_date);

      // Fetch sales data for previous week
      const { data: prevSales } = await supabase
        .from('daily_sales_uber')
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

      // Fetch customer reviews for previous week
      const { data: prevReviews } = await supabase
        .from('customer_reviews')
        .select('overall_rating')
        .eq('restaurant_id', restaurantId)
        .gte('review_date', prevStartStr)
        .lte('review_date', prevEndStr + 'T23:59:59');

      const reviewCount = reviews?.length || 0;
      const averageRating = reviewCount > 0 && reviews
        ? reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / reviewCount
        : null;

      const prevReviewCount = prevReviews?.length || 0;
      const prevAverageRating = prevReviewCount > 0 && prevReviews
        ? prevReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / prevReviewCount
        : null;

      const newCustomerCount = reviews?.filter(r => r.customer_type === 'new')?.length || 0;
      const newCustomerPercent = reviewCount > 0 ? (newCustomerCount / reviewCount) * 100 : null;

      // Fetch order history for prep times
      const { data: orderHistory } = await supabase
        .from('order_history')
        .select('initial_prep_time_minutes, avoidable_wait_time_minutes')
        .eq('restaurant_id', restaurantId)
        .gte('order_datetime', start_date)
        .lte('order_datetime', end_date + 'T23:59:59');

      const validPrepTimes = orderHistory?.filter(o => o.initial_prep_time_minutes !== null) || [];
      const avgPrepTime = validPrepTimes.length > 0
        ? validPrepTimes.reduce((sum, o) => sum + (o.initial_prep_time_minutes || 0), 0) / validPrepTimes.length
        : null;

      const validWaitTimes = orderHistory?.filter(o => o.avoidable_wait_time_minutes !== null) || [];
      const avgCourierWait = validWaitTimes.length > 0
        ? validWaitTimes.reduce((sum, o) => sum + (o.avoidable_wait_time_minutes || 0), 0) / validWaitTimes.length
        : null;

      // Fetch order errors for current week
      const { data: errors } = await supabase
        .from('order_errors')
        .select('id, error_category, item_title')
        .eq('restaurant_id', restaurantId)
        .gte('error_date', start_date)
        .lte('error_date', end_date + 'T23:59:59');

      // Fetch order errors for previous week
      const { data: prevErrors } = await supabase
        .from('order_errors')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .gte('error_date', prevStartStr)
        .lte('error_date', prevEndStr + 'T23:59:59');

      const errorCount = errors?.length || 0;
      const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : null;

      const prevErrorCount = prevErrors?.length || 0;
      const prevErrorRate = prevOrderCount > 0 ? (prevErrorCount / prevOrderCount) * 100 : null;

      // ============ ERROR BREAKDOWN BY CATEGORY ============
      const errorCategoryMap: Record<string, number> = {};
      (errors || []).forEach(e => {
        const cat = e.error_category || 'Autre';
        errorCategoryMap[cat] = (errorCategoryMap[cat] || 0) + 1;
      });

      const errorBreakdown: ErrorBreakdown[] = Object.entries(errorCategoryMap)
        .map(([category, count]) => ({
          category,
          count,
          percentage: errorCount > 0 ? Math.round((count / errorCount) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);

      // ============ PROBLEMATIC PRODUCTS ============
      const productErrorMap: Record<string, number> = {};
      (errors || []).forEach(e => {
        if (e.item_title) {
          productErrorMap[e.item_title] = (productErrorMap[e.item_title] || 0) + 1;
        }
      });

      const problematicProducts: ProblematicProduct[] = Object.entries(productErrorMap)
        .map(([item_title, error_count]) => ({ item_title, error_count }))
        .sort((a, b) => b.error_count - a.error_count)
        .slice(0, 5);

      // ============ ACTIVE OFFERS ============
      const { data: actionsData } = await supabase
        .from('restaurant_actions')
        .select('title, platform, action_type, restaurant_id, restaurant_ids')
        .gte('end_date', start_date)
        .lte('start_date', end_date)
        .in('category', ['promotions', 'marketing']);

      const activeOffers: ActiveOffer[] = (actionsData || [])
        .filter(action => {
          if (action.restaurant_ids && action.restaurant_ids.length > 0) {
            return action.restaurant_ids.includes(restaurantId);
          }
          if (action.restaurant_id) {
            return action.restaurant_id === restaurantId;
          }
          return true; // Global offer
        })
        .map(a => ({
          title: a.title,
          platform: a.platform,
          action_type: a.action_type
        }));

      // ============ BUILD KPIs OBJECT ============
      const kpis: WeeklyKPIs = {
        restaurant_id: restaurantId,
        restaurant_name: restaurant.name,
        manager_name: managerName,
        manager_first_name: managerFirstName,
        manager_whatsapp: restaurant.manager_whatsapp,
        order_count: orderCount,
        revenue,
        average_basket: averageBasket,
        order_variation: orderVariation,
        revenue_variation: revenueVariation,
        average_rating: averageRating,
        prev_average_rating: prevAverageRating,
        review_count: reviewCount,
        new_customer_percent: newCustomerPercent,
        avg_prep_time: avgPrepTime,
        avg_courier_wait: avgCourierWait,
        error_rate: errorRate,
        prev_error_rate: prevErrorRate,
        error_count: errorCount,
      };

      // ============ GENERATE AI MESSAGE ============
      const enrichedData: EnrichedReportData = {
        kpis,
        error_breakdown: errorBreakdown,
        problematic_products: problematicProducts,
        active_offers: activeOffers,
      };

      let generatedMessage: string;
      
      // Generate message based on report type
      switch (report_type) {
        case 'errors':
          generatedMessage = await generateErrorsDetailReport(enrichedData, LOVABLE_API_KEY);
          break;
        case 'reviews':
          generatedMessage = await generateReviewsDetailReport(supabase, restaurantId, start_date, end_date, kpis, LOVABLE_API_KEY);
          break;
        case 'operations':
          generatedMessage = await generateOperationsDetailReport(supabase, restaurantId, start_date, end_date, kpis, LOVABLE_API_KEY);
          break;
        case 'promotions':
          generatedMessage = await generatePromotionsDetailReport(enrichedData, LOVABLE_API_KEY);
          break;
        default:
          // Global report with interactive menu
          generatedMessage = await generateAIMessage(enrichedData, template_context, LOVABLE_API_KEY);
          // Add interactive menu if enabled (default: true for global reports)
          if (template_context?.include_interactive_menu !== false) {
            generatedMessage += getInteractiveMenu();
          }
      }

      reports.push({
        restaurant_id: restaurantId,
        restaurant_name: restaurant.name,
        manager_name: managerName,
        manager_whatsapp: restaurant.manager_whatsapp,
        generated_message: generatedMessage,
        kpis,
      });

      console.log(`Generated ${report_type} report for ${restaurant.name}`);
    }

    console.log(`Successfully generated ${reports.length} AI reports`);

    return new Response(
      JSON.stringify({ success: true, reports }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error generating AI reports:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateAIMessage(
  data: EnrichedReportData, 
  templateContext: ReportRequest['template_context'],
  apiKey: string
): Promise<string> {
  const { kpis, error_breakdown, problematic_products, active_offers } = data;
  const tone = templateContext?.tone || 'standard';

  // Determine if performance is good or needs attention
  const ratingTrend = kpis.average_rating !== null && kpis.prev_average_rating !== null
    ? kpis.average_rating >= kpis.prev_average_rating ? '✅' : '❌'
    : '➖';
  
  const errorTrend = kpis.error_rate !== null && kpis.prev_error_rate !== null
    ? kpis.error_rate <= kpis.prev_error_rate ? '✅' : '❌'
    : '➖';

  // Build error breakdown string
  const errorBreakdownStr = error_breakdown.length > 0
    ? error_breakdown.map(e => `• ${e.category}: ${e.percentage}%`).join('\n')
    : 'Aucune erreur cette semaine';

  // Build problematic products string
  const productsStr = problematic_products.length > 0
    ? problematic_products.map(p => `${p.item_title} (${p.error_count} erreurs)`).join(', ')
    : 'Aucun produit problématique identifié';

  // Build active offers string
  const offersStr = active_offers.length > 0
    ? active_offers.map(o => `"${o.title}" (${o.platform})`).join(', ')
    : 'Aucune offre active';

  // Calculate days until Ramadan (approximate - March 2026)
  const now = new Date();
  const ramadan2026 = new Date(2026, 2, 1); // March 1, 2026 (approximate)
  const daysUntilRamadan = Math.ceil((ramadan2026.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const ramadanContext = daysUntilRamadan > 0 && daysUntilRamadan < 60 
    ? `Ramadan dans ~${daysUntilRamadan} jours`
    : '';

  const systemPrompt = `Tu es un conseiller bienveillant pour restaurateurs sur les plateformes de livraison. Tu génères des rapports WhatsApp personnalisés, inspirants et actionnables.

STYLE D'ÉCRITURE:
- Tutoiement, ton chaleureux et professionnel
- Utilise des emojis WhatsApp: ✅ ❌ ⚫️ 👋 🚀 🎯 📦 ⭐ 👊
- Format WhatsApp: pas de markdown lourd (pas de **bold**, utilise des majuscules ou emojis)
- Phrases courtes et percutantes
- Maximum 400 mots

EXEMPLES DE TON À REPRODUIRE:
- "Rien à dire pour [restaurant] à part : RESPECT 👊"
- "Al-hamdou liLlah cette semaine on a du vert !"
- "Du coup focus sur les erreurs, histoire de mettre le doigt exactement sur ce qui a bloqué..."
- "On espère que ça va continuer comme ça in shaa Allah."

RÈGLES:
1. Commence par saluer avec le prénom: "Bonjour [prénom] ! 👋" ou "Salut [prénom] !"
2. Synthèse rapide avec indicateurs visuels:
   - "${ratingTrend} Notes : [valeur actuelle] (vs [valeur précédente] semaine dernière)"
   - "${errorTrend} Erreurs : [taux actuel]% (vs [taux précédent]% semaine dernière)"
3. Si erreurs > 2%, analyse les CAUSES en liant aux offres actives si pertinent
4. Identifie les produits problématiques et explique pourquoi (ex: "l'opé 1+1 sur ce produit complexifie les tickets")
5. Donne des recommandations concrètes: "double-check avant fermeture du sac", "vigilance sur [produit]"
6. Si performance exceptionnelle, félicite avec enthousiasme
7. Mentionne le contexte business si pertinent (offres à venir, fin de période promo, Ramadan)
8. Termine TOUJOURS par: "🤲 Qu'Allah nous accorde la réussite !"`;

  const userPrompt = `Génère un rapport WhatsApp pour ce restaurant:

RESTAURANT: ${kpis.restaurant_name}
PRÉNOM MANAGER: ${kpis.manager_first_name}

📊 KPIs SEMAINE:
- Commandes: ${kpis.order_count} ${kpis.order_variation !== null ? `(${kpis.order_variation >= 0 ? '+' : ''}${kpis.order_variation.toFixed(0)}% vs semaine précédente)` : ''}
- CA: ${kpis.revenue.toFixed(0)}€
- Panier moyen: ${kpis.average_basket.toFixed(1)}€
- Note moyenne: ${kpis.average_rating !== null ? kpis.average_rating.toFixed(1) : '--'} ${ratingTrend} (${kpis.review_count} avis, vs ${kpis.prev_average_rating?.toFixed(1) || '--'} semaine précédente)
- Taux d'erreur: ${kpis.error_rate !== null ? kpis.error_rate.toFixed(1) : '--'}% ${errorTrend} (${kpis.error_count} erreurs, vs ${kpis.prev_error_rate?.toFixed(1) || '--'}% semaine précédente)
- Temps prépa moyen: ${kpis.avg_prep_time !== null ? Math.round(kpis.avg_prep_time) : '--'} min
- Attente coursier: ${kpis.avg_courier_wait !== null ? Math.round(kpis.avg_courier_wait) : '--'} min

⚫️ RÉPARTITION DES ERREURS:
${errorBreakdownStr}

🔴 PRODUITS PROBLÉMATIQUES:
${productsStr}

📢 OFFRES ACTIVES:
${offersStr}

📅 CONTEXTE:
${ramadanContext || 'Pas de contexte particulier'}

TON SOUHAITÉ: ${tone === 'congratulations' ? 'Félicitations enthousiastes' : tone === 'alert' ? 'Alerte bienveillante' : 'Standard équilibré'}

Génère maintenant le message WhatsApp personnalisé:`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      // Fallback to basic message if AI fails
      return generateFallbackMessage(kpis);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return generateFallbackMessage(kpis);
    }

    return content.trim();
  } catch (error) {
    console.error('Error calling AI:', error);
    return generateFallbackMessage(kpis);
  }
}

function generateFallbackMessage(kpis: WeeklyKPIs): string {
  const ratingEmoji = kpis.average_rating !== null && kpis.average_rating >= 4.4 ? '✅' : '❌';
  const errorEmoji = kpis.error_rate !== null && kpis.error_rate <= 3 ? '✅' : '❌';

  return `Bonjour ${kpis.manager_first_name} ! 👋

📊 BILAN SEMAINE - ${kpis.restaurant_name}

${ratingEmoji} Notes : ${kpis.average_rating?.toFixed(1) || '--'} (${kpis.review_count} avis)
${errorEmoji} Erreurs : ${kpis.error_rate?.toFixed(1) || '--'}% (${kpis.error_count} erreurs)

📦 ${kpis.order_count} commandes | ${kpis.revenue.toFixed(0)}€ CA

🤲 Qu'Allah nous accorde la réussite !`;
}

// ============ INTERACTIVE MENU ============
function getInteractiveMenu(): string {
  return `

────────────────────────
📋 PLUS DE DÉTAILS ? Réponds :
1️⃣ Détail erreurs & produits
2️⃣ Analyse avis clients
3️⃣ Performance opérationnelle
4️⃣ Bilan promotions`;
}

// ============ DETAILED REPORT GENERATORS ============

async function generateErrorsDetailReport(
  data: EnrichedReportData,
  apiKey: string
): Promise<string> {
  const { kpis, error_breakdown, problematic_products, active_offers } = data;

  // Build error breakdown string
  const errorBreakdownStr = error_breakdown.length > 0
    ? error_breakdown.map(e => `• ${e.category}: ${e.percentage}% (${e.count} erreurs)`).join('\n')
    : 'Aucune erreur cette semaine';

  // Build problematic products string
  const productsStr = problematic_products.length > 0
    ? problematic_products.map((p, i) => `${i + 1}. ${p.item_title} (${p.error_count} erreurs)`).join('\n')
    : 'Aucun produit problématique identifié';

  // Build active offers string
  const offersStr = active_offers.length > 0
    ? active_offers.map(o => `"${o.title}" (${o.platform})`).join(', ')
    : 'Aucune offre active';

  const systemPrompt = `Tu es un conseiller bienveillant pour restaurateurs. Tu génères un rapport WhatsApp DÉTAILLÉ sur les erreurs de commande.

STYLE:
- Tutoiement, ton chaleureux
- Emojis WhatsApp
- Format WhatsApp (pas de markdown lourd)
- Maximum 300 mots
- Termine TOUJOURS par: "🤲 Qu'Allah nous accorde la réussite !"

STRUCTURE OBLIGATOIRE:
1. Titre: 🔍 DÉTAIL ERREURS - [restaurant]
2. Répartition par catégorie avec ⚫️
3. Top produits problématiques avec 🔴
4. Impact financier avec 💰
5. Conseil actionnable avec 💡`;

  const userPrompt = `Génère le rapport détaillé des erreurs:

RESTAURANT: ${kpis.restaurant_name}
PRÉNOM MANAGER: ${kpis.manager_first_name}

📊 STATS ERREURS:
- Taux d'erreur: ${kpis.error_rate?.toFixed(1) || '--'}% (${kpis.error_count} erreurs)
- Commandes totales: ${kpis.order_count}

⚫️ RÉPARTITION DES ERREURS:
${errorBreakdownStr}

🔴 PRODUITS PROBLÉMATIQUES:
${productsStr}

📢 OFFRES ACTIVES (contexte):
${offersStr}

Génère le rapport détaillé:`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return generateErrorsFallback(kpis, error_breakdown, problematic_products);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || generateErrorsFallback(kpis, error_breakdown, problematic_products);
  } catch (error) {
    console.error('Error calling AI:', error);
    return generateErrorsFallback(kpis, error_breakdown, problematic_products);
  }
}

function generateErrorsFallback(kpis: WeeklyKPIs, errorBreakdown: ErrorBreakdown[], products: ProblematicProduct[]): string {
  const breakdownStr = errorBreakdown.map(e => `• ${e.category}: ${e.percentage}%`).join('\n');
  const productsStr = products.slice(0, 3).map(p => `🎯 ${p.item_title} (${p.error_count})`).join('\n');

  return `🔍 DÉTAIL ERREURS - ${kpis.restaurant_name}

⚫️ RÉPARTITION:
${breakdownStr || '• Aucune erreur'}

🔴 PRODUITS À SURVEILLER:
${productsStr || 'Aucun'}

💡 Double-check des sacs avant fermeture recommandé.

🤲 Qu'Allah nous accorde la réussite !`;
}

async function generateReviewsDetailReport(
  supabase: any,
  restaurantId: string,
  startDate: string,
  endDate: string,
  kpis: WeeklyKPIs,
  apiKey: string
): Promise<string> {
  // Fetch detailed reviews data
  const { data: reviews } = await supabase
    .from('customer_reviews')
    .select('overall_rating, customer_comment, tags, customer_type')
    .eq('restaurant_id', restaurantId)
    .gte('review_date', startDate)
    .lte('review_date', endDate + 'T23:59:59');

  // Calculate distribution
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let newCustomerCount = 0;
  const allTags: string[] = [];
  const negativeComments: string[] = [];

  (reviews || []).forEach((r: any) => {
    if (r.overall_rating) {
      const rating = Math.round(r.overall_rating);
      if (distribution[rating] !== undefined) distribution[rating]++;
    }
    if (r.customer_type === 'new') newCustomerCount++;
    if (r.tags) allTags.push(...r.tags);
    if (r.customer_comment && r.overall_rating && r.overall_rating < 4) {
      negativeComments.push(r.customer_comment);
    }
  });

  const totalReviews = reviews?.length || 0;
  const newCustomerPercent = totalReviews > 0 ? Math.round((newCustomerCount / totalReviews) * 100) : 0;

  // Top tags
  const tagCounts: Record<string, number> = {};
  allTags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const systemPrompt = `Tu es un conseiller bienveillant pour restaurateurs. Tu génères un rapport WhatsApp DÉTAILLÉ sur les avis clients.

STYLE:
- Tutoiement, ton chaleureux
- Emojis WhatsApp
- Format WhatsApp (pas de markdown lourd)
- Maximum 300 mots
- Termine TOUJOURS par: "🤲 Qu'Allah nous accorde la réussite !"

STRUCTURE OBLIGATOIRE:
1. Titre: ⭐ ANALYSE AVIS - [restaurant]
2. Distribution des notes avec 📊
3. Tags récurrents avec 🏷️ (positifs ✅ et négatifs ❌)
4. Clientèle avec 👥
5. Commentaire notable si pertinent avec 💬`;

  const userPrompt = `Génère le rapport détaillé des avis:

RESTAURANT: ${kpis.restaurant_name}
PRÉNOM MANAGER: ${kpis.manager_first_name}

📊 DISTRIBUTION:
★★★★★ : ${distribution[5]} avis
★★★★☆ : ${distribution[4]} avis
★★★☆☆ : ${distribution[3]} avis
Moins : ${distribution[2] + distribution[1]} avis

🏷️ TAGS RÉCURRENTS:
${topTags.map(([tag, count]) => `• ${tag}: ${count}x`).join('\n') || 'Aucun tag'}

👥 CLIENTÈLE:
- ${newCustomerPercent}% nouveaux clients
- ${totalReviews} avis cette semaine

💬 COMMENTAIRES NÉGATIFS:
${negativeComments.slice(0, 2).map(c => `"${c.substring(0, 80)}..."`).join('\n') || 'Aucun'}

Génère le rapport détaillé:`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      return generateReviewsFallback(kpis, distribution, totalReviews);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || generateReviewsFallback(kpis, distribution, totalReviews);
  } catch (error) {
    console.error('Error calling AI:', error);
    return generateReviewsFallback(kpis, distribution, totalReviews);
  }
}

function generateReviewsFallback(kpis: WeeklyKPIs, distribution: Record<number, number>, total: number): string {
  return `⭐ ANALYSE AVIS - ${kpis.restaurant_name}

📊 DISTRIBUTION:
★★★★★ : ${distribution[5]} avis
★★★★☆ : ${distribution[4]} avis
★★★☆☆ : ${distribution[3]} avis

📝 ${total} avis au total cette semaine

🤲 Qu'Allah nous accorde la réussite !`;
}

async function generateOperationsDetailReport(
  supabase: any,
  restaurantId: string,
  startDate: string,
  endDate: string,
  kpis: WeeklyKPIs,
  apiKey: string
): Promise<string> {
  // Fetch order history for time analysis
  const { data: orders } = await supabase
    .from('order_history')
    .select('initial_prep_time_minutes, avoidable_wait_time_minutes, order_datetime')
    .eq('restaurant_id', restaurantId)
    .gte('order_datetime', startDate)
    .lte('order_datetime', endDate + 'T23:59:59');

  // Fetch downtime logs
  const { data: downtimes } = await supabase
    .from('downtime_logs')
    .select('duration_minutes, reason')
    .eq('restaurant_id', restaurantId)
    .gte('downtime_start', startDate)
    .lte('downtime_start', endDate + 'T23:59:59');

  // Calculate hourly prep times
  const hourlyPrepTimes: Record<number, number[]> = {};
  (orders || []).forEach((o: any) => {
    if (o.order_datetime && o.initial_prep_time_minutes) {
      const hour = new Date(o.order_datetime).getHours();
      if (!hourlyPrepTimes[hour]) hourlyPrepTimes[hour] = [];
      hourlyPrepTimes[hour].push(o.initial_prep_time_minutes);
    }
  });

  // Find worst hours
  const hourlyAvg = Object.entries(hourlyPrepTimes).map(([hour, times]) => ({
    hour: parseInt(hour),
    avg: times.reduce((a, b) => a + b, 0) / times.length
  })).sort((a, b) => b.avg - a.avg);

  const worstHours = hourlyAvg.slice(0, 3);

  // Calculate downtime stats
  const totalDowntime = (downtimes || []).reduce((sum: number, d: any) => sum + (d.duration_minutes || 0), 0);
  const reasons = [...new Set((downtimes || []).map((d: any) => d.reason).filter(Boolean))].slice(0, 2);

  const systemPrompt = `Tu es un conseiller bienveillant pour restaurateurs. Tu génères un rapport WhatsApp DÉTAILLÉ sur la performance opérationnelle.

STYLE:
- Tutoiement, ton chaleureux
- Emojis WhatsApp
- Format WhatsApp (pas de markdown lourd)
- Maximum 300 mots
- Termine TOUJOURS par: "🤲 Qu'Allah nous accorde la réussite !"

STRUCTURE OBLIGATOIRE:
1. Titre: ⏱️ PERFORMANCE OPS - [restaurant]
2. Temps moyens avec 📊
3. Créneaux tendus avec 🔥
4. Temps d'inactivité avec ⏸️
5. Conseil actionnable avec 💡`;

  const userPrompt = `Génère le rapport détaillé opérationnel:

RESTAURANT: ${kpis.restaurant_name}
PRÉNOM MANAGER: ${kpis.manager_first_name}

📊 TEMPS MOYENS:
- Préparation : ${kpis.avg_prep_time ? Math.round(kpis.avg_prep_time) : '--'} min
- Attente coursier : ${kpis.avg_courier_wait ? Math.round(kpis.avg_courier_wait) : '--'} min

🔥 CRÉNEAUX TENDUS (pire prépa):
${worstHours.map(h => `• ${h.hour}h-${h.hour + 1}h : ${h.avg.toFixed(1)} min`).join('\n') || 'Données insuffisantes'}

⏸️ TEMPS D'INACTIVITÉ:
- Total semaine : ${totalDowntime} min
- Raisons : ${reasons.join(', ') || 'Non renseignées'}

Génère le rapport détaillé:`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      return generateOperationsFallback(kpis, totalDowntime);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || generateOperationsFallback(kpis, totalDowntime);
  } catch (error) {
    console.error('Error calling AI:', error);
    return generateOperationsFallback(kpis, totalDowntime);
  }
}

function generateOperationsFallback(kpis: WeeklyKPIs, totalDowntime: number): string {
  return `⏱️ PERFORMANCE OPS - ${kpis.restaurant_name}

📊 TEMPS MOYENS:
• Préparation : ${kpis.avg_prep_time ? Math.round(kpis.avg_prep_time) : '--'} min
• Attente coursier : ${kpis.avg_courier_wait ? Math.round(kpis.avg_courier_wait) : '--'} min

⏸️ INACTIVITÉ: ${totalDowntime} min cette semaine

🤲 Qu'Allah nous accorde la réussite !`;
}

async function generatePromotionsDetailReport(
  data: EnrichedReportData,
  apiKey: string
): Promise<string> {
  const { kpis, active_offers } = data;

  const offersDetail = active_offers.length > 0
    ? active_offers.map(o => `• "${o.title}" (${o.platform}) - Type: ${o.action_type || 'promo'}`).join('\n')
    : 'Aucune offre active cette semaine';

  const systemPrompt = `Tu es un conseiller bienveillant pour restaurateurs. Tu génères un rapport WhatsApp DÉTAILLÉ sur les promotions et leur impact.

STYLE:
- Tutoiement, ton chaleureux
- Emojis WhatsApp
- Format WhatsApp (pas de markdown lourd)
- Maximum 300 mots
- Termine TOUJOURS par: "🤲 Qu'Allah nous accorde la réussite !"

STRUCTURE OBLIGATOIRE:
1. Titre: 📢 BILAN PROMOS - [restaurant]
2. Offres actives avec 🎯
3. Impact estimé avec 📊 (si données disponibles)
4. Alertes si problèmes avec ⚠️
5. Conseil actionnable avec 💡`;

  const userPrompt = `Génère le rapport détaillé des promotions:

RESTAURANT: ${kpis.restaurant_name}
PRÉNOM MANAGER: ${kpis.manager_first_name}

🎯 OFFRES ACTIVES:
${offersDetail}

📊 CONTEXTE PERFORMANCE:
- Commandes : ${kpis.order_count}
- CA : ${kpis.revenue.toFixed(0)}€
- Taux d'erreur : ${kpis.error_rate?.toFixed(1) || '--'}%

Génère le rapport détaillé:`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      return generatePromotionsFallback(kpis, active_offers);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || generatePromotionsFallback(kpis, active_offers);
  } catch (error) {
    console.error('Error calling AI:', error);
    return generatePromotionsFallback(kpis, active_offers);
  }
}

function generatePromotionsFallback(kpis: WeeklyKPIs, offers: ActiveOffer[]): string {
  const offersStr = offers.length > 0
    ? offers.map(o => `• "${o.title}" (${o.platform})`).join('\n')
    : '• Aucune offre active';

  return `📢 BILAN PROMOS - ${kpis.restaurant_name}

🎯 OFFRES ACTIVES:
${offersStr}

📊 RÉSULTATS:
• ${kpis.order_count} commandes cette semaine
• CA : ${kpis.revenue.toFixed(0)}€

🤲 Qu'Allah nous accorde la réussite !`;
}
