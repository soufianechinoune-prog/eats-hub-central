import { TrendingDown, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export type QuarterStat = { q: number; ads: number; revenue: number; pct: number | null; future: boolean; loading: boolean };

const eur = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const dm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const DAY = 86400000;
/** Bornes du trimestre et avancement à date (jours écoulés inclus aujourd'hui). */
export function quarterProgress(year: number, q: number, today = new Date()) {
  const start = new Date(year, (q - 1) * 3, 1);
  const end = new Date(year, q * 3, 0);
  const total = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const inProgress = t >= start && t <= end;
  const elapsed = inProgress ? Math.round((t.getTime() - start.getTime()) / DAY) + 1 : total;
  return { start, end, total, elapsed, inProgress, lastDay: inProgress ? t : end };
}

const pctFmt = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ",") + " %");

/** 4 vignettes trimestrielles ; l'écart est calculé vs le trimestre précédent (base du budget pub suivant). */
export function AdsQuarterCards({ year, onYearChange, stats, prevQ4, activeQ, onSelect, maxYear }: {
  year: number; onYearChange: (y: number) => void; stats: QuarterStat[]; prevQ4: QuarterStat | null;
  activeQ?: number | null; onSelect?: (q: number) => void; maxYear: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Trimestres {year}</h2>
          <p className="text-xs text-muted-foreground">Le budget pub d'un trimestre se cale sur le trimestre précédent</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onYearChange(year - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium tabular-nums w-12 text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={year >= maxYear} onClick={() => onYearChange(year + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => {
          const before = i === 0 ? prevQ4 : stats[i - 1];
          const delta = s.pct != null && before?.pct != null && !before.future ? s.pct - before.pct : null;
          const active = activeQ === s.q;
          const p = quarterProgress(year, s.q);
          return (
            <Card key={s.q} onClick={() => !s.future && onSelect?.(s.q)}
              className={`transition-colors ${s.future ? "opacity-50" : onSelect ? "cursor-pointer hover:border-uber/50" : ""} ${active ? "border-2 border-uber bg-uber/5" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-wide text-uber">Q{s.q}</span>
                    {p.inProgress && <span className="text-[10px] font-medium rounded-full bg-uber/10 text-uber px-1.5 py-0.5">En cours</span>}
                  </div>
                  {delta != null && (
                    <span className="text-[11px] flex items-center gap-0.5 text-muted-foreground">
                      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {delta > 0 ? "+" : ""}{delta.toFixed(2).replace(".", ",")} pt
                    </span>
                  )}
                </div>
                {s.future ? <p className="text-sm text-muted-foreground mt-3">À venir</p> : s.loading ? <Skeleton className="h-8 w-20 mt-2" /> : (
                  <>
                    <p className="text-2xl font-bold mt-1 tabular-nums">{pctFmt(s.pct)}</p>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">{eur(s.ads)} pub · {eur(s.revenue)} CA</p>
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {dm(p.start)} – {dm(p.lastDay)} · {p.inProgress ? `${p.elapsed} j / ${p.total}` : `${p.total} j`}
                    </p>
                    {p.inProgress && (
                      <>
                        <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden"><div className="h-full bg-uber" style={{ width: `${(p.elapsed / p.total) * 100}%` }} /></div>
                        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                          Rythme ~{eur(s.ads / p.elapsed)}/j · projeté ~{eur((s.ads / p.elapsed) * p.total)}
                        </p>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
