import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RestaurantStat {
  id: string;
  name: string;
  totalOfflineMinutes: number;
  availabilityRate: number;
}

interface DowntimeRankingBarsProps {
  stats: RestaurantStat[];
}

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const getMedal = (index: number): string => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
};

const getBarColor = (availabilityRate: number): string => {
  if (availabilityRate === 100) return "bg-emerald-500";
  if (availabilityRate >= 99) return "bg-emerald-400";
  if (availabilityRate >= 98) return "bg-amber-400";
  if (availabilityRate >= 95) return "bg-orange-400";
  return "bg-red-500";
};

const getStatusLabel = (availabilityRate: number): { text: string; color: string } => {
  if (availabilityRate === 100) return { text: "Parfait", color: "text-emerald-500" };
  if (availabilityRate >= 99) return { text: "Excellent", color: "text-emerald-400" };
  if (availabilityRate >= 98) return { text: "Bon", color: "text-amber-500" };
  if (availabilityRate >= 95) return { text: "À surveiller", color: "text-orange-500" };
  return { text: "Critique", color: "text-red-500" };
};

export const DowntimeRankingBars = ({ stats }: DowntimeRankingBarsProps) => {
  const maxMinutes = Math.max(...stats.map(s => s.totalOfflineMinutes), 1);

  if (stats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats.map((stat, index) => {
        const barWidth = stat.availabilityRate;
        const status = getStatusLabel(stat.availabilityRate);
        
        return (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg w-6">{getMedal(index)}</span>
                <span className="font-medium">{stat.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", status.color)}>
                  {status.text}
                </span>
                <span className="font-semibold tabular-nums min-w-[80px] text-right">
                  {stat.availabilityRate.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                className={cn("h-full rounded-full", getBarColor(stat.availabilityRate))}
              />
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Temps hors ligne: {formatMinutesToDisplay(stat.totalOfflineMinutes)}</span>
              {stat.availabilityRate === 100 && (
                <span className="text-emerald-500">✓ 100% en ligne</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
