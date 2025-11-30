import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MessageSquare,
  Search,
  Send,
  CheckCircle2,
  ArrowRight,
  X,
  Phone,
  User,
  Store,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Restaurant {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_whatsapp: string | null;
  is_active: boolean | null;
}

export default function Messaging() {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  
  // Sequential send dialog state
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  const [sentRestaurants, setSentRestaurants] = useState<Set<string>>(new Set());

  // Fetch restaurants
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-messaging"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, postal_code, manager_first_name, manager_last_name, manager_whatsapp, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    restaurants.forEach((r) => {
      if (r.postal_code) {
        depts.add(r.postal_code.substring(0, 2));
      }
    });
    return Array.from(depts).sort();
  }, [restaurants]);

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchLower) ||
        r.city?.toLowerCase().includes(searchLower) ||
        `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.toLowerCase().includes(searchLower);

      // Department filter
      const matchesDepartment =
        departmentFilter === "all" ||
        (r.postal_code && r.postal_code.startsWith(departmentFilter));

      return matchesSearch && matchesDepartment;
    });
  }, [restaurants, searchQuery, departmentFilter]);

  // Restaurants with WhatsApp
  const restaurantsWithWhatsApp = useMemo(() => {
    return filteredRestaurants.filter((r) => r.manager_whatsapp);
  }, [filteredRestaurants]);

  // Selected restaurants list for sending
  const selectedRestaurantsList = useMemo(() => {
    return restaurantsWithWhatsApp.filter((r) => selectedRestaurants.has(r.id));
  }, [restaurantsWithWhatsApp, selectedRestaurants]);

  // Toggle selection
  const toggleRestaurant = (id: string) => {
    const newSelected = new Set(selectedRestaurants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRestaurants(newSelected);
  };

  // Select all with WhatsApp
  const selectAll = () => {
    const allIds = restaurantsWithWhatsApp.map((r) => r.id);
    setSelectedRestaurants(new Set(allIds));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedRestaurants(new Set());
  };

  // Format phone for WhatsApp (remove spaces, ensure +33 format)
  const formatWhatsAppNumber = (phone: string) => {
    let cleaned = phone.replace(/\s/g, "").replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "+33" + cleaned.substring(1);
    }
    if (!cleaned.startsWith("+")) {
      cleaned = "+33" + cleaned;
    }
    return cleaned;
  };

  // Generate personalized message
  const getPersonalizedMessage = (restaurant: Restaurant) => {
    let personalizedMsg = message;
    personalizedMsg = personalizedMsg.replace(/{prenom}/g, restaurant.manager_first_name || "");
    personalizedMsg = personalizedMsg.replace(/{nom}/g, restaurant.manager_last_name || "");
    personalizedMsg = personalizedMsg.replace(/{restaurant}/g, restaurant.name);
    return personalizedMsg;
  };

  // Open WhatsApp for current restaurant
  const openWhatsApp = (restaurant: Restaurant) => {
    if (!restaurant.manager_whatsapp) return;
    
    const phone = formatWhatsAppNumber(restaurant.manager_whatsapp);
    const text = encodeURIComponent(getPersonalizedMessage(restaurant));
    const url = `https://wa.me/${phone.replace("+", "")}?text=${text}`;
    
    // Use anchor element to avoid COOP blocking in Safari
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Mark as sent
    setSentRestaurants((prev) => new Set([...prev, restaurant.id]));
  };

  // Start send process
  const startSending = () => {
    if (selectedRestaurantsList.length === 0 || !message.trim()) return;
    setCurrentSendIndex(0);
    setSentRestaurants(new Set());
    setIsSendDialogOpen(true);
  };

  // Handle next in sequence
  const handleNext = () => {
    if (currentSendIndex < selectedRestaurantsList.length - 1) {
      setCurrentSendIndex((prev) => prev + 1);
    } else {
      // All done
      setIsSendDialogOpen(false);
      setSelectedRestaurants(new Set());
      setMessage("");
    }
  };

  // Current restaurant in send flow
  const currentRestaurant = selectedRestaurantsList[currentSendIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messagerie</h1>
          <p className="text-muted-foreground">
            Envoyez des messages WhatsApp aux gérants de vos restaurants
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <MessageSquare className="h-5 w-5 mr-2" />
          {selectedRestaurants.size} sélectionné{selectedRestaurants.size > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Restaurant Selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" />
                Sélection des restaurants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par nom, ville, gérant..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Département" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les départements</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        Département {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selection actions */}
              <div className="flex items-center gap-2 text-sm">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Tout sélectionner ({restaurantsWithWhatsApp.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Tout désélectionner
                </Button>
                <span className="text-muted-foreground ml-auto">
                  {filteredRestaurants.length - restaurantsWithWhatsApp.length} sans WhatsApp
                </span>
              </div>

              {/* Restaurant list */}
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Gérant</TableHead>
                      <TableHead>WhatsApp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Chargement...
                        </TableCell>
                      </TableRow>
                    ) : filteredRestaurants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Aucun restaurant trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRestaurants.map((restaurant) => {
                        const hasWhatsApp = !!restaurant.manager_whatsapp;
                        return (
                          <TableRow
                            key={restaurant.id}
                            className={!hasWhatsApp ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}
                            onClick={() => hasWhatsApp && toggleRestaurant(restaurant.id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedRestaurants.has(restaurant.id)}
                                disabled={!hasWhatsApp}
                                onCheckedChange={() => toggleRestaurant(restaurant.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{restaurant.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {restaurant.city} {restaurant.postal_code && `(${restaurant.postal_code.substring(0, 2)})`}
                              </div>
                            </TableCell>
                            <TableCell>
                              {restaurant.manager_first_name || restaurant.manager_last_name ? (
                                <span>
                                  {restaurant.manager_first_name} {restaurant.manager_last_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasWhatsApp ? (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {restaurant.manager_whatsapp}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Non renseigné</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: Message Composition */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  placeholder="Rédigez votre message ici...

Variables disponibles :
{prenom} - Prénom du gérant
{nom} - Nom du gérant
{restaurant} - Nom du restaurant"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[200px] resize-none"
                />
              </div>

              {/* Variables help */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Variables disponibles :</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMessage((m) => m + "{prenom}")}>
                    {"{prenom}"}
                  </Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMessage((m) => m + "{nom}")}>
                    {"{nom}"}
                  </Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMessage((m) => m + "{restaurant}")}>
                    {"{restaurant}"}
                  </Badge>
                </div>
              </div>

              {/* Preview */}
              {message && selectedRestaurantsList.length > 0 && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Aperçu pour {selectedRestaurantsList[0].name} :</p>
                  <p className="whitespace-pre-wrap">{getPersonalizedMessage(selectedRestaurantsList[0])}</p>
                </div>
              )}

              {/* Send button */}
              <Button
                className="w-full"
                size="lg"
                onClick={startSending}
                disabled={selectedRestaurants.size === 0 || !message.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer à {selectedRestaurants.size} restaurant{selectedRestaurants.size > 1 ? "s" : ""}
              </Button>
            </CardContent>
          </Card>

          {/* Selected restaurants summary */}
          {selectedRestaurantsList.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Destinataires ({selectedRestaurantsList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {selectedRestaurantsList.slice(0, 10).map((r) => (
                    <Badge
                      key={r.id}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => toggleRestaurant(r.id)}
                    >
                      {r.name}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  {selectedRestaurantsList.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedRestaurantsList.length - 10} autres
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Send Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Envoi WhatsApp
            </DialogTitle>
            <DialogDescription>
              Restaurant {currentSendIndex + 1} sur {selectedRestaurantsList.length}
            </DialogDescription>
          </DialogHeader>

          {currentRestaurant && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex gap-1">
                {selectedRestaurantsList.map((r, idx) => (
                  <div
                    key={r.id}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      sentRestaurants.has(r.id)
                        ? "bg-green-500"
                        : idx === currentSendIndex
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              {/* Current restaurant info */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{currentRestaurant.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {currentRestaurant.manager_first_name} {currentRestaurant.manager_last_name}
                      </p>
                      <Badge variant="outline" className="mt-1 text-xs font-mono">
                        <Phone className="h-3 w-3 mr-1" />
                        {currentRestaurant.manager_whatsapp}
                      </Badge>
                    </div>
                    {sentRestaurants.has(currentRestaurant.id) && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Message preview */}
              <div className="p-3 bg-muted rounded-lg text-sm max-h-[150px] overflow-y-auto">
                <p className="whitespace-pre-wrap">{getPersonalizedMessage(currentRestaurant)}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!sentRestaurants.has(currentRestaurant?.id || "") ? (
              <Button
                className="flex-1"
                onClick={() => currentRestaurant && openWhatsApp(currentRestaurant)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Ouvrir WhatsApp
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleNext}
              >
                {currentSendIndex < selectedRestaurantsList.length - 1 ? (
                  <>
                    Suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Terminé
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
