import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Wallet } from "lucide-react";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend,
} from "recharts";
import { useOfferFeesCorrelation } from "@/hooks/useOfferFeesCorrelation";
import type { OffersAnalyticsResult } from "@/hooks/useOffersAnalytics";

interface Props {
  data: OffersAnalyticsResult;
  restaurantIds: string[];
  startDate: string;
  endDate: string;
}

export function OfferFeesCorrelationTab({ data, restaurantIds, startDate, endDate }: Props) {
  const monthlyFees = data.monthlyStats.map((m) => ({
    monthKey: m.monthKey,
    totalFees: m.totalFees,
  }));

  const { points, isLoading } = useOfferFeesCorrelation(
    restaurantIds,
    startDate,
    endDate,
    monthlyFees
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Aucune donnée croisée disponible sur la période sélectionnée.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
        <Badge variant="outline" className="font-normal">Mensuel</Badge>
        CA HT estimé à partir des ventes TTC (TVA restauration 10%) — comparable indicatif.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Frais vs CA HT */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Frais 0,89€ vs CA HT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                  <YAxis
                    yAxisId="left"
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(v) => `${v.toFixed(2)}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => {
                      if (name === "Ratio frais/CA") return [`${value.toFixed(3)}%`, name];
                      return [`${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€`, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="caHt" name="CA HT" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="fees" name="Frais offres" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="feesRatioCa" name="Ratio frais/CA" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Frais vs Rentabilité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-4 w-4 text-accent" />
              Frais 0,89€ vs Rentabilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                  <YAxis
                    yAxisId="left"
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => {
                      if (name === "Rentabilité") return [`${value.toFixed(1)}%`, name];
                      return [`${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€`, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="versement" name="Versement total" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="fees" name="Frais offres" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="rentabilite" name="Rentabilité" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lecture des courbes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • <span className="font-medium text-foreground">Ratio frais/CA</span> : indique combien d'euros de CA chaque euro de frais d'offre consomme. Un ratio qui monte alors que le CA stagne signale une dépendance croissante aux promotions taxées.
          </p>
          <p>
            • <span className="font-medium text-foreground">Rentabilité</span> = Versement total (net_payout + meal_voucher) / CA HT opérationnel. Les frais d'offres sont déjà déduits du versement — la courbe permet de visualiser leur impact mois par mois.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
