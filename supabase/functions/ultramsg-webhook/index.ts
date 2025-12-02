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
  
  // Keywords that indicate a query
  const queryKeywords = /\b(quel|combien|comment|pourquoi|quand|où|ca|chiffre|commande|panier|conversion|rapport|hier|aujourd|semaine|mois|performance|vente|revenue|stat)/i;
  const questionMark = message.includes('?');
  
  return queryKeywords.test(message) || questionMark || message.length > 10;
};

// Fetch restaurant performance data
async function fetchRestaurantData(supabase: any, restaurantId: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

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
    currentYear,
    currentMonth,
  };
}

// Build the system prompt for the AI
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

📋 ACTIONS RÉCENTES:
${actionsText}

CAPACITÉS:
1. Répondre aux questions sur les performances (CA, commandes, conversion, frais)
2. Donner des comparaisons et tendances
3. Fournir des conseils d'amélioration basés sur les données
4. CRÉER DES ACTIONS/RAPPELS - Si le manager demande de créer une action, rappel ou promo, ajoute ce tag dans ta réponse:
   [ACTION:Titre de l'action|YYYY-MM-DD|categorie]
   Catégories disponibles: marketing, menu, promotion, operation, other
   Exemple: "Je te crée ça ! [ACTION:Push notification match PSG|2024-12-15|marketing]"

RÈGLES IMPORTANTES:
- Réponds de manière CONCISE et DIRECTE (c'est WhatsApp, pas un email)
- Maximum 4-5 lignes par réponse
- Utilise des émojis pour rendre les réponses plus lisibles
- Tutoie le manager (ton familier et sympathique)
- Si les données sont à 0, dis que les données ne sont pas encore disponibles
- Ne réponds QUE sur les sujets liés au restaurant et ses performances
- Si la question n'est pas liée au restaurant, dis poliment que tu ne peux pas aider
- Pour les demandes d'action, UTILISE TOUJOURS le format [ACTION:...] pour que je puisse créer l'action automatiquement`;
}

// Detect intent from query
function detectIntent(query: string): { intent: string; entities: Record<string, any> } {
  const lowerQuery = query.toLowerCase();
  const entities: Record<string, any> = {};
  
  // Detect period
  if (lowerQuery.includes('hier')) entities.period = 'yesterday';
  else if (lowerQuery.includes('aujourd')) entities.period = 'today';
  else if (lowerQuery.includes('semaine')) entities.period = 'week';
  else if (lowerQuery.includes('mois')) entities.period = 'month';
  
  // Detect metric
  if (lowerQuery.includes('ca') || lowerQuery.includes('chiffre') || lowerQuery.includes('revenu') || lowerQuery.includes('vente')) {
    entities.metric = 'revenue';
  } else if (lowerQuery.includes('commande')) {
    entities.metric = 'orders';
  } else if (lowerQuery.includes('panier')) {
    entities.metric = 'basket';
  } else if (lowerQuery.includes('conversion') || lowerQuery.includes('taux')) {
    entities.metric = 'conversion';
  } else if (lowerQuery.includes('frais') || lowerQuery.includes('commission')) {
    entities.metric = 'fees';
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
  
  if (finalResponse && finalResponse.includes('[ACTION:')) {
    const actionResult = await parseAndCreateAction(supabase, finalResponse, restaurant.id);
    finalResponse = actionResult.modifiedResponse;
    actionCreated = actionResult.actionCreated;
    
    if (actionCreated) {
      console.log(`✓ Action command processed: ${actionResult.actionTitle}`);
    }
  }

  // Log interaction to chatbot_interactions
  const interactionLog = {
    restaurant_id: restaurant.id,
    manager_phone: phone,
    manager_name: managerName || null,
    query,
    response: finalResponse,
    intent: actionCreated ? 'action_request' : intent,
    detected_entities: { ...entities, action_created: actionCreated },
    response_time_ms: aiResult.responseTimeMs,
    ai_model: 'google/gemini-2.5-flash',
    tokens_used: aiResult.tokensUsed || null,
    was_successful: !!finalResponse,
    error_message: aiResult.error || null,
  };

  await supabase.from('chatbot_interactions').insert(interactionLog);
  console.log(`✓ Interaction logged (${aiResult.responseTimeMs}ms, intent: ${interactionLog.intent})`);

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
