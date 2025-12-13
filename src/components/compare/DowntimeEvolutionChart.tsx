import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DowntimeEvolutionChartProps {
  data: Record<string, string | number>[];
  restaurants: string[];
}

const COLORS = [
  "hsl(142, 76%, 36%)", // emerald-600
  "hsl(217, 91%, 60%)", // blue-500
  "hsl(262, 83%, 58%)", // violet-500
  "hsl(24, 95%, 53%)",  // orange-500
  "hsl(340, 82%, 52%)", // rose-500
];

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
};

export const DowntimeEvolutionChart = ({ data, restaurants }: DowntimeEvolutionChartProps) => {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(parseISO(value), "d MMM", { locale: fr })}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tickFormatter={(value) => formatMinutesToDisplay(value)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
            labelFormatter={(value) => format(parseISO(value as string), "EEEE d MMMM", { locale: fr })}
            formatter={(value: number, name: string) => [
              formatMinutesToDisplay(value),
              name
            ]}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value) => <span className="text-sm">{value}</span>}
          />
          {restaurants.map((restaurant, index) => (
            <Line
              key={restaurant}
              type="monotone"
              dataKey={restaurant}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS[index % COLORS.length] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
