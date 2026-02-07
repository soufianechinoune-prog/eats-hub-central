import { Building2, Star } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NetworkViewToggleProps {
  isNetworkView: boolean;
  onToggle: (value: boolean) => void;
  pinnedCount?: number;
  networkCount?: number;
  className?: string;
}

export function NetworkViewToggle({
  isNetworkView,
  onToggle,
  pinnedCount = 0,
  networkCount = 0,
  className,
}: NetworkViewToggleProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <Star className={cn("h-4 w-4", !isNetworkView ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
        <Label 
          htmlFor="network-toggle" 
          className={cn(
            "text-sm cursor-pointer transition-colors",
            !isNetworkView ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          Épinglés
          {pinnedCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">
              {pinnedCount}
            </Badge>
          )}
        </Label>
      </div>
      
      <Switch
        id="network-toggle"
        checked={isNetworkView}
        onCheckedChange={onToggle}
      />
      
      <div className="flex items-center gap-2">
        <Building2 className={cn("h-4 w-4", isNetworkView ? "text-primary" : "text-muted-foreground")} />
        <Label 
          htmlFor="network-toggle" 
          className={cn(
            "text-sm cursor-pointer transition-colors",
            isNetworkView ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          Réseau
          {networkCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">
              {networkCount}
            </Badge>
          )}
        </Label>
      </div>
    </div>
  );
}
