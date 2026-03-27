import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Gift, Megaphone, TrendingUp, AlertCircle, Upload, BarChart3, Package, Store } from "lucide-react";
import { useMarketingCampaigns } from "@/hooks/useMarketingCampaigns";
import { OffersOverview } from "@/components/marketing/OffersOverview";
import { AdsOverview } from "@/components/marketing/AdsOverview";
import { OfferPerformanceAnalysis } from "@/components/marketing/OfferPerformanceAnalysis";
import { ProductPerformanceAnalysis } from "@/components/marketing/ProductPerformanceAnalysis";
import { RestaurantCampaignComparison } from "@/components/marketing/RestaurantCampaignComparison";
import { Link } from "react-router-dom";

export default function MarketingAnalytics() {
  const [activeTab, setActiveTab] = useState("offers");
  const { selectedChainId } = useAnalyticsContext();

  // Fetch restaurants for filtering (filtered by active chain)
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-marketing", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name")
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: campaignData, isLoading } = useMarketingCampaigns();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </AppLayout>
    );
  }

  const hasData = (campaignData?.offers?.length || 0) + (campaignData?.ads?.length || 0) > 0;

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              Marketing Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Analysez la performance de vos offres promotionnelles et publicités Uber Eats
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/report-import">
              <Upload className="h-4 w-4 mr-2" />
              Importer des campagnes
            </Link>
          </Button>
        </div>

        {!hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Aucune campagne marketing importée</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Importez vos rapports de campagnes Uber Eats (offres promotionnelles et publicités)
                pour visualiser leur performance.
              </p>
              <Button asChild>
                <Link to="/report-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Importer des campagnes
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-emerald-500/20">
                        <Gift className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Offres promotionnelles</p>
                        <p className="text-2xl font-bold">
                          {campaignData?.offerStats?.campaignCount || 0} campagnes
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ventes générées</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {formatCurrency(campaignData?.offerStats?.totalSales || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-blue-500/20">
                        <Megaphone className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Publicités</p>
                        <p className="text-2xl font-bold">
                          {campaignData?.adsStats?.campaignCount || 0} campagnes
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">ROAS moyen</p>
                      <p className="text-xl font-bold text-blue-600">
                        {(campaignData?.adsStats?.avgRoas || 0).toFixed(1)}x
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full max-w-4xl grid-cols-5">
                <TabsTrigger value="offers" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Offres
                  <Badge variant="secondary" className="ml-1">
                    {campaignData?.offers?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analyse
                </TabsTrigger>
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produits
                </TabsTrigger>
                <TabsTrigger value="restaurants" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Restaurants
                </TabsTrigger>
                <TabsTrigger value="ads" className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Publicités
                  <Badge variant="secondary" className="ml-1">
                    {campaignData?.ads?.length || 0}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="offers">
                <OffersOverview
                  offers={campaignData?.offers || []}
                  stats={campaignData?.offerStats || {
                    totalSales: 0,
                    totalNewCustomers: 0,
                    totalOrders: 0,
                    avgUberFunding: 0,
                    campaignCount: 0,
                    byType: {},
                  }}
                />
              </TabsContent>

              <TabsContent value="performance">
                <OfferPerformanceAnalysis offers={campaignData?.offers || []} />
              </TabsContent>

              <TabsContent value="products">
                <ProductPerformanceAnalysis offers={campaignData?.offers || []} />
              </TabsContent>

              <TabsContent value="restaurants">
                <RestaurantCampaignComparison offers={campaignData?.offers || []} />
              </TabsContent>

              <TabsContent value="ads">
                <AdsOverview
                  ads={campaignData?.ads || []}
                  stats={campaignData?.adsStats || {
                    totalSales: 0,
                    totalSpend: 0,
                    totalBudget: 0,
                    avgRoas: 0,
                    avgCostPerOrder: 0,
                    totalImpressions: 0,
                    totalClicks: 0,
                    totalOrders: 0,
                    campaignCount: 0,
                  }}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
