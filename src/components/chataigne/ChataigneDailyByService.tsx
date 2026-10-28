import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subDays, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";

type Row = { day: string; service_type: string; orders: number; revenue: number };

interface Props {
  start: string;
  end: string;
  restaurantIds: string[] | null | undefined;
}

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const DELIVERY = "hsl(var(--primary))";
const COLLECTION = "hsl(var(--chart-3, var(--accent-foreground)))";

export function ChataigneDailyByService({ start, end, restaurantIds }: Props) {
  const [range, setRange] = useState<"30" | "period">("30");
  const [metric, setMetric] = useState<"orders" | "revenue">("orders");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const today = new Date();
  const rStart = range === "30" ? format(subDays(today, 29), "yyyy-MM-dd") : start;
  const rEnd = range === "30" ? format(today, "yyyy-MM-dd") : end;

  const q = useQuery({
    queryKey: ["chataigne-daily-by-service", rStart, rEnd, restaurantIds === null ? "all" : [...(restaurantIds ?? [])].sort().join(",")],
    enabled: restaurantIds !== undefined,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chataigne_daily_by_service" as never, {
        p_start: rStart,
        p_end: rEnd,
        p_restaurant_ids: restaurantIds && restaurantIds.length > 0 ? restaurantIds : null,
      } as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const data = useMemo(() => {
    const map = new Map<string, { delivery: number; collection: number; orders: number; revenue: number; dOrders: number; cOrders: number }>();
    for (const r of q.data ?? []) {
      const k = String(r.day).slice(0, 10);
      const cur = map.get(k) ?? { delivery: 0, collection: 0, orders: 0, revenue: 0, dOrders: 0, cOrders: 0 };
      cur.orders += Number(r.orders) || 0;
      cur.revenue += Number(r.revenue) || 0;
      if (r.service_type === "delivery") cur.dOrders += Number(r.orders) || 0; else cur.cOrders += Number(r.orders) || 0;
      const v = Number(metric === "orders" ? r.orders : r.revenue) || 0;
      if (r.service_type === "delivery") cur.delivery += v; else cur.collection += v;
      map.set(k, cur);
    }
    return eachDayOfInterval({ start: parseISO(rStart), end: parseISO(rEnd) }).map((d) => {
      const k = format(d, "yyyy-MM-dd");
      const v = map.get(k) ?? { delivery: 0, collection: 0, orders: 0, revenue: 0, dOrders: 0, cOrders: 0 };
      return { key: k, label: format(d, "d MMM", { locale: fr }), ...v, total: v.delivery + v.collection };
    });
  }, [q.data, metric, rStart, rEnd]);

  const fmt = metric === "orders" ? fmtInt : fmtEur;

  const tooltip = (
    <Tooltip
      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload as { delivery: number; collection: number; total: number; orders: number; revenue: number; dOrders: number; cOrders: number };
        const share = p.orders > 0 ? Math.round((p.dOrders / p.orders) * 100) : 0;
        return (
          <div className="rounded-xl border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
            <div className="mb-1 font-medium">{label}</div>
            <div className="flex justify-between gap-6"><span style={{ color: DELIVERY }}>Livraison</span><span>{fmt(p.delivery)}</span></div>
            <div className="flex justify-between gap-6"><span style={{ color: COLLECTION }}>À emporter</span><span>{fmt(p.collection)}</span></div>
            <div className="mt-1 flex justify-between gap-6 border-t pt-1 font-medium"><span>Total</span><span>{fmt(p.total)}</span></div>
            <div className="flex justify-between gap-6"><span>Commandes</span><span>{fmtInt(p.orders)}</span></div>
            <div className="flex justify-between gap-6"><span>CA</span><span>{fmtEur(p.revenue)}</span></div>
            <div className="text-xs text-muted-foreground">{share} % des commandes en livraison</div>
          </div>
        );
      }}
    />
  );

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(Number(v))} />
      {tooltip}
      <Legend verticalAlign="bottom" />
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{metric === "orders" ? "Commandes par jour" : "CA par jour"}</CardTitle>
          <CardDescription>Commandes terminées, par mode. Survolez un jour pour le détail.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" size="sm" value={range} onValueChange={(v) => v && setRange(v as "30" | "period")}>
            <ToggleGroupItem value="30">30 derniers jours</ToggleGroupItem>
            <ToggleGroupItem value="period">Période</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" size="sm" value={metric} onValueChange={(v) => v && setMetric(v as "orders" | "revenue")}>
            <ToggleGroupItem value="orders">Commandes</ToggleGroupItem>
            <ToggleGroupItem value="revenue">CA</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" size="sm" value={chartType} onValueChange={(v) => v && setChartType(v as "bar" | "line")}>
            <ToggleGroupItem value="bar">Barres</ToggleGroupItem>
            <ToggleGroupItem value="line">Courbes</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Skeleton className="h-[340px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            {chartType === "bar" ? (
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                {axes}
                <Bar dataKey="delivery" name="Livraison" stackId="s" fill={DELIVERY} />
                <Bar dataKey="collection" name="À emporter" stackId="s" fill={COLLECTION} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                {axes}
                <Line type="monotone" dataKey="delivery" name="Livraison" stroke={DELIVERY} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="collection" name="À emporter" stroke={COLLECTION} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
