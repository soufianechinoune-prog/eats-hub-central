import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChainConnectionsData } from "@/hooks/useChainConnections";

interface Restaurant {
  id: string;
  uber_store_id?: string | null;
  uber_closing_date?: string | null;
  deliveroo_store_id?: string | null;
  deliveroo_closing_date?: string | null;
}

interface ChannelBadge {
  key: string;
  label: string;
  tooltip: string;
  className: string;
}

const STYLES: Record<string, string> = {
  uber: "bg-black text-white border-black hover:bg-black/90 dark:bg-white dark:text-black dark:border-white",
  deliveroo: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40",
  splash360: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
  zelty: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40",
  dishop: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40",
  chataigne: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
};

const CONNECTOR_LABELS: Record<string, string> = {
  splash360: "Splash360",
  zelty: "Zelty",
  dishop: "Dishop",
  chataigne: "Châtaigne",
};

interface Props {
  restaurant: Restaurant;
  chainData?: ChainConnectionsData;
}

export function ConnectionBadges({ restaurant, chainData }: Props) {
  const badges: ChannelBadge[] = [];

  // --- Uber Eats : présence d'un store UUID et non fermé
  if (restaurant.uber_store_id && !restaurant.uber_closing_date) {
    badges.push({
      key: "uber",
      label: "Uber",
      tooltip: "Connecté à Uber Eats",
      className: STYLES.uber,
    });
  }

  // --- Deliveroo : présence d'un store ID et non fermé
  if (restaurant.deliveroo_store_id && !restaurant.deliveroo_closing_date) {
    badges.push({
      key: "deliveroo",
      label: "Deliveroo",
      tooltip: "Connecté à Deliveroo",
      className: STYLES.deliveroo,
    });
  }

  // --- Caisse Splash360 : mapping existant pour ce restaurant
  if (chainData?.splashRestaurantIds.has(restaurant.id)) {
    badges.push({
      key: "splash360",
      label: "Splash360",
      tooltip: "Caisse Splash360 connectée",
      className: STYLES.splash360,
    });
  }

  // --- Connecteurs au niveau de la chaîne (Dishop, Châtaigne, Zelty, etc.)
  // Note: Splash360 est déjà géré ci-dessus via le mapping par restaurant.
  if (chainData?.activeChainConnectors) {
    for (const connectorId of chainData.activeChainConnectors) {
      if (connectorId === "splash360") continue;
      const label = CONNECTOR_LABELS[connectorId] ?? connectorId;
      badges.push({
        key: connectorId,
        label,
        tooltip: `Connecté à ${label}`,
        className: STYLES[connectorId] ?? "bg-muted text-foreground border-border",
      });
    }
  }

  if (badges.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Aucune connexion</span>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {badges.map((b) => (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium px-1.5 py-0.5 ${b.className}`}
              >
                {b.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{b.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
