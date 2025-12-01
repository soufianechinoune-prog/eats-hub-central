import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messages } = await req.json() as { messages: Message[] };
    const lastMessage = messages[messages.length - 1]?.content || '';

    console.log('AI Advisor query:', lastMessage);

    // Fetch relevant data from database
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const lastYear = currentYear - 1;

    // Get restaurants
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, city, is_active')
      .eq('is_active', true);

    // Get recent revenue data
    const { data: revenueData } = await supabase
      .from('monthly_revenue')
      .select('*')
      .gte('year', lastYear)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(100);

    // Get recent conversion data
    const { data: conversionData } = await supabase
      .from('monthly_conversion')
      .select('*')
      .gte('year', lastYear)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(100);

    // Get recent fees data
    const { data: feesData } = await supabase
      .from('monthly_fees')
      .select('*')
      .gte('year', lastYear)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(100);

    // Get recent actions
    const { data: actionsData } = await supabase
      .from('restaurant_actions')
      .select('*')
      .gte('start_date', `${lastYear}-01-01`)
      .order('start_date', { ascending: false })
      .limit(50);

    // Build context for AI
    const contextData = {
      restaurants: restaurants || [],
      revenue: revenueData || [],
      conversion: conversionData || [],
      fees: feesData || [],
      actions: actionsData || [],
      currentPeriod: { year: currentYear, month: currentMonth }
    };

    const systemPrompt = `Tu es un conseiller en performance pour des restaurants sur les plateformes de livraison (Uber Eats, Deliveroo).

Tu as accès aux données suivantes:
- ${contextData.restaurants.length} restaurants actifs
- Données de chiffre d'affaires, commandes, panier moyen
- Données de conversion (visites, vues menu, ajouts panier, commandes)
- Données de frais (commissions, marketing, offres, publicité)
- Historique des actions marketing

DONNÉES DISPONIBLES:
${JSON.stringify(contextData, null, 2)}

INSTRUCTIONS:
- Analyse les données pour répondre de manière précise et chiffrée
- Identifie les tendances, les points forts et les axes d'amélioration
- Donne des recommandations concrètes et actionnables
- Utilise des comparaisons N vs N-1 quand pertinent
- Mentionne les restaurants par leur nom
- Réponds en français de manière professionnelle et concise
- Si les données ne permettent pas de répondre, dis-le clairement

BENCHMARKS:
- Taux de conversion correct: 5-10%, excellent: >10%, faible: <5%
- Rentabilité correcte: >60%, moyenne: 40-60%, faible: <40%
- Panier moyen industrie: 20-30€`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requêtes atteinte. Réessayez dans quelques instants.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Crédits AI épuisés. Ajoutez des crédits dans les paramètres.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      return new Response(JSON.stringify({ error: 'Erreur du service AI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: any) {
    console.error('AI Advisor error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur inconnue' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
