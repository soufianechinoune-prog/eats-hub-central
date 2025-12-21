import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Clock } from "lucide-react";

interface OpeningHourSlot {
  restaurant_id: string;
  platform: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_overnight: boolean | null;
}

interface TimeSlotAnalysisProps {
  openingHoursData: OpeningHourSlot[];
  restaurantStats: {
    id: string;
    name: string;
    revenuePerHour: number;
    totalHoursPerWeek: number;
  }[];
}

const TIME_SLOTS = [
  { id: "morning", label: "Matin", start: 6, end: 11, color: "hsl(var(--chart-1))" },
  { id: "lunch", label: "Déjeuner", start: 11, end: 14, color: "hsl(var(--chart-2))" },
  { id: "afternoon", label: "Après-midi", start: 14, end: 18, color: "hsl(var(--chart-3))" },
  { id: "dinner", label: "Dîner", start: 18, end: 22, color: "hsl(var(--chart-4))" },
  { id: "latenight", label: "Late-night", start: 22, end: 6, color: "hsl(var(--chart-5))" },
];

export const TimeSlotAnalysis = ({ openingHoursData, restaurantStats }: TimeSlotAnalysisProps) => {
  
  // Calculer la couverture par créneau horaire
  const slotCoverage = useMemo(() => {
    if (!openingHoursData?.length) return [];

    const coverage: Record<string, { count: number; totalHours: number }> = {};
    TIME_SLOTS.forEach(slot => {
      coverage[slot.id] = { count: 0, totalHours: 0 };
    });

    openingHoursData.forEach(slot => {
      const [startH] = slot.start_time.split(':').map(Number);
      const [endH] = slot.end_time.split(':').map(Number);
      
      // Déterminer quel(s) créneau(x) ce slot couvre
      TIME_SLOTS.forEach(timeSlot => {
        let slotStart = startH;
        let slotEnd = slot.is_overnight || endH < startH ? endH + 24 : endH;
        
        let tsStart = timeSlot.start;
        let tsEnd = timeSlot.end;
        if (timeSlot.id === "latenight") {
          // Late-night: 22h-6h (next day)
          tsEnd = 30; // 6h next day as 30
        }

        // Check overlap
        const overlapStart = Math.max(slotStart, tsStart);
        const overlapEnd = Math.min(slotEnd, tsEnd);
        
        if (overlapStart < overlapEnd) {
          coverage[timeSlot.id].count += 1;
          coverage[timeSlot.id].totalHours += (overlapEnd - overlapStart);
        }
      });
    });

    const totalRestaurants = new Set(openingHoursData.map(h => h.restaurant_id)).size;
    
    return TIME_SLOTS.map(slot => ({
      ...slot,
      coverage: Math.round((coverage[slot.id].count / (totalRestaurants * 7)) * 100), // % de couverture
      avgHours: Math.round(coverage[slot.id].totalHours / Math.max(1, totalRestaurants) * 10) / 10,
    }));
  }, [openingHoursData]);

  // Identifier le meilleur et le pire créneau
  const bestSlot = slotCoverage.reduce((best, slot) => 
    slot.coverage > best.coverage ? slot : best, slotCoverage[0]);
  const worstSlot = slotCoverage.reduce((worst, slot) => 
    slot.coverage < worst.coverage && slot.coverage > 0 ? slot : worst, slotCoverage[0]);

  if (!openingHoursData?.length) {
    return null;
  }

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Analyse par créneau horaire
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Graphique en barres */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slotCoverage} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <YAxis 
                  type="category" 
                  dataKey="label" 
                  width={80}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, "Couverture"]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="coverage" 
                  radius={[0, 4, 4, 0]}
                >
                  {slotCoverage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insights rapides */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-muted-foreground">Créneau le plus couvert</p>
              <p className="font-semibold text-green-600">{bestSlot?.label}</p>
              <p className="text-xs text-muted-foreground">{bestSlot?.coverage}% du réseau</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-muted-foreground">Créneau sous-exploité</p>
              <p className="font-semibold text-amber-600">{worstSlot?.label}</p>
              <p className="text-xs text-muted-foreground">{worstSlot?.coverage}% du réseau</p>
            </div>
          </div>

          {/* Légende détaillée */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {TIME_SLOTS.map(slot => (
              <Badge 
                key={slot.id} 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: slot.color, backgroundColor: `${slot.color}20` }}
              >
                {slot.label}: {slot.start}h-{slot.end === 6 ? "6h+" : `${slot.end}h`}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
