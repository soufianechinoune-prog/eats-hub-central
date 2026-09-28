import { useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  restaurants: { id: string; name: string }[];
  onOpenRestaurant: (id: string) => void;
}

/** Alerte haut de page, purement informative : restaurants sans aucun CA sur la période. */
export function ZeroRevenueAlert({ restaurants, onOpenRestaurant }: Props) {
  const [open, setOpen] = useState(false);
  const n = restaurants.length;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <AlertTriangle className="h-4 w-4 text-destructive" />
        {n} restaurant{n > 1 ? "s" : ""} à 0 € sur la période
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {restaurants.map((r) => (
            <Button key={r.id} variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onOpenRestaurant(r.id)}>
              {r.name}
              <ExternalLink className="h-3 w-3" />
            </Button>
          ))}
          <p className="w-full text-xs text-muted-foreground">
            Travaux ou fermeture ? Ouvrez la fiche pour renseigner la date de fermeture. Pour les écarter du calcul N-1, activez « Comparaison N-1 » puis « Exclure les restaurants à 0 € ».
          </p>
        </div>
      )}
    </div>
  );
}
