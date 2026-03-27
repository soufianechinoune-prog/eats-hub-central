import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, User, Tablet, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneNumber } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useQuery } from "@tanstack/react-query";

interface RestaurantForm {
  name: string;
  street: string;
  postal_code: string;
  city: string;
  siren: string;
  siret: string;
  restaurant_phone: string;
  restaurant_email: string;
  manager_first_name: string;
  manager_last_name: string;
  phone: string;
  manager_whatsapp: string;
  tablet_email: string;
  tablet_password: string;
  account_manager_name: string;
  account_manager_title: string;
  account_manager_phone: string;
  account_manager_email: string;
  deliveroo_account_manager_name: string;
  deliveroo_account_manager_title: string;
  deliveroo_account_manager_phone: string;
  deliveroo_account_manager_email: string;
  uber_opening_date: string;
  uber_closing_date: string;
  deliveroo_opening_date: string;
  deliveroo_closing_date: string;
  is_succursale: boolean;
}

const initialFormState: RestaurantForm = {
  name: "",
  street: "",
  postal_code: "",
  city: "",
  siren: "",
  siret: "",
  restaurant_phone: "",
  restaurant_email: "",
  manager_first_name: "",
  manager_last_name: "",
  phone: "",
  manager_whatsapp: "",
  tablet_email: "",
  tablet_password: "",
  account_manager_name: "",
  account_manager_title: "",
  account_manager_phone: "",
  account_manager_email: "",
  deliveroo_account_manager_name: "",
  deliveroo_account_manager_title: "",
  deliveroo_account_manager_phone: "",
  deliveroo_account_manager_email: "",
  uber_opening_date: "",
  uber_closing_date: "",
  deliveroo_opening_date: "",
  deliveroo_closing_date: "",
  is_succursale: false,
};

interface RestaurantFormDialogProps {
  onSuccess: () => void;
}

