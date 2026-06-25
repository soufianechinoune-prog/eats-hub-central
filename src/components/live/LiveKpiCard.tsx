import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  revenue: number;
  orders: number;
  yesterdayRevenue: number;
  freshness: "live" | "near-live";
  freshnessLabel: string;
  lastEventAt: string | null;
  isLoading?: boolean;
  accentClassName?: string;
}

function formatEUR(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v || 0);
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function LiveKpiCard({
  title,
  revenue,
  orders,
  yesterdayRevenue,
  freshness,
  freshnessLabel,
  lastEventAt,
  isLoading,
  accentClassName,
}: Props) {
  const avg = orders > 0 ? revenue / orders : 0;
  const delta = yesterdayRevenue > 0 ? ((revenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;
  const deltaPositive = (delta ?? 0) >= 0;

  return (
    <Card className="p-4 space-y-3 relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 right-0 h-1", accentClassName ?? "bg-primary")} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] gap-1 font-normal",
            freshness === "live" ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              freshness === "live" ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
            )}
          />
          {freshnessLabel}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold tabular-nums">
          {isLoading ? "…" : formatEUR(revenue)}
        </div>
        <div className="text-xs text-muted-foreground">
          {orders.toLocaleString("fr-FR")} cmds · panier {formatEUR(avg)}
        </div>
        {delta !== null && (
          <div className={cn("text-xs font-medium", deltaPositive ? "text-emerald-600" : "text-red-600")}>
            {deltaPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs hier
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Dernière maj : {formatTime(lastEventAt)}
      </div>
    </Card>
  );
}
