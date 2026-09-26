import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NetworkDailyPoint } from "@/hooks/useNetworkDailyRevenue";
import splashLogo from "@/assets/splash360-logo.png.asset.json";
import dishopLogo from "@/assets/dishop-logo.png.asset.json";
import chataigneLogo from "@/assets/chataigne-logo.png.asset.json";
import uberLogo from "@/assets/uber-eats-wordmark-tight.png.asset.json";
import deliverooLogo from "@/assets/deliveroo-wordmark.png.asset.json";

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)) + " €";

/** Mini sparkline SVG (aquaremplie légère), colorée selon la tendance. */
function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 120;
  const h = 36;
  if (points.length < 2) {
    return <div style={{ width: w, height: h }} className="ml-auto" />;
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - 4 - ((p - min) / range) * (h - 8)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const stroke = positive ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
  const fill = positive ? "hsl(142 71% 45% / 0.12)" : "hsl(0 84% 60% / 0.12)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ml-auto shrink-0">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface ChannelCardDef {
  key: "cash" | "uber" | "deliveroo" | "dishop" | "chataigne";
  label: string;
  logo: string;
  logoAlt: string;
  darkInvert?: boolean;
  tileClass: string;
  value: number | null; // null = non provisionné / non connecté
  notConnectedLabel?: string;
  variation?: number | null;
  hint: string;
}

export interface NetworkChannelCardsProps {
  isLoading: boolean;
  cash: number | null;
  cashVariation?: number | null;
  cashConnected: boolean;
  uber: number;
  deliveroo: number;
  dishop: number | null;
  chataigne: number;
  daily: NetworkDailyPoint[];
}

export function NetworkChannelCards({
  isLoading,
  cash,
  cashVariation,
  cashConnected,
  uber,
  deliveroo,
  dishop,
  chataigne,
  daily,
}: NetworkChannelCardsProps) {
  const cards: ChannelCardDef[] = [
    {
      key: "cash",
      label: "Caisse",
      logo: splashLogo.url,
      logoAlt: "Caisse",
      tileClass: "bg-cash/10",
      value: cashConnected ? cash : null,
      notConnectedLabel: "Caisse non connectée",
      variation: cashVariation ?? null,
      hint: "Chiffre d'affaires sur place (TTC) remonté par le logiciel de caisse.",
    },
    {
      key: "uber",
      label: "Uber Eats",
      logo: uberLogo.url,
      logoAlt: "Uber Eats",
      darkInvert: true,
      tileClass: "bg-uber/10",
      value: uber,
      hint: "Chiffre d'affaires brut TTC Uber Eats sur la période (avant commission).",
    },
    {
      key: "deliveroo",
      label: "Deliveroo",
      logo: deliverooLogo.url,
      logoAlt: "Deliveroo",
      tileClass: "bg-deliveroo/10",
      value: deliveroo,
      hint: "Chiffre d'affaires brut TTC Deliveroo sur la période.",
    },
    {
      key: "dishop",
      label: "Dishop",
      logo: dishopLogo.url,
      logoAlt: "Dishop",
      tileClass: "bg-orange-500/10",
      value: dishop,
      notConnectedLabel: "Non provisionné",
      hint: "Chiffre d'affaires TTC de la boutique en ligne Dishop.",
    },
    {
      key: "chataigne",
      label: "Chataigne",
      logo: chataigneLogo.url,
      logoAlt: "Chataigne",
      darkInvert: true,
      tileClass: "bg-slate-500/10",
      value: chataigne,
      hint: "Chiffre d'affaires TTC des commandes via Chataigne.",
    },
  ];

  const total = cards.reduce((s, c) => s + Math.max(0, c.value ?? 0), 0);

  const seriesByKey = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const key of ["cash", "uber", "deliveroo", "chataigne"] as const) {
      m.set(key, daily.map((d) => d[key]));
    }
    return m;
  }, [daily]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => {
        const share = total > 0 && c.value != null ? (Math.max(0, c.value) / total) * 100 : null;
        const series = seriesByKey.get(c.key) ?? [];
        const positive = c.variation != null ? c.variation >= 0 : true;
        return (
          <TooltipProvider key={c.key} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="cursor-help transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", c.tileClass)}>
                        <img
                          src={c.logo}
                          alt={c.logoAlt}
                          className={cn("h-5 w-auto max-w-[26px] object-contain", c.darkInvert && "dark:invert")}
                        />
                      </div>
                      <span className="text-sm font-medium">{c.label}</span>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        {isLoading ? (
                          <Skeleton className="h-7 w-24" />
                        ) : c.value == null ? (
                          <p className="text-sm text-muted-foreground">{c.notConnectedLabel ?? "Pas de données"}</p>
                        ) : (
                          <p className="truncate text-xl font-bold tracking-tight tabular-nums">
                            {fmtEur(c.value)}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {share != null ? `${share.toFixed(1).replace(".", ",")} % du CA` : "—"}
                          </span>
                          {c.variation != null && !isLoading && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 font-medium",
                                c.variation >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400",
                              )}
                            >
                              {c.variation >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {c.variation > 0 ? "+" : ""}
                              {c.variation.toFixed(1).replace(".", ",")} %
                            </span>
                          )}
                        </div>
                      </div>
                      {!isLoading && c.value != null && c.value > 0 && (
                        <Sparkline points={series} positive={positive} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {c.hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
