import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface HourPoint {
  hour: number;
  uber: number;
  dishop: number;
}

interface Props {
  uberHourly: Array<{ hour: number; revenue: number }>;
  dishopHourly: Array<{ hour: number; revenue: number }>;
}

export function LiveHourlyChart({ uberHourly, dishopHourly }: Props) {
  const data: HourPoint[] = Array.from({ length: 24 }, (_, h) => {
    const u = uberHourly.find((x) => x.hour === h)?.revenue ?? 0;
    const d = dishopHourly.find((x) => x.hour === h)?.revenue ?? 0;
    return { hour: h, uber: Number(u), dishop: Number(d) };
  });

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3">Activité heure par heure (CA TTC)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gUber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gDishop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="hour"
              tickFormatter={(h) => `${h}h`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip
              formatter={(v: number) =>
                new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
              }
              labelFormatter={(h) => `${h}h00`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="uber"
              name="Uber Eats"
              stackId="1"
              stroke="hsl(var(--primary))"
              fill="url(#gUber)"
            />
            <Area
              type="monotone"
              dataKey="dishop"
              name="Dishop"
              stackId="1"
              stroke="#10b981"
              fill="url(#gDishop)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        La caisse Splash360 n'expose pas de granularité horaire — voir cumul dans la carte dédiée.
      </p>
    </Card>
  );
}
