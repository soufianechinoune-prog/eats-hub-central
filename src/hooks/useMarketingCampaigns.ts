import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingCampaign {
  id: string;
  restaurant_id: string;
  action_type: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  category_id?: string;
  target_item_ids?: string[];
  change_context?: {
    campaign_type?: "offer" | "ads";
    offer_type?: string;
    sales_eur?: number;
    audience?: string;
    generated_sales?: number;
    new_customers?: number;
    orders?: number;
    uber_funding_percent?: number;
    items_affected?: string;
    // Ads specific
    campaign_uuid?: string;
    budget?: number;
    ad_spend?: number;
    roas?: number;
    cost_per_click?: number;
    cost_per_order?: number;
    impressions?: number;
    clicks?: number;
    click_through_rate?: number;
    conversion_rate?: number;
    average_basket?: number;
  };
  restaurant?: {
    name: string;
  };
}

export interface OffersCampaign extends MarketingCampaign {
  offer_type: string;
  audience: string;
  generated_sales: number;
  new_customers: number;
  orders: number;
  uber_funding_percent: number;
  items_affected: string;
}

export interface AdsCampaign extends MarketingCampaign {
  campaign_uuid: string;
  budget: number;
  generated_sales: number;
  ad_spend: number;
  roas: number;
  cost_per_click: number;
  cost_per_order: number;
  impressions: number;
  clicks: number;
  orders: number;
  click_through_rate: number;
  conversion_rate: number;
  average_basket: number;
}

export const useMarketingCampaigns = (restaurantIds?: string[]) => {
  return useQuery({
    queryKey: ["marketing-campaigns", restaurantIds],
    queryFn: async () => {
      let query = supabase
        .from("restaurant_actions")
        .select(`
          id,
          restaurant_id,
          action_type,
          title,
          description,
          start_date,
          end_date,
          status,
          category_id,
          target_item_ids,
          change_context,
          restaurant:restaurants(name)
        `)
        .or('category.eq.promotions,category.eq.ads')
        .order("start_date", { ascending: false });

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      const campaigns = (data || []) as unknown as MarketingCampaign[];

      // Separate offers and ads
      const offers: OffersCampaign[] = campaigns
        .filter((c) => c.change_context?.campaign_type === "offer" || !c.change_context?.campaign_type)
        .map((c) => ({
          ...c,
          offer_type: c.change_context?.offer_type || "",
          audience: c.change_context?.audience || "",
          generated_sales: c.change_context?.generated_sales || c.change_context?.sales_eur || 0,
          new_customers: c.change_context?.new_customers || 0,
          orders: c.change_context?.orders || 0,
          uber_funding_percent: c.change_context?.uber_funding_percent || 0,
          items_affected: c.change_context?.items_affected || "",
        }));

      const ads: AdsCampaign[] = campaigns
        .filter((c) => c.change_context?.campaign_type === "ads")
        .map((c) => ({
          ...c,
          campaign_uuid: c.change_context?.campaign_uuid || "",
          budget: c.change_context?.budget || 0,
          generated_sales: c.change_context?.generated_sales || c.change_context?.sales_eur || 0,
          ad_spend: c.change_context?.ad_spend || 0,
          roas: c.change_context?.roas || 0,
          cost_per_click: c.change_context?.cost_per_click || 0,
          cost_per_order: c.change_context?.cost_per_order || 0,
          impressions: c.change_context?.impressions || 0,
          clicks: c.change_context?.clicks || 0,
          orders: c.change_context?.orders || 0,
          click_through_rate: c.change_context?.click_through_rate || 0,
          conversion_rate: c.change_context?.conversion_rate || 0,
          average_basket: c.change_context?.average_basket || 0,
        }));

      // Calculate summary stats
      const offerStats = {
        totalSales: offers.reduce((sum, o) => sum + o.generated_sales, 0),
        totalNewCustomers: offers.reduce((sum, o) => sum + o.new_customers, 0),
        totalOrders: offers.reduce((sum, o) => sum + o.orders, 0),
        avgUberFunding: offers.length > 0 
          ? offers.reduce((sum, o) => sum + o.uber_funding_percent, 0) / offers.length 
          : 0,
        campaignCount: offers.length,
        byType: offers.reduce((acc, o) => {
          const type = o.offer_type || "Autre";
          if (!acc[type]) {
            acc[type] = { count: 0, sales: 0, orders: 0, newCustomers: 0 };
          }
          acc[type].count++;
          acc[type].sales += o.generated_sales;
          acc[type].orders += o.orders;
          acc[type].newCustomers += o.new_customers;
          return acc;
        }, {} as Record<string, { count: number; sales: number; orders: number; newCustomers: number }>),
      };

      const adsStats = {
        totalSales: ads.reduce((sum, a) => sum + a.generated_sales, 0),
        totalSpend: ads.reduce((sum, a) => sum + a.ad_spend, 0),
        totalBudget: ads.reduce((sum, a) => sum + a.budget, 0),
        avgRoas: ads.length > 0 
          ? ads.reduce((sum, a) => sum + a.roas, 0) / ads.length 
          : 0,
        avgCostPerOrder: ads.length > 0 
          ? ads.reduce((sum, a) => sum + a.cost_per_order, 0) / ads.length 
          : 0,
        totalImpressions: ads.reduce((sum, a) => sum + a.impressions, 0),
        totalClicks: ads.reduce((sum, a) => sum + a.clicks, 0),
        totalOrders: ads.reduce((sum, a) => sum + a.orders, 0),
        campaignCount: ads.length,
      };

      return {
        offers,
        ads,
        offerStats,
        adsStats,
        all: campaigns,
      };
    },
  });
};
