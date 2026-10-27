import { Megaphone, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UberEatsLogo } from "@/components/icons/PlatformIcons";
import { ADS_RATIO_MODES, type AdsRatioMode } from "@/lib/adsRatioModes";

interface AdsRevenueRatioCardProps {
  adsSpend: number;
  revenue: number;
  pct: number | null;
  isLoading?: boolean;
  periodLabel?: string;
  mode: AdsRatioMode;
  onModeChange: (m: AdsRatioMode) => void;
}

const formatEuro = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " €";

export function AdsRevenueRatioCard({
  adsSpend, revenue, pct, isLoading, periodLabel, mode, onModeChange,
}: AdsRevenueRatioCardProps) {
  const meta = ADS_RATIO_MODES[mode];
  const adsTax = "HT";
  const revTax = mode === "comptable" ? "HT" : "TTC";
  const revLabel = mode === "comptable" ? "de ventes HT" : "de CA net TTC";
  return (
    <Card className="border-2 border-uber/30 shadow-lg bg-gradient-to-br from-card via-card to-uber/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-uber/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-uber" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Dépenses pub / CA
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    {meta.hint} CA net = ventes moins promotions articles.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <div className="flex items-center gap-2 mt-0.5">
              <UberEatsLogo size={12} />
              <p className="text-xs text-muted-foreground">
                Uber Eats{periodLabel ? ` · ${periodLabel}` : ""}
              </p>
            </div>
          </div>
        </div>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && onModeChange(v as AdsRatioMode)}
          className="mt-3 justify-start gap-1"
          size="sm"
        >
          {(Object.keys(ADS_RATIO_MODES) as AdsRatioMode[]).map((k) => (
            <ToggleGroupItem
              key={k}
              value={k}
              className="h-7 px-2 text-xs data-[state=on]:bg-uber/15 data-[state=on]:text-uber"
            >
              {ADS_RATIO_MODES[k].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : pct == null ? (
          <div className="text-muted-foreground text-sm py-3">Aucune donnée disponible sur la période</div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-4xl font-bold tracking-tight text-uber">
                {pct.toFixed(2).replace(".", ",")} %
              </div>
              <div className="text-right text-xs text-muted-foreground leading-snug">
                <div>
                  <span className="font-semibold text-foreground">{formatEuro(adsSpend)}</span> de pub {adsTax}
                </div>
                <div>
                  sur <span className="font-semibold text-foreground">{formatEuro(revenue)}</span> de CA net {revTax}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{meta.short}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
