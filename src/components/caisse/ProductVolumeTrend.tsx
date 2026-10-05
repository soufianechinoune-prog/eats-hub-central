import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { format, getISOWeek, startOfISOWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
const varPct = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);
const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--primary))"];
const MAX_SEL = 6;
type Gran = "day" | "week" | "month";

function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return <span className={cn(value >= 0 ? "text-success" : "text-destructive", className)}>{value >= 0 ? "+" : ""}{value.toFixed(1)} %</span>;
}

function bucketOf(date: string, g: Gran) {
  const d = new Date(date + "T12:00:00");
  if (g === "day") return { key: date, label: format(d, "dd MMM", { locale: fr }) };
  if (g === "week") { const s = startOfISOWeek(d); return { key: format(s, "yyyy-MM-dd"), label: `S${getISOWeek(d)}` }; }
  return { key: format(d, "yyyy-MM"), label: format(d, "MMM yy", { locale: fr }) };
}

interface Props { ids: string[] | undefined; start: string; end: string; gran: Gran }

export function ProductVolumeTrend({ ids, start, end, gran }: Props) {
  const [prodSearch, setProdSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const enabled = !!ids && ids.length > 0;
  const params = { p_restaurant_ids: ids ?? [], p_start: start, p_end: end };

  const products = useQuery({
    queryKey: ["caisse-product-volume-list", start, end, ids], enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_product_volume_list", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ product: r.product as string, q: Number(r.qty) || 0, pq: Number(r.prev_qty) || 0 }));
    },
  });
  const series = useQueries({
    queries: selected.map((p) => ({
      queryKey: ["caisse-product-volume-daily", start, end, ids, p], enabled, retry: false,
      queryFn: async () => {
        const { data, error } = await (supabase as any).rpc("get_caisse_product_volume_daily", { ...params, p_product: p });
        if (error) throw error;
        return ((data ?? []) as any[]).map((x) => ({ date: String(x.date), q: Number(x.qty) || 0, pq: Number(x.prev_qty) || 0 }));
      },
    })),
  });

  const prodChart = useMemo(() => {
    const m = new Map<string, any>();
    series.forEach((s, i) => (s.data ?? []).forEach((x) => {
      const { key, label } = bucketOf(x.date, gran);
      const row = m.get(key) ?? { key, label };
      row[`p${i}`] = (row[`p${i}`] ?? 0) + x.q;
      row[`p${i}_prev`] = (row[`p${i}_prev`] ?? 0) + x.pq;
      m.set(key, row);
    }));
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [series, gran]);

  const prodList = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return (products.data ?? []).filter((p) => !q || p.product.toLowerCase().includes(q)).slice(0, 40);
  }, [products.data, prodSearch]);
  const toggle = (p: string) => setSelected((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : xs.length >= MAX_SEL ? xs : [...xs, p]));
  const prodInfo = (p: string) => (products.data ?? []).find((x) => x.product === p);
  const granLabel = gran === "day" ? "jour" : gran === "week" ? "semaine" : "mois";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendance par produit</CardTitle>
        <CardDescription>Choisissez jusqu'à {MAX_SEL} produits : articles vendus par {granLabel}, N vs N-1 (pointillés).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un produit" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="max-h-[320px] space-y-0.5 overflow-y-auto pr-1">
            {products.isLoading ? <Skeleton className="h-40" /> : prodList.map((p) => {
              const i = selected.indexOf(p.product);
              return (
                <button key={p.product} onClick={() => toggle(p.product)}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted", i >= 0 && "bg-muted font-medium")}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: i >= 0 ? COLORS[i] : "hsl(var(--border))" }} />
                    <span className="truncate">{p.product}</span>
                  </span>
                  <Delta value={varPct(p.q, p.pq)} className="shrink-0 text-xs" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          {selected.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Sélectionnez un produit dans la liste pour afficher sa courbe.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {selected.map((p, i) => {
                  const info = prodInfo(p);
                  return (
                    <Badge key={p} variant="outline" className="gap-2 py-1 pl-2 pr-1 font-normal">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                      {p}
                      {info && <span className="tabular-nums text-muted-foreground">{int(info.q)}</span>}
                      {info && <Delta value={varPct(info.q, info.pq)} className="text-xs" />}
                      <button onClick={() => toggle(p)} className="rounded p-0.5 hover:bg-muted" aria-label={`Retirer ${p}`}><X className="h-3 w-3" /></button>
                    </Badge>
                  );
                })}
              </div>
              <div className="h-[280px]">
                {series.some((s) => s.isLoading) ? <Skeleton className="h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prodChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => int(Number(v))} width={55} />
                      <ReTooltip formatter={(v: any, n: any) => [int(Number(v)), n]} />
                      {selected.map((p, i) => (
                        <Line key={p} type="monotone" dataKey={`p${i}`} name={p} stroke={COLORS[i]} strokeWidth={2} dot={false} />
                      ))}
                      {selected.map((p, i) => (
                        <Line key={p + "prev"} type="monotone" dataKey={`p${i}_prev`} name={`${p} (N-1)`} stroke={COLORS[i]} strokeOpacity={0.45} strokeDasharray="4 4" strokeWidth={1.5} dot={false} legendType="none" />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
