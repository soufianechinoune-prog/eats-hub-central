import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface SelectableRestaurant {
  id: string;
  name: string;
  city?: string | null;
  is_pinned?: boolean | null;
}

interface Props {
  restaurants: SelectableRestaurant[];
  /** Vide = tous les restaurants */
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function OnsiteRestaurantSelect({ restaurants, selected, onChange, className }: Props) {
  const [open, setOpen] = useState(false);

  const pinned = useMemo(() => restaurants.filter((r) => r.is_pinned), [restaurants]);
  const others = useMemo(() => restaurants.filter((r) => !r.is_pinned), [restaurants]);

  const allSelected = selected.length === 0;
  const label = allSelected
    ? "Tous les restaurants"
    : selected.length === 1
      ? restaurants.find((r) => r.id === selected[0])?.name ?? "1 restaurant"
      : `${selected.length} restaurants`;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const renderItem = (r: SelectableRestaurant) => {
    const checked = selected.includes(r.id);
    return (
      <CommandItem key={r.id} value={`${r.name} ${r.city ?? ""}`} onSelect={() => toggle(r.id)}>
        <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
        <div className="flex flex-col">
          <span>{r.name}</span>
          {r.city && <span className="text-xs uppercase text-muted-foreground">{r.city}</span>}
        </div>
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-12 justify-between gap-2 rounded-xl border-0 bg-emerald-600 px-4 text-white hover:bg-emerald-700 hover:text-white",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            {label}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un restaurant..." />
          <CommandList className="max-h-80">
            <CommandEmpty>Aucun restaurant.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="tous les restaurants"
                onSelect={() => {
                  onChange([]);
                  setOpen(false);
                }}
                className={cn(allSelected && "bg-emerald-600 text-white aria-selected:bg-emerald-600 aria-selected:text-white")}
              >
                <Check className={cn("mr-2 h-4 w-4", allSelected ? "opacity-100" : "opacity-0")} />
                Tous les restaurants
              </CommandItem>
              {pinned.length > 0 && (
                <CommandItem
                  value="selectionner les epingles"
                  onSelect={() => onChange(pinned.map((r) => r.id))}
                  className="text-amber-600"
                >
                  <Star className="mr-2 h-4 w-4 fill-amber-500 text-amber-500" />
                  Sélectionner les {pinned.length} épinglés
                </CommandItem>
              )}
            </CommandGroup>
            {pinned.length > 0 && (
              <CommandGroup heading={`Épinglés (${pinned.length})`}>{pinned.map(renderItem)}</CommandGroup>
            )}
            <CommandGroup heading="Tous les restaurants">{others.map(renderItem)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
