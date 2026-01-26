import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BogoOfferHistoryItem {
  id: string;
  startDate: string;
  endDate: string | null;
  articles: string[];
  audience: string;
  orders: number;
  salesEur: number;
  newCustomers: number;
  uberFundingPercent: number | null;
  status: string;
  // User annotations
  userRating: number | null;
  userComment: string | null;
  learnings: string[];
  // Computed
  durationDays: number;
  salesPerDay: number;
  score: number;
  scoreLabel: string;
}

interface RawChangeContext {
  articles?: string[];
  audience?: string;
  orders?: number;
  sales_eur?: number;
  new_customers?: number;
  uber_funding_percent?: number | null;
  status?: string;
  user_rating?: number | null;
  user_comment?: string | null;
  learnings?: string[];
}

function calculateOfferScore(
  salesEur: number,
  orders: number,
  newCustomers: number,
  durationDays: number,
  uberFundingPercent: number | null,
  avgSales: number,
  avgOrders: number,
  avgNewCustomers: number
): { score: number; label: string } {
  // Normalize values (0-100 scale)
  const salesScore = avgSales > 0 ? Math.min((salesEur / avgSales) * 50, 100) : 50;
  const ordersScore = avgOrders > 0 ? Math.min((orders / avgOrders) * 50, 100) : 50;
  const newCustomersScore = avgNewCustomers > 0 ? Math.min((newCustomers / avgNewCustomers) * 50, 100) : 50;
  const efficiencyScore = durationDays > 0 ? Math.min(((salesEur / durationDays) / 1000) * 50, 100) : 50;
  const fundingScore = uberFundingPercent ? Math.min(uberFundingPercent * 5, 100) : 0;

  // Weighted score (1-5 scale)
  const weightedScore = (
    salesScore * 0.30 +
    ordersScore * 0.20 +
    newCustomersScore * 0.25 +
    efficiencyScore * 0.15 +
    fundingScore * 0.10
  ) / 20; // Convert 0-100 to 0-5

  const score = Math.min(Math.max(Math.round(weightedScore * 10) / 10, 1), 5);

  let label: string;
  if (score >= 4.5) label = "Excellent";
  else if (score >= 3.5) label = "Bon";
  else if (score >= 2.5) label = "Correct";
  else if (score >= 1.5) label = "Faible";
  else label = "Mauvais";

  return { score, label };
}

export function useBogoOfferHistory(selectedItemNames: string[], restaurantIds?: string[]) {
  return useQuery({
    queryKey: ["bogo-offer-history", selectedItemNames, restaurantIds],
    queryFn: async () => {
      if (selectedItemNames.length === 0) return { offers: [], insights: null };

      // Fetch all BOGO offers
      const { data, error } = await supabase
        .from("restaurant_actions")
        .select("id, start_date, end_date, change_context, restaurant_id, restaurant_ids")
        .eq("category", "promotions")
        .eq("action_type", "1 acheté = 1 offert")
        .order("start_date", { ascending: false });

      if (error) throw error;
      if (!data) return { offers: [], insights: null };

      // Normalize selected item names for matching
      const normalizedSelectedNames = selectedItemNames.map(name => 
        name.toLowerCase().replace(/[^a-z0-9]/gi, "")
      );

      // Filter offers that match any of the selected items
      const matchedOffers: BogoOfferHistoryItem[] = [];

      for (const row of data) {
        const ctx = row.change_context as RawChangeContext | null;
        if (!ctx || ctx.status === "CANCELED") continue;

        const articles = ctx.articles || [];
        
        // Check if any article matches any selected item
        const hasMatch = articles.some(article => {
          const normalizedArticle = article.toLowerCase().replace(/[^a-z0-9]/gi, "");
          return normalizedSelectedNames.some(selectedName =>
            normalizedArticle.includes(selectedName) || selectedName.includes(normalizedArticle)
          );
        });

        // If no specific items selected or there's a match
        if (selectedItemNames.length === 0 || hasMatch || articles.length === 0) {
          // Filter by restaurant if specified
          if (restaurantIds && restaurantIds.length > 0) {
            const offerRestaurantIds = row.restaurant_ids || (row.restaurant_id ? [row.restaurant_id] : []);
            const hasRestaurantMatch = offerRestaurantIds.length === 0 || 
              offerRestaurantIds.some((id: string) => restaurantIds.includes(id));
            if (!hasRestaurantMatch) continue;
          }

          const startDate = new Date(row.start_date);
          const endDate = row.end_date ? new Date(row.end_date) : new Date();
          const durationDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

          matchedOffers.push({
            id: row.id,
            startDate: row.start_date,
            endDate: row.end_date,
            articles,
            audience: ctx.audience || "Tous",
            orders: ctx.orders || 0,
            salesEur: ctx.sales_eur || 0,
            newCustomers: ctx.new_customers || 0,
            uberFundingPercent: ctx.uber_funding_percent || null,
            status: ctx.status || "COMPLETED",
            userRating: ctx.user_rating || null,
            userComment: ctx.user_comment || null,
            learnings: ctx.learnings || [],
            durationDays,
            salesPerDay: durationDays > 0 ? (ctx.sales_eur || 0) / durationDays : 0,
            score: 0,
            scoreLabel: "",
          });
        }
      }

      // Calculate averages for scoring
      const avgSales = matchedOffers.reduce((sum, o) => sum + o.salesEur, 0) / matchedOffers.length || 1;
      const avgOrders = matchedOffers.reduce((sum, o) => sum + o.orders, 0) / matchedOffers.length || 1;
      const avgNewCustomers = matchedOffers.reduce((sum, o) => sum + o.newCustomers, 0) / matchedOffers.length || 1;

      // Calculate scores
      for (const offer of matchedOffers) {
        const { score, label } = calculateOfferScore(
          offer.salesEur,
          offer.orders,
          offer.newCustomers,
          offer.durationDays,
          offer.uberFundingPercent,
          avgSales,
          avgOrders,
          avgNewCustomers
        );
        offer.score = score;
        offer.scoreLabel = label;
      }

      // Sort by score descending
      matchedOffers.sort((a, b) => b.score - a.score);

      // Generate insights
      const insights = generateInsights(matchedOffers, selectedItemNames);

      return { offers: matchedOffers, insights };
    },
    enabled: true,
  });
}

