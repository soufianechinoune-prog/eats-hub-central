import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EFFICIENCY_COHORTS, SWEET_SPOT, groupByCohort, type AdsEfficiencyRow } from "@/lib/adsEfficiency";

const pct = (v: number | null, sign = false) => (v == null ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")} %`);
const eurx = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} €`);

export function AdsEfficiencyPanel({ rows, loading, curLabel, prevLabel }: { rows?: AdsEfficiencyRow[]; loading: boolean; curLabel: string; prevLabel: string }) {
  const cohorts = groupByCohort(rows ?? []);
  const best = cohorts.filter((c) => c.count >= 3 && c.growth != null).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0]?.key;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Rendement de la pub dans le réseau</CardTitle>
        <p className="text-xs text-muted-foreground">
          {curLabel} vs {prevLabel} · restaurants actifs sur les deux trimestres, groupés par ratio pub / CA · constat observé, pas une preuve de cause à effet
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cohorts.map((c) => {
          const meta = EFFICIENCY_COHORTS[c.key];
          const sweet = meta.min === SWEET_SPOT.min;
          return (
            <div key={c.key} className={`rounded-xl border p-4 space-y-2 ${c.key === best ? "border-success/50 bg-success/5" : "bg-muted/20"}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">{meta.label}</span>
                <span className="text-xs text-muted-foreground">{loading ? "…" : `${c.count} resto${c.count > 1 ? "s" : ""}`}</span>
              </div>
              <p className="text-xs text-muted-foreground">{meta.hint}{sweet ? " · repère réseau" : ""}</p>
              {loading ? <Skeleton className="h-16 w-full" /> : (
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Évolution CA</dt><dd className={`font-semibold tabular-nums ${c.growth == null ? "" : c.growth >= 0 ? "text-success" : "text-destructive"}`}>{pct(c.growth, true)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">CA gagné / € pub</dt><dd className="tabular-nums">{eurx(c.gainPerEuro)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Net en banque</dt><dd className="tabular-nums">{pct(c.netMargin)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Ratio moyen</dt><dd className="tabular-nums text-muted-foreground">{pct(c.pct)}</dd></div>
                </dl>
              )}
            </div>
          );
        })}
      </CardContent>
      <p className="px-6 pb-4 text-xs text-muted-foreground">Net en banque = (versement Uber − pub) ÷ CA net TTC. CA gagné / € pub = hausse de CA entre les deux trimestres ÷ pub dépensée.</p>
    </Card>
  );
}
