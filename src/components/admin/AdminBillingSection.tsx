import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, CreditCard, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AdminUser {
  id: string;
  email: string;
}

interface AdminBillingSectionProps {
  users: AdminUser[];
}

export default function AdminBillingSection({ users }: AdminBillingSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscription form state
  const [subRestaurantId, setSubRestaurantId] = useState("");
  const [subPayerId, setSubPayerId] = useState("");
  const [subPrice, setSubPrice] = useState("190");
  const [subNotes, setSubNotes] = useState("");

  // Grant form state
  const [grantRestaurantId, setGrantRestaurantId] = useState("");
  const [grantToUserId, setGrantToUserId] = useState("");
  const [grantByUserId, setGrantByUserId] = useState("");

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["admin-restaurants-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, chains(name)")
        .order("name");
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        chain_name: r.chains?.name || "—",
      }));
    },
  });

  // Fetch subscriptions
  const { data: subscriptions, isLoading: loadingSubs } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, restaurants(name, chains(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        restaurant_name: s.restaurants?.name || "—",
        chain_name: s.restaurants?.chains?.name || "—",
      }));
    },
  });

  // Fetch grants
  const { data: grants, isLoading: loadingGrants } = useQuery({
    queryKey: ["admin-visibility-grants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_visibility_grants")
        .select("*, restaurants(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g,
        restaurant_name: g.restaurants?.name || "—",
      }));
    },
  });

  const getUserEmail = (userId: string) =>
    users.find((u) => u.id === userId)?.email || userId.slice(0, 8) + "…";

  // Create subscription
  const createSubMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscriptions").insert({
        restaurant_id: subRestaurantId,
        payer_user_id: subPayerId,
        monthly_price: parseFloat(subPrice),
        notes: subNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Abonnement activé" });
      setSubRestaurantId("");
      setSubPayerId("");
      setSubPrice("190");
      setSubNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Delete subscription
  const deleteSubMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Abonnement supprimé" });
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Create grant
  const createGrantMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("restaurant_visibility_grants").insert({
        restaurant_id: grantRestaurantId,
        granted_to_user_id: grantToUserId,
        granted_by_user_id: grantByUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Visibilité accordée" });
      setGrantRestaurantId("");
      setGrantToUserId("");
      setGrantByUserId("");
      queryClient.invalidateQueries({ queryKey: ["admin-visibility-grants"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Delete grant
  const deleteGrantMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_visibility_grants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Visibilité révoquée" });
      queryClient.invalidateQueries({ queryKey: ["admin-visibility-grants"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const statusVariant = (s: string) =>
    s === "active" ? "default" : s === "trial" ? "secondary" : "outline";

  return (
    <>
      {/* Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Facturation & Abonnements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingSubs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Marque</TableHead>
                  <TableHead>Payeur</TableHead>
                  <TableHead>Prix/mois</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Activation</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucun abonnement
                    </TableCell>
                  </TableRow>
                )}
                {subscriptions?.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.restaurant_name}</TableCell>
                    <TableCell>{sub.chain_name}</TableCell>
                    <TableCell>{getUserEmail(sub.payer_user_id)}</TableCell>
                    <TableCell>{sub.monthly_price} €</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {sub.activated_at ? format(new Date(sub.activated_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteSubMutation.mutate(sub.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Create subscription form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Activer un abonnement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={subRestaurantId} onValueChange={setSubRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.chain_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={subPayerId} onValueChange={setSubPayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Payeur" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Prix mensuel HT"
                value={subPrice}
                onChange={(e) => setSubPrice(e.target.value)}
              />
              <Textarea
                placeholder="Notes (optionnel)"
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                className="min-h-[40px]"
              />
            </div>
            <Button
              onClick={() => createSubMutation.mutate()}
              disabled={!subRestaurantId || !subPayerId || createSubMutation.isPending}
            >
              {createSubMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Activer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visibility Grants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Autorisations de visibilité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingGrants ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Accordé à</TableHead>
                  <TableHead>Accordé par</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucune autorisation
                    </TableCell>
                  </TableRow>
                )}
                {grants?.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.restaurant_name}</TableCell>
                    <TableCell>{getUserEmail(g.granted_to_user_id)}</TableCell>
                    <TableCell>{getUserEmail(g.granted_by_user_id)}</TableCell>
                    <TableCell>
                      {g.created_at ? format(new Date(g.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteGrantMutation.mutate(g.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Create grant form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Accorder visibilité</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={grantRestaurantId} onValueChange={setGrantRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={grantToUserId} onValueChange={setGrantToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Accorder à" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={grantByUserId} onValueChange={setGrantByUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Accordé par" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createGrantMutation.mutate()}
              disabled={!grantRestaurantId || !grantToUserId || !grantByUserId || createGrantMutation.isPending}
            >
              {createGrantMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Accorder
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
