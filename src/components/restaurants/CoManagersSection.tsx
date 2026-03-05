import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Phone, MessageCircle, Mail, UserPlus } from "lucide-react";

interface CoManager {
  id: string;
  manager_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  email: string | null;
}

interface CoManagersSectionProps {
  restaurantId: string;
}

export function CoManagersSection({ restaurantId }: CoManagersSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  const { data: coManagers = [], isLoading } = useQuery({
    queryKey: ["co-managers", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_restaurants")
        .select(`
          id,
          manager_id,
          managers!inner(id, first_name, last_name, phone, email)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("role", "co-dirigeant");

      if (error) throw error;
      return (data || []).map((mr: any) => ({
        id: mr.id,
        manager_id: mr.manager_id,
        first_name: mr.managers.first_name,
        last_name: mr.managers.last_name,
        phone: mr.managers.phone,
        email: mr.managers.email,
      })) as CoManager[];
    },
    enabled: !!restaurantId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.phone.trim()) throw new Error("Le téléphone est requis");

      // Create manager
      const { data: manager, error: mErr } = await supabase
        .from("managers")
        .insert({
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          phone: form.phone,
          email: form.email || null,
        })
        .select("id")
        .single();

      if (mErr) throw mErr;

      // Link to restaurant
      const { error: lErr } = await supabase
        .from("manager_restaurants")
        .insert({
          manager_id: manager.id,
          restaurant_id: restaurantId,
          role: "co-dirigeant",
          is_primary: false,
        });

      if (lErr) throw lErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["co-managers", restaurantId] });
      toast({ title: "Co-dirigeant ajouté" });
      setShowDialog(false);
      setForm({ first_name: "", last_name: "", phone: "", email: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ linkId, managerId }: { linkId: string; managerId: string }) => {
      // Remove link
      await supabase.from("manager_restaurants").delete().eq("id", linkId);
      // Check if manager has other links
      const { count } = await supabase
        .from("manager_restaurants")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", managerId);
      // If no more links, delete manager
      if (count === 0) {
        await supabase.from("managers").delete().eq("id", managerId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["co-managers", restaurantId] });
      toast({ title: "Co-dirigeant supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    },
  });

  return (
    <div className="pt-4 border-t space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Co-dirigeant(s)</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowDialog(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement...</p>
      ) : coManagers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun co-dirigeant</p>
      ) : (
        <div className="space-y-2">
          {coManagers.map((cm) => (
            <div key={cm.id} className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium truncate">
                  {[cm.first_name, cm.last_name].filter(Boolean).join(" ") || "Sans nom"}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {cm.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {cm.phone}
                    </span>
                  )}
                  {cm.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {cm.email}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate({ linkId: cm.id, managerId: cm.manager_id })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un co-dirigeant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prénom</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="Prénom"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="Nom"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                Téléphone / WhatsApp *
              </Label>
              <PhoneInput
                value={form.phone}
                onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
                placeholder="06 12 34 56 78"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.phone.trim()}>
              {addMutation.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
