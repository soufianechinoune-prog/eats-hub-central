import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Scale, TrendingUp, Users } from "lucide-react";
import { computeIncrementalAll, TWIN_COUNT, type IncrementalResult } from "@/lib/adsIncremental";
import type { AdsEfficiencyRow } from "@/lib/adsEfficiency";

const eur = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const signed = (v: number) => `${v > 0 ? "+" : ""}${eur(v)}`;

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <UiTooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Explication" className="text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  );
}

/**
 * Panneau « Impact incrémental de la pub » : chaque restaurant est comparé à
 * ses 5 jumeaux (plus proches en taille), dont on prend la médiane de la
 * croissance du versement comme contrefactuel.
 */
export function AdsIncrementalPanel({ rows, loading, curLabel, prevLabel }: { rows?: AdsEfficiencyRow[]; loading: boolean; curLabel: string; prevLabel: string }) {
  const results = useMemo(() => computeIncrementalAll(rows ?? []), [rows]);
  const treated = useMemo(
    () => [...results.values()].filter((r) => r.incremental != null && (rows?.find((x) => x.restaurant_id === r.restaurantId)?.ads_ht ?? 0) > 0),
    [results, rows],
  );
  const totalIncremental = treated.reduce((s, r) => s + (r.incremental ?? 0), 0);
  const totalAds = treated.reduce((s, r) => s + (Number(rows?.find((x) => x.restaurant_id === r.restaurantId)?.ads_ht) || 0), 0);
  const networkRoas = totalAds > 0 ? totalIncremental / totalAds : null;
  const positive = treated.filter((r) => (r.incremental ?? 0) > 0).length;
  const medianGrowth = useMemo(() => {
    const gs = treated.map((r) => r.twinsGrowth).filter((g): g is number => g != null).sort((a, b) => a - b);
    if (!gs.length) return null;
    const m = Math.floor(gs.length / 2);
    return gs.length % 2 ? gs[m] : (gs[m - 1] + gs[m]) / 2;
  }, [treated]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-1.5">
          Impact incrémental de la pub
          <InfoTip text={`Chaque restaurant est comparé à ses ${TWIN_COUNT} « jumeaux » (les plus proches en taille). On calcule la médiane de la croissance de leur versement, puis on compare le versement réel du restaurant à ce qu'il aurait versé en grandissant au même rythme. La médiane évite qu'un seul témoin atypique ne fausse le résultat.`} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {curLabel} vs {prevLabel} · versement réel comparé au contrefactuel des jumeaux · restaurants qui font de la pub
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Versement incrémental du réseau</p>
          {loading ? <Skeleton className="h-9 w-28 mt-2" /> : (
            <p className={`text-3xl font-bold mt-1 ${totalIncremental >= 0 ? "text-success" : "text-destructive"}`}>{signed(totalIncremental)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">au-delà de la croissance des jumeaux, sur {treated.length} annonceurs</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Versement gagné par € de pub</p>
          {loading ? <Skeleton className="h-9 w-28 mt-2" /> : (
            <p className={`text-3xl font-bold mt-1 ${networkRoas == null ? "" : networkRoas >= 0 ? "text-success" : "text-destructive"}`}>
              {networkRoas == null ? "—" : `${networkRoas >= 0 ? "+" : ""}${networkRoas.toFixed(2).replace(".", ",")} €`}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">incrémental total ÷ pub investie · positif = la pub a créé du versement net</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Annonceurs au-dessus de leurs jumeaux</p>
          {loading ? <Skeleton className="h-9 w-28 mt-2" /> : (
            <p className="text-3xl font-bold mt-1">{positive}<span className="text-base text-muted-foreground font-medium"> / {treated.length}</span></p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            croissance médiane des jumeaux : {medianGrowth == null ? "—" : `${medianGrowth >= 0 ? "+" : ""}${(medianGrowth * 100).toFixed(1).replace(".", ",")} %`}
          </p>
        </div>
      </CardContent>
      <p className="px-6 pb-4 text-xs text-muted-foreground">
        Lecture : un versement incrémental positif signifie que le restaurant a versé plus que ce que laissait attendre la tendance de restaurants comparables. Constat observé, pas une preuve de cause à effet.
      </p>
    </Card>
  );
}

export type { IncrementalResult };
