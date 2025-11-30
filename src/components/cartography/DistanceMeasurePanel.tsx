import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Ruler, 
  X, 
  ArrowLeftRight, 
  RotateCcw, 
  Copy,
  Check
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export interface DistancePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface DistanceMeasurePanelProps {
  isDistanceMode: boolean;
  pointA: DistancePoint | null;
  pointB: DistancePoint | null;
  distance: number | null;
  onToggleMode: () => void;
  onClearPointA: () => void;
  onClearPointB: () => void;
  onSwapPoints: () => void;
  onReset: () => void;
}

export const DistanceMeasurePanel = ({
  isDistanceMode,
  pointA,
  pointB,
  distance,
  onToggleMode,
  onClearPointA,
  onClearPointB,
  onSwapPoints,
  onReset,
}: DistanceMeasurePanelProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyDistance = async () => {
    if (distance !== null) {
      const text = `${distance.toFixed(2)} km à vol d'oiseau entre ${pointA?.name} et ${pointB?.name}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Distance copiée !");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isDistanceMode) {
    return (
      <Button
        onClick={onToggleMode}
        variant="outline"
        className="w-full border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 transition-all"
      >
        <Ruler className="h-4 w-4 mr-2 text-amber-500" />
        Mesurer une distance
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5 shadow-lg">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Ruler className="h-3.5 w-3.5 text-white" />
              </div>
              <CardTitle className="text-sm font-semibold">Mesure de distance</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onToggleMode}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {/* Point A */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
              pointA 
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" 
                : "bg-muted text-muted-foreground border-2 border-dashed border-amber-500/50"
            )}>
              A
            </div>
            <div className="flex-1 min-w-0">
              {pointA ? (
                <span className="text-sm font-medium truncate block">{pointA.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  Cliquez sur un restaurant
                </span>
              )}
            </div>
            {pointA && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={onClearPointA}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Connection line visual */}
          <div className="flex items-center gap-2 pl-3">
            <div className={cn(
              "w-0.5 h-6 rounded-full transition-all",
              pointA && pointB 
                ? "bg-gradient-to-b from-amber-500 to-orange-600" 
                : "bg-muted-foreground/30"
            )} 
            style={{ 
              backgroundImage: pointA && pointB 
                ? undefined 
                : "repeating-linear-gradient(to bottom, transparent, transparent 2px, hsl(var(--muted-foreground) / 0.3) 2px, hsl(var(--muted-foreground) / 0.3) 4px)" 
            }}
            />
          </div>

          {/* Point B */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
              pointB 
                ? "bg-orange-600 text-white shadow-md shadow-orange-600/30" 
                : "bg-muted text-muted-foreground border-2 border-dashed border-orange-500/50"
            )}>
              B
            </div>
            <div className="flex-1 min-w-0">
              {pointB ? (
                <span className="text-sm font-medium truncate block">{pointB.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  {pointA ? "Cliquez sur un 2ème restaurant" : "—"}
                </span>
              )}
            </div>
            {pointB && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={onClearPointB}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Distance result */}
          <AnimatePresence>
            {distance !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative overflow-hidden rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.2),transparent_70%)]" />
                <motion.p 
                  key={distance}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-3xl font-bold tracking-tight relative z-10"
                >
                  {distance.toFixed(2)} <span className="text-lg font-medium">km</span>
                </motion.p>
                <p className="text-xs opacity-90 mt-1 relative z-10">à vol d'oiseau</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={onSwapPoints}
              disabled={!pointA || !pointB}
            >
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              Inverser
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={onReset}
              disabled={!pointA && !pointB}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            {distance !== null && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2"
                onClick={handleCopyDistance}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {/* Hint */}
          {!pointA && !pointB && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Sélectionnez deux points de vente sur la carte ou dans la liste
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
