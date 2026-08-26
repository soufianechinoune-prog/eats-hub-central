import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock } from "lucide-react";
import {
  useChataigneHeatmap,
  useChataigneHourly,
  type RestaurantScope,
} from "@/hooks/useChataigne";

const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HEADER_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

interface Props {
  start: string;
  end: string;
  restaurantIds: RestaurantScope;
}

export function ChataigneHourlySection({ start, end, restaurantIds }: Props) {
  const hourlyQ = useChataigneHourly(start, end, restaurantIds);
  const heatmapQ = useChataigneHeatmap(start, end, restaurantIds);

  const hourlyData = useMemo(() => {
    const byHour = new Map((hourlyQ.data ?? []).map((r) => [r.heure, r]));
    return HOURS.map((h) => {
      const r = byHour.get(h);
      return {
        heure: h,
        label: `${h}h`,
        commandes: r?.commandes ?? 0,
        ca: r?.ca ?? 0,
        panier_moyen: r?.panier_moyen ?? 0,
      };
    });
  }, [hourlyQ.data]);

  const maxHourly = useMemo(
    () => Math.max(1, ...hourlyData.map((d) => d.commandes)),
    [hourlyData]
  );

  const heat = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    for (const r of heatmapQ.data ?? []) {
      map.set(`${r.jour}-${r.heure}`, r.commandes);
      if (r.commandes > max) max = r.commandes;
    }
    return { map, max: Math.max(1, max) };
  }, [heatmapQ.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Horaires de commande
        </CardTitle>
        <CardDescription>
          Répartition des commandes dans la journée (heure de Paris).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* A) Commandes par heure */}
        <div>
          <h4 className="mb-3 text-sm font-medium">Commandes par heure</h4>
          {hourlyQ.isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  interval={0}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => fmtInt(Number(v))}
                />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelFormatter={(label) => `${label}`}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof hourlyData)[number];
                    return (
                      <div className="rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                        <div className="mb-1 font-medium">{label}</div>
                        <div>{fmtInt(d.commandes)} commandes</div>
                        <div>Panier moyen : {fmtEur(d.panier_moyen, 2)}</div>
                        <div>CA : {fmtEur(d.ca)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="commandes" name="Commandes" radius={[6, 6, 0, 0]}>
                  {hourlyData.map((d) => (
                    <Cell
                      key={d.heure}
                      fill="hsl(var(--primary))"
                      fillOpacity={d.commandes >= maxHourly * 0.8 ? 1 : 0.45}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* B) Heatmap jour × heure */}
        <div>
          <h4 className="mb-3 text-sm font-medium">Jour × heure</h4>
          {heatmapQ.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="mb-1 flex items-center gap-1 pl-20">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="flex-1 text-center text-[10px] text-muted-foreground"
                    >
                      {HEADER_HOURS.includes(h) ? `${h}h` : ""}
                    </div>
                  ))}
                </div>
                {DAY_LABELS.map((day, idx) => (
                  <div key={day} className="mb-1 flex items-center gap-1">
                    <div className="w-20 shrink-0 pr-2 text-right text-xs text-muted-foreground">
                      {day}
                    </div>
                    {HOURS.map((h) => {
                      const count = heat.map.get(`${idx + 1}-${h}`) ?? 0;
                      const ratio = count / heat.max;
                      return (
                        <div
                          key={h}
                          title={`${day} ${h}h — ${fmtInt(count)} commandes`}
                          className="h-7 flex-1 rounded-sm border border-border/40"
                          style={{
                            backgroundColor:
                              count === 0
                                ? "hsl(var(--muted))"
                                : `hsl(152 60% ${72 - ratio * 42}%)`,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                  <span>moins</span>
                  {[0.15, 0.35, 0.55, 0.75, 1].map((r) => (
                    <span
                      key={r}
                      className="h-3 w-5 rounded-sm border border-border/40"
                      style={{ backgroundColor: `hsl(152 60% ${72 - r * 42}%)` }}
                    />
                  ))}
                  <span>plus de commandes</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Le pic est le soir (19h-23h), avec un petit pic le midi vers 12h.
        </p>
      </CardContent>
    </Card>
  );
}
