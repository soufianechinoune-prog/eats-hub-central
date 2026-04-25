import { useMemo } from "react";
import { motion } from "framer-motion";
import { Store, Info, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import type { RestaurantNetworkStats } from "@/hooks/useNetworkStats";

interface Props {
  stats: RestaurantNetworkStats[];
  isLoading: boolean;
  cashTotal?: number; // Optional — only when Splash360 data is available
  cashDaysWithData?: number;
  cashVariation?: number | null;
}

export function PlatformRevenueSplit({
  stats,
  isLoading,
  cashTotal = 0,
  cashDaysWithData,
  cashVariation = null,
}: Props) {
  const { uberTotal, deliverooTotal, total, uberPct, deliverooPct, cashPct } = useMemo(() => {
    let uber = 0;
    let deliveroo = 0;
    for (const s of stats) {
      uber += s.platformBreakdown.uber.revenue;
      deliveroo += s.platformBreakdown.deliveroo.revenue;
    }
    const cash = Math.max(0, cashTotal);
    const t = uber + deliveroo + cash;
    return {
      uberTotal: uber,
      deliverooTotal: deliveroo,
      total: t,
      uberPct: t > 0 ? (uber / t) * 100 : 0,
      deliverooPct: t > 0 ? (deliveroo / t) * 100 : 0,
      cashPct: t > 0 ? (cash / t) * 100 : 0,
    };
  }, [stats, cashTotal]);

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

  const hasCash = cashTotal > 0;

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
            {uberPct > 12 && (
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
            className={`h-full bg-deliveroo flex items-center justify-center ${hasCash ? "" : "rounded-r-full"}`}
            initial={{ width: 0 }}
            animate={{ width: `${deliverooPct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            {deliverooPct > 12 && (
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

          {/* Cash segment */}
          {hasCash && (
            <motion.div
              className="h-full bg-cash flex items-center justify-center rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${cashPct}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            >
              {cashPct > 12 && (
                <motion.span
                  className="text-xs font-semibold text-white drop-shadow-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  {cashPct.toFixed(1)}%
                </motion.span>
              )}
            </motion.div>
          )}
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
          {hasCash && (
            <div className="flex items-center gap-2">
              <Store className="h-[18px] w-[18px] text-cash" />
              <span className="text-sm font-medium">Caisse</span>
              <span className="text-sm font-semibold text-cash">
                <AnimatedNumber value={Math.round(cashTotal)} duration={800} /> €
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
