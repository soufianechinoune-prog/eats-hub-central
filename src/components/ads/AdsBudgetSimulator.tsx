import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import {
  ADS_SCENARIOS, fetchAdsSimulatorData, simulateAdsBudget,
  type AdsDecision, type AdsScenario, type AdsSimRow, type AdsStrategy,
} from "@/lib/adsBudgetSimulator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const eur = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)) + " €";
const signed = (v: number) => (v > 0.5 ? "+" : v < -0.5 ? "−" : "") + eur(Math.abs(v));
const compact = (v: number) => {
  const a = Math.abs(v), s = v > 0 ? "+" : v < 0 ? "−" : "";
  if (a >= 1e6) return s + (a / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€";
  if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString("fr-FR") + " k€";
  return s + Math.round(a) + " €";
};
const pct = (v: number, d = 1) => (v * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";

const DECISION: Record<AdsDecision, { label: string; cls: string; bar: string }> = {
  increase: { label: "Augmenter", cls: "bg-success/15 text-success", bar: "bg-success" },
  keep: { label: "Garder", cls: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40" },
  reduce: { label: "Baisser", cls: "bg-destructive/15 text-destructive", bar: "bg-destructive" },
};

type SortKey = "name" | "revenueWeek" | "adsWeekHt" | "ratio" | "salesPerExtraEuro" | "recommendedWeekHt" | "change";

export function AdsBudgetSimulator() {
  const { selectedChainId } = useAnalyticsContext();
  const [foodCost, setFoodCost] = useState(30);
  const [strategy, setStrategy] = useState<AdsStrategy>("reallocate");
  const [scenario, setScenario] = useState<AdsScenario>("realiste");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "change", desc: false });

  const chain = useQuery({
    queryKey: ["chain-name", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase.from("chains").select("name").eq("id", selectedChainId as string).maybeSingle();
      if (error) throw error;
      return data?.name ?? "";
    },
  });
  const sim = useQuery({
    queryKey: ["ads-budget-simulator", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: () => fetchAdsSimulatorData(selectedChainId as string),
    staleTime: 600000,
  });

  const result = useMemo(
    () => (sim.data ? simulateAdsBudget(sim.data.rows, { foodCost: foodCost / 100, elasticity: ADS_SCENARIOS[scenario].elasticity, strategy }) : null),
    [sim.data, foodCost, scenario, strategy],
  );

  const rows = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    const val = (r: AdsSimRow): number | string => {
      switch (sort.key) {
        case "name": return r.name;
        case "ratio": return r.revenueWeek ? r.adsWeekHt / r.revenueWeek : 0;
        case "salesPerExtraEuro": return r.salesPerExtraEuro ?? 999;
        case "change": return r.recommendedWeekHt - r.adsWeekHt;
        default: return r[sort.key];
      }
    };
    return result.rows
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.desc ? -1 : 1); });
  }, [result, search, sort]);

  if (!selectedChainId) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Choisissez une enseigne dans le menu en haut à gauche pour utiliser le simulateur de budget pub.
      </CardContent></Card>
    );
  }

  const rule = sim.data?.rule ?? null;
  const ratioNow = result && result.revenueWeek ? result.adsNowWeek / result.revenueWeek : 0;
  const ratioRec = result && result.revenueWeek ? result.adsRecommendedWeek / result.revenueWeek : 0;
  const salesChange = result && result.revenueWeek ? result.extraRevenueYear / 52 / result.revenueWeek : 0;
  const period = sim.data?.periodStart && sim.data?.periodEnd
    ? `${format(parseISO(sim.data.periodStart), "d MMM", { locale: fr })} au ${format(parseISO(sim.data.periodEnd), "d MMM yyyy", { locale: fr })}`
    : "";
  const total = result ? result.rows.length || 1 : 1;
  const SortHead = ({ k, children, right = true }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      <button type="button" className="hover:text-foreground" onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== "name" }))}>{children}</button>
    </th>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-uber" /> Où mettre chaque euro de pub ?</CardTitle>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Indiquez votre coût matière : pour chaque restaurant {chain.data ? `${chain.data} ` : ""}l'outil dit s'il faut augmenter, garder ou baisser la pub Uber.
          {period && ` Calcul sur les 12 dernières semaines complètes (${period}).`} Montants de pub en HT.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Réglages */}
        <div className="grid gap-5 lg:grid-cols-3 rounded-xl border p-4">
          <div className="space-y-3 min-w-0">
            <label htmlFor="ads-food-cost" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coût matière moyen</label>
            <p className="text-4xl font-bold text-uber tabular-nums">{foodCost} %</p>
            <Slider id="ads-food-cost" min={10} max={50} step={1} value={[foodCost]} onValueChange={(v) => setFoodCost(v[0])} aria-label="Coût matière moyen" />
            <p className="text-xs text-muted-foreground">Part du prix de vente HT qui part dans les ingrédients et l'emballage.</p>
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Que voulez-vous faire ?</p>
            <ToggleGroup type="single" value={strategy} onValueChange={(v) => v && setStrategy(v as AdsStrategy)} className="flex-wrap justify-start gap-2">
              <ToggleGroupItem value="reallocate" className="h-9 px-3 text-sm data-[state=on]:bg-uber/15 data-[state=on]:text-uber">Dépenser pareil, mais mieux</ToggleGroupItem>
              <ToggleGroupItem value="optimal" className="h-9 px-3 text-sm data-[state=on]:bg-uber/15 data-[state=on]:text-uber">Dépenser le bon montant</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {strategy === "reallocate"
                ? "La dépense totale ne change pas. On enlève de la pub aux restaurants où elle rapporte peu pour la donner à ceux où elle rapporte beaucoup."
                : "Chaque restaurant fait juste la pub qui rapporte. La dépense totale peut baisser ou monter."}
            </p>
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scénario</p>
            <ToggleGroup type="single" value={scenario} onValueChange={(v) => v && setScenario(v as AdsScenario)} className="flex-wrap justify-start gap-2">
              {(Object.keys(ADS_SCENARIOS) as AdsScenario[]).map((s) => (
                <ToggleGroupItem key={s} value={s} className="h-9 px-3 text-sm data-[state=on]:bg-uber/15 data-[state=on]:text-uber">{ADS_SCENARIOS[s].label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">On ne connaît jamais l'effet exact de la pub. « Réaliste » utilise ce que montre l'historique, les deux autres supposent un peu moins ou un peu plus d'effet. Si la décision reste la même dans les trois cas, elle est solide.</p>
          </div>
        </div>

        {/* Résultat */}
        {sim.isLoading || !result ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : sim.isError ? (
          <p className="text-sm text-destructive">Les données du simulateur n'ont pas pu être chargées. Rechargez la page ; si le problème continue, prévenez l'administrateur.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Part du CA mise en pub</p><p className="text-2xl font-bold tabular-nums mt-1">{pct(ratioRec, 2)}</p><p className="text-xs text-muted-foreground">aujourd'hui {pct(ratioNow, 2)}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Dépense pub par semaine</p><p className="text-2xl font-bold tabular-nums mt-1">{eur(result.adsRecommendedWeek)}</p><p className="text-xs text-muted-foreground">aujourd'hui {eur(result.adsNowWeek)} HT</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Ventes en plus par an</p><p className={`text-2xl font-bold tabular-nums mt-1 ${result.extraRevenueYear >= 0 ? "text-success" : "text-destructive"}`}>{compact(result.extraRevenueYear)}</p><p className="text-xs text-muted-foreground">si on applique les conseils</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Gain net par an</p><p className={`text-2xl font-bold tabular-nums mt-1 ${result.extraProfitYear >= 0 ? "text-success" : "text-destructive"}`}>{compact(result.extraProfitYear)}</p><p className="text-xs text-muted-foreground">ce qui reste, une fois payés Uber, les ingrédients et la pub</p></div>
            </div>

            {rule && (
              <div className="space-y-2">
                {ratioRec < rule.minAdsRatio ? (
                  <div className="flex gap-2 rounded-xl bg-warning/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                    <span><b>Attention au {rule.label} : la pub passerait sous {pct(rule.minAdsRatio, 0)} du CA ({pct(ratioRec, 2)}).</b> Le siège devrait alors payer plus de pub de son côté : environ {compact(rule.hqExtraRate * result.revenueWeek * 13).replace("+", "")} de plus par trimestre.</span></div>
                ) : (
                  <div className="flex gap-2 rounded-xl bg-success/10 p-3 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />
                    <span><b>{rule.label} respecté :</b> la pub reste au-dessus de {pct(rule.minAdsRatio, 0)} du CA ({pct(ratioRec, 2)}).</span></div>
                )}
                {rule.growthPenaltyEur != null && salesChange < -0.002 && (
                  <div className="flex gap-2 rounded-xl bg-warning/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                    <span><b>Attention, les ventes baisseraient de {pct(-salesChange)}.</b> Si les ventes Uber reculent sur un an, la commission augmente : environ {compact(rule.growthPenaltyEur).replace("+", "")} de plus par an.</span></div>
                )}
              </div>
            )}

            {/* Tableau */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <div className="flex h-2.5 w-64 max-w-full overflow-hidden rounded-full" aria-hidden="true">
                    {(["increase", "keep", "reduce"] as AdsDecision[]).map((d) => <span key={d} className={DECISION[d].bar} style={{ width: `${(100 * result.counts[d]) / total}%` }} />)}
                  </div>
                  <p className="text-xs text-muted-foreground">{result.counts.increase} à augmenter · {result.counts.keep} à garder · {result.counts.reduce} à baisser</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un restaurant" className="pl-8" aria-label="Chercher un restaurant" />
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <SortHead k="name" right={false}>Restaurant</SortHead>
                      <SortHead k="revenueWeek">CA / semaine</SortHead>
                      <SortHead k="adsWeekHt">Pub / semaine</SortHead>
                      <SortHead k="ratio">Part du CA</SortHead>
                      <SortHead k="salesPerExtraEuro">1 € de pub en plus fait vendre</SortHead>
                      <SortHead k="recommendedWeekHt">Pub conseillée</SortHead>
                      <SortHead k="change">Écart</SortHead>
                      <th className="px-3 py-2 text-right font-medium">Décision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const diff = r.recommendedWeekHt - r.adsWeekHt;
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(r.revenueWeek)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(r.adsWeekHt)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{pct(r.revenueWeek ? r.adsWeekHt / r.revenueWeek : 0)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.salesPerExtraEuro == null ? <span className="text-muted-foreground">pas de pub</span> : r.salesPerExtraEuro.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{eur(r.recommendedWeekHt)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${r.decision === "increase" ? "text-success" : r.decision === "reduce" ? "text-destructive" : "text-muted-foreground"}`}>{signed(diff)}</td>
                          <td className="px-3 py-2 text-right"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${DECISION[r.decision].cls}`}>{DECISION[r.decision].label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <details className="rounded-xl border p-4 text-sm">
              <summary className="cursor-pointer font-medium">Comment c'est calculé</summary>
              <ul className="mt-3 space-y-2 text-muted-foreground list-disc pl-5 max-w-3xl">
                <li>L'historique (10 882 semaines de restaurants analysées) montre qu'avec 10 % de pub en plus, un restaurant vend environ 0,45 % de plus. C'est vrai partout : un euro de pub en plus rapporte donc beaucoup chez un restaurant qui en fait peu, et peu chez un restaurant qui en fait déjà beaucoup.</li>
                <li>Ce qui reste sur chaque vente = prix de vente HT − commission Uber − ingrédients. La commission vient du versement réel de chaque restaurant.</li>
                <li>Pour éviter les conseils extrêmes, la pub conseillée reste entre la moitié et le double de la pub actuelle.</li>
                <li>Ce sont des estimations tirées du passé, à confirmer par un test sur quelques restaurants avant de tout changer.</li>
              </ul>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
