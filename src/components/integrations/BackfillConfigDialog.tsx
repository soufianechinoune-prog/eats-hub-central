import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Search, Play, Link2 } from "lucide-react";

interface MappingRow {
  restaurant_splash_id: number;
  splash_name: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  is_mapped: boolean;
  duplicate_splash_ids: number[];
}

interface Restaurant {
  id: string;
  name: string;
}

type StatusFilter = "all" | "ok" | "problem" | "unmapped";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainId: string | null;
}

const PRESETS = [
  { label: "24 derniers mois", startY: new Date().getFullYear() - 2, startM: new Date().getMonth() + 1, endY: new Date().getFullYear(), endM: new Date().getMonth() + 1 },
  { label: "Historique 2021-2024", startY: 2021, startM: 1, endY: 2024, endM: 4 },
  { label: "Tout (2021 → aujourd'hui)", startY: 2021, startM: 1, endY: new Date().getFullYear(), endM: new Date().getMonth() + 1 },
];

export function BackfillConfigDialog({ open, onOpenChange, chainId }: Props) {
  const qc = useQueryClient();
  const now = new Date();
  const [startYear, setStartYear] = useState(now.getFullYear() - 2);
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [enqueuing, setEnqueuing] = useState(false);

  // Mapping overview
  const { data: rows = [], isLoading } = useQuery<MappingRow[]>({
    queryKey: ["splash-mapping-overview", chainId],
    enabled: !!chainId && open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("splash_mapping_overview", { p_chain_id: chainId });
      if (error) throw error;
      return (data ?? []) as MappingRow[];
    },
  });

  // Restos de la chain (pour le mapping inline)
  const { data: restaurants = [] } = useQuery<Restaurant[]>({
    queryKey: ["chain-restaurants-for-mapping", chainId],
    enabled: !!chainId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("chain_id", chainId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Restaurant[];
    },
  });

  // Pré-sélection au chargement : tous les OK + ⚠️ doublons cochés, ❌ non mappés décochés
  useEffect(() => {
    if (!rows.length) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev; // ne pas écraser un choix utilisateur
      const next = new Set<number>();
      for (const r of rows) if (r.is_mapped) next.add(r.restaurant_splash_id);
      return next;
    });
  }, [rows]);

  // Stats
  const stats = useMemo(() => {
    let ok = 0, problem = 0, unmapped = 0;
    for (const r of rows) {
      if (!r.is_mapped) unmapped++;
      else if (r.duplicate_splash_ids.length > 0) problem++;
      else ok++;
    }
    return { total: rows.length, ok, problem, unmapped };
  }, [rows]);

  // Filtrage
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "ok" && !(r.is_mapped && r.duplicate_splash_ids.length === 0)) return false;
      if (filter === "problem" && !(r.is_mapped && r.duplicate_splash_ids.length > 0)) return false;
      if (filter === "unmapped" && r.is_mapped) return false;
      if (q) {
        const hay = `${r.splash_name ?? ""} ${r.restaurant_name ?? ""} ${r.restaurant_splash_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, filter]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.restaurant_splash_id));
  const toggleAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) {
      for (const r of filteredRows) next.delete(r.restaurant_splash_id);
    } else {
      for (const r of filteredRows) if (r.is_mapped) next.add(r.restaurant_splash_id);
    }
    setSelected(next);
  };

  const toggleRow = (splashId: number, isMapped: boolean) => {
    if (!isMapped) return;
    const next = new Set(selected);
    if (next.has(splashId)) next.delete(splashId);
    else next.add(splashId);
    setSelected(next);
  };

  const handleMapInline = async (splashId: number, restaurantId: string | null) => {
    const { error } = await supabase.rpc("update_splash_mapping", {
      p_splash_id: splashId,
      p_restaurant_id: restaurantId,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: restaurantId ? "Mapping enregistré ✓" : "Mapping retiré" });
    await qc.invalidateQueries({ queryKey: ["splash-mapping-overview", chainId] });
  };

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx];
    setStartYear(p.startY);
    setStartMonth(p.startM);
    setEndYear(p.endY);
    setEndMonth(p.endM);
  };

  // Estimation : (nb restos sélectionnés) × (nb mois) jobs, ≈ 5 jobs/min
  const monthCount = useMemo(() => {
    if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) return 0;
    return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  }, [startYear, startMonth, endYear, endMonth]);
  const totalJobs = selected.size * monthCount;
  const estHours = totalJobs > 0 ? (totalJobs / 300).toFixed(1) : "0";

  const handleLaunch = async () => {
    if (!chainId || selected.size === 0 || monthCount === 0) return;
    setEnqueuing(true);
    try {
      const { data, error } = await supabase.rpc("enqueue_splash_backfill_for_restaurants", {
        p_chain_id: chainId,
        p_splash_ids: Array.from(selected),
        p_start_year: startYear,
        p_start_month: startMonth,
        p_end_year: endYear,
        p_end_month: endMonth,
      });
      if (error) throw error;
      toast({
        title: `Backfill lancé ✓`,
        description: `${data} jobs créés pour ${selected.size} restos. Le worker va les traiter en arrière-plan.`,
      });
      await qc.invalidateQueries({ queryKey: ["splash-backfill-progress", chainId] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Échec du lancement", variant: "destructive" });
    } finally {
      setEnqueuing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurer un backfill Splash360</DialogTitle>
          <DialogDescription>
            Choisis la période et les restaurants. Vérifie le matching avant de lancer.
          </DialogDescription>
        </DialogHeader>

        {/* Bloc Période */}
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <div className="text-sm font-medium">Période</div>
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-muted-foreground">De</span>
            <MonthYearPicker year={startYear} month={startMonth} onChange={(y, m) => { setStartYear(y); setStartMonth(m); }} />
            <span className="text-muted-foreground">à</span>
            <MonthYearPicker year={endYear} month={endMonth} onChange={(y, m) => { setEndYear(y); setEndMonth(m); }} />
            <span className="ml-2 text-xs text-muted-foreground">({monthCount} mois)</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESETS.map((p, i) => (
              <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(i)}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Bloc Restaurants */}
        <div className="space-y-2 border rounded-md p-3 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Restaurants ({stats.total})</div>
            <div className="flex gap-1">
              <FilterPill active={filter === "all"} onClick={() => setFilter("all")} count={stats.total}>Tout</FilterPill>
              <FilterPill active={filter === "ok"} onClick={() => setFilter("ok")} count={stats.ok} color="emerald">OK</FilterPill>
              <FilterPill active={filter === "problem"} onClick={() => setFilter("problem")} count={stats.problem} color="amber">Doublons</FilterPill>
              <FilterPill active={filter === "unmapped"} onClick={() => setFilter("unmapped")} count={stats.unmapped} color="red">Non mappés</FilterPill>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou ID Splash…"
              className="pl-8 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto border rounded-md">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Aucun restaurant.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b z-10">
                  <tr className="text-left">
                    <th className="p-2 w-8">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAllVisible}
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="p-2">Resto Splash</th>
                    <th className="p-2">→ Resto app</th>
                    <th className="p-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const isDuplicate = r.duplicate_splash_ids.length > 0;
                    const checked = selected.has(r.restaurant_splash_id);
                    return (
                      <tr key={r.restaurant_splash_id} className={`border-b hover:bg-muted/40 ${!r.is_mapped ? "opacity-60" : ""}`}>
                        <td className="p-2">
                          <Checkbox
                            checked={checked}
                            disabled={!r.is_mapped}
                            onCheckedChange={() => toggleRow(r.restaurant_splash_id, r.is_mapped)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="font-mono text-xs text-muted-foreground">#{r.restaurant_splash_id}</div>
                          <div className="font-medium">{r.splash_name || <em className="text-muted-foreground">sans nom</em>}</div>
                        </td>
                        <td className="p-2">
                          <RestaurantPicker
                            currentId={r.restaurant_id}
                            currentName={r.restaurant_name}
                            restaurants={restaurants}
                            onSelect={(id) => handleMapInline(r.restaurant_splash_id, id)}
                          />
                        </td>
                        <td className="p-2 text-right">
                          {!r.is_mapped ? (
                            <Badge variant="outline" className="text-destructive border-destructive/30">
                              <XCircle className="h-3 w-3 mr-1" />Non mappé
                            </Badge>
                          ) : isDuplicate ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Doublon (#{r.duplicate_splash_ids.join(", #")})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />OK
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {selected.size > 0 && monthCount > 0 ? (
              <>
                <span className="font-semibold text-foreground">{selected.size}</span> restos × {monthCount} mois ={" "}
                <span className="font-semibold text-foreground">{totalJobs.toLocaleString("fr-FR")}</span> jobs
                <span className="ml-2 text-xs">(~{estHours} h)</span>
              </>
            ) : (
              <span>Sélectionne au moins un restaurant et une période valide.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleLaunch} disabled={enqueuing || selected.size === 0 || monthCount === 0}>
              {enqueuing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Lancer le backfill
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Sub-components ---------------- */

function FilterPill({
  active, onClick, count, children, color,
}: { active: boolean; onClick: () => void; count: number; children: React.ReactNode; color?: "emerald" | "amber" | "red" }) {
  const colorCls = active
    ? color === "emerald" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : color === "amber" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : color === "red" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
    : "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground hover:bg-muted/70";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded-md transition-colors ${colorCls}`}
    >
      {children} <span className="opacity-70">({count})</span>
    </button>
  );
}

function MonthYearPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const currentY = new Date().getFullYear();
  const years = Array.from({ length: currentY - 2020 }, (_, i) => 2021 + i);
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return (
    <div className="flex gap-1">
      <Select value={String(month)} onValueChange={(v) => onChange(year, Number(v))}>
        <SelectTrigger className="h-8 w-[90px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onChange(Number(v), month)}>
        <SelectTrigger className="h-8 w-[90px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function RestaurantPicker({
  currentId, currentName, restaurants, onSelect,
}: { currentId: string | null; currentName: string | null; restaurants: Restaurant[]; onSelect: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1 text-left hover:underline ${currentId ? "" : "text-muted-foreground italic"}`}
        >
          <Link2 className="h-3 w-3 opacity-50" />
          {currentName || "Associer un resto…"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un resto…" />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup>
              {currentId && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onSelect(null); setOpen(false); }}
                  className="text-destructive"
                >
                  ✕ Retirer l'association
                </CommandItem>
              )}
              {restaurants.map((r) => (
                <CommandItem
                  key={r.id}
                  value={r.name}
                  onSelect={() => { onSelect(r.id); setOpen(false); }}
                >
                  {r.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
