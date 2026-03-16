import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Loader2, CheckCircle2, XCircle, Search,
  ArrowUpDown, ShieldCheck, ShieldAlert, ShieldOff,
  CalendarDays, Hash,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEcoOrganismCheck, type EcoOrganismCheckResult, type IduResult } from "@/hooks/useEcoOrganismCheck";

interface RepMembershipSectionProps {
  restaurantIds: string[];
  restaurantMap: Map<string, string>;
}

type SortMode = "alpha" | "status" | "filieres";
type FilterMode = "all" | "inscrit" | "non_trouve" | "sans_siret";

interface ParsedRestaurant {
  id: string;
  name: string;
  status: "inscrit" | "non_trouve" | "sans_siret" | "loading" | "error";
  result?: EcoOrganismCheckResult;
  error?: string;
  filiereCount: number;
  orgs: string[];
  filieres: string[];
  iduEntries: IduResult[];
  entries: {
    filiere: string;
    org: string;
    start: string;
    end: string | null;
    isActive: boolean;
    idu?: string;
  }[];
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : null;

export function RepMembershipSection({ restaurantIds, restaurantMap }: RepMembershipSectionProps) {
  const { data: repData, loading: repLoading, errors: repErrors, checkMultiple } = useEcoOrganismCheck();
  const [repChecked, setRepChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("status");
  const [filter, setFilter] = useState<FilterMode>("all");

  const isLoading = Object.values(repLoading).some(Boolean);

  const parsed = useMemo<ParsedRestaurant[]>(() => {
    return restaurantIds.map(rId => {
      const name = restaurantMap.get(rId) || rId.slice(0, 8);
      const result = repData[rId];
      const error = repErrors[rId];
      const loading = repLoading[rId];

      if (loading) return { id: rId, name, status: "loading" as const, filiereCount: 0, orgs: [], filieres: [], iduEntries: [], entries: [] };
      if (error) return { id: rId, name, status: "error" as const, error, filiereCount: 0, orgs: [], filieres: [], iduEntries: [], entries: [] };
      if (!result) return { id: rId, name, status: "sans_siret" as const, filiereCount: 0, orgs: [], filieres: [], iduEntries: [], entries: [] };

      const hasResults = result.count > 0;
      const iduEntries = result.idu_results || [];
      const entries = result.results.map(r => {
        const matchingIdu = iduEntries.find(i => i.filiere === r.filiere);
        return {
          filiere: r.filiere,
          org: r.raison_sociale_ecoorganisme,
          start: fmtDate(r.date_debutvalidite_inscription) || "—",
          end: r.date_finvalidite_inscription,
          isActive: !r.date_finvalidite_inscription || new Date(r.date_finvalidite_inscription) > new Date(),
          idu: matchingIdu?.identifiant_unique,
        };
      });

      return {
        id: rId,
        name,
        status: hasResults ? "inscrit" as const : "non_trouve" as const,
        result,
        filiereCount: result.count,
        orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
        filieres: [...new Set(result.results.map(r => r.filiere).filter(Boolean))],
        iduEntries,
        entries,
      };
    });
  }, [restaurantIds, restaurantMap, repData, repLoading, repErrors]);

  const filtered = useMemo(() => {
    let list = parsed;

    if (filter !== "all") {
      list = list.filter(r => r.status === filter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.orgs.some(o => o.toLowerCase().includes(q)) ||
        r.filieres.some(f => f.toLowerCase().includes(q))
      );
    }

    list = [...list].sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name);
      if (sort === "filieres") return b.filiereCount - a.filiereCount;
      // status: inscrit first, then non_trouve, then sans_siret
      const order = { inscrit: 0, non_trouve: 1, error: 2, sans_siret: 3, loading: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });

    return list;
  }, [parsed, filter, search, sort]);

  // Summary stats
  const stats = useMemo(() => {
    const inscrit = parsed.filter(r => r.status === "inscrit").length;
    const nonTrouve = parsed.filter(r => r.status === "non_trouve").length;
    const sansSiret = parsed.filter(r => r.status === "sans_siret").length;
    return { inscrit, nonTrouve, sansSiret, total: parsed.length };
  }, [parsed]);

