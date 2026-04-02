import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, Upload, ImageIcon } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useQueryClient } from "@tanstack/react-query";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const Account = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [chains, setChains] = useState<{ name: string; id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chainLogo, setChainLogo] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);

  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { selectedChainId } = useAnalyticsContext();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const [roleRes, chainsRes] = await Promise.all([
        supabase.rpc("get_user_role"),
        supabase
          .from("user_chain_access")
          .select("chain_id, chains(id, name, logo_url)")
          .eq("user_id", user.id)
          .not("chain_id", "is", null),
      ]);

      setRole(roleRes.data as string | null);
      const userChains = (chainsRes.data || [])
        .map((r: any) => ({ name: r.chains?.name, id: r.chains?.id }))
        .filter((c: any) => c.name);
      setChains(userChains);
      setLoading(false);
    };
    load();
  }, []);

  // Load chain logo data for the logo section
  useEffect(() => {
    const loadChainLogo = async () => {
      let targetChainId: string | null = null;

      if (isSuperAdmin && selectedChainId) {
        targetChainId = selectedChainId;
      } else if (role === "client" && chains.length === 1) {
        targetChainId = chains[0].id;
      }

      if (!targetChainId) {
        setChainLogo(null);
        return;
      }

      const { data } = await supabase
        .from("chains")
        .select("id, name, logo_url")
        .eq("id", targetChainId)
        .single();

      setChainLogo(data || null);
    };
    if (!loading) loadChainLogo();
  }, [isSuperAdmin, selectedChainId, role, chains, loading]);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chainLogo) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Format invalide", description: "Formats acceptés : PNG, JPG, WebP", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "Fichier trop volumineux", description: "Taille max : 2 MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${chainLogo.id}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("chain-logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erreur d'upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("chain-logos")
      .getPublicUrl(filePath);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update chains table
    const { error: updateError } = await supabase
      .from("chains")
      .update({ logo_url: publicUrl })
      .eq("id", chainLogo.id);

    if (updateError) {
      toast({ title: "Erreur", description: updateError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    setChainLogo({ ...chainLogo, logo_url: publicUrl });
    queryClient.invalidateQueries({ queryKey: ["chains-list"] });
    queryClient.invalidateQueries({ queryKey: ["chain-name-header"] });
    toast({ title: "Logo mis à jour", description: `Le logo de ${chainLogo.name} a été changé.` });
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const showLogoSection = chainLogo !== null;

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

      {showLogoSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo de ma marque — {chainLogo.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {chainLogo.logo_url ? (
                <img
                  src={chainLogo.logo_url}
                  alt={chainLogo.name}
                  className="h-16 w-16 rounded-md object-cover border"
                />
              ) : (
                <div className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {chainLogo.logo_url ? "Logo actuel" : "Aucun logo configuré"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WebP — max 2 MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Changer le logo
            </Button>
          </CardContent>
        </Card>
      )}

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
