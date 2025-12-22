import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSlotDetailData } from "@/hooks/useSlotDetailData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, TrendingUp, ShoppingCart, Euro, ShoppingBag } from "lucide-react";

type DisplayMode = "orders" | "revenue" | "basket";

interface SlotDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: { id: string; name: string } | null;
  slot: { label: string; hours: number[]; range: string; color: string } | null;
  startDate: string;
  endDate: string;
  displayMode: DisplayMode;
}

export function SlotDetailSheet({
  open,
  onOpenChange,
  restaurant,
  slot,
  startDate,
  endDate,
  displayMode,
}: SlotDetailSheetProps) {
  const { data, summary, granularity, isLoading } = useSlotDetailData({
    restaurantId: restaurant?.id || "",
    slotHours: slot?.hours || [],
    startDate,
    endDate,
    enabled: open && !!restaurant && !!slot,
  });

  const getDataKey = () => {
    switch (displayMode) {
      case "orders": return "order_count";
      case "revenue": return "revenue";
      case "basket": return "avg_basket";
    }
  };

  const getLabel = () => {
    switch (displayMode) {
      case "orders": return "Commandes";
      case "revenue": return "Chiffre d'affaires (€)";
      case "basket": return "Panier moyen (€)";
    }
  };

  const getBarColor = () => {
    switch (slot?.label) {
      case "Déjeuner": return "hsl(25, 95%, 53%)"; // amber
      case "Après-midi": return "hsl(187, 85%, 43%)"; // cyan
      case "Dîner": return "hsl(217, 91%, 60%)"; // blue
      case "Soirée": return "hsl(271, 91%, 65%)"; // purple
      case "Late-night": return "hsl(350, 89%, 60%)"; // rose
      default: return "hsl(var(--primary))";
    }
  };

  const getGranularityLabel = () => {
    switch (granularity) {
      case "daily": return "par jour";
      case "weekly": return "par semaine";
      case "monthly": return "par mois";
    }
  };

  const formatValue = (value: number) => {
    if (displayMode === "revenue") return `${value.toLocaleString()}€`;
    if (displayMode === "basket") return `${value.toFixed(2)}€`;
    return value.toString();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {restaurant?.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            Créneau 
            <Badge variant="outline" className={slot?.color}>
              {slot?.label} ({slot?.range})
            </Badge>
            • Évolution {getGranularityLabel()}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data?.length ? (
          <div className="text-center text-muted-foreground py-12">
            Aucune donnée disponible pour ce créneau
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary KPIs */}
            {summary && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg font-bold">{summary.totalOrders}</div>
                    <div className="text-xs text-muted-foreground">Commandes</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <Euro className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg font-bold">{summary.totalRevenue.toLocaleString()}€</div>
                    <div className="text-xs text-muted-foreground">CA total</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg font-bold">{summary.avgBasket.toFixed(2)}€</div>
                    <div className="text-xs text-muted-foreground">Panier moyen</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Chart */}
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => displayMode === "orders" ? v : `${v}€`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatValue(value), getLabel()]}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar 
                    dataKey={getDataKey()} 
                    fill={getBarColor()} 
                    radius={[4, 4, 0, 0]}
                    name={getLabel()}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <p className="text-xs text-muted-foreground text-center">
              {getLabel()} {getGranularityLabel()} sur {data.length} périodes
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
