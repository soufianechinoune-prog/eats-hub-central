import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Camera,
  Euro,
  Gift,
  Megaphone,
  UtensilsCrossed,
  Settings,
  Moon,
  Check,
  ChevronDown,
  Search,
  Calendar,
  GraduationCap,
  Trophy,
  Sun,
  X,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Action category config
const ACTION_CATEGORY_COLORS: Record<string, string> = {
  visuals: "#8b5cf6",
  pricing: "#f59e0b",
  promotions: "#ec4899",
  marketing: "#3b82f6",
  menu: "#10b981",
  operational: "#64748b",
  events: "#059669",
};

const ACTION_CATEGORY_ICONS: Record<string, any> = {
  visuals: Camera,
  pricing: Euro,
  promotions: Gift,
  marketing: Megaphone,
  menu: UtensilsCrossed,
  operational: Settings,
  events: Moon,
};

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
  events: "Événements",
};

// Contextual event types
const CONTEXTUAL_EVENT_TYPES = {
  holidays: { label: "Jours fériés", icon: Sun, color: "#ef4444" },
  schoolHolidays: { label: "Vacances scolaires", icon: GraduationCap, color: "#8b5cf6" },
  footballMatches: { label: "Matchs de football", icon: Trophy, color: "#22c55e" },
};

export interface RestaurantAction {
  id: string;
  category: string;
  action_type: string;
  title: string;
  start_date: string;
  end_date?: string;
  platform: string;
}

export interface ContextualEvent {
  id: string;
  type: "holidays" | "schoolHolidays" | "footballMatches";
  title: string;
  date: string;
  endDate?: string;
}

