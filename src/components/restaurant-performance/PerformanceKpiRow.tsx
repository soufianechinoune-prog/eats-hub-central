import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtEur, fmtEur2, fmtInt } from "./channelMeta";

interface Props {
  isLoading: boolean;
  totalCa: number;
  totalOrders: number;
  uberRentabilite: number | null;
}

export function PerformanceKpiRow({ isLoading, totalCa, totalOrders, uberRentabilite }: Props) {
  const items = [
    { label: "CA total consolidé", value: fmtEur(totalCa) },
    { label: "Commandes", value: fmtInt(totalOrders) },
    { label: "Panier moyen", value: totalOrders > 0 ? fmtEur2(totalCa / totalOrders) : "—" },
    {
      label: "Rentabilité",
      value: uberRentabilite != null ? `${uberRentabilite.toLocaleString("fr-FR")} %` : "—",
      badge: "Uber",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {it.label}
              {it.badge && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                  {it.badge}
                </Badge>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <div className="mt-1 text-2xl font-semibold tabular-nums">{it.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
