import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound } from "lucide-react";

const Account = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [chains, setChains] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const [roleRes, chainsRes] = await Promise.all([
        supabase.rpc("get_user_role"),
        supabase
          .from("user_chain_access")
          .select("chain_id, chains(name)")
          .eq("user_id", user.id)
          .not("chain_id", "is", null),
      ]);

      setRole(roleRes.data as string | null);
      setChains(
        (chainsRes.data || [])
          .map((r: any) => ({ name: r.chains?.name }))
          .filter((c: any) => c.name)
      );
      setLoading(false);
    };
    load();
  }, []);

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdating(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Mot de passe mis à jour." });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    importer: "Importateur",
    client: "Client",
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">Mon compte</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <Input value={email} disabled className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Rôle</label>
            <div className="mt-1">
              <Badge variant="secondary">{role ? roleLabels[role] || role : "Aucun"}</Badge>
            </div>
          </div>
          {chains.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Marques</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {chains.map((c) => (
                  <Badge key={c.name} variant="outline">{c.name}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nouveau mot de passe</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 caractères"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Confirmer le mot de passe</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer"
              className="mt-1"
            />
          </div>
          <Button onClick={handleUpdatePassword} disabled={updating}>
            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Mettre à jour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;
