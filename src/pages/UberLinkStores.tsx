import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { fetchStores, getValidAccessToken } from "@/services/uberService";
import {
  autoMatchStoresToRestaurants,
  bulkLinkStores,
  type LinkAction,
  type MatchSuggestion,
  type UberStore,
} from "@/services/uberLinkingService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, AlertTriangle, PlusCircle, CheckCircle2, X } from "lucide-react";

type RowState = {
  store: UberStore;
  matchType: MatchSuggestion["matchType"];
  action: "link" | "create" | "ignore";
  // For link
  selectedRestaurantId: string | null;
  // For create
  newName: string;
};

const SENTINEL = "00000000-0000-0000-0000-000000000000";

const UberLinkStores = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const connectionId = searchParams.get("connection");
  const { selectedChainId } = useAnalyticsContext();
  const { data: restaurants = [], isLoading: loadingRestaurants } = useActiveRestaurants();

  const [loadingStores, setLoadingStores] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState<string>("");
  const [stores, setStores] = useState<UberStore[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("");

  // 1. Load token + stores
  useEffect(() => {
    if (!connectionId) {
      navigate("/uber-connections");
      return;
    }
    (async () => {
      try {
        // Fetch the master connection directly (avoids touching restaurant scoping)
        const { data: conn, error } = await supabase
          .from("uber_connections")
          .select("access_token, account_label")
          .eq("id", connectionId)
          .single();
        if (error || !conn?.access_token) throw error ?? new Error("Connexion introuvable");
        setAccessToken(conn.access_token);
        setAccountLabel((conn as any).account_label ?? "Compte Uber Manager");

        const data = await fetchStores(conn.access_token);
        const list: UberStore[] = (data?.stores ?? []).map((s: any) => ({
          id: s.id,
          name: s.name ?? "Sans nom",
          address: s.location?.address ?? s.location?.street_address ?? "",
          raw: s,
        }));
        setStores(list);
      } catch (err: any) {
        console.error(err);
        toast({
          title: "Erreur",
          description: err?.message ?? "Impossible de récupérer la liste des restaurants Uber",
          variant: "destructive",
        });
      } finally {
        setLoadingStores(false);
      }
    })();
  }, [connectionId, navigate, toast]);

  // 2. Auto-match once both stores + restaurants are loaded
  useEffect(() => {
    if (loadingStores || loadingRestaurants || stores.length === 0) return;
    (async () => {
      const suggestions = await autoMatchStoresToRestaurants(
        stores,
        restaurants.map((r) => ({ id: r.id, name: r.name, city: (r as any).city ?? null })),
      );
      setRows(
        suggestions.map((s) => ({
          store: s.store,
          matchType: s.matchType,
          action:
            s.matchType === "already_linked"
              ? "ignore"
              : s.matchType === "none"
                ? "create"
                : "link",
          selectedRestaurantId: s.suggestedRestaurantId,
          newName: s.store.name,
        })),
      );
    })();
  }, [loadingStores, loadingRestaurants, stores, restaurants]);

  const counts = useMemo(() => {
    let exact = 0,
      fuzzy = 0,
      none = 0,
      already = 0;
    rows.forEach((r) => {
      if (r.matchType === "exact") exact++;
      else if (r.matchType === "fuzzy") fuzzy++;
      else if (r.matchType === "none") none++;
      else if (r.matchType === "already_linked") already++;
    });
    return { exact, fuzzy, none, already };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(
      (r) =>
        r.store.name.toLowerCase().includes(q) || (r.store.address ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const setRow = (storeId: string, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r) => (r.store.id === storeId ? { ...r, ...patch } : r)),
    );
  };

  const setAllAction = (action: "link" | "create" | "ignore") => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.matchType === "already_linked") return r;
        if (action === "link" && !r.selectedRestaurantId) return { ...r, action: "create" };
        return { ...r, action };
      }),
    );
  };

  const handleSubmit = async () => {
    if (!accessToken || !connectionId) return;
    if (!selectedChainId || selectedChainId === SENTINEL) {
      toast({
        title: "Sélection de marque requise",
        description: "Choisissez une marque active avant de lier les restaurants.",
        variant: "destructive",
      });
      return;
    }

    const actions: LinkAction[] = [];
    rows.forEach((r) => {
      if (r.matchType === "already_linked") return;
      if (r.action === "ignore") {
        actions.push({ kind: "ignore", storeId: r.store.id });
      } else if (r.action === "create") {
        actions.push({
          kind: "create",
          storeId: r.store.id,
          newRestaurantName: r.newName.trim() || r.store.name,
          newRestaurantAddress: r.store.address,
          chainId: selectedChainId,
        });
      } else if (r.action === "link" && r.selectedRestaurantId) {
        actions.push({
          kind: "link",
          storeId: r.store.id,
          restaurantId: r.selectedRestaurantId,
        });
      }
    });

    setSubmitting(true);
    const storeMap = new Map(stores.map((s) => [s.id, s]));
    const result = await bulkLinkStores({
      connectionId,
      accessToken,
      storeMap,
      actions,
    });
    setSubmitting(false);

    toast({
      title: "Associations terminées",
      description: `${result.linked} liés • ${result.created} créés • ${result.posActivated} POS activés${
        result.posFailed ? ` • ${result.posFailed} POS échoués` : ""
      }${result.errors.length ? ` • ${result.errors.length} erreurs` : ""}`,
    });

    if (result.errors.length === 0) {
      setTimeout(() => navigate("/uber-connections"), 1500);
    }
  };

  const isLoading = loadingStores || loadingRestaurants;

  return (
    <div className="container max-w-7xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Associer vos restaurants Uber Eats</h1>
        <p className="text-muted-foreground mt-1">
          Compte connecté : <span className="font-medium">{accountLabel}</span>
          {!isLoading && stores.length > 0 && (
            <> • <span className="font-medium">{stores.length}</span> restaurants détectés</>
          )}
        </p>
      </div>

      {!isLoading && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> {counts.exact} match exact
          </Badge>
          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> {counts.fuzzy} à vérifier
          </Badge>
          <Badge variant="outline" className="gap-1">
            <PlusCircle className="h-3 w-3" /> {counts.none} à créer
          </Badge>
          {counts.already > 0 && (
            <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> {counts.already} déjà liés
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg">Tableau d'association</CardTitle>
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              placeholder="Filtrer par nom ou adresse..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-64"
            />
            <Button size="sm" variant="outline" onClick={() => setAllAction("link")}>
              Tout lier (matches)
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAllAction("ignore")}>
              Tout ignorer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Chargement des restaurants Uber...</span>
            </div>
          ) : stores.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Aucun restaurant trouvé pour ce compte Uber.
            </p>
          ) : (
            <div className="overflow-auto max-h-[60vh] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Restaurant Uber</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="min-w-[260px]">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r) => (
                    <TableRow key={r.store.id}>
                      <TableCell>
                        <div className="font-medium">{r.store.name}</div>
                        {r.store.address && (
                          <div className="text-xs text-muted-foreground">{r.store.address}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.matchType === "exact" && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            ✨ Exact
                          </Badge>
                        )}
                        {r.matchType === "fuzzy" && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            ⚠ Probable
                          </Badge>
                        )}
                        {r.matchType === "none" && (
                          <Badge variant="outline">🆕 Aucun</Badge>
                        )}
                        {r.matchType === "already_linked" && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            ✓ Déjà lié
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.matchType === "already_linked" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={r.action}
                            onValueChange={(v) =>
                              setRow(r.store.id, { action: v as RowState["action"] })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="link">Lier</SelectItem>
                              <SelectItem value="create">Créer</SelectItem>
                              <SelectItem value="ignore">Ignorer</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.matchType === "already_linked" ? (
                          <span className="text-xs text-muted-foreground">
                            Lié à un restaurant existant
                          </span>
                        ) : r.action === "link" ? (
                          <Select
                            value={r.selectedRestaurantId ?? ""}
                            onValueChange={(v) =>
                              setRow(r.store.id, { selectedRestaurantId: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un restaurant CS..." />
                            </SelectTrigger>
                            <SelectContent>
                              {restaurants.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : r.action === "create" ? (
                          <Input
                            value={r.newName}
                            onChange={(e) =>
                              setRow(r.store.id, { newName: e.target.value })
                            }
                            placeholder="Nom du nouveau restaurant"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <X className="h-3 w-3" /> Ce store sera ignoré
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/uber-connections")}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || isLoading || rows.length === 0}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Confirmer les associations
        </Button>
      </div>
    </div>
  );
};

export default UberLinkStores;
