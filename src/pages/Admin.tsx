import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, UserPlus, Plus, Building2, Users, Loader2 } from "lucide-react";
import AdminBillingSection from "@/components/admin/AdminBillingSection";

interface UserAccess {
  access_id: string;
  role: string;
  chain_id: string | null;
  chain_name: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  accesses: UserAccess[];
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useIsSuperAdmin();

  // Redirect if not super_admin
  useEffect(() => {
    if (!checkingAdmin && isSuperAdmin === false) {
      toast({ title: "Accès non autorisé", variant: "destructive" });
      navigate("/");
    }
  }, [checkingAdmin, isSuperAdmin, navigate, toast]);

  // Form state for creating user
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("client");
  const [newChainIds, setNewChainIds] = useState<string[]>([]);

  // Form state for adding access to existing user
  const [accessUserId, setAccessUserId] = useState("");
  const [accessRole, setAccessRole] = useState<string>("client");
  const [accessChainIds, setAccessChainIds] = useState<string[]>([]);

  // Form state for new chain
  const [newChainName, setNewChainName] = useState("");

  // Fetch users via edge function
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      return res.data as { users: AdminUser[] };
    },
    enabled: isSuperAdmin === true,
  });

  // Fetch chains
  const { data: chains } = useQuery({
    queryKey: ["admin-chains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chains")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin === true,
  });

  // Fetch chains with restaurant count
  const { data: chainsWithCount } = useQuery({
    queryKey: ["admin-chains-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chains")
        .select("id, name, restaurants(count)")
        .order("name");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        restaurant_count: c.restaurants?.[0]?.count || 0,
      }));
    },
    enabled: isSuperAdmin === true,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-create-user", {
        body: { email: newEmail, role: newRole, chain_ids: newChainIds },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Compte créé", description: `${newEmail} — mot de passe temporaire : ChangeMe123!` });
      setNewEmail("");
      setNewChainIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Add access mutation (for existing user)
  const addAccessMutation = useMutation({
    mutationFn: async () => {
      const rows = accessChainIds.map((chain_id) => ({
        user_id: accessUserId,
        chain_id,
        role: accessRole,
      }));
      const { error } = await supabase.from("user_chain_access").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Accès attribué" });
      setAccessUserId("");
      setAccessChainIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Delete access mutation
  const deleteAccessMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-delete-access", {
        body: { access_id: accessId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast({ title: "Accès supprimé" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Create chain mutation
  const createChainMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chains").insert({ name: newChainName.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marque créée" });
      setNewChainName("");
      queryClient.invalidateQueries({ queryKey: ["admin-chains"] });
      queryClient.invalidateQueries({ queryKey: ["admin-chains-count"] });
      queryClient.invalidateQueries({ queryKey: ["chains-list"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Delete chain mutation
  const deleteChainMutation = useMutation({
    mutationFn: async (chainId: string) => {
      const { error } = await supabase.from("chains").delete().eq("id", chainId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marque supprimée" });
      queryClient.invalidateQueries({ queryKey: ["admin-chains"] });
      queryClient.invalidateQueries({ queryKey: ["admin-chains-count"] });
      queryClient.invalidateQueries({ queryKey: ["chains-list"] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const toggleChainSelection = (chainId: string, target: "new" | "access") => {
    const setter = target === "new" ? setNewChainIds : setAccessChainIds;
    const current = target === "new" ? newChainIds : accessChainIds;
    if (current.includes(chainId)) {
      setter(current.filter((id) => id !== chainId));
    } else {
      setter([...current, chainId]);
    }
  };

  if (checkingAdmin || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const users = usersData?.users || [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Administration</h1>

      {/* SECTION 1: User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestion des utilisateurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Users table */}
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle(s)</TableHead>
                  <TableHead>Marques</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      {user.accesses.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Aucun accès</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(user.accesses.map((a) => a.role))].map((role) => (
                            <Badge key={role} variant={role === "super_admin" ? "default" : "secondary"}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.accesses
                          .filter((a) => a.chain_id !== null)
                          .map((a) => (
                            <Badge key={a.access_id} variant="outline">
                              {a.chain_name}
                            </Badge>
                          ))}
                        {user.accesses.some((a) => a.chain_id === null) && (
                          <Badge variant="default">Toutes</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.accesses
                        .filter((a) => a.role !== "super_admin")
                        .map((a) => (
                          <Button
                            key={a.access_id}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteAccessMutation.mutate(a.access_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Create user form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Créer un compte
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="importer">Importer</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {chains?.map((chain) => (
                  <Badge
                    key={chain.id}
                    variant={newChainIds.includes(chain.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleChainSelection(chain.id, "new")}
                  >
                    {chain.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              onClick={() => createUserMutation.mutate()}
              disabled={!newEmail || newChainIds.length === 0 || createUserMutation.isPending}
            >
              {createUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Créer le compte
            </Button>
          </div>

          {/* Add access to existing user */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Attribuer un accès (utilisateur existant)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={accessUserId} onValueChange={setAccessUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accessRole} onValueChange={setAccessRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="importer">Importer</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {chains?.map((chain) => (
                  <Badge
                    key={chain.id}
                    variant={accessChainIds.includes(chain.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleChainSelection(chain.id, "access")}
                  >
                    {chain.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              onClick={() => addAccessMutation.mutate()}
              disabled={!accessUserId || accessChainIds.length === 0 || addAccessMutation.isPending}
            >
              {addAccessMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Attribuer l'accès
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Brand Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Gestion des marques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marque</TableHead>
                <TableHead>Restaurants</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chainsWithCount?.map((chain) => (
                <TableRow key={chain.id}>
                  <TableCell className="font-medium">{chain.name}</TableCell>
                  <TableCell>{chain.restaurant_count}</TableCell>
                  <TableCell>
                    {chain.restaurant_count === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteChainMutation.mutate(chain.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex gap-3">
            <Input
              placeholder="Nom de la nouvelle marque"
              value={newChainName}
              onChange={(e) => setNewChainName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newChainName.trim() && createChainMutation.mutate()}
              className="max-w-sm"
            />
            <Button
              onClick={() => createChainMutation.mutate()}
              disabled={!newChainName.trim() || createChainMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
