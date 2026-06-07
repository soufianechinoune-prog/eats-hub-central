import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChainConnectionsData } from "@/hooks/useChainConnections";

interface Restaurant {
  id: string;
  is_active?: boolean | null;
  uber_store_id?: string | null;
  uber_opening_date?: string | null;
  uber_closing_date?: string | null;
  deliveroo_store_id?: string | null;
  deliveroo_opening_date?: string | null;
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
};

interface Props {
  restaurant: Restaurant;
  chainData?: ChainConnectionsData;
}

/**
 * Un canal est considéré "actif" pour un restaurant si :
 *  - Uber / Deliveroo : un store_id est renseigné, une date d'ouverture est passée,
 *    et il n'y a pas de date de fermeture (et le restaurant n'est pas globalement fermé).
 *  - Splash360 : un mapping existe dans splash360_restaurant_mapping pour ce restaurant.
 *
 * Les connecteurs de chaîne (Dishop, Châtaigne, etc.) ne sont PAS affichés tant qu'on n'a
 * pas un mapping par restaurant — sinon ils apparaîtraient sur tous les restaurants
 * alors que la connexion ne concerne qu'une partie d'entre eux.
 */
export function ConnectionBadges({ restaurant, chainData }: Props) {
  const badges: ChannelBadge[] = [];
  const isRestaurantActive = restaurant.is_active !== false;

  // --- Uber Eats
  const uberActive =
    isRestaurantActive &&
    !!restaurant.uber_store_id &&
    !!restaurant.uber_opening_date &&
    !restaurant.uber_closing_date;
  if (uberActive) {
    badges.push({
      key: "uber",
      label: "Uber Eats",
      tooltip: "Connecté à Uber Eats",
      className: STYLES.uber,
    });
  }

  // --- Deliveroo
  const deliverooActive =
    isRestaurantActive &&
    !!restaurant.deliveroo_store_id &&
    !!restaurant.deliveroo_opening_date &&
    !restaurant.deliveroo_closing_date;
  if (deliverooActive) {
    badges.push({
      key: "deliveroo",
      label: "Deliveroo",
      tooltip: "Connecté à Deliveroo",
      className: STYLES.deliveroo,
    });
  }

  // --- Caisse Splash360 (mapping par restaurant)
  if (isRestaurantActive && chainData?.splashRestaurantIds.has(restaurant.id)) {
    badges.push({
      key: "splash360",
      label: "Splash360",
      tooltip: "Caisse Splash360 connectée",
      className: STYLES.splash360,
    });
  }

  if (badges.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Aucune connexion active</span>;
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
