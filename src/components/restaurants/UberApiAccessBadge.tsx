import { AlertTriangle, CheckCircle2, Clock3, HelpCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UberEatsLogo } from "@/components/icons/PlatformIcons";
import { cn } from "@/lib/utils";
import { daysSince, uberApiAccessDisplay, type UberApiAccess } from "@/lib/uberApiAccess";

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const STYLE = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  refuse: "bg-destructive/10 text-destructive border-destructive/30",
  demande: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  silencieux: "bg-muted text-muted-foreground border-border",
  non_configure: "",
} as const;

/**
 * Badge « accès API Uber » d'un restaurant, d'après ce qu'Uber renvoie vraiment.
 * Quand l'accès est refusé, un bouton permet de noter qu'on a fait la demande à Uber ;
 * le badge rappelle ensuite depuis combien de jours elle attend.
 */
export function UberApiAccessBadge({
  access, onRequest, onCancel, pending = false,
}: {
  access?: UberApiAccess;
  onRequest?: () => void;
  onCancel?: () => void;
  pending?: boolean;
}) {
  const display = uberApiAccessDisplay(access);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (display === "non_configure") {
    return <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">Non connecté</Badge>;
  }

  let label: string, Icon = CheckCircle2, help: string;
  if (display === "ok") {
    label = "Accès API OK";
    help = access?.last_api_order_at ? `Dernière commande reçue par l'API le ${dateFr(access.last_api_order_at)}.` : "Commandes reçues par l'API.";
  } else if (display === "demande") {
    const days = daysSince(access?.requested_at ?? null);
    label = days === 0 ? "Accès demandé aujourd'hui" : `Accès demandé il y a ${days} j`;
    Icon = Clock3;
    help = `Demande notée le ${dateFr(access!.requested_at!)}${access?.requested_by_name ? ` par ${access.requested_by_name}` : ""}. Uber refuse toujours l'accès : relancer si l'attente dure.`;
  } else if (display === "refuse") {
    label = "Accès refusé par Uber";
    Icon = AlertTriangle;
    help = `${access?.refusal_reason ?? "Uber a refusé l'accès"}${access?.last_refusal_at ? ` (dernier refus le ${dateFr(access.last_refusal_at)})` : ""}. Demander l'accès à Uber, puis le noter ici.`;
  } else {
    label = "Pas de données API";
    Icon = HelpCircle;
    help = access?.last_api_order_at
      ? `Aucune commande reçue par l'API depuis le ${dateFr(access.last_api_order_at)}. Restaurant fermé ou en pause, ou accès à vérifier.`
      : "Aucune commande reçue par l'API depuis 4 mois. Restaurant fermé ou en pause, ou accès à vérifier.";
  }

  return (
    <div className="flex flex-col items-start gap-1" onClick={stop}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex">
              <Badge className={cn("gap-1.5 whitespace-nowrap", STYLE[display])}>
                <UberEatsLogo size={12} />
                <Icon className="h-3 w-3" />
                {label}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {display === "refuse" && onRequest && (
        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1" disabled={pending} onClick={onRequest}>
          <Send className="h-3 w-3" /> J'ai demandé l'accès
        </Button>
      )}
      {display === "demande" && onCancel && (
        <button type="button" className="text-[10px] text-muted-foreground underline" disabled={pending} onClick={onCancel}>
          Retirer la demande
        </button>
      )}
    </div>
  );
}
