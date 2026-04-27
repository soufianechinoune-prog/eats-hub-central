import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { validateUberStoreId } from "@/services/uberService";
import { CheckCircle2, XCircle, Loader2, ShieldAlert, ExternalLink } from "lucide-react";
import { Navigate } from "react-router-dom";

type RowState = {
  value: string;
  status: "idle" | "validating" | "valid" | "invalid";
  message?: string;
};

const UberStoreBulkMapping = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: isSuperAdmin, isLoading: roleLoading } = useIsSuperAdmin();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const { data: restaurants, isLoading } = useQuery({
    queryKey: ["restaurants-uber-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, uber_store_id, chain_id")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!isSuperAdmin,
  });

  if (roleLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/overview" replace />;
  }

  const setRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { value: "", status: "idle", ...prev[id], ...patch },
    }));
  };

  const validateOne = async (restaurantId: string, uuid: string) => {
    setRow(restaurantId, { status: "validating", message: undefined });
    const result = await validateUberStoreId(uuid);
    if (result.valid) {
      setRow(restaurantId, {
        status: "valid",
        message: result.warning ?? (result.name ? `Store: ${result.name}` : "UUID valide"),
      });
    } else {
      setRow(restaurantId, {
        status: "invalid",
        message: result.error ?? "UUID invalide",
      });
    }
    return result.valid;
  };

  const saveOne = async (restaurantId: string, uuid: string) => {
    const trimmed = uuid.trim();
    if (!trimmed) return;
    const ok = await validateOne(restaurantId, trimmed);
    if (!ok) {
      toast({ title: "UUID invalide", description: rows[restaurantId]?.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("restaurants")
      .update({ uber_store_id: trimmed })
      .eq("id", restaurantId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sauvegardé", description: "Store UUID enregistré." });
    queryClient.invalidateQueries({ queryKey: ["restaurants-uber-mapping"] });
  };

  const validateAll = async () => {
    setBulkSaving(true);
    const entries = Object.entries(rows).filter(([, r]) => r.value.trim().length > 0);
    let ok = 0;
    let ko = 0;
    for (const [id, r] of entries) {
      const valid = await validateOne(id, r.value.trim());
      if (valid) {
        const { error } = await supabase
          .from("restaurants")
          .update({ uber_store_id: r.value.trim() })
          .eq("id", id);
        if (error) ko++;
        else ok++;
      } else {
        ko++;
      }
    }
    setBulkSaving(false);
    queryClient.invalidateQueries({ queryKey: ["restaurants-uber-mapping"] });
    toast({
      title: "Validation en masse terminée",
      description: `${ok} restaurant(s) connecté(s), ${ko} en erreur.`,
    });
  };

  const withoutUuid = (restaurants ?? []).filter((r) => !r.uber_store_id);
  const withUuid = (restaurants ?? []).filter((r) => r.uber_store_id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Connexion Uber Eats — Mapping en masse</h2>
          <p className="text-muted-foreground">
            Saisissez les Store UUIDs Uber pour brancher chaque restaurant aux rapports automatiques.
          </p>
        </div>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Pourquoi cette saisie manuelle&nbsp;?</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Uber n'a pas activé les scopes utilisateur (Authorization Code Grant) sur notre application. La
            connexion par "Login Uber Marchand" renvoie systématiquement <code>invalid_scope</code>.
          </p>
          <p>
            La méthode officielle pour brancher plusieurs restaurants sans être un POS provider certifié
            consiste à enregistrer directement le <strong>Store UUID Uber</strong> de chaque point de vente.
            Les rapports de ventes sont ensuite récupérés automatiquement via le token serveur (qui fonctionne).
          </p>
          <p className="text-sm">
            <strong>Comment trouver un Store UUID&nbsp;:</strong>
            <a
              href="https://merchants.ubereats.com/"
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-1 underline"
            >
              merchants.ubereats.com <ExternalLink className="h-3 w-3" />
            </a>
            &nbsp;→ sélectionnez un restaurant → l'UUID se trouve dans l'URL (<code>.../store/&lt;UUID&gt;/...</code>).
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Restaurants à connecter ({withoutUuid.length})</CardTitle>
            <CardDescription>Collez chaque Store UUID puis cliquez "Valider tous" ou ligne par ligne.</CardDescription>
          </div>
          <Button onClick={validateAll} disabled={bulkSaving || withoutUuid.length === 0}>
            {bulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Valider tous
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : withoutUuid.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Tous les restaurants ont un Store UUID Uber.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="w-[380px]">Store UUID Uber</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withoutUuid.map((r) => {
                  const row = rows[r.id] ?? { value: "", status: "idle" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={row.value}
                          onChange={(e) => setRow(r.id, { value: e.target.value, status: "idle" })}
                          className="font-mono text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        {row.status === "validating" && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Validation…
                          </span>
                        )}
                        {row.status === "valid" && (
                          <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> {row.message ?? "Valide"}
                          </Badge>
                        )}
                        {row.status === "invalid" && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> {row.message ?? "Invalide"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!row.value.trim() || row.status === "validating"}
                          onClick={() => saveOne(r.id, row.value)}
                        >
                          Tester &amp; sauver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restaurants déjà connectés ({withUuid.length})</CardTitle>
          <CardDescription>Vous pouvez réécraser un UUID via cette liste si besoin.</CardDescription>
        </CardHeader>
        <CardContent>
          {withUuid.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Aucun restaurant connecté pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Store UUID actuel</TableHead>
                  <TableHead className="text-right">Remplacer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withUuid.map((r) => {
                  const row = rows[r.id] ?? { value: "", status: "idle" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.uber_store_id}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            placeholder="Nouveau UUID…"
                            value={row.value}
                            onChange={(e) => setRow(r.id, { value: e.target.value, status: "idle" })}
                            className="w-64 font-mono text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!row.value.trim() || row.status === "validating"}
                            onClick={() => saveOne(r.id, row.value)}
                          >
                            Mettre à jour
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UberStoreBulkMapping;