  const handleCheck = async () => {
    const { data: restData } = await supabase
      .from("restaurants")
      .select("id, siret")
      .in("id", restaurantIds);
    if (restData) {
      await checkMultiple(restData.map((r: any) => ({ id: r.id, siret: r.siret })));
      setRepChecked(true);
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Adhésion éco-organismes (REP)</h3>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-full gap-1.5"
            disabled={isLoading}
            onClick={handleCheck}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Vérifier les SIRET
          </Button>
        </div>


        {/* Not checked yet */}
        {!repChecked && (
          <p className="text-xs text-muted-foreground">
            Cliquez sur "Vérifier les SIRET" pour interroger l'API ADEME et vérifier l'adhésion de vos restaurants aux filières REP.
          </p>
        )}

        {/* Results */}
        {repChecked && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard
                icon={<ShieldCheck className="h-4 w-4 text-green-600" />}
                label="Inscrits"
                value={stats.inscrit}
                total={stats.total}
                colorClass="text-green-600"
                onClick={() => setFilter(f => f === "inscrit" ? "all" : "inscrit")}
                active={filter === "inscrit"}
              />
              <SummaryCard
                icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
                label="Non trouvés"
                value={stats.nonTrouve}
                total={stats.total}
                colorClass="text-red-500"
                onClick={() => setFilter(f => f === "non_trouve" ? "all" : "non_trouve")}
                active={filter === "non_trouve"}
              />
              <SummaryCard
                icon={<ShieldOff className="h-4 w-4 text-muted-foreground" />}
                label="Sans SIRET"
                value={stats.sansSiret}
                total={stats.total}
                colorClass="text-muted-foreground"
                onClick={() => setFilter(f => f === "sans_siret" ? "all" : "sans_siret")}
                active={filter === "sans_siret"}
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher restaurant, filière, éco-organisme…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Tabs value={sort} onValueChange={v => setSort(v as SortMode)}>
                <TabsList className="h-9">
                  <TabsTrigger value="status" className="text-[11px] px-2.5 h-7 gap-1">
                    <ArrowUpDown className="h-3 w-3" /> Statut
                  </TabsTrigger>
                  <TabsTrigger value="alpha" className="text-[11px] px-2.5 h-7">
                    A→Z
                  </TabsTrigger>
                  <TabsTrigger value="filieres" className="text-[11px] px-2.5 h-7">
                    Filières
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Filter active indicator */}
            {filter !== "all" && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                  Filtre : {filter === "inscrit" ? "Inscrits" : filter === "non_trouve" ? "Non trouvés" : "Sans SIRET"}
                  <button onClick={() => setFilter("all")} className="ml-1 hover:text-foreground">✕</button>
                </Badge>
                <span className="text-[11px] text-muted-foreground">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
              </div>
            )}

            {/* List */}
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map(r => (
                <RestaurantRepRow key={r.id} restaurant={r} />
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-xs">Aucun résultat</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  icon, label, value, total, colorClass, onClick, active,
}: {
  icon: React.ReactNode; label: string; value: number; total: number;
  colorClass: string; onClick: () => void; active: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
        active && "ring-2 ring-primary/30 border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        {icon}
        <span className={cn("text-lg font-bold", colorClass)}>{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", {
            "bg-green-500": colorClass.includes("green"),
            "bg-red-400": colorClass.includes("red"),
            "bg-muted-foreground/40": !colorClass.includes("green") && !colorClass.includes("red"),
          })}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{pct}%</p>
    </button>
  );
}

function RestaurantRepRow({ restaurant: r }: { restaurant: ParsedRestaurant }) {
  if (r.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {r.name}…
      </div>
    );
  }

  if (r.status === "error") {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive py-2 px-3 rounded-md bg-destructive/5">
        <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">{r.name}</span>
        <span className="text-[11px] opacity-75">— {r.error}</span>
      </div>
    );
  }

  if (r.status === "sans_siret") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-3">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
        <span>{r.name}</span>
        <span className="italic text-[11px]">— Pas de SIRET renseigné</span>
      </div>
    );
  }

  if (r.status === "non_trouve") {
    return (
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10">
        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        <span className="text-sm font-medium">{r.name}</span>
        <Badge variant="destructive" className="text-[10px] h-5 ml-auto">Non trouvé</Badge>
      </div>
    );
  }

  // inscrit
  const unmatchedIdus = r.iduEntries.filter(idu => !r.entries.some(e => e.filiere === idu.filiere));

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-900/30 bg-green-50/30 dark:bg-green-950/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-sm font-medium">{r.name}</span>
        <Badge className="text-[10px] h-5 bg-green-600 hover:bg-green-700 ml-auto">
          {r.filiereCount} filière{r.filiereCount > 1 ? "s" : ""} REP
        </Badge>
      </div>

      {/* IDU prominent display */}
      <div className="pl-6">
        {r.iduEntries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 items-center">
            {r.iduEntries.map((idu, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 font-mono text-xs bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-md">
                <Hash className="h-3 w-3" />
                IDU {idu.filiere} : {idu.identifiant_unique}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">Aucun IDU trouvé via l'API ADEME</span>
        )}
      </div>

      <div className="pl-6 space-y-1.5">
        {/* Org names */}
        <p className="text-[11px] text-muted-foreground">
          Éco-organismes : {r.orgs.join(", ")}
        </p>
        {/* Validity entries */}
        {r.entries.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <CalendarDays className="h-3 w-3 flex-shrink-0" />
            <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", entry.isActive ? "bg-green-500" : "bg-red-400")} />
            <span className="font-mono">{entry.filiere}</span>
            {entry.idu ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  <Hash className="h-2.5 w-2.5" />
                  {entry.idu}
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-[10px] italic text-muted-foreground/50">IDU non disponible</span>
              </>
            )}
            <span className="text-muted-foreground/60">·</span>
            <span>{entry.org}</span>
            <span className="text-muted-foreground/60">·</span>
            <span>du {entry.start} au {entry.end ? fmtDate(entry.end) : "En cours"}</span>
            {!entry.isActive && <Badge variant="destructive" className="text-[9px] h-4 px-1">Expiré</Badge>}
          </div>
        ))}
        {/* Unmatched IDUs fallback */}
        {unmatchedIdus.length > 0 && (
          <div className="pt-1 border-t border-dashed border-muted-foreground/20 mt-1">
            <p className="text-[10px] text-muted-foreground mb-1">IDU supplémentaires :</p>
            {unmatchedIdus.map((idu, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 mr-1">
                <Hash className="h-2.5 w-2.5" />
                {idu.filiere} — {idu.identifiant_unique}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
