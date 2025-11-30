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
  X,
  Phone,
  User,
  Store,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

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

interface SendResult {
  phone: string;
  name: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

export default function Messaging() {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  
  // Send state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

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
        depts.add(r.postal_code.trim().substring(0, 2));
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
        (r.postal_code && r.postal_code.trim().startsWith(departmentFilter));

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

  // Generate personalized message preview
  const getPersonalizedMessage = (restaurant: Restaurant) => {
    let personalizedMsg = message;
    personalizedMsg = personalizedMsg.replace(/{prenom}/g, restaurant.manager_first_name || "");
    personalizedMsg = personalizedMsg.replace(/{nom}/g, restaurant.manager_last_name || "");
    personalizedMsg = personalizedMsg.replace(/{restaurant}/g, restaurant.name);
    return personalizedMsg;
  };

  // Send messages via Ultramsg API
  const sendMessages = async () => {
    if (selectedRestaurantsList.length === 0 || !message.trim()) return;
    
    setIsSending(true);
    setSendProgress(0);
    setSendResults([]);

    try {
      // Prepare recipients
      const recipients = selectedRestaurantsList.map((r) => ({
        phone: r.manager_whatsapp || "",
        name: `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.trim(),
        restaurantName: r.name,
      }));

      // Show progress toast
      toast.loading(`Envoi en cours... 0/${recipients.length}`, { id: "send-progress" });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { recipients, message },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSendProgress(100);
      setSendResults(data.results || []);
      
      // Update toast
      toast.dismiss("send-progress");
      
      if (data.sent > 0 && data.failed === 0) {
        toast.success(`${data.sent} message${data.sent > 1 ? "s" : ""} envoyé${data.sent > 1 ? "s" : ""} avec succès`);
      } else if (data.sent > 0 && data.failed > 0) {
        toast.warning(`${data.sent} envoyé${data.sent > 1 ? "s" : ""}, ${data.failed} échec${data.failed > 1 ? "s" : ""}`);
      } else {
        toast.error(`Échec de l'envoi (${data.failed} erreur${data.failed > 1 ? "s" : ""})`);
      }

      // Show results dialog
      setShowResultsDialog(true);

      // Reset selection if all successful
      if (data.failed === 0) {
        setSelectedRestaurants(new Set());
        setMessage("");
      }

    } catch (err) {
      console.error("Error sending messages:", err);
      toast.dismiss("send-progress");
      toast.error("Erreur lors de l'envoi des messages");
    } finally {
      setIsSending(false);
    }
  };

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
                                {restaurant.city} {restaurant.postal_code && `(${restaurant.postal_code.trim().substring(0, 2)})`}
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
                onClick={sendMessages}
                disabled={selectedRestaurants.size === 0 || !message.trim() || isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer à {selectedRestaurants.size} restaurant{selectedRestaurants.size > 1 ? "s" : ""}
                  </>
                )}
              </Button>

              {/* Progress indicator */}
              {isSending && (
                <Progress value={sendProgress} className="h-2" />
              )}
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

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Résultats de l'envoi
            </DialogTitle>
            <DialogDescription>
              {sendResults.filter(r => r.success).length} envoyé{sendResults.filter(r => r.success).length > 1 ? "s" : ""} sur {sendResults.length}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {sendResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    result.success ? "bg-green-500/10" : "bg-destructive/10"
                  }`}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.name || result.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.success ? `ID: ${result.messageId}` : result.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setShowResultsDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
