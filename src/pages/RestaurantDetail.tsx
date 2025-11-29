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
  Tablet,
  UserCheck,
  TrendingUp,
  BarChart3,
  Receipt,
  Pencil,
  Save,
  X,
  Phone,
  Mail,
  MessageCircle,
  Trash2,
} from "lucide-react";

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
          *,
          uber_connections (id)
        `)
        .eq("id", id)
        .single();
      
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
    mutationFn: async () => {
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
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le restaurant", variant: "destructive" });
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
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const updates: Record<string, string | null> = {};
    Object.entries(formData).forEach(([key, value]) => {
      updates[key] = value || null;
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

  const dataEntryLinks = [
    {
      title: "CA & Commandes",
      description: "Saisir le chiffre d'affaires et nombre de commandes",
      icon: TrendingUp,
      href: `/data-entry/revenue?restaurant=${id}`,
    },
    {
      title: "Conversion",
      description: "Saisir les métriques de conversion (visites, vues, paniers)",
      icon: BarChart3,
      href: `/data-entry/conversion?restaurant=${id}`,
    },
    {
      title: "Frais",
      description: "Saisir les frais mensuels (commissions, marketing, offres)",
      icon: Receipt,
      href: `/data-entry/fees?restaurant=${id}`,
    },
  ];

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
              {restaurant.is_active ? (
                <Badge className="bg-accent text-accent-foreground">Actif</Badge>
              ) : (
                <Badge variant="outline">Inactif</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{restaurant.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Toggle Active Status */}
          <div className="flex items-center gap-2">
            <Label htmlFor="active-toggle" className="text-sm text-muted-foreground">
              {restaurant.is_active ? "Actif" : "Inactif"}
            </Label>
            <Switch
              id="active-toggle"
              checked={restaurant.is_active ?? false}
              onCheckedChange={(checked) => toggleActiveMutation.mutate(checked)}
              disabled={toggleActiveMutation.isPending}
            />
          </div>
          
          <div className="flex gap-2">
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
                      <AlertDialogTitle>Supprimer ce restaurant ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Toutes les données associées à ce restaurant seront définitivement supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions - Data Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Saisie de données</CardTitle>
          <CardDescription>Accédez rapidement aux formulaires de saisie pour ce restaurant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dataEntryLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <link.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{link.title}</p>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

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
              {renderField("SIREN", "siren", "text", "123 456 789")}
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
          </CardContent>
        </Card>

        {/* Accès Tablette */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="p-2 rounded-md bg-primary/10">
              <Tablet className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Accès Tablette Uber</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {renderField("Email", "tablet_email", "email", "Email de connexion")}
            </div>
            {renderField("Mot de passe", "tablet_password", "password", "Mot de passe")}
            {!isEditing && restaurant.tablet_password && (
              <p className="text-xs text-muted-foreground">
                Le mot de passe est masqué pour des raisons de sécurité
              </p>
            )}
          </CardContent>
        </Card>

        {/* Account Manager */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <div className="p-2 rounded-md bg-primary/10">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Account Manager Uber</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {renderField("Nom", "account_manager_name", "text", "Nom complet")}
              {renderField("Titre", "account_manager_title", "text", "Account Manager Territory, France")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderPhoneField("Téléphone", "account_manager_phone", "7 87 77 86 58", <Phone className="h-3 w-3" />)}
              {renderField("Email", "account_manager_email", "email", "email@uber.com")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connexion Uber Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connexion API Uber</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {Array.isArray(restaurant.uber_connections) && restaurant.uber_connections.length > 0
                  ? "Connecté à l'API Uber Eats"
                  : "Non connecté à l'API Uber Eats"}
              </p>
              <p className="text-sm text-muted-foreground">
                {restaurant.uber_store_id
                  ? `Store ID: ${restaurant.uber_store_id}`
                  : "Aucun Store ID configuré"}
              </p>
            </div>
            {Array.isArray(restaurant.uber_connections) && restaurant.uber_connections.length > 0 ? (
              <Badge className="bg-accent text-accent-foreground">Connecté</Badge>
            ) : (
              <Button variant="outline" onClick={() => navigate("/uber-connections")}>
                Configurer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantDetail;
