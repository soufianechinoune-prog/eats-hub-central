import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";

type Channel = "cash" | "uber" | "chataigne";
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "cash", label: "Caisse" },
  { id: "uber", label: "Uber Eats" },
  { id: "chataigne", label: "Châtaigne" },
];
const WINDOWS = [14, 30, 60];

const eur0 = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const eur2 = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n || 0);
const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
const signed = (n: number, f: (x: number) => string) => `${n >= 0 ? "+" : "−"}${f(Math.abs(n))}`;

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return <span className={v >= 0 ? "text-success" : "text-destructive"}>{v >= 0 ? "+" : ""}{v.toFixed(1)} %</span>;
}

interface Row { product: string; qb: number; rb: number; qa: number; ra: number }

const TIERS = [
  { id: "low", label: "Entrée de gamme (< 7 €)", test: (p: number) => p < 7 },
  { id: "mid", label: "Cœur de gamme (7–11 €)", test: (p: number) => p >= 7 && p <= 11 },
  { id: "high", label: "Haut de gamme (> 11 €)", test: (p: number) => p > 11 },
];

export default function ProductMix() {
  const { selectedRestaurants, selectedChainId } = useAnalyticsContext();
  const [channel, setChannel] = useState<Channel>("cash");
  const [launch, setLaunch] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [days, setDays] = useState(30);
  const [focus, setFocus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [metric, setMetric] = useState<"rev" | "qty" | "basket">("rev");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let q = supabase.from("restaurants").select("id").order("name");
      if (selectedChainId) q = q.eq("chain_id", selectedChainId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const ids = useMemo(() => {
    if (!restaurants) return undefined;
    const all = restaurants.map((r) => r.id);
    return resolveBrandScopedRestaurantIds({ selectedRestaurantIds: selectedRestaurants, selectedChainId, chainRestaurantIds: all }) ?? all;
  }, [restaurants, selectedRestaurants, selectedChainId]);
  const enabled = !!ids && ids.length > 0 && !!launch;
  const params = { p_channel: channel, p_restaurant_ids: ids ?? [], p_launch: launch, p_days: days };

  const products = useQuery({
    queryKey: ["mix-products", params],
    enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_product_mix_diagnostic", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r): Row => ({
        product: r.product, qb: Number(r.qty_before) || 0, rb: Number(r.rev_before) || 0, qa: Number(r.qty_after) || 0, ra: Number(r.rev_after) || 0,
      }));
    },
  });
  const totals = useQuery({
    queryKey: ["mix-totals", params],
    enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_product_mix_totals", params);
      if (error) throw error;
      const r = (data ?? [])[0] ?? {};
      return { tb: Number(r.tickets_before) || 0, rb: Number(r.rev_before) || 0, ta: Number(r.tickets_after) || 0, ra: Number(r.rev_after) || 0 };
    },
  });

  const bridge = useMemo(() => {
    const t = totals.data;
    if (!t || t.tb === 0 || t.ta === 0) return null;
    const b0 = t.rb / t.tb, b1 = t.ra / t.ta;
    const volume = (t.ta - t.tb) * b0;
    const basket = (b1 - b0) * t.ta;
    return { ...t, b0, b1, volume, basket, delta: t.ra - t.rb };
  }, [totals.data]);

  const waterfall = useMemo(() => {
    if (!bridge) return [];
    const { rb, volume, basket, ra } = bridge;
    return [
      { name: "CA avant", base: 0, value: rb, kind: "total" },
      { name: "Effet volume", base: volume >= 0 ? rb : rb + volume, value: Math.abs(volume), kind: volume >= 0 ? "up" : "down" },
      { name: "Effet panier / mix", base: basket >= 0 ? rb + volume : rb + volume + basket, value: Math.abs(basket), kind: basket >= 0 ? "up" : "down" },
      { name: "CA après", base: 0, value: ra, kind: "total" },
    ];
  }, [bridge]);

  const rows = useMemo(() => {
    const all = products.data ?? [];
    const sb = all.reduce((a, r) => a + r.rb, 0), sa = all.reduce((a, r) => a + r.ra, 0);
    return all.map((r) => ({ ...r, shareB: sb > 0 ? (r.rb / sb) * 100 : 0, shareA: sa > 0 ? (r.ra / sa) * 100 : 0, dRev: r.ra - r.rb }));
  }, [products.data]);

  const tiers = useMemo(() => {
    const sb = rows.reduce((a, r) => a + r.qb, 0), sa = rows.reduce((a, r) => a + r.qa, 0);
    return TIERS.map((t) => {
      const inT = rows.filter((r) => {
        const q = r.qa + r.qb; const rev = r.ra + r.rb;
        return q > 0 && t.test(rev / q);
      });
      const qb = inT.reduce((a, r) => a + r.qb, 0), qa = inT.reduce((a, r) => a + r.qa, 0);
      return { label: t.label, before: sb > 0 ? (qb / sb) * 100 : 0, after: sa > 0 ? (qa / sa) * 100 : 0 };
    });
  }, [rows]);

  const focusRow = rows.find((r) => r.product === focus) ?? null;
  const cannib = useMemo(() => {
    if (!focusRow) return null;
    const gain = focusRow.qa - focusRow.qb;
    const others = rows.filter((r) => r.product !== focus);
    const lost = others.reduce((a, r) => a + Math.min(0, r.qa - r.qb), 0);
    return { gain, lost: -lost, rate: gain > 0 ? Math.min(100, (-lost / gain) * 100) : null };
  }, [focusRow, rows, focus]);

  const q = search.trim().toLowerCase();
  const tableRows = [...rows]
    .filter((r) => !q || r.product.toLowerCase().includes(q))
    .sort((a, b) => Math.abs(b.dRev) - Math.abs(a.dRev))
    .slice(0, 50);

  const loading = products.isLoading || totals.isLoading;

  const toggleExcluded = (p: string) => setExcluded((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]));
  const daily = useQuery({
    queryKey: ["mix-daily", params, excluded],
    enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_product_mix_daily", { ...params, p_products: excluded });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        d: String(r.d), ra: Number(r.rev_all) || 0, qa: Number(r.qty_all) || 0, rs: Number(r.rev_sel) || 0, qs: Number(r.qty_sel) || 0, t: Number(r.tickets) || 0,
      }));
    },
  });
  const curve = useMemo(() => (daily.data ?? []).map((r) => {
    const label = format(new Date(r.d), "dd/MM");
    if (metric === "rev") return { label, real: r.ra, without: r.ra - r.rs };
    if (metric === "qty") return { label, real: r.qa, without: r.qa - r.qs };
    return { label, real: r.t > 0 ? r.ra / r.t : null, without: r.t > 0 ? (r.ra - r.rs) / r.t : null };
  }), [daily.data, metric]);
  const weight = useMemo(() => {
    const a = daily.data ?? [];
    const ra = a.reduce((s, r) => s + r.ra, 0), rs = a.reduce((s, r) => s + r.rs, 0);
    const qa = a.reduce((s, r) => s + r.qa, 0), qs = a.reduce((s, r) => s + r.qs, 0);
    const t = a.reduce((s, r) => s + r.t, 0);
    if (ra === 0) return null;
    return { revSel: rs, qtySel: qs, revShare: (rs / ra) * 100, qtyShare: qa > 0 ? (qs / qa) * 100 : 0, basketContribution: t > 0 ? rs / t : 0 };
  }, [daily.data]);

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Mix produit & nouveautés</h1>
            <p className="text-muted-foreground">
              Avant / après une date clé (lancement, changement de prix) : la hausse vient-elle du volume ou du panier ?
            </p>
          </div>
          <AnalyticsHeader />

          <Card>
            <CardContent className="pt-6 flex flex-wrap items-end gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Canal</p>
                <div className="flex gap-1">
                  {CHANNELS.map((c) => (
                    <Button key={c.id} size="sm" variant={channel === c.id ? "default" : "outline"} onClick={() => { setChannel(c.id); setFocus(null); }}>
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Date de lancement</p>
                <Input type="date" value={launch} onChange={(e) => setLaunch(e.target.value)} className="w-44" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Fenêtre avant / après</p>
                <div className="flex gap-1">
                  {WINDOWS.map((w) => (
                    <Button key={w} size="sm" variant={days === w ? "default" : "outline"} onClick={() => setDays(w)}>{w} j</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : !bridge ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Pas assez de données sur ce canal pour les deux périodes.</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">CA</p>
                  <p className="text-2xl font-bold">{eur0(bridge.ra)}</p>
                  <p className="text-xs text-muted-foreground">vs {eur0(bridge.rb)} avant · <Delta v={pct(bridge.ra, bridge.rb)} /></p>
                </CardContent></Card>
                <Card><CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Commandes</p>
                  <p className="text-2xl font-bold">{int(bridge.ta)}</p>
                  <p className="text-xs text-muted-foreground">vs {int(bridge.tb)} avant · <Delta v={pct(bridge.ta, bridge.tb)} /></p>
                </CardContent></Card>
                <Card><CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Panier moyen</p>
                  <p className="text-2xl font-bold">{eur2(bridge.b1)}</p>
                  <p className="text-xs text-muted-foreground">vs {eur2(bridge.b0)} avant · <Delta v={pct(bridge.b1, bridge.b0)} /></p>
                </CardContent></Card>
                <Card><CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Lecture</p>
                  <p className="text-sm font-medium mt-1">
                    {bridge.volume > 0 && bridge.basket < 0
                      ? "Effet volume pur : plus de commandes, mais un panier qui se dilue."
                      : bridge.volume > 0 && bridge.basket >= 0
                      ? "Cercle vertueux : volume et panier progressent."
                      : bridge.volume <= 0 && bridge.basket > 0
                      ? "Effet prix / premium : moins de commandes, panier plus élevé."
                      : "Zone rouge : volume et panier reculent."}
                  </p>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">D'où vient l'écart de CA ?</CardTitle>
                  <CardDescription>
                    Effet volume {signed(bridge.volume, eur0)} (commandes en plus au panier d'avant) · effet panier / mix {signed(bridge.basket, eur0)} · total {signed(bridge.delta, eur0)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfall}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)} k€`} />
                      <ReTooltip formatter={(v: any, n: any) => (n === "base" ? null : [eur0(Number(v)), "Montant"])} />
                      <Bar dataKey="base" stackId="a" fill="transparent" />
                      <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                        {waterfall.map((w, i) => (
                          <Cell key={i} fill={w.kind === "total" ? "hsl(var(--chart-1))" : w.kind === "up" ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Réel vs hors produits exclus</CardTitle>
                <CardDescription>
                  {excluded.length === 0
                    ? "Cochez « Exclure » sur un ou plusieurs produits dans le tableau du bas pour voir la courbe sans eux."
                    : `${excluded.length} produit(s) exclu(s) : ${excluded.slice(0, 3).join(", ")}${excluded.length > 3 ? "…" : ""}`}
                </CardDescription>
              </div>
              <div className="flex gap-1 shrink-0">
                {([["rev", "CA"], ["qty", "Articles"], ["basket", "Panier moyen"]] as const).map(([id, l]) => (
                  <Button key={id} size="sm" variant={metric === id ? "default" : "outline"} onClick={() => setMetric(id)}>{l}</Button>
                ))}
                {excluded.length > 0 && <Button size="sm" variant="ghost" onClick={() => setExcluded([])}>Tout réinclure</Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {excluded.length > 0 && weight && (
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Poids dans le CA</p><p className="text-lg font-semibold">{weight.revShare.toFixed(1)} %</p><p className="text-xs text-muted-foreground">{eur0(weight.revSel)} sur la période</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Poids dans les articles vendus</p><p className="text-lg font-semibold">{weight.qtyShare.toFixed(1)} %</p><p className="text-xs text-muted-foreground">{int(weight.qtySel)} articles</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Apport au panier moyen</p><p className="text-lg font-semibold">{eur2(weight.basketContribution)}</p><p className="text-xs text-muted-foreground">par commande, en moyenne</p></div>
                </div>
              )}
              <div className="h-[300px]">
                {daily.isLoading ? <Skeleton className="h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curve}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => metric === "rev" ? `${Math.round(Number(v) / 1000)} k€` : metric === "basket" ? `${Number(v).toFixed(0)} €` : int(Number(v))} />
                      <ReTooltip formatter={(v: any, n: any) => [metric === "rev" ? eur0(Number(v)) : metric === "basket" ? eur2(Number(v)) : int(Number(v)), n]} />
                      <Legend />
                      <ReferenceLine x={format(new Date(launch), "dd/MM")} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "Lancement", fontSize: 11 }} />
                      <Line type="monotone" dataKey="real" name="Réel" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      {excluded.length > 0 && <Line type="monotone" dataKey="without" name="Hors produits exclus" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              {metric === "basket" && <p className="text-xs text-muted-foreground">Panier « hors produits » = ce que chaque commande rapporte sans ces produits (nombre de commandes inchangé).</p>}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mix par gamme de prix</CardTitle>
                <CardDescription>Part des quantités vendues selon le prix moyen de l'article</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tiers.map((t) => (
                  <div key={t.label} className="flex items-center justify-between text-sm">
                    <span>{t.label}</span>
                    <span className="tabular-nums">
                      {t.before.toFixed(1)} % → <strong>{t.after.toFixed(1)} %</strong>{" "}
                      <span className={t.after - t.before >= 0 ? "text-success" : "text-destructive"}>
                        ({t.after - t.before >= 0 ? "+" : ""}{(t.after - t.before).toFixed(1)} pt)
                      </span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Produit suivi</CardTitle>
                <CardDescription>{focusRow ? focusRow.product : "Cliquez sur un produit dans le tableau pour mesurer son impact"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {focusRow && cannib ? (
                  <>
                    <div className="flex justify-between"><span>Quantités</span><span className="tabular-nums">{int(focusRow.qb)} → <strong>{int(focusRow.qa)}</strong></span></div>
                    <div className="flex justify-between"><span>CA</span><span className="tabular-nums">{eur0(focusRow.rb)} → <strong>{eur0(focusRow.ra)}</strong></span></div>
                    <div className="flex justify-between"><span>Part du CA</span><span className="tabular-nums">{focusRow.shareB.toFixed(1)} % → <strong>{focusRow.shareA.toFixed(1)} %</strong></span></div>
                    <div className="flex justify-between"><span>Ventes perdues sur les autres produits</span><span className="tabular-nums">{int(cannib.lost)}</span></div>
                    <div className="flex justify-between"><span>Cannibalisation estimée</span><span className="tabular-nums font-semibold">{cannib.rate != null ? `${cannib.rate.toFixed(0)} %` : "—"}</span></div>
                    <p className="text-xs text-muted-foreground pt-1">Estimation : ventes perdues par les autres produits rapportées aux ventes gagnées par ce produit.</p>
                  </>
                ) : <p className="text-muted-foreground">Aucun produit sélectionné.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Produits qui bougent le plus</CardTitle>
                <CardDescription>Classés par écart de CA entre les deux périodes (50 premiers)</CardDescription>
              </div>
              <Input placeholder="Rechercher un produit" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {products.isLoading ? <Skeleton className="h-40" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Exclure</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté avant</TableHead>
                      <TableHead className="text-right">Qté après</TableHead>
                      <TableHead className="text-right">Var. qté</TableHead>
                      <TableHead className="text-right">CA après</TableHead>
                      <TableHead className="text-right">Écart CA</TableHead>
                      <TableHead className="text-right">Part du CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((r) => (
                      <TableRow key={r.product} className={`cursor-pointer ${focus === r.product ? "bg-muted" : ""}`} onClick={() => setFocus(r.product)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={excluded.includes(r.product)} onCheckedChange={() => toggleExcluded(r.product)} aria-label={`Exclure ${r.product}`} />
                        </TableCell>
                        <TableCell className="font-medium">{r.product}{r.qb === 0 && r.qa > 0 && <span className="ml-2 text-xs text-primary">Nouveau</span>}</TableCell>
                        <TableCell className="text-right">{int(r.qb)}</TableCell>
                        <TableCell className="text-right">{int(r.qa)}</TableCell>
                        <TableCell className="text-right"><Delta v={pct(r.qa, r.qb)} /></TableCell>
                        <TableCell className="text-right">{eur0(r.ra)}</TableCell>
                        <TableCell className={`text-right ${r.dRev >= 0 ? "text-success" : "text-destructive"}`}>{signed(r.dRev, eur0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.shareB.toFixed(1)} → {r.shareA.toFixed(1)} %</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
