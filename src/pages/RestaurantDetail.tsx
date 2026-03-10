import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/ui/phone-input";
import { formatPhoneNumber } from "@/lib/utils";
import OpeningHoursEditor from "@/components/restaurants/OpeningHoursEditor";
import { OpeningHoursAnalytics } from "@/components/restaurants/OpeningHoursAnalytics";
import { RestaurantDocuments } from "@/components/restaurants/RestaurantDocuments";
import { SiretValidation, type SiretAutoFillData } from "@/components/restaurants/SiretValidation";
import { CoManagersSection } from "@/components/restaurants/CoManagersSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Building2,
  User,
  CalendarDays,
  Pencil,
  Save,
  X,
  Phone,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select(`
          *
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: uberIds = [] } = useQuery({
    queryKey: ["restaurant-uber-ids", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_uber_ids")
        .select("*")
        .eq("restaurant_id", id!)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string | null | boolean>) => {
      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant", id] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast({ title: "Succès", description: "Restaurant mis à jour" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_active: isActive })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ["restaurant", id] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast({ 
        title: "Succès", 
        description: isActive ? "Restaurant activé" : "Restaurant désactivé" 
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (forceDelete: boolean = false) => {
      // If forceDelete, delete all related data first
      if (forceDelete) {
        // Delete in order of dependencies
        await supabase.from("order_items").delete().eq("restaurant_id", id);
        await supabase.from("order_errors").delete().eq("restaurant_id", id);
        await supabase.from("order_history").delete().eq("restaurant_id", id);
        await supabase.from("customer_reviews").delete().eq("restaurant_id", id);
        await supabase.from("menu_item_reviews").delete().eq("restaurant_id", id);
        await supabase.from("delivery_stats").delete().eq("restaurant_id", id);
        await supabase.from("downtime_logs").delete().eq("restaurant_id", id);
        await supabase.from("daily_revenue").delete().eq("restaurant_id", id);
        await supabase.from("daily_sales_uber").delete().eq("restaurant_id", id);
        await supabase.from("daily_conversion").delete().eq("restaurant_id", id);
        await supabase.from("daily_order_accuracy").delete().eq("restaurant_id", id);
        await supabase.from("monthly_revenue").delete().eq("restaurant_id", id);
        await supabase.from("monthly_fees").delete().eq("restaurant_id", id);
        await supabase.from("monthly_conversion").delete().eq("restaurant_id", id);
        await supabase.from("monthly_order_accuracy").delete().eq("restaurant_id", id);
        await supabase.from("hourly_availability").delete().eq("restaurant_id", id);
        await supabase.from("message_history").delete().eq("restaurant_id", id);
        await supabase.from("restaurant_actions").delete().eq("restaurant_id", id);
        await supabase.from("uber_connections").delete().eq("restaurant_id", id);
      }
      
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast({ title: "Succès", description: "Restaurant supprimé" });
      navigate("/restaurants");
    },
    onError: (error: Error & { code?: string; details?: string }) => {
      // Check if it's a foreign key constraint error
      if (error.message?.includes("foreign key constraint") || error.code === "23503") {
        toast({ 
          title: "Données liées existantes", 
          description: "Ce restaurant a des commandes, avis ou autres données associées. Utilisez 'Supprimer tout' pour supprimer toutes les données.", 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Erreur", description: "Impossible de supprimer le restaurant", variant: "destructive" });
      }
    },
  });

  const handleEdit = () => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || "",
        street: restaurant.street || "",
        postal_code: restaurant.postal_code || "",
        city: restaurant.city || "",
        siren: restaurant.siren || "",
        siret: (restaurant as any).siret || "",
        restaurant_phone: restaurant.restaurant_phone || "",
        restaurant_email: restaurant.restaurant_email || "",
        manager_first_name: restaurant.manager_first_name || "",
        manager_last_name: restaurant.manager_last_name || "",
        phone: restaurant.phone || "",
        manager_whatsapp: restaurant.manager_whatsapp || "",
        tablet_email: restaurant.tablet_email || "",
        tablet_password: restaurant.tablet_password || "",
        account_manager_name: restaurant.account_manager_name || "",
        account_manager_title: restaurant.account_manager_title || "",
        account_manager_phone: restaurant.account_manager_phone || "",
        account_manager_email: restaurant.account_manager_email || "",
        deliveroo_account_manager_name: restaurant.deliveroo_account_manager_name || "",
        deliveroo_account_manager_title: restaurant.deliveroo_account_manager_title || "",
        deliveroo_account_manager_phone: restaurant.deliveroo_account_manager_phone || "",
        deliveroo_account_manager_email: restaurant.deliveroo_account_manager_email || "",
        uber_opening_date: restaurant.uber_opening_date || "",
        uber_closing_date: restaurant.uber_closing_date || "",
        deliveroo_opening_date: restaurant.deliveroo_opening_date || "",
        deliveroo_closing_date: restaurant.deliveroo_closing_date || "",
        is_succursale: (restaurant as any).is_succursale ? "true" : "false",
        denomination_sociale: (restaurant as any).denomination_sociale || "",
        dirigeant_legal: (restaurant as any).dirigeant_legal || "",
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const updates: Record<string, string | null | boolean> = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "is_succursale") {
        updates[key] = value === "true";
      } else if (key === "manager_whatsapp" && value) {
        updates[key] = formatPhoneNumber(value);
      } else {
        updates[key] = value || null;
      }
    });
    updateMutation.mutate(updates);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSiretAutoFill = (data: SiretAutoFillData) => {
    setFormData(prev => ({
      ...prev,
      ...(data.rue && { street: data.rue }),
      ...(data.codePostal && { postal_code: data.codePostal }),
      ...(data.ville && { city: data.ville }),
      ...(data.denomination && { denomination_sociale: data.denomination }),
      ...((data.managerFirstName || data.managerLastName) && { dirigeant_legal: [data.managerFirstName, data.managerLastName].filter(Boolean).join(" ") }),
      ...(data.managerFirstName && { manager_first_name: data.managerFirstName }),
      ...(data.managerLastName && { manager_last_name: data.managerLastName }),
      ...(data.etat === "Fermé" && { is_active: "false" }),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/restaurants")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux restaurants
        </Button>
        <div className="text-center text-muted-foreground">Restaurant non trouvé</div>
      </div>
    );
  }

  const renderField = (label: string, field: string, type: string = "text", placeholder?: string) => {
    const value = isEditing ? formData[field] : (restaurant as Record<string, unknown>)[field];
    
    if (isEditing) {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input
            type={type}
            value={formData[field] || ""}
            onChange={(e) => handleInputChange(field, e.target.value)}
            placeholder={placeholder}
          />
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="font-medium">
          {value ? String(value) : <span className="text-muted-foreground italic">Non renseigné</span>}
        </p>
      </div>
    );
  };

  const renderPhoneField = (label: string, field: string, placeholder?: string, icon?: React.ReactNode) => {
    const value = (restaurant as Record<string, unknown>)[field];
    
    if (isEditing) {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            {icon}
            {label}
          </Label>
          <PhoneInput
            value={formData[field] || ""}
            onChange={(val) => handleInputChange(field, val)}
            placeholder={placeholder}
          />
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <p className="font-medium">
          {value ? String(value) : <span className="text-muted-foreground italic">Non renseigné</span>}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/restaurants")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{restaurant.name}</h2>
              {restaurant.is_active === false ? (
                <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                  Fermé{restaurant.uber_closing_date 
                    ? ` le ${new Date(restaurant.uber_closing_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` 
                    : ''}
                </Badge>
              ) : restaurant.csv_verified ? (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Validé</Badge>
              ) : restaurant.uber_store_id ? (
                <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">En attente</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Non connecté</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{restaurant.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer "{restaurant.name}" ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Vous pouvez :
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li><strong>Supprimer</strong> : Supprime le restaurant s'il n'a pas de données liées</li>
                          <li><strong>Supprimer tout</strong> : Supprime le restaurant ET toutes ses données (commandes, avis, revenus, etc.)</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(false)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteMutation.isPending}
                      >
                        Supprimer
                      </AlertDialogAction>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(true)}
                        className="bg-red-700 text-white hover:bg-red-800"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Suppression..." : "⚠️ Supprimer tout"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

      {/* Restaurant Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations générales */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="p-2 rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {renderField("Nom", "name", "text", "Nom du restaurant")}
              {renderField("Dénomination sociale", "denomination_sociale", "text", "Dénomination légale")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField("Dirigeant légal", "dirigeant_legal", "text", "Prénom Nom")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField("SIRET", "siret", "text", "123 456 789 00012")}
              <SiretValidation
                siret={isEditing ? formData["siret"] : (restaurant as any).siret}
                onAutoFill={isEditing ? handleSiretAutoFill : undefined}
              />
            </div>
            {renderField("Rue", "street", "text", "29 Avenue François Mitterrand")}
            <div className="grid grid-cols-2 gap-4">
              {renderField("Code postal", "postal_code", "text", "91200")}
              {renderField("Ville", "city", "text", "Athis-Mons")}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              {renderPhoneField("Téléphone", "restaurant_phone", "01 23 45 67 89", <Phone className="h-3 w-3" />)}
              {renderField("Email", "restaurant_email", "email", "contact@restaurant.com")}
            </div>
            <div className="pt-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Succursale</span>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData["is_succursale"] === "true"}
                      onCheckedChange={(checked) => handleInputChange("is_succursale", checked ? "true" : "false")}
                    />
                    <span className="text-sm">{formData["is_succursale"] === "true" ? "Oui" : "Non"}</span>
                  </div>
                ) : (
                  <p className="font-medium">
                    {(restaurant as any).is_succursale ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Succursale</Badge>
                    ) : (
                      "Franchise"
                    )}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gérant */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="p-2 rounded-md bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Gérant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {renderField("Prénom", "manager_first_name", "text", "Prénom")}
              {renderField("Nom", "manager_last_name", "text", "Nom")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderPhoneField("Téléphone", "phone", "06 12 34 56 78", <Phone className="h-3 w-3" />)}
              {renderPhoneField("WhatsApp", "manager_whatsapp", "06 12 34 56 78", <MessageCircle className="h-3 w-3" />)}
            </div>
            <CoManagersSection restaurantId={id!} />
          </CardContent>
        </Card>

        {/* Dates d'activité plateformes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="p-2 rounded-md bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Dates d'activité plateformes</CardTitle>
              <CardDescription className="text-xs">
                Les restaurants non actifs sur la période analysée sont exclus des moyennes réseau
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Uber Eats */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <UberEatsIcon className="h-5 w-5" />
                  <span className="font-medium text-green-600">Uber Eats</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {renderField("Ouverture", "uber_opening_date", "date")}
                  {renderField("Fermeture", "uber_closing_date", "date")}
                </div>
              </div>
              
              {/* Deliveroo */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <DeliverooIcon className="h-5 w-5" />
                  <span className="font-medium text-cyan-600">Deliveroo</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {renderField("Ouverture", "deliveroo_opening_date", "date")}
                  {renderField("Fermeture", "deliveroo_closing_date", "date")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <RestaurantDocuments restaurantId={id!} />

      {/* Opening Hours Analytics */}
      <OpeningHoursAnalytics restaurantId={id!} restaurantName={restaurant.name} />

      {/* Opening Hours Editor */}
      <OpeningHoursEditor restaurantId={id!} />


      {/* Active Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statut du restaurant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {restaurant.is_active ? "Restaurant actif" : "Restaurant inactif"}
              </p>
              <p className="text-sm text-muted-foreground">
                {restaurant.is_active
                  ? "Le restaurant est visible et peut recevoir des commandes"
                  : "Le restaurant est masqué et ne reçoit pas de commandes"}
              </p>
            </div>
            <Switch
              checked={restaurant.is_active ?? true}
              onCheckedChange={(checked) => toggleActiveMutation.mutate(checked)}
              disabled={toggleActiveMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantDetail;