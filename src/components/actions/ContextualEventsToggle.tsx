import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextualEventsToggleProps {
  showSchoolHolidays: boolean;
  onToggleSchoolHolidays: (value: boolean) => void;
  showFootballMatches?: boolean;
  onToggleFootballMatches?: (value: boolean) => void;
  loading?: boolean;
  footballLoading?: boolean;
  relevantZones?: string[];
  relevantTeams?: string[];
}

export function ContextualEventsToggle({
  showSchoolHolidays,
  onToggleSchoolHolidays,
  showFootballMatches = false,
  onToggleFootballMatches,
  loading = false,
  footballLoading = false,
  relevantZones = [],
  relevantTeams = [],
}: ContextualEventsToggleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg border",
        "bg-gradient-to-r from-orange-500/5 via-green-500/5 to-amber-500/5",
        "border-muted"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Événements contextuels</span>
      </div>
      
      {/* School Holidays Toggle */}
      <div className="flex items-center gap-3 pl-3 border-l border-muted">
        <GraduationCap className="h-4 w-4 text-orange-500" />
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

      {/* Football Matches Toggle */}
      {onToggleFootballMatches && (
        <div className="flex items-center gap-3 pl-3 border-l border-muted">
          <Trophy className="h-4 w-4 text-blue-600" />
          <div className="flex items-center gap-2">
            <Switch
              id="football-matches"
              checked={showFootballMatches}
              onCheckedChange={onToggleFootballMatches}
              disabled={footballLoading}
            />
            <Label htmlFor="football-matches" className="text-sm cursor-pointer">
              Matchs de foot
            </Label>
            {footballLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      )}
    </motion.div>
  );
}
