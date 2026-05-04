import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Info, Loader2, ShieldAlert, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { validateUberStoreId } from "@/services/uberService";
import { Link } from "react-router-dom";

const UberConnections = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: restaurants, isLoading } = useQuery({
    queryKey: ["uber-connections-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, uber_store_id, chain_id, uber_pos_activated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSave = async (restaurantId: string, uuid: string) => {
    const trimmed = uuid.trim();
    if (!trimmed) return;
    setSavingId(restaurantId);
    try {
      const result = await validateUberStoreId(trimmed);
      if (!result.valid) {
        toast({ title: "UUID refusé", description: result.error, variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from("restaurants")
        .update({ uber_store_id: trimmed })
        .eq("id", restaurantId);
      if (error) throw error;
      toast({
        title: "Connecté",
        description: result.name ? `Store: ${result.name}` : "Store UUID enregistré.",
      });
      setDraft((p) => ({ ...p, [restaurantId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["uber-connections-restaurants"] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const connected = (restaurants ?? []).filter((r) => r.uber_store_id);
  const pending = (restaurants ?? []).filter((r) => !r.uber_store_id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Connexions Uber Eats</h2>
          <p className="text-muted-foreground">
            Brancher chaque restaurant aux rapports Uber via son Store UUID.
          </p>
        </div>
        {isSuperAdmin && pending.length > 1 && (
          <Button asChild>
            <Link to="/uber-store-bulk">Connexion en masse ({pending.length})</Link>
          </Button>
        )}
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Mode de connexion : Store UUID</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Le flow OAuth utilisateur Uber (login marchand) renvoie <code>invalid_scope</code> car notre
            application n'est pas autorisée pour les scopes utilisateur (Authorization Code Grant). Ces
            scopes sont réservés aux POS providers certifiés.
          </p>
          <p>
            En attendant l'éventuelle activation par Uber, nous utilisons la méthode officielle pour les
            non-POS : enregistrer manuellement le <strong>Store UUID</strong> de chaque restaurant.
            Les rapports financiers et de ventes sont ensuite synchronisés automatiquement par notre serveur.
          </p>
          <p className="text-sm">
            <strong>Trouver un Store UUID :</strong>{" "}
            <a
              href="https://merchants.ubereats.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              merchants.ubereats.com <ExternalLink className="h-3 w-3" />
            </a>{" "}
            → choisir un restaurant → copier l'UUID dans l'URL (<code>.../store/&lt;UUID&gt;/...</code>).
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Restaurants connectés ({connected.length})</CardTitle>
          <CardDescription>Synchronisation automatique des rapports activée.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connected.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun restaurant connecté.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Store UUID</TableHead>
                  <TableHead>Mapping</TableHead>
                  <TableHead>POS Reporting Uber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connected.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.uber_store_id}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Connecté</Badge>
                    </TableCell>
                    <TableCell>
                      {r.uber_pos_activated_at ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">POS activé</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">En attente POS</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>À connecter ({pending.length})</CardTitle>
            <CardDescription>Saisissez le Store UUID Uber pour activer la synchronisation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="w-[400px]">Store UUID Uber</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                    <TableCell>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={draft[r.id] ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                        className="font-mono text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={!draft[r.id]?.trim() || savingId === r.id}
                        onClick={() => handleSave(r.id, draft[r.id] ?? "")}
                      >
                        {savingId === r.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        Tester &amp; connecter
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isSuperAdmin && pending.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {pending.length} restaurant(s) en attente de connexion. Contactez un super-administrateur pour
            renseigner les Store UUIDs.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UberConnections;
