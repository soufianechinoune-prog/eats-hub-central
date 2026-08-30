import { Layers, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import splashLogo from "@/assets/splash360-logo.png.asset.json";
import dishopLogo from "@/assets/dishop-logo.png.asset.json";
import chataigneLogo from "@/assets/chataigne-logo.png.asset.json";
import uberIcon from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-wordmark.png.asset.json";


export interface ChannelRevenueTilesProps {
  periodLabel: string;
  isLoading?: boolean;
  /** CA Caisse TTC (null = caisse non connectée) */
  cash: number | null;
  cashVariation?: number | null;
  cashConnected: boolean;
  /** CA Uber Eats TTC */
  uber: number;
  /** CA Deliveroo TTC */
  deliveroo: number;
  /** CA Dishop TTC (null = canal non provisionné pour la marque) */
  dishop: number | null;
  /** CA Chataigne TTC */
  chataigne: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "decimal", maximumFractionDigits: 0 }).format(v) + " €";

interface TileDef {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  iconWrapClass: string;
  valueClass: string;
  /** null = canal non connecté / non provisionné */
  value: number | null;
  notConnectedLabel?: string;
  variation?: number | null;
}

export function ChannelRevenueTiles({
  periodLabel,
  isLoading,
  cash,
  cashVariation,
  cashConnected,
  uber,
  deliveroo,
  dishop,
  chataigne,
}: ChannelRevenueTilesProps) {
  const logoBox = (src: string, alt: string, darkInvert = false) => (
    <div className="w-[84px] h-[28px] flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        className={cn(
          "max-h-full max-w-full object-contain",
          darkInvert && "dark:invert",
        )}
      />
    </div>
  );

  const tiles: TileDef[] = [
    {
      key: "cash",
      label: "Caisse",
      hint: "Chiffre d'affaires sur place (TTC) remonté par le logiciel de caisse (Splash360…).",
      icon: logoBox(splashLogo.url, "Splash360"),
      iconWrapClass: "bg-cash/10",
      valueClass: "text-cash",
      value: cashConnected ? cash : null,
      notConnectedLabel: "Caisse non connectée",
      variation: cashVariation ?? null,
    },
    {
      key: "uber",
      label: "Uber Eats",
      hint: "Chiffre d'affaires brut TTC Uber Eats sur la période (ventes avant commission).",
      icon: logoBox(uberIcon, "Uber Eats", true),
      iconWrapClass: "bg-uber/10",
      valueClass: "text-uber",
      value: uber,
    },
    {
      key: "deliveroo",
      label: "Deliveroo",
      hint: "Chiffre d'affaires brut TTC Deliveroo sur la période.",
      icon: logoBox(deliverooLogo.url, "Deliveroo"),
      iconWrapClass: "bg-deliveroo/10",
      valueClass: "text-deliveroo",
      value: deliveroo,
    },
    {
      key: "dishop",
      label: "Dishop",
      hint: "Chiffre d'affaires TTC de la boutique en ligne Dishop (click & collect / livraison propre).",
      icon: logoBox(dishopLogo.url, "Dishop"),
      iconWrapClass: "bg-emerald-500/10",
      valueClass: "text-blue-500",
      value: dishop,
      notConnectedLabel: "Canal non provisionné",
    },
    {
      key: "chataigne",
      label: "Chataigne",
      hint: "Chiffre d'affaires TTC des commandes WhatsApp via Chataigne.",
      icon: logoBox(chataigneLogo.url, "Chataigne", true),
      iconWrapClass: "bg-emerald-500/10",
      valueClass: "text-emerald-600 dark:text-emerald-400",
      value: chataigne,
    },
  ];

  const total = tiles.reduce((s, t) => s + Math.max(0, t.value ?? 0), 0);

  return (
    <Card className="border-border/50 shadow-lg backdrop-blur-xl bg-card/80">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">CA par canal</h2>
              <p className="text-xs text-muted-foreground">{periodLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total tous canaux</p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 ml-auto" />
            ) : (
              <p className="text-xl font-bold text-primary">{fmt(total)}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {tiles.map((t) => {
            const share = total > 0 && t.value != null ? (Math.max(0, t.value) / total) * 100 : null;
            return (
              <TooltipProvider key={t.key} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "min-w-0 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-4 space-y-2 cursor-help transition-shadow hover:shadow-md",
                      )}
                    >
                      <div className="flex items-center gap-2 h-8">
                        <div className={cn("h-8 rounded-lg flex items-center justify-center px-2", t.iconWrapClass)}>
                          {t.icon}
                        </div>
                        <span className="sr-only">{t.label}</span>

                      </div>
                      {isLoading ? (
                        <Skeleton className="h-7 w-24" />
                      ) : t.value == null ? (
                        <p className="text-sm text-muted-foreground italic">{t.notConnectedLabel ?? "Pas de données"}</p>
                      ) : (
                        <p className={cn("text-2xl font-bold tracking-tight truncate", t.valueClass)}>
                          {fmt(Math.max(0, t.value))}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{share != null ? `${share.toFixed(1)}% du CA` : "—"}</span>
                        {t.variation != null && !isLoading && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 font-medium",
                              t.variation >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {t.variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {t.variation > 0 ? "+" : ""}{t.variation.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {t.hint}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
