import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, BarChart3, LineChartIcon } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";

interface ErrorRateData {
  period: string;
  label: string;
  errorRate: number;
  errorCount: number;
  orderCount: number;
}

interface ErrorRateEvolutionChartProps {
  data: ErrorRateData[];
  objective: number;
  onObjectiveChange: (value: number) => void;
  chartType: "line" | "bar";
  onChartTypeChange: (type: "line" | "bar") => void;
  periodMode: "year" | "month";
  selectedMonth: number | null;
  onDrillDown?: (month: number) => void;
  onBackToYear?: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

export function ErrorRateEvolutionChart({
  data,
  objective,
  onObjectiveChange,
  chartType,
  onChartTypeChange,
  periodMode,
  selectedMonth,
  onDrillDown,
  onBackToYear,
  onPrevMonth,
  onNextMonth,
}: ErrorRateEvolutionChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.[0]) return null;
    const item = payload[0].payload;
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium">{item.label}</p>
        <p className={item.errorRate <= objective ? "text-emerald-500" : "text-destructive"}>
          Taux: {item.errorRate.toFixed(2)}%
        </p>
        <p className="text-sm text-muted-foreground">
          {item.errorCount} erreurs / {item.orderCount} commandes
        </p>
      </div>
    );
  };

  const handleClick = (data: any) => {
    if (periodMode === "year" && onDrillDown && data?.activePayload?.[0]) {
      const month = parseInt(data.activePayload[0].payload.period.split("-")[1]);
      onDrillDown(month);
    }
  };

  const maxRate = Math.max(...data.map(d => d.errorRate), objective + 1);
  const yDomain = [0, Math.ceil(maxRate * 1.2)];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Évolution du taux d'erreur</CardTitle>
            <p className="text-sm text-muted-foreground">
              Objectif: &lt; {objective}% d'erreurs
            </p>
          </div>
          <div className="flex items-center gap-2">
            {periodMode === "month" && (
              <>
                <Button variant="ghost" size="sm" onClick={onPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={onBackToYear}>
                  Retour année
                </Button>
                <Button variant="ghost" size="sm" onClick={onNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant={chartType === "line" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onChartTypeChange("line")}
            >
              <LineChartIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === "bar" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onChartTypeChange("bar")}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Objective slider */}
        <div className="flex items-center gap-4 mt-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Objectif:</span>
          <Slider
            value={[objective]}
            onValueChange={(v) => onObjectiveChange(v[0])}
            min={0.5}
            max={5}
            step={0.5}
            className="flex-1 max-w-[200px]"
          />
          <span className="text-sm font-medium">{objective}%</span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {chartType === "line" ? (
            <LineChart data={data} onClick={handleClick}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis domain={yDomain} tickFormatter={(v) => `${v}%`} className="text-xs" />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference zones */}
              <ReferenceArea y1={0} y2={objective} fill="hsl(var(--primary))" fillOpacity={0.1} />
              <ReferenceArea y1={objective} y2={yDomain[1]} fill="hsl(var(--destructive))" fillOpacity={0.1} />
              
              {/* Objective line */}
              <ReferenceLine
                y={objective}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{ value: `Objectif ${objective}%`, position: "right", fill: "hsl(var(--primary))", fontSize: 11 }}
              />
              
              <Line
                type="monotone"
                dataKey="errorRate"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--destructive))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} onClick={handleClick}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis domain={yDomain} tickFormatter={(v) => `${v}%`} className="text-xs" />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Objective line */}
              <ReferenceLine
                y={objective}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{ value: `Objectif ${objective}%`, position: "right", fill: "hsl(var(--primary))", fontSize: 11 }}
              />
              
              <Bar dataKey="errorRate" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.errorRate <= objective ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                    className={periodMode === "year" ? "cursor-pointer" : ""}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