interface ActionFilterPopoverProps {
  actions: RestaurantAction[];
  selectedActionIds: Set<string>;
  onActionToggle: (actionId: string) => void;
  onSelectAllCategory: (category: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  // Contextual events
  contextualEvents?: ContextualEvent[];
  selectedContextualEventIds?: Set<string>;
  onContextualEventToggle?: (eventId: string) => void;
  showHolidays?: boolean;
  showSchoolHolidays?: boolean;
  showFootballMatches?: boolean;
  onHolidaysToggle?: (value: boolean) => void;
  onSchoolHolidaysToggle?: (value: boolean) => void;
  onFootballMatchesToggle?: (value: boolean) => void;
}

// Individual category popover for detailed action selection
function CategoryPopover({
  category,
  actions,
  selectedActionIds,
  onActionToggle,
  onSelectAllCategory,
}: {
  category: string;
  actions: RestaurantAction[];
  selectedActionIds: Set<string>;
  onActionToggle: (actionId: string) => void;
  onSelectAllCategory: (category: string, selected: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const Icon = ACTION_CATEGORY_ICONS[category] || Zap;
  const color = ACTION_CATEGORY_COLORS[category] || "#64748b";
  const label = ACTION_CATEGORY_LABELS[category] || category;
  
  const categoryActions = actions.filter(a => a.category === category);
  const selectedCount = categoryActions.filter(a => selectedActionIds.has(a.id)).length;
  const allSelected = selectedCount === categoryActions.length;
  const someSelected = selectedCount > 0 && selectedCount < categoryActions.length;
  
  const filteredActions = useMemo(() => {
    if (!searchQuery) return categoryActions;
    const query = searchQuery.toLowerCase();
    return categoryActions.filter(a => 
      a.title.toLowerCase().includes(query)
    );
  }, [categoryActions, searchQuery]);
  
  if (categoryActions.length === 0) return null;
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-all cursor-pointer border",
            selectedCount > 0
              ? "bg-background shadow-sm"
              : "bg-muted/50 opacity-60 hover:opacity-80 border-transparent"
          )}
          style={{
            borderColor: selectedCount > 0 ? color : undefined,
          }}
        >
          <div 
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-opacity",
              selectedCount === 0 && "opacity-40"
            )}
            style={{ backgroundColor: color }} 
          />
          <Icon 
            className={cn(
              "h-3 w-3 transition-opacity",
              selectedCount === 0 && "opacity-40"
            )} 
            style={{ color }} 
          />
          <span className={cn(selectedCount === 0 && "text-muted-foreground")}>
            {label}
          </span>
          <Badge 
            variant={selectedCount > 0 ? "default" : "secondary"} 
            className="h-4 px-1.5 text-[10px] font-medium ml-0.5"
            style={{
              backgroundColor: selectedCount > 0 ? `${color}20` : undefined,
              color: selectedCount > 0 ? color : undefined,
            }}
          >
            {selectedCount}/{categoryActions.length}
          </Badge>
          <ChevronDown className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0" 
        align="start"
        sideOffset={8}
      >
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" style={{ color }} />
              <span className="font-medium text-sm">{label}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onSelectAllCategory(category, !allSelected)}
            >
              {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
          </div>
          {categoryActions.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}
        </div>
        
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-0.5">
            {filteredActions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucune action trouvée
              </p>
            ) : (
              filteredActions.map((action) => {
                const isSelected = selectedActionIds.has(action.id);
                const date = new Date(action.start_date);
                const formattedDate = format(date, "d MMM yyyy", { locale: fr });
                
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-primary/5 hover:bg-primary/10" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onActionToggle(action.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="mt-0.5"
                      style={{
                        borderColor: isSelected ? color : undefined,
                        backgroundColor: isSelected ? color : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-medium truncate",
                        !isSelected && "text-muted-foreground"
                      )}>
                        {action.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {formattedDate}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Contextual events section
function ContextualEventsSection({
  showHolidays,
  showSchoolHolidays,
  showFootballMatches,
  onHolidaysToggle,
  onSchoolHolidaysToggle,
  onFootballMatchesToggle,
  holidaysCount = 0,
  schoolHolidaysCount = 0,
  footballMatchesCount = 0,
}: {
  showHolidays?: boolean;
  showSchoolHolidays?: boolean;
  showFootballMatches?: boolean;
  onHolidaysToggle?: (value: boolean) => void;
  onSchoolHolidaysToggle?: (value: boolean) => void;
  onFootballMatchesToggle?: (value: boolean) => void;
  holidaysCount?: number;
  schoolHolidaysCount?: number;
  footballMatchesCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const activeCount = [showHolidays, showSchoolHolidays, showFootballMatches].filter(Boolean).length;
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-all cursor-pointer border",
            activeCount > 0
              ? "bg-background shadow-sm border-amber-500/50"
              : "bg-muted/50 opacity-60 hover:opacity-80 border-transparent"
          )}
        >
          <Calendar className={cn(
            "h-3.5 w-3.5",
            activeCount > 0 ? "text-amber-500" : "text-muted-foreground"
          )} />
          <span className={cn(activeCount === 0 && "text-muted-foreground")}>
            Événements contextuels
          </span>
          {activeCount > 0 && (
            <Badge 
              className="h-4 px-1.5 text-[10px] font-medium ml-0.5 bg-amber-500/20 text-amber-600"
            >
              {activeCount}/3
            </Badge>
          )}
          <ChevronDown className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-0" 
        align="start"
        sideOffset={8}
      >
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-sm">Événements contextuels</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Afficher sur les graphiques
          </p>
        </div>
        
        <div className="p-2 space-y-1">
          {/* Jours fériés */}
          {onHolidaysToggle && (
            <motion.div
              whileHover={{ x: 2 }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                showHolidays 
                  ? "bg-red-500/5 hover:bg-red-500/10" 
                  : "hover:bg-muted/50"
              )}
              onClick={() => onHolidaysToggle(!showHolidays)}
            >
              <Checkbox
                checked={showHolidays}
                className={cn(showHolidays && "border-red-500 bg-red-500")}
              />
              <Sun className="h-4 w-4 text-red-500" />
              <span className={cn(
                "text-xs flex-1",
                !showHolidays && "text-muted-foreground"
              )}>
                Jours fériés
              </span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {holidaysCount}
              </Badge>
            </motion.div>
          )}
          
          {/* Vacances scolaires */}
          {onSchoolHolidaysToggle && (
            <motion.div
              whileHover={{ x: 2 }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                showSchoolHolidays 
                  ? "bg-violet-500/5 hover:bg-violet-500/10" 
                  : "hover:bg-muted/50"
              )}
              onClick={() => onSchoolHolidaysToggle(!showSchoolHolidays)}
            >
              <Checkbox
                checked={showSchoolHolidays}
                className={cn(showSchoolHolidays && "border-violet-500 bg-violet-500")}
              />
              <GraduationCap className="h-4 w-4 text-violet-500" />
              <span className={cn(
                "text-xs flex-1",
                !showSchoolHolidays && "text-muted-foreground"
              )}>
                Vacances scolaires
              </span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {schoolHolidaysCount}
              </Badge>
            </motion.div>
          )}
          
          {/* Matchs de football */}
          {onFootballMatchesToggle && (
            <motion.div
              whileHover={{ x: 2 }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                showFootballMatches 
                  ? "bg-green-500/5 hover:bg-green-500/10" 
                  : "hover:bg-muted/50"
              )}
              onClick={() => onFootballMatchesToggle(!showFootballMatches)}
            >
              <Checkbox
                checked={showFootballMatches}
                className={cn(showFootballMatches && "border-green-500 bg-green-500")}
              />
              <Trophy className="h-4 w-4 text-green-500" />
              <span className={cn(
                "text-xs flex-1",
                !showFootballMatches && "text-muted-foreground"
              )}>
                Matchs de football
              </span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {footballMatchesCount}
              </Badge>
            </motion.div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ActionFilterPopover({
  actions,
  selectedActionIds,
  onActionToggle,
  onSelectAllCategory,
  onSelectAll,
  showHolidays,
  showSchoolHolidays,
  showFootballMatches,
  onHolidaysToggle,
  onSchoolHolidaysToggle,
  onFootballMatchesToggle,
}: ActionFilterPopoverProps) {
  // Group actions by category
  const actionsByCategory = useMemo(() => {
    const grouped: Record<string, RestaurantAction[]> = {};
    actions.forEach(action => {
      if (!grouped[action.category]) {
        grouped[action.category] = [];
      }
      grouped[action.category].push(action);
    });
    return grouped;
  }, [actions]);
  
  const categories = Object.keys(actionsByCategory);
  const totalActions = actions.length;
  const selectedCount = actions.filter(a => selectedActionIds.has(a.id)).length;
  const allSelected = selectedCount === totalActions;
  
  // Count contextual events (placeholder - will be passed from parent)
  const holidaysCount = 12; // TODO: get from parent
  const schoolHolidaysCount = 8;
  const footballMatchesCount = 15;
  
  if (totalActions === 0 && !onHolidaysToggle && !onSchoolHolidaysToggle && !onFootballMatchesToggle) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 flex-wrap"
    >
      {/* Global filter indicator */}
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {selectedCount}/{totalActions} actions
        </span>
        {selectedCount > 0 && selectedCount < totalActions && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onSelectAll(true)}
          >
            Tout afficher
          </Button>
        )}
        {allSelected && totalActions > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onSelectAll(false)}
          >
            Tout masquer
          </Button>
        )}
      </div>
      
      {/* Category popovers */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {categories.map(category => (
          <CategoryPopover
            key={category}
            category={category}
            actions={actions}
            selectedActionIds={selectedActionIds}
            onActionToggle={onActionToggle}
            onSelectAllCategory={onSelectAllCategory}
          />
        ))}
      </div>
      
      {/* Separator if both actions and contextual events exist */}
      {totalActions > 0 && (onHolidaysToggle || onSchoolHolidaysToggle || onFootballMatchesToggle) && (
        <Separator orientation="vertical" className="h-6 mx-1" />
      )}
      
      {/* Contextual events section */}
      {(onHolidaysToggle || onSchoolHolidaysToggle || onFootballMatchesToggle) && (
        <ContextualEventsSection
          showHolidays={showHolidays}
          showSchoolHolidays={showSchoolHolidays}
          showFootballMatches={showFootballMatches}
          onHolidaysToggle={onHolidaysToggle}
          onSchoolHolidaysToggle={onSchoolHolidaysToggle}
          onFootballMatchesToggle={onFootballMatchesToggle}
          holidaysCount={holidaysCount}
          schoolHolidaysCount={schoolHolidaysCount}
          footballMatchesCount={footballMatchesCount}
        />
      )}
    </motion.div>
  );
}
