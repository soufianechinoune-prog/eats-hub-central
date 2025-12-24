import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize restaurant name for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[""«»']/g, "") // Remove quotes
    .replace(/\s+/g, " ")
    .trim();
}

// Calculate Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Calculate similarity score (0-100)
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);
  if (norm1 === norm2) return 100;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(norm1, norm2);
  return Math.round((1 - distance / maxLen) * 100);
}

// Extract restaurant name from notification text
function extractRestaurantName(notificationText: string): string | null {
  // Patterns observed:
  // "Commandes interrompues chez Chicken Street - Bonneuil"
  // "Les commandes sont interrompues chez Chicken Street - Bonneuil pour une raison inconnue"
  // "Mis en pause par Uber Eats..." (title contains restaurant name)
  
  const patterns = [
    /(?:commandes?\s+(?:sont\s+)?interrompues?\s+chez\s+)([^.]+?)(?:\s+pour|\s*$)/i,
    /(?:chez\s+)([^.]+?)(?:\s+pour|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = notificationText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

interface NotifyRequest {
  notification_text: string;  // Full notification text
  notification_title?: string; // Optional notification title
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ULTRAMSG_INSTANCE_ID = Deno.env.get('ULTRAMSG_INSTANCE_ID');
    const ULTRAMSG_TOKEN = Deno.env.get('ULTRAMSG_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_TOKEN) {
      throw new Error('Ultramsg credentials not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const body: NotifyRequest = await req.json();
    const { notification_text, notification_title } = body;

    console.log('Received notification:', { notification_text, notification_title });

    // Try to extract restaurant name from text or title
    let restaurantName = extractRestaurantName(notification_text);
    if (!restaurantName && notification_title) {
      restaurantName = extractRestaurantName(notification_title);
    }

    if (!restaurantName) {
      console.error('Could not extract restaurant name from notification');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract restaurant name from notification',
          notification_text 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted restaurant name:', restaurantName);

    // Fetch all restaurants
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name');

    if (restaurantsError) {
      throw new Error(`Failed to fetch restaurants: ${restaurantsError.message}`);
    }

    // Find best match using fuzzy matching
    let bestMatch: { id: string; name: string; similarity: number } | null = null;
    
    for (const restaurant of restaurants || []) {
      const similarity = calculateSimilarity(restaurantName, restaurant.name);
      if (similarity >= 60 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { ...restaurant, similarity };
      }
    }

    if (!bestMatch) {
      console.error('No matching restaurant found for:', restaurantName);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No matching restaurant found',
          extracted_name: restaurantName,
          available_restaurants: restaurants?.map(r => r.name) 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Matched restaurant:', bestMatch);

    // Get manager for this restaurant
    const { data: managerRestaurants, error: mrError } = await supabase
      .from('manager_restaurants')
      .select(`
        manager_id,
        managers!inner(id, phone, first_name, last_name)
      `)
      .eq('restaurant_id', bestMatch.id);

    if (mrError) {
      throw new Error(`Failed to fetch manager: ${mrError.message}`);
    }

    if (!managerRestaurants || managerRestaurants.length === 0) {
      console.error('No manager found for restaurant:', bestMatch.name);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No manager found for this restaurant',
          restaurant: bestMatch.name 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send WhatsApp to all managers of this restaurant
    const results = [];
    
    for (const mr of managerRestaurants) {
      const managerData = mr.managers as unknown as { id: string; phone: string; first_name: string | null; last_name: string | null };
      const managerName = [managerData.first_name, managerData.last_name].filter(Boolean).join(' ') || 'Manager';
      
      // Format phone number
      let phone = managerData.phone.replace(/\s+/g, '');
      if (phone.startsWith('0')) {
        phone = '33' + phone.substring(1);
      }
      if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      // Create message
      const message = `⚠️ *Alerte Tablette Uber*

Bonjour ${managerName},

La tablette de *${bestMatch.name}* vient d'être mise en pause sur Uber Eats.

📍 Raison probable : ${notification_text.includes('coursiers') ? 'Signalement coursiers (établissement fermé)' : 'Raison inconnue'}

👉 Merci de vérifier et réactiver la tablette si nécessaire.

_Message automatique_`;

      console.log('Sending WhatsApp to:', phone);

      // Send via Ultramsg
      const ultramsgUrl = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
      const ultramsgResponse = await fetch(ultramsgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: ULTRAMSG_TOKEN,
          to: phone,
          body: message,
        }),
      });

      const ultramsgResult = await ultramsgResponse.json();
      console.log('Ultramsg response:', ultramsgResult);

      const success = ultramsgResult.sent === 'true' || ultramsgResult.sent === true;

      // Log to message_history
      await supabase.from('message_history').insert({
        recipient_phone: phone,
        recipient_name: managerName,
        restaurant_id: bestMatch.id,
        restaurant_name: bestMatch.name,
        message_content: message,
        message_type: 'text',
        direction: 'outbound',
        status: success ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        ultramsg_message_id: ultramsgResult.id || null,
        error_message: success ? null : JSON.stringify(ultramsgResult),
      });

      results.push({
        manager: managerName,
        phone,
        success,
        ultramsg_response: ultramsgResult,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        restaurant: bestMatch.name,
        similarity: bestMatch.similarity,
        managers_notified: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in notify-tablet-pause:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
