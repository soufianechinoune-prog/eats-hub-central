import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderErrorId } = await req.json();

    if (!orderErrorId) {
      return new Response(JSON.stringify({ error: "orderErrorId is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order error details
    const { data: orderError, error: fetchError } = await supabase
      .from('order_errors')
      .select(`
        *,
        orders!inner (
          uber_order_id,
          order_datetime,
          gross_amount,
          net_amount,
          restaurants!inner (
            name,
            city
          )
        )
      `)
      .eq('id', orderErrorId)
      .single();

    if (fetchError || !orderError) {
      console.error("Error fetching order error:", fetchError);
      return new Response(JSON.stringify({ error: "Order error not found" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch restaurant statistics
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('restaurant_id', orderError.restaurant_id)
      .gte('order_datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: recentErrors } = await supabase
      .from('order_errors')
      .select('id')
      .eq('restaurant_id', orderError.restaurant_id)
      .gte('error_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const totalOrders = recentOrders?.length || 0;
    const totalErrors = recentErrors?.length || 0;
    const errorRate = totalOrders > 0 ? ((totalErrors / totalOrders) * 100).toFixed(2) : '0';

    // Build AI prompt
    const systemPrompt = `Tu es un expert en contestations de remboursements Uber Eats pour les restaurants. 
Ton rôle est d'analyser les erreurs de commandes et de générer des justifications professionnelles, convaincantes et factuelles pour contester les remboursements injustifiés.

Tu dois :
1. Analyser objectivement si l'erreur est légitime ou contestable
2. Générer une justification professionnelle en français
3. Suggérer des preuves à fournir
4. Estimer les chances de succès (faible/moyen/élevé)

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "isContestable": boolean,
  "successProbability": "faible" | "moyen" | "élevé",
  "justification": "texte de justification professionnelle et convaincante",
  "suggestedEvidence": ["preuve 1", "preuve 2"],
  "reasoning": "explication de ton analyse"
}`;

    const userPrompt = `Analyse cette erreur de commande Uber Eats et génère une contestation :

Restaurant: ${orderError.orders.restaurants.name} (${orderError.orders.restaurants.city})
Commande Uber: ${orderError.orders.uber_order_id}
Date: ${new Date(orderError.error_date).toLocaleDateString('fr-FR')}

Type d'erreur: ${orderError.error_type}
Catégorie: ${orderError.error_category || 'Non spécifiée'}
Description: ${orderError.error_description || 'Aucune description'}
Article concerné: ${orderError.item_title || 'Non spécifié'}
Impact financier: ${orderError.financial_impact ? `${orderError.financial_impact.toFixed(2)}€` : 'Non spécifié'}

Statistiques du restaurant (30 derniers jours):
- Commandes totales: ${totalOrders}
- Erreurs totales: ${totalErrors}
- Taux d'erreur: ${errorRate}%

Analyse cette situation et génère une contestation adaptée.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, veuillez réessayer dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés, veuillez recharger votre compte Lovable." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error("AI API error");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    let disputeData;

    try {
      disputeData = JSON.parse(aiContent);
    } catch (e) {
      console.error("Failed to parse AI response:", aiContent);
      throw new Error("Invalid AI response format");
    }

    console.log("Generated dispute for order error:", orderErrorId);

    return new Response(JSON.stringify({
      orderError,
      dispute: disputeData,
      statistics: {
        totalOrders,
        totalErrors,
        errorRate: `${errorRate}%`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-dispute function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
