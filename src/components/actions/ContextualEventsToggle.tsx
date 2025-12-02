import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextualEventsToggleProps {
  showSchoolHolidays: boolean;
  onToggleSchoolHolidays: (value: boolean) => void;
  loading?: boolean;
  relevantZones?: string[];
}

export function ContextualEventsToggle({
  showSchoolHolidays,
  onToggleSchoolHolidays,
  loading = false,
  relevantZones = [],
}: ContextualEventsToggleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-lg border",
        "bg-gradient-to-r from-orange-500/5 to-amber-500/5",
        "border-orange-500/20"
      )}
    >
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-orange-500" />
        <span className="text-sm font-medium">Événements contextuels</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="school-holidays"
            checked={showSchoolHolidays}
            onCheckedChange={onToggleSchoolHolidays}
            disabled={loading}
          />
          <Label htmlFor="school-holidays" className="text-sm cursor-pointer">
            Vacances scolaires
          </Label>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        
        {showSchoolHolidays && relevantZones.length > 0 && (
          <div className="flex items-center gap-1">
            {relevantZones.map((zone) => (
              <Badge 
                key={zone} 
                variant="outline" 
                className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30"
              >
                {zone}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