interface BogoInsights {
  avgSalesPerCampaign: number;
  avgOrdersPerCampaign: number;
  avgNewCustomersPerCampaign: number;
  bestAudience: { audience: string; avgNewCustomers: number; improvement: number } | null;
  bestPeriod: string | null;
  optimalDuration: number | null;
  totalCampaigns: number;
}

function generateInsights(offers: BogoOfferHistoryItem[], selectedItemNames: string[]): BogoInsights | null {
  if (offers.length === 0) return null;

  const totalCampaigns = offers.length;
  const avgSalesPerCampaign = offers.reduce((sum, o) => sum + o.salesEur, 0) / totalCampaigns;
  const avgOrdersPerCampaign = offers.reduce((sum, o) => sum + o.orders, 0) / totalCampaigns;
  const avgNewCustomersPerCampaign = offers.reduce((sum, o) => sum + o.newCustomers, 0) / totalCampaigns;

  // Best audience analysis
  const audienceGroups: Record<string, { count: number; totalNewCustomers: number }> = {};
  for (const offer of offers) {
    const audience = offer.audience || "Tous";
    if (!audienceGroups[audience]) {
      audienceGroups[audience] = { count: 0, totalNewCustomers: 0 };
    }
    audienceGroups[audience].count++;
    audienceGroups[audience].totalNewCustomers += offer.newCustomers;
  }

  let bestAudience: { audience: string; avgNewCustomers: number; improvement: number } | null = null;
  const audiences = Object.entries(audienceGroups);
  if (audiences.length > 1) {
    const audienceStats = audiences.map(([audience, data]) => ({
      audience,
      avgNewCustomers: data.totalNewCustomers / data.count,
    }));
    const baseline = audienceStats.find(a => a.audience === "Tous les clients")?.avgNewCustomers || 
                     audienceStats.reduce((sum, a) => sum + a.avgNewCustomers, 0) / audienceStats.length;
    
    const best = audienceStats.reduce((best, curr) => 
      curr.avgNewCustomers > best.avgNewCustomers ? curr : best
    );
    
    if (best.avgNewCustomers > baseline) {
      bestAudience = {
        audience: best.audience,
        avgNewCustomers: best.avgNewCustomers,
        improvement: ((best.avgNewCustomers - baseline) / baseline) * 100,
      };
    }
  }

  // Best period (end of month analysis)
  const endOfMonthOffers = offers.filter(o => {
    const day = new Date(o.startDate).getDate();
    return day >= 26;
  });
  const bestPeriod = endOfMonthOffers.length > 3 ? "fin de mois (26-31)" : null;

  // Optimal duration
  const topOffers = offers.slice(0, Math.ceil(offers.length / 3)); // Top third by score
  const avgDuration = topOffers.reduce((sum, o) => sum + o.durationDays, 0) / topOffers.length;
  const optimalDuration = Math.round(avgDuration);

  return {
    avgSalesPerCampaign,
    avgOrdersPerCampaign,
    avgNewCustomersPerCampaign,
    bestAudience,
    bestPeriod,
    optimalDuration,
    totalCampaigns,
  };
}

// Mutation to update offer annotations
export function useUpdateOfferAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      userRating,
      userComment,
      learnings,
    }: {
      offerId: string;
      userRating?: number;
      userComment?: string;
      learnings?: string[];
    }) => {
      // First get current change_context
      const { data: currentData, error: fetchError } = await supabase
        .from("restaurant_actions")
        .select("change_context")
        .eq("id", offerId)
        .single();

      if (fetchError) throw fetchError;

      const currentContext = (currentData?.change_context as RawChangeContext) || {};

      // Merge new annotations
      const updatedContext = {
        ...currentContext,
        ...(userRating !== undefined && { user_rating: userRating }),
        ...(userComment !== undefined && { user_comment: userComment }),
        ...(learnings !== undefined && { learnings }),
      };

      const { error } = await supabase
        .from("restaurant_actions")
        .update({ change_context: updatedContext })
        .eq("id", offerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bogo-offer-history"] });
    },
  });
}
