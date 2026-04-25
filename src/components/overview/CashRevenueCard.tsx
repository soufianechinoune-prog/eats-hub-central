import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Euro, Calendar, PieChart, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NetworkCashRevenueData } from "@/hooks/useNetworkCashRevenue";

interface Props {
  data: NetworkCashRevenueData | null | undefined;
  isLoading: boolean;
  periodLabel: string;
}

const fmtEur = (v: number) =>
  v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

export function CashRevenueCard({ data, isLoading, periodLabel }: Props) {
  return (
    <Card className="border-2 border-cash/30 shadow-2xl bg-gradient-to-br from-card via-card to-cash/5 backdrop-blur-xl hover:shadow-[0_10px_30px_-10px_hsl(var(--cash)/0.3)] transition-all duration-500 hover:scale-[1.02]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-cash/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-cash" />
            </div>
            <div>
              <CardTitle className="text-xl">Caisse</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
          </>
        ) : !data || data.totalCash <= 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Aucune donnée caisse sur cette période.
          </p>
        ) : (
          <>
            <Row
              icon={Euro}
              label="CA TTC"
              value={fmtEur(data.totalCash)}
              valueClass="text-cash font-bold text-lg"
            />
            <Row
              icon={PieChart}
              label="Part du CA réseau"
              value={`${data.cashShare.toFixed(1)}%`}
            />
            <Row
              icon={Calendar}
              label="Jours de données"
              value={`${data.daysWithData}j`}
            />
            {data.cashVariation != null && (
              <Row
                icon={data.cashVariation >= 0 ? TrendingUp : TrendingDown}
                label="vs période précédente"
                value={`${data.cashVariation >= 0 ? "+" : ""}${data.cashVariation.toFixed(1)}%`}
                valueClass={cn(
                  "font-semibold",
                  data.cashVariation >= 0 ? "text-emerald-600" : "text-destructive",
                )}
              />
            )}
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              Source : Splash360 (réseau global). Détail par restaurant indisponible via l'API actuellement.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface RowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}

function Row({ icon: Icon, label, value, valueClass }: RowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={cn("text-foreground", valueClass)}>{value}</span>
    </div>
  );
}
