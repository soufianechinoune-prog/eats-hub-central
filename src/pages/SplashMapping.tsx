import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, CheckCircle2, AlertTriangle, Ban, Sparkles, ArrowLeftRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NOT_APPLICABLE = "__NA__";
const UNMAPPED = "__UNMAPPED__";

function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/CHICKEN STREET/g, "")
    .replace(/TASTY CROUSTY/g, "")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SplashMapping() {
  const { data: isSuperAdmin, isLoading: roleLoading } = useIsSuperAdmin();
  const { selectedChainId } = useAnalyticsContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "todo" | "mapped" | "na">("todo");

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["splash-mapping", selectedChainId],
    enabled: !!isSuperAdmin && !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("splash360_restaurant_mapping")
        .select("restaurant_splash_id, splash_name, restaurant_id, is_not_applicable, chain_id, matched_at")
        .eq("chain_id", selectedChainId!)
        .order("restaurant_splash_id", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: restaurants = [], isLoading: loadingResto } = useQuery({
    queryKey: ["splash-mapping-restos", selectedChainId],
    enabled: !!isSuperAdmin && !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("chain_id", selectedChainId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Toutes les caisses Splash de toutes les marques + leurs restaurants
  // pour détecter les caisses mal mappées sur une AUTRE marque.
  const { data: foreignMappings = [], isLoading: loadingForeign } = useQuery({
    queryKey: ["splash-mapping-foreign", selectedChainId],
    enabled: !!isSuperAdmin && !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("splash360_restaurant_mapping")
        .select("restaurant_splash_id, splash_name, restaurant_id, chain_id, is_not_applicable")
        .neq("chain_id", selectedChainId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: chains = [] } = useQuery({
    queryKey: ["chains-list"],
    enabled: !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("chains").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Restaurants des autres marques pour afficher "actuellement rattachée à"
  const foreignRestaurantIds = useMemo(
    () => Array.from(new Set(foreignMappings.map((m) => m.restaurant_id).filter(Boolean))) as string[],
    [foreignMappings],
  );

  const { data: foreignRestaurants = [] } = useQuery({
    queryKey: ["splash-mapping-foreign-restos", foreignRestaurantIds.join(",")],
    enabled: !!isSuperAdmin && foreignRestaurantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, chain_id")
        .in("id", foreignRestaurantIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const foreignRestoMap = useMemo(() => {
    const map = new Map<string, { name: string; chain_id: string }>();
    for (const r of foreignRestaurants) map.set(r.id, { name: r.name, chain_id: r.chain_id });
    return map;
  }, [foreignRestaurants]);

  const chainNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of chains) map.set(c.id, c.name);
    return map;
  }, [chains]);

  const updateMutation = useMutation({
    mutationFn: async (args: {
      splashId: number;
      restaurantId: string | null;
      isNotApplicable: boolean;
    }) => {
      // Si on rattache un restaurant déjà détenu par une AUTRE caisse de la même marque,
      // on libère l'ancienne caisse pour éviter le double-mapping.
      if (args.restaurantId) {
        const stale = mappings.filter(
          (m) =>
            m.restaurant_id === args.restaurantId &&
            m.restaurant_splash_id !== args.splashId,
        );
        for (const s of stale) {
          const { error: clearErr } = await supabase
            .from("splash360_restaurant_mapping")
            .update({ restaurant_id: null, is_not_applicable: false })
            .eq("restaurant_splash_id", s.restaurant_splash_id);
          if (clearErr) throw clearErr;
        }
      }

      const { error } = await supabase
        .from("splash360_restaurant_mapping")
        .update({
          restaurant_id: args.restaurantId,
          is_not_applicable: args.isNotApplicable,
        })
        .eq("restaurant_splash_id", args.splashId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["splash-mapping"] });
      qc.invalidateQueries({ queryKey: ["splash-mapping-foreign"] });
      qc.invalidateQueries({ queryKey: ["chain-connections"] });
      toast({ title: "Mapping enregistré ✓" });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message ?? "Impossible d'enregistrer.",
        variant: "destructive",
      }),
  });

  // Déplace une caisse depuis une autre marque vers la marque active
  const moveForeignMutation = useMutation({
    mutationFn: async (args: { splashId: number; restaurantId: string }) => {
      const { error } = await supabase
        .from("splash360_restaurant_mapping")
        .update({
          restaurant_id: args.restaurantId,
          chain_id: selectedChainId!,
          is_not_applicable: false,
        })
        .eq("restaurant_splash_id", args.splashId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["splash-mapping"] });
      qc.invalidateQueries({ queryKey: ["splash-mapping-foreign"] });
      qc.invalidateQueries({ queryKey: ["chain-connections"] });
      toast({ title: "Caisse déplacée ✓" });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message ?? "Impossible de déplacer la caisse.",
        variant: "destructive",
      }),
  });

  // Set restaurant_id => splash_name déjà rattaché (pour éviter les doublons)
  const mappedRestaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mappings) {
      if (m.restaurant_id) {
        map.set(m.restaurant_id, m.splash_name ?? `Splash #${m.restaurant_splash_id}`);
      }
    }
    return map;
  }, [mappings]);

  // Suggestions: pour chaque non-mappé, trouver un restaurant unique qui contient le token
  // ET qui n'est pas déjà rattaché à une autre caisse Splash
  const suggestions = useMemo(() => {
    const map = new Map<number, { id: string; name: string }>();
    if (!restaurants.length) return map;
    for (const m of mappings) {
      if (m.restaurant_id || m.is_not_applicable) continue;
      const token = normalize(m.splash_name);
      if (!token || token.length < 3) continue;
      const matches = restaurants.filter(
        (r) => normalize(r.name).includes(token) && !mappedRestaurantMap.has(r.id),
      );
      if (matches.length === 1) {
        map.set(m.restaurant_splash_id, { id: matches[0].id, name: matches[0].name });
      }
    }
    return map;
  }, [mappings, restaurants, mappedRestaurantMap]);

  // Token brut de la marque active (sans les déductions de normalize),
  // pour ne suggérer une caisse cross-chain que si SON nom contient explicitement
  // la marque active. Évite les faux positifs où seule la ville matche.
  const activeBrandToken = useMemo(() => {
    const name = chainNameMap.get(selectedChainId ?? "");
    if (!name) return "";
    return name
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, [chainNameMap, selectedChainId]);

  // Caisses mappées à une AUTRE marque, dont le nom Splash :
  //   1. contient explicitement la marque active (ex: "TASTY CROUSTY ...")
  //   2. ET correspond par ville à un restaurant unique de la marque active
  const crossChainCandidates = useMemo(() => {
    const out: Array<{
      splashId: number;
      splashName: string;
      currentChainId: string | null;
      currentRestaurantName: string | null;
      suggested: { id: string; name: string };
    }> = [];
    if (!restaurants.length || !activeBrandToken) return out;
    for (const m of foreignMappings) {
      const rawSplashName = (m.splash_name ?? "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      // Filtre #1 : le nom de la caisse doit contenir la marque active
      if (!rawSplashName.includes(activeBrandToken)) continue;

      const token = normalize(m.splash_name);
      if (!token || token.length < 3) continue;
      const matches = restaurants.filter((r) => normalize(r.name).includes(token));
      if (matches.length !== 1) continue;
      const currentResto = m.restaurant_id ? foreignRestoMap.get(m.restaurant_id) : null;
      out.push({
        splashId: m.restaurant_splash_id,
        splashName: m.splash_name ?? `Splash #${m.restaurant_splash_id}`,
        currentChainId: m.chain_id,
        currentRestaurantName: currentResto?.name ?? null,

        suggested: { id: matches[0].id, name: matches[0].name },
      });
    }
    return out;
  }, [foreignMappings, restaurants, foreignRestoMap, activeBrandToken]);

  const filtered = useMemo(() => {
    return mappings.filter((m) => {
      if (filter === "todo" && (m.restaurant_id || m.is_not_applicable)) return false;
      if (filter === "mapped" && !m.restaurant_id) return false;
      if (filter === "na" && !m.is_not_applicable) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !(m.splash_name ?? "").toLowerCase().includes(s) &&
          !String(m.restaurant_splash_id).includes(s)
        )
          return false;
      }
      return true;
    });
  }, [mappings, filter, search]);

  const counts = useMemo(() => {
    return {
      total: mappings.length,
      todo: mappings.filter((m) => !m.restaurant_id && !m.is_not_applicable).length,
      mapped: mappings.filter((m) => !!m.restaurant_id).length,
      na: mappings.filter((m) => m.is_not_applicable).length,
    };
  }, [mappings]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/overview" replace />;

  if (!selectedChainId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Sélectionnez une marque dans la barre latérale pour voir le mapping Splash360.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Link2 className="h-7 w-7 text-primary" />
          Mapping Splash360
        </h1>
        <p className="text-muted-foreground mt-1">
          Rattache chaque caisse Splash reçue via l'API à la fiche restaurant correspondante.
          La data déjà reçue est rétroactivement rattachée dès le mapping enregistré.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total caisses" value={counts.total} />
        <StatCard label="À mapper" value={counts.todo} variant="warn" />
        <StatCard label="Mappées" value={counts.mapped} variant="ok" />
        <StatCard label="Non applicables" value={counts.na} variant="muted" />
      </div>

      {/* Cross-chain candidates */}
      {!loadingForeign && crossChainCandidates.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Caisses mappées à une autre marque ({crossChainCandidates.length})
            </CardTitle>
            <CardDescription>
              Ces caisses Splash existent dans l'API mais sont actuellement rattachées à un
              restaurant d'une <strong>autre marque</strong>. Leur nom correspond pourtant à un
              restaurant de la marque active. Clique sur « Déplacer ici » pour les rebrancher.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Splash ID</TableHead>
                    <TableHead>Nom Splash</TableHead>
                    <TableHead>Actuellement rattachée à</TableHead>
                    <TableHead>Restaurant suggéré (marque active)</TableHead>
                    <TableHead className="text-right w-40">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossChainCandidates.map((c) => (
                    <TableRow key={c.splashId}>
                      <TableCell className="font-mono text-xs">{c.splashId}</TableCell>
                      <TableCell className="font-medium">{c.splashName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>{c.currentRestaurantName ?? "—"}</span>
                          <span className="text-muted-foreground">
                            {c.currentChainId ? chainNameMap.get(c.currentChainId) ?? "Autre marque" : "Aucune marque"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.suggested.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            moveForeignMutation.mutate({
                              splashId: c.splashId,
                              restaurantId: c.suggested.id,
                            })
                          }
                          disabled={moveForeignMutation.isPending}
                          className="gap-1"
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                          Déplacer ici
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Caisses Splash de la marque</CardTitle>
              <CardDescription>
                Recherche, suggestion automatique sur nom, et rattachement en 1 clic. Sélectionner
                un restaurant déjà mappé le déplace automatiquement (l'ancienne caisse est libérée).
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Rechercher (nom ou ID Splash)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À mapper ({counts.todo})</SelectItem>
                  <SelectItem value="mapped">Mappées ({counts.mapped})</SelectItem>
                  <SelectItem value="na">Non applicables ({counts.na})</SelectItem>
                  <SelectItem value="all">Toutes ({counts.total})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMappings || loadingResto ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              Aucune caisse à afficher pour ce filtre.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Splash ID</TableHead>
                    <TableHead>Nom Splash</TableHead>
                    <TableHead className="w-[340px]">Restaurant rattaché</TableHead>
                    <TableHead className="w-32 text-right">État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => {
                    const suggestion = suggestions.get(m.restaurant_splash_id);
                    const current = m.is_not_applicable
                      ? NOT_APPLICABLE
                      : m.restaurant_id ?? UNMAPPED;
                    return (
                      <TableRow key={m.restaurant_splash_id}>
                        <TableCell className="font-mono text-xs">
                          {m.restaurant_splash_id}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{m.splash_name || "—"}</span>
                            {!m.restaurant_id && !m.is_not_applicable && suggestion && (
                              <span className="text-xs text-primary flex items-center gap-1 mt-0.5">
                                <Sparkles className="h-3 w-3" />
                                Suggestion : {suggestion.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={current}
                              onValueChange={(value) => {
                                if (value === current) return;
                                const isNA = value === NOT_APPLICABLE;
                                const restaurantId =
                                  value === UNMAPPED || isNA ? null : value;
                                updateMutation.mutate({
                                  splashId: m.restaurant_splash_id,
                                  restaurantId,
                                  isNotApplicable: isNA,
                                });
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="— à mapper —" />
                              </SelectTrigger>
                              <SelectContent className="max-h-80">
                                <SelectItem value={UNMAPPED}>— à mapper —</SelectItem>
                                <SelectItem value={NOT_APPLICABLE}>
                                  🚫 Non applicable
                                </SelectItem>
                                {restaurants.map((r) => {
                                  const takenBy = mappedRestaurantMap.get(r.id);
                                  const isTakenByOther = !!takenBy && r.id !== m.restaurant_id;
                                  return (
                                    <SelectItem key={r.id} value={r.id}>
                                      <span className="flex items-center gap-2">
                                        <span className={isTakenByOther ? "text-muted-foreground" : ""}>
                                          {r.name}
                                        </span>
                                        {isTakenByOther && (
                                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                            ● déjà mappé → {takenBy} (cliquer = déplacer)
                                          </span>
                                        )}
                                      </span>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {suggestion && !m.restaurant_id && !m.is_not_applicable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateMutation.mutate({
                                    splashId: m.restaurant_splash_id,
                                    restaurantId: suggestion.id,
                                    isNotApplicable: false,
                                  })
                                }
                                disabled={updateMutation.isPending}
                              >
                                Appliquer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {m.is_not_applicable ? (
                            <Badge variant="secondary" className="gap-1">
                              <Ban className="h-3 w-3" /> N/A
                            </Badge>
                          ) : m.restaurant_id ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> À faire
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "ok" | "warn" | "muted";
}) {
  const color =
    variant === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : variant === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
