import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  usePayoutsConsolidation,
  usePayoutBackfillQueue,
} from "@/hooks/usePayoutsConsolidation";

const MONTH_LABELS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

interface Props {
  restaurantIds: string[] | undefined;
  startDateStr: string;
  endDateStr: string;
  enabled?: boolean;
  className?: string;
}

/**
 * Bandeau « Consolidation en cours » : visible tant qu'un mois de la période
 * n'a pas 100 % de ses commandes rattachées à un cycle de versement Uber
 * (`orders.payout_date`). Les montants de versements affichés pour ces mois
 * sont donc partiels — ils se complèteront à la fin de la file de backfill.
 */
export function PayoutsConsolidationBanner({
  restaurantIds,
  startDateStr,
  endDateStr,
  enabled = true,
  className,
}: Props) {
  const { data: incompleteMonths } = usePayoutsConsolidation(
    restaurantIds,
    startDateStr,
    endDateStr,
    enabled,
  );
  const { data: queue } = usePayoutBackfillQueue(enabled);

  if (!incompleteMonths || incompleteMonths.length === 0) return null;

  const inProgress = (queue?.pendingJobs || 0) + (queue?.runningJobs || 0);


  const pendingAuth = Math.max(
    0,
    ...incompleteMonths.map((m) => m.storesPendingAuth || 0),
  );

  return (
    <Alert
      className={
        "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 " +
        (className || "")
      }
    >
      <AlertTriangle className="h-4 w-4 !text-amber-600 dark:!text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        Consolidation des versements en cours
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">
          L'import Uber rattache encore des commandes à leur cycle de versement.
          Les montants des mois ci-dessous sont partiels et augmenteront
          automatiquement à la fin de la synchronisation. Périmètre : uniquement
          les restaurants dont l'accès API Uber est actif.
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {incompleteMonths.map((m) => (
            <div
              key={`${m.year}-${m.month}`}
              className="rounded-md border border-amber-200 bg-white/60 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/30"
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="capitalize">
                  {MONTH_LABELS[m.month - 1]} {m.year}
                </span>
                <span>{m.coveragePct.toFixed(1)} %</span>
              </div>
              <Progress value={m.coveragePct} className="mt-1.5 h-1.5" />
              <div className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-300/70">
                {m.ordersWithPayoutDate.toLocaleString("fr-FR")} /{" "}
                {m.ordersTotal.toLocaleString("fr-FR")} commandes rattachées
              </div>
            </div>
          ))}
        </div>
        {pendingAuth > 0 && (
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
            {pendingAuth} boutique{pendingAuth > 1 ? "s" : ""} en attente
            d'autorisation Uber — exclue{pendingAuth > 1 ? "s" : ""} du calcul.
          </p>
        )}

      </AlertDescription>
    </Alert>
  );
}
