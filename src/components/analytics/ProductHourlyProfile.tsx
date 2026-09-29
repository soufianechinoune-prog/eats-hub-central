import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, subDays } from "date-fns";
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

// Coupes de service (heure Paris). La nuit (0h-4h) est ramenée en fin d'axe.
const SLOTS = [
  { label: "Déjeuner", from: 11, to: 15 },
  { label: "Après-midi", from: 15, to: 18 },
  { label: "Dîner", from: 18, to: 22 },
  { label: "Soirée", from: 22, to: 24 },
  { label: "Nuit", from: 24, to: 28 },
];
const HOURS = Array.from({ length: 24 }, (_, i) => (i + 5) % 24); // 5h → 4h
const axisPos = (h: number) => (h < 5 ? h + 24 : h);
const slotOf = (h: number) => SLOTS.find((s) => axisPos(h) >= s.from && axisPos(h) < s.to)?.label ?? "Matin";

interface Props {
  chainId: string | null;
  restaurantIds: string[];
  products: string[];
  colors: string[];
  launch: string;
}

export function ProductHourlyProfile({ chainId, restaurantIds, products, colors, launch }: Props) {
  const [period, setPeriod] = useState<"before" | "after">("after");
  const [metric, setMetric] = useState<"qty" | "profile">("profile");
  const from = period === "after" ? launch : format(subDays(new Date(launch), 14), "yyyy-MM-dd");
  const to = period === "after" ? format(addDays(new Date(launch), 13), "yyyy-MM-dd") : format(subDays(new Date(launch), 1), "yyyy-MM-dd");

  const q = useQuery({
    queryKey: ["mix-hourly", chainId, restaurantIds, from, to, products],
    enabled: !!chainId && restaurantIds.length > 0 && products.length > 0,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_product_mix_hourly_v2", {
        p_chain_id: chainId, p_restaurant_ids: restaurantIds, p_from: from, p_to: to, p_products: products,
      });
      if (error) throw error;
      return (data ?? []) as { product: string; hour: number; qty: number; revenue: number; tickets: number }[];
    },
  });

  const { chart, slotTable } = useMemo(() => {
    const rows = q.data ?? [];
    const totals = new Map<string, number>();
    rows.forEach((r) => r.product !== "__all__" && totals.set(r.product, (totals.get(r.product) ?? 0) + Number(r.qty)));
    const chart = HOURS.map((h) => {
      const row: Record<string, number | string | null> = { h, label: `${h}h`, x: axisPos(h) };
      row.tickets = Number(rows.find((r) => r.product === "__all__" && r.hour === h)?.tickets ?? 0);
      products.forEach((p, i) => {
        const v = Number(rows.find((r) => r.product === p && r.hour === h)?.qty ?? 0);
        const t = totals.get(p) ?? 0;
        row[`p${i}`] = metric === "qty" ? v : t > 0 ? (v / t) * 100 : 0;
      });
      return row;
    });
    const slotTable = products.map((p) => {
      const t = totals.get(p) ?? 0;
      const by: Record<string, number> = {};
      rows.filter((r) => r.product === p).forEach((r) => { const s = slotOf(r.hour); by[s] = (by[s] ?? 0) + Number(r.qty); });
      let peak = -1, peakQ = -1;
      rows.filter((r) => r.product === p).forEach((r) => { if (Number(r.qty) > peakQ) { peakQ = Number(r.qty); peak = r.hour; } });
      return { p, t, by, peak };
    });
    return { chart, slotTable };
  }, [q.data, products, metric]);

  const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profil horaire des produits (Caisse)</CardTitle>
        <CardDescription>
          À quelle heure se vendent les produits sélectionnés, découpé par service. Du {format(new Date(from), "dd/MM")} au {format(new Date(to), "dd/MM")} (14 jours).
        </CardDescription>
        <div className="flex flex-wrap gap-4 pt-2">
          <div className="flex gap-1">
            <Button size="sm" variant={period === "before" ? "default" : "outline"} onClick={() => setPeriod("before")}>14 j avant lancement</Button>
            <Button size="sm" variant={period === "after" ? "default" : "outline"} onClick={() => setPeriod("after")}>14 j après lancement</Button>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={metric === "profile" ? "default" : "outline"} onClick={() => setMetric("profile")}>% de ses ventes</Button>
            <Button size="sm" variant={metric === "qty" ? "default" : "outline"} onClick={() => setMetric("qty")}>Volume</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cochez des produits dans le comparateur ci-dessus pour voir leur profil horaire.</p>
        ) : q.isLoading ? (
          <Skeleton className="h-72" />
        ) : q.isError ? (
          <p className="text-sm text-muted-foreground">Calcul trop long sur ce périmètre. Réduisez le nombre de restaurants ou réessayez.</p>
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  {SLOTS.map((s, i) => (
                    <ReferenceArea key={s.label} yAxisId="l" x1={s.from} x2={s.to - 1} fill={i % 2 ? "hsl(var(--muted))" : "hsl(var(--accent))"} fillOpacity={0.35}
                      label={{ value: s.label, position: "insideTop", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  ))}
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="x" type="number" domain={[5, 28]} ticks={HOURS.map(axisPos)} tickFormatter={(x) => `${x % 24}h`} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} tickFormatter={(v) => (metric === "qty" ? nf(v) : `${v.toFixed(0)} %`)} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickFormatter={nf} />
                  <Tooltip
                    labelFormatter={(x) => `${Number(x) % 24}h – ${(Number(x) + 1) % 24}h`}
                    formatter={(v: number, n: string) => [n === "Tickets (tous produits)" ? nf(v) : metric === "qty" ? nf(v) : `${v.toFixed(1)} %`, n]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="r" dataKey="tickets" name="Tickets (tous produits)" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} strokeWidth={1} />
                  {products.map((p, i) => (
                    <Line key={p} yAxisId="l" dataKey={`p${i}`} name={p} stroke={colors[i]} dot={false} strokeWidth={2} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Heure de pointe</TableHead>
                  {["Matin", ...SLOTS.map((s) => s.label)].map((s) => <TableHead key={s} className="text-right">{s}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {slotTable.map((r, i) => (
                  <TableRow key={r.p}>
                    <TableCell className="font-medium"><span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: colors[i] }} />{r.p}</TableCell>
                    <TableCell className="text-right">{r.peak >= 0 ? `${r.peak}h` : "—"}</TableCell>
                    {["Matin", ...SLOTS.map((s) => s.label)].map((s) => (
                      <TableCell key={s} className="text-right tabular-nums">
                        {r.t > 0 ? `${(((r.by[s] ?? 0) / r.t) * 100).toFixed(0)} %` : "—"}
                        <span className="block text-xs text-muted-foreground">{nf(r.by[s] ?? 0)}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
