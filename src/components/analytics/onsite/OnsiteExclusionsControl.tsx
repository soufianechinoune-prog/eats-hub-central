import { useMemo, useState } from "react";
import { EyeOff, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ExclusionCandidate {
  restaurantId: string;
  name: string;
  current: number;
  previous: number;
  /** Premier mois avec des commandes (= ouverture). null si antérieure aux données. */
  firstSale?: { year: number; month: number } | null;
}

interface Props {
  /** Restaurants du périmètre courant (déjà filtrés par la sélection) */
  candidates: ExclusionCandidate[];
  excluded: string[];
  onChange: (ids: string[]) => void;
  year: number;
  className?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const monthLong = (y: number, m: number) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));

const monthShort = (y: number, m: number) =>
  new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));

export function OnsiteExclusionsControl({ candidates, excluded, onChange, year, className }: Props) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...candidates].sort((a, b) => (b.current || b.previous) - (a.current || a.previous)),
    [candidates]
  );

  /** Ouvertures : du CA cette année mais rien l'an dernier */
  const openings = useMemo(
    () => sorted.filter((c) => c.current > 0 && c.previous === 0).map((c) => c.restaurantId),
    [sorted]
  );

  const count = excluded.length;

  const toggle = (id: string) =>
    onChange(excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-12 gap-2 rounded-xl bg-background px-4",
            count > 0 && "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800",
            className
          )}
        >
          <EyeOff className="h-4 w-4" />
          {count > 0 ? `${count} restaurant${count > 1 ? "s" : ""} exclu${count > 1 ? "s" : ""}` : "Aucune exclusion"}
          {count > 0 && (
            <Badge variant="outline" className="ml-1 border-amber-500/40 bg-amber-500/20 text-amber-800">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] p-0" align="start">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Exclure des restaurants du comparatif</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Les restaurants cochés sont retirés de tous les chiffres de la page (brut et périmètre constant).
          </p>
        </div>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={openings.length === 0}
            onClick={() => onChange(Array.from(new Set([...excluded, ...openings])))}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Exclure les ouvertures {year} ({openings.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 gap-1.5 text-xs"
            disabled={count === 0}
            onClick={() => onChange([])}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tout réinclure
          </Button>
        </div>
        <Command shouldFilter>
          <CommandInput placeholder="Rechercher un restaurant..." />
          <CommandList className="max-h-80">
            <CommandEmpty>Aucun restaurant.</CommandEmpty>
            <CommandGroup>
              {sorted.map((c) => {
                const checked = excluded.includes(c.restaurantId);
                const isOpening = c.current > 0 && c.previous === 0;
                const isClosing = c.current === 0 && c.previous > 0;
                return (
                  <CommandItem
                    key={c.restaurantId}
                    value={c.name}
                    onSelect={() => toggle(c.restaurantId)}
                    className="gap-3"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("truncate", checked && "text-muted-foreground line-through")}>
                          {c.name}
                        </span>
                        {isOpening && (
                          <Badge variant="outline" className="h-5 border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-700">
                            Ouverture
                          </Badge>
                        )}
                        {isClosing && (
                          <Badge variant="outline" className="h-5 border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700">
                            Fermeture
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmt(c.current)} en {year} · {fmt(c.previous)} en {year - 1}
                      </span>
                    </div>
                    {checked && <X className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
