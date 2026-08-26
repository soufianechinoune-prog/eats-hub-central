import { EyeOff, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExcludedItem {
  restaurantId: string;
  name: string;
  current: number;
  previous: number;
}

interface Props {
  items: ExcludedItem[];
  year: number;
  onRemove: (id: string) => void;
  onReset: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export function OnsiteExclusionsBar({ items, year, onRemove, onReset }: Props) {
  if (items.length === 0) return null;

  const current = items.reduce((s, i) => s + i.current, 0);
  const previous = items.reduce((s, i) => s + i.previous, 0);

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
          <EyeOff className="h-4 w-4" />
          {items.length} restaurant{items.length > 1 ? "s" : ""} exclu{items.length > 1 ? "s" : ""} du comparatif
        </div>
        <span className="text-sm text-amber-700/90">
          — {fmt(current)} retirés de {year}, {fmt(previous)} de {year - 1}.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1.5 text-xs text-amber-800 hover:bg-amber-500/20 hover:text-amber-900"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.restaurantId}
            type="button"
            onClick={() => onRemove(i.restaurantId)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-background/70 px-2.5 py-1 text-xs text-amber-900 transition-colors hover:bg-background"
            title="Réintégrer ce restaurant dans le comparatif"
          >
            {i.name}
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
