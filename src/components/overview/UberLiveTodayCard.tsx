import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ShoppingBag, Euro, TrendingUp } from "lucide-react";
import { useUberLiveToday } from "@/hooks/useUberLiveToday";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  restaurantIds: string[];
  scope: "today" | "yesterday";
}

export function UberLiveTodayCard({ restaurantIds, scope }: Props) {
  const { data, isLoading } = useUberLiveToday({ restaurantIds, scope });

  const isLive = scope === "today" && !data?.consolidated;
  const label = scope === "today" ? "Aujourd'hui" : "Hier";

  return (
    <Card className="border-2 border-uber/30 bg-gradient-to-br from-card via-card to-uber/5 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={isLive ? "h-4 w-4 text-emerald-500 animate-pulse" : "h-4 w-4 text-muted-foreground"} />
            <CardTitle className="text-sm font-semibold">Uber Eats — {label}</CardTitle>
          </div>
          {isLive ? (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Live</Badge>
          ) : data?.consolidated ? (
            <Badge variant="secondary">Consolidé J+2</Badge>
          ) : (
            <Badge variant="outline">En attente</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <Metric
            icon={<Euro className="h-4 w-4 text-emerald-500" />}
            label="CA TTC"
            value={isLoading ? "…" : `${(data?.revenueInclVat ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
          />
          <Metric
            icon={<ShoppingBag className="h-4 w-4 text-blue-500" />}
            label="Commandes"
            value={isLoading ? "…" : `${data?.orderCount ?? 0}`}
          />
          <Metric
            icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
            label="Panier moyen"
            value={isLoading ? "…" : `${(data?.averageBasket ?? 0).toFixed(2)} €`}
          />
        </div>
        {data?.lastEventAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Dernière commande {formatDistanceToNow(new Date(data.lastEventAt), { addSuffix: true, locale: fr })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
