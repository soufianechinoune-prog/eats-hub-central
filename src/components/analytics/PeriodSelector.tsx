import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PeriodOption = "previous_week" | "7d" | "30d" | "current_month" | "year";

interface PeriodSelectorProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
  className?: string;
}

export const getPeriodLabel = (period: PeriodOption): string => {
  switch (period) {
    case "previous_week": return "Semaine précédente";
    case "7d": return "7 derniers jours";
    case "30d": return "30 derniers jours";
    case "current_month": return "Mois en cours";
    case "year": return "Année en cours";
  }
};

export const getDateRangeFromPeriod = (period: PeriodOption): { startDate: Date; endDate: Date } => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();
  
  switch (period) {
    case "previous_week":
      const dayOfWeek = now.getDay();
      const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - daysSinceSunday);
      lastSunday.setHours(23, 59, 59, 999);
      
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6);
      lastMonday.setHours(0, 0, 0, 0);
      
      startDate = lastMonday;
      endDate = lastSunday;
      break;
    case "7d":
      startDate.setDate(now.getDate() - 7);
      endDate = now;
      break;
    case "30d":
      startDate.setDate(now.getDate() - 30);
      endDate = now;
      break;
    case "current_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      break;
  }
  
  return { startDate, endDate };
};

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PeriodOption)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Période" />
      </SelectTrigger>
      <SelectContent className="bg-background border border-border z-50">
        <SelectItem value="previous_week">Semaine précédente</SelectItem>
        <SelectItem value="7d">7 derniers jours</SelectItem>
        <SelectItem value="30d">30 derniers jours</SelectItem>
        <SelectItem value="current_month">Mois en cours</SelectItem>
        <SelectItem value="year">Année en cours</SelectItem>
      </SelectContent>
    </Select>
  );
}
