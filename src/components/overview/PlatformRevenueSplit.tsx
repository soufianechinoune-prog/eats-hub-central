import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { RestaurantNetworkStats } from "@/hooks/useNetworkStats";

interface Props {
  stats: RestaurantNetworkStats[];
  isLoading: boolean;
}

export function PlatformRevenueSplit({ stats, isLoading }: Props) {
  const { uberTotal, deliverooTotal, total, uberPct, deliverooPct } = useMemo(() => {
    let uber = 0;
    let deliveroo = 0;
    for (const s of stats) {
      uber += s.platformBreakdown.uber.revenue;
      deliveroo += s.platformBreakdown.deliveroo.revenue;
    }
    const t = uber + deliveroo;
    return {
      uberTotal: uber,
      deliverooTotal: deliveroo,
      total: t,
      uberPct: t > 0 ? (uber / t) * 100 : 0,
      deliverooPct: t > 0 ? (deliveroo / t) * 100 : 0,
    };
  }, [stats]);

  if (isLoading) {
    return (
      <Card className="border-border/50 backdrop-blur">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (total === 0) return null;

  const fmt = (v: number) =>
    v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  return (
    <Card className="border-border/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Répartition du CA réseau
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Total :{" "}
            <span className="font-semibold text-foreground">
              <AnimatedNumber value={Math.round(total)} duration={800} /> €
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Animated bar */}
        <div className="relative h-9 w-full rounded-full bg-muted/50 overflow-hidden flex">
          {/* Uber segment */}
          <motion.div
            className="h-full bg-uber flex items-center justify-center rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${uberPct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {uberPct > 15 && (
              <motion.span
                className="text-xs font-semibold text-white drop-shadow-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {uberPct.toFixed(1)}%
              </motion.span>
            )}
          </motion.div>

          {/* Deliveroo segment */}
          <motion.div
            className="h-full bg-deliveroo flex items-center justify-center rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${deliverooPct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            {deliverooPct > 15 && (
              <motion.span
                className="text-xs font-semibold text-white drop-shadow-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 }}
              >
                {deliverooPct.toFixed(1)}%
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <UberEatsLogo size={18} />
            <span className="text-sm font-medium">Uber Eats</span>
            <span className="text-sm font-semibold text-uber">
              <AnimatedNumber value={Math.round(uberTotal)} duration={800} /> €
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DeliverooLogo size={18} />
            <span className="text-sm font-medium">Deliveroo</span>
            <span className="text-sm font-semibold text-deliveroo">
              <AnimatedNumber value={Math.round(deliverooTotal)} duration={800} /> €
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