export function RestaurantFormDialog({ onSuccess }: RestaurantFormDialogProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState<RestaurantForm>(initialFormState);
  const [selectedFormChainId, setSelectedFormChainId] = useState<string>("");
  const { selectedChainId } = useAnalyticsContext();

  const { data: chains } = useQuery({
    queryKey: ["chains-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chains")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // When dialog opens, pre-fill chain from context
  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (open) {
      setSelectedFormChainId(selectedChainId || "");
    }
  };

  const handleInputChange = (field: keyof RestaurantForm, value: string) => {
    setNewRestaurant((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.city) {
      toast({
        title: "Erreur",
        description: "Le nom et la ville sont obligatoires",
        variant: "destructive",
      });
      return;
    }

    // Fetch or create a default chain
    let { data: chain } = await supabase
      .from("chains")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!chain) {
      // Create a default chain if none exists
      const { data: newChain, error: chainError } = await supabase
        .from("chains")
        .insert({ name: "Default Chain" })
        .select("id")
        .single();
      
      if (chainError || !newChain) {
        toast({
          title: "Erreur",
          description: "Impossible de créer la chaîne par défaut",
          variant: "destructive",
        });
        return;
      }
      chain = newChain;
    }

    const { error } = await supabase.from("restaurants").insert({
      chain_id: chain.id,
      name: newRestaurant.name,
      street: newRestaurant.street || null,
      postal_code: newRestaurant.postal_code || null,
      city: newRestaurant.city,
      siren: newRestaurant.siren || null,
      siret: (newRestaurant.siret || "").replace(/\s/g, "") || null,
      restaurant_phone: newRestaurant.restaurant_phone || null,
      restaurant_email: newRestaurant.restaurant_email || null,
      manager_first_name: newRestaurant.manager_first_name || null,
      manager_last_name: newRestaurant.manager_last_name || null,
      phone: newRestaurant.phone || null,
      manager_whatsapp: formatPhoneNumber(newRestaurant.manager_whatsapp) || null,
      tablet_email: newRestaurant.tablet_email || null,
      tablet_password: newRestaurant.tablet_password || null,
      account_manager_name: newRestaurant.account_manager_name || null,
      account_manager_title: newRestaurant.account_manager_title || null,
      account_manager_phone: newRestaurant.account_manager_phone || null,
      account_manager_email: newRestaurant.account_manager_email || null,
      deliveroo_account_manager_name: newRestaurant.deliveroo_account_manager_name || null,
      deliveroo_account_manager_title: newRestaurant.deliveroo_account_manager_title || null,
      deliveroo_account_manager_phone: newRestaurant.deliveroo_account_manager_phone || null,
      deliveroo_account_manager_email: newRestaurant.deliveroo_account_manager_email || null,
      uber_opening_date: newRestaurant.uber_opening_date || null,
      uber_closing_date: newRestaurant.uber_closing_date || null,
      deliveroo_opening_date: newRestaurant.deliveroo_opening_date || null,
      deliveroo_closing_date: newRestaurant.deliveroo_closing_date || null,
      is_succursale: newRestaurant.is_succursale,
      is_active: true,
    } as any);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le restaurant",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Restaurant ajouté avec succès",
    });

    setIsDialogOpen(false);
    setNewRestaurant(initialFormState);
    onSuccess();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Nouveau restaurant</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Informations générales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-4 w-4" />
              <h3 className="font-semibold text-sm uppercase tracking-wide">
                Informations générales
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du restaurant *</Label>
                <Input
                  id="name"
                  placeholder="Chicken Street Athis-Mons"
                  value={newRestaurant.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siren">SIREN</Label>
                <Input
                  id="siren"
                  placeholder="123 456 789"
                  value={newRestaurant.siren}
                  onChange={(e) => handleInputChange("siren", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input
                  id="siret"
                  placeholder="123 456 789 00012"
                  value={newRestaurant.siret}
                  onChange={(e) => handleInputChange("siret", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="is_succursale"
                checked={newRestaurant.is_succursale}
                onCheckedChange={(checked) => setNewRestaurant(prev => ({ ...prev, is_succursale: checked }))}
              />
              <Label htmlFor="is_succursale">Succursale</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Rue</Label>
              <Input
                id="street"
                placeholder="29 Avenue François Mitterrand"
                value={newRestaurant.street}
                onChange={(e) => handleInputChange("street", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Code postal</Label>
                <Input
                  id="postal_code"
                  placeholder="91200"
                  value={newRestaurant.postal_code}
                  onChange={(e) => handleInputChange("postal_code", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  placeholder="Athis-Mons"
                  value={newRestaurant.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant_phone">Téléphone restaurant</Label>
                <PhoneInput
                  id="restaurant_phone"
                  value={newRestaurant.restaurant_phone}
                  onChange={(value) => handleInputChange("restaurant_phone", value)}
                  placeholder="01 23 45 67 89"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant_email">Email restaurant</Label>
                <Input
                  id="restaurant_email"
                  type="email"
                  placeholder="contact@restaurant.com"
                  value={newRestaurant.restaurant_email}
                  onChange={(e) => handleInputChange("restaurant_email", e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Gérant */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <User className="h-4 w-4" />
              <h3 className="font-semibold text-sm uppercase tracking-wide">
                Gérant
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manager_first_name">Prénom</Label>
                <Input
                  id="manager_first_name"
                  placeholder="Jean"
                  value={newRestaurant.manager_first_name}
                  onChange={(e) => handleInputChange("manager_first_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_last_name">Nom</Label>
                <Input
                  id="manager_last_name"
                  placeholder="Dupont"
                  value={newRestaurant.manager_last_name}
                  onChange={(e) => handleInputChange("manager_last_name", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <PhoneInput
                  id="phone"
                  value={newRestaurant.phone}
                  onChange={(value) => handleInputChange("phone", value)}
                  placeholder="06 12 34 56 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_whatsapp">WhatsApp</Label>
                <PhoneInput
                  id="manager_whatsapp"
                  value={newRestaurant.manager_whatsapp}
                  onChange={(value) => handleInputChange("manager_whatsapp", value)}
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Accès Tablette Uber */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Tablet className="h-4 w-4" />
              <h3 className="font-semibold text-sm uppercase tracking-wide">
                Accès Tablette Uber
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tablet_email">Email</Label>
                <Input
                  id="tablet_email"
                  type="email"
                  placeholder="restaurant@email.com"
                  value={newRestaurant.tablet_email}
                  onChange={(e) => handleInputChange("tablet_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tablet_password">Mot de passe</Label>
                <Input
                  id="tablet_password"
                  type="password"
                  placeholder="••••••••"
                  value={newRestaurant.tablet_password}
                  onChange={(e) => handleInputChange("tablet_password", e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Manager Uber */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <UserCheck className="h-4 w-4" />
              <h3 className="font-semibold text-sm uppercase tracking-wide">
                Account Manager Uber Eats
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_manager_name">Nom complet</Label>
                <Input
                  id="account_manager_name"
                  placeholder="Camille LAMPIN"
                  value={newRestaurant.account_manager_name}
                  onChange={(e) => handleInputChange("account_manager_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_manager_title">Titre</Label>
                <Input
                  id="account_manager_title"
                  placeholder="Account Manager Territory, France"
                  value={newRestaurant.account_manager_title}
                  onChange={(e) => handleInputChange("account_manager_title", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_manager_phone">Téléphone</Label>
                <PhoneInput
                  id="account_manager_phone"
                  value={newRestaurant.account_manager_phone}
                  onChange={(value) => handleInputChange("account_manager_phone", value)}
                  placeholder="07 87 77 86 58"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_manager_email">Email</Label>
                <Input
                  id="account_manager_email"
                  type="email"
                  placeholder="camille.lampin@uber.com"
                  value={newRestaurant.account_manager_email}
                  onChange={(e) => handleInputChange("account_manager_email", e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Manager Deliveroo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-600">
              <UserCheck className="h-4 w-4" />
              <h3 className="font-semibold text-sm uppercase tracking-wide">
                Account Manager Deliveroo
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveroo_account_manager_name">Nom complet</Label>
                <Input
                  id="deliveroo_account_manager_name"
                  placeholder="Marie MARTIN"
                  value={newRestaurant.deliveroo_account_manager_name}
                  onChange={(e) => handleInputChange("deliveroo_account_manager_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveroo_account_manager_title">Titre</Label>
                <Input
                  id="deliveroo_account_manager_title"
                  placeholder="Account Manager, France"
                  value={newRestaurant.deliveroo_account_manager_title}
                  onChange={(e) => handleInputChange("deliveroo_account_manager_title", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveroo_account_manager_phone">Téléphone</Label>
                <PhoneInput
                  id="deliveroo_account_manager_phone"
                  value={newRestaurant.deliveroo_account_manager_phone}
                  onChange={(value) => handleInputChange("deliveroo_account_manager_phone", value)}
                  placeholder="07 12 34 56 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveroo_account_manager_email">Email</Label>
                <Input
                  id="deliveroo_account_manager_email"
                  type="email"
                  placeholder="marie.martin@deliveroo.com"
                  value={newRestaurant.deliveroo_account_manager_email}
                  onChange={(e) => handleInputChange("deliveroo_account_manager_email", e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button onClick={handleAddRestaurant} className="w-full mt-4" size="lg">
            Créer le restaurant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}