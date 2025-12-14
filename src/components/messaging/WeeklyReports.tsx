import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Eye,
  RefreshCw,
  ChevronDown,
  Star,
  Clock,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Restaurant {
  id: string;
  name: string;
  city: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_whatsapp: string | null;
  is_pinned: boolean | null;
}

interface WeeklyKPIs {
  restaurant_id: string;
  restaurant_name: string;
  manager_name: string;
  manager_whatsapp: string | null;
  // Commandes & CA
  order_count: number;
  revenue: number;
  average_basket: number;
  order_variation: number | null;
  revenue_variation: number | null;
  // Note moyenne
  average_rating: number | null;
  review_count: number;
  new_customer_percent: number | null;
  // Temps opérationnels
  avg_prep_time: number | null;
  avg_courier_wait: number | null;
  // Taux d'erreur
  error_rate: number | null;
  error_count: number;
}

interface Objectives {
  prep_time: number;
  courier_wait: number;
  rating: number;
  error_rate: number;
}

const DEFAULT_OBJECTIVES: Objectives = {
  prep_time: 20,
  courier_wait: 5,
  rating: 4.4,
  error_rate: 3,
};

const getStatusEmoji = (value: number | null, objective: number, isLowerBetter: boolean = false): string => {
  if (value === null) return "➖";
  if (isLowerBetter) {
    return value <= objective ? "✅" : "❌";
  }
  return value >= objective ? "✅" : "❌";
};

const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return "--";
  return `${Math.round(minutes)} min`;
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value: number | null): string => {
  if (value === null) return "--";
  return `${value.toFixed(1)}%`;
};

export default function WeeklyReports() {
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [objectives, setObjectives] = useState<Objectives>(DEFAULT_OBJECTIVES);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedKPIs, setGeneratedKPIs] = useState<WeeklyKPIs[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [introTemplate, setIntroTemplate] = useState("📊 Bonjour {prenom}, voici le rapport de la semaine du {date_debut} au {date_fin} :\n\n");
  const [outroTemplate, setOutroTemplate] = useState("\n\n💪 Bonne continuation !");

  // Get last week's date range
  const lastWeek = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    return { start, end };
  }, []);

  // Fetch pinned restaurants (show all, even without WhatsApp)
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ["restaurants-weekly-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, manager_first_name, manager_last_name, manager_whatsapp, is_pinned")
        .eq("is_active", true)
        .eq("is_pinned", true)
        .order("name");

      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Generate report message for a restaurant
  const generateMessage = (kpi: WeeklyKPIs): string => {
    const dateStart = format(lastWeek.start, "d MMMM", { locale: fr });
    const dateEnd = format(lastWeek.end, "d MMMM", { locale: fr });

    let intro = introTemplate
      .replace(/{prenom}/g, kpi.manager_name.split(" ")[0] || "")
      .replace(/{date_debut}/g, dateStart)
      .replace(/{date_fin}/g, dateEnd);

    const lines: string[] = [];

    // Commandes & CA
    lines.push("📦 *COMMANDES & CA*");
    lines.push(`• Commandes : ${kpi.order_count}${kpi.order_variation !== null ? ` (${kpi.order_variation >= 0 ? "+" : ""}${kpi.order_variation.toFixed(0)}%)` : ""}`);
    lines.push(`• Chiffre d'affaires : ${formatCurrency(kpi.revenue)}${kpi.revenue_variation !== null ? ` (${kpi.revenue_variation >= 0 ? "+" : ""}${kpi.revenue_variation.toFixed(0)}%)` : ""}`);
    lines.push(`• Panier moyen : ${formatCurrency(kpi.average_basket)}`);
    lines.push("");

    // Note moyenne
    lines.push("⭐ *NOTE MOYENNE*");
    lines.push(`• Moyenne : ${kpi.average_rating !== null ? kpi.average_rating.toFixed(1) : "--"} ${getStatusEmoji(kpi.average_rating, objectives.rating)} (${kpi.review_count} avis${kpi.new_customer_percent !== null ? ` - ${kpi.new_customer_percent.toFixed(0)}% nouveaux clients` : ""})`);
    lines.push(`   ↳ Objectif : ${objectives.rating}`);
    lines.push("");

    // Temps opérationnels
    lines.push("⏱️ *TEMPS OPÉRATIONNELS*");
    lines.push(`• Temps de préparation : ${formatDuration(kpi.avg_prep_time)} ${getStatusEmoji(kpi.avg_prep_time, objectives.prep_time, true)}`);
    lines.push(`   ↳ Objectif : -${objectives.prep_time} min`);
    lines.push(`• Temps d'attente coursier : ${formatDuration(kpi.avg_courier_wait)} ${getStatusEmoji(kpi.avg_courier_wait, objectives.courier_wait, true)}`);
    lines.push(`   ↳ Objectif : -${objectives.courier_wait} min`);
    lines.push("");

    // Taux d'erreur
    lines.push("❌ *TAUX D'ERREUR*");
    lines.push(`• Pourcentage d'erreurs : ${formatPercent(kpi.error_rate)} ${getStatusEmoji(kpi.error_rate, objectives.error_rate, true)} (${kpi.error_count} erreurs)`);
    lines.push(`   ↳ Objectif : -${objectives.error_rate}%`);

    return intro + lines.join("\n") + outroTemplate;
  };

  // Generate KPIs for all restaurants
  const generateReports = async () => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
        body: {
          restaurant_ids: restaurants.map(r => r.id),
          start_date: format(lastWeek.start, "yyyy-MM-dd"),
          end_date: format(lastWeek.end, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;

      const kpis: WeeklyKPIs[] = data.reports || [];
      setGeneratedKPIs(kpis);
      
      // Pre-select all and generate default messages
      const newSelected = new Set<string>();
      const newMessages: Record<string, string> = {};
      
      kpis.forEach(kpi => {
        if (kpi.manager_whatsapp) {
          newSelected.add(kpi.restaurant_id);
          newMessages[kpi.restaurant_id] = generateMessage(kpi);
        }
      });
      
      setSelectedReports(newSelected);
      setEditedMessages(newMessages);
      
      toast.success(`${kpis.length} rapport(s) générés`);
    } catch (err) {
      console.error("Error generating reports:", err);
      toast.error("Erreur lors de la génération des rapports");
    } finally {
      setIsGenerating(false);
    }
  };

  // Send all selected reports
  const sendReports = async () => {
    const toSend = generatedKPIs.filter(k => selectedReports.has(k.restaurant_id) && k.manager_whatsapp);
    
    if (toSend.length === 0) {
      toast.error("Aucun rapport sélectionné");
      return;
    }

    setIsSending(true);

    try {
      let sentCount = 0;
      let failedCount = 0;

      for (const kpi of toSend) {
        const message = editedMessages[kpi.restaurant_id] || generateMessage(kpi);
        
        const { error } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            recipients: [{
              restaurant_id: kpi.restaurant_id,
              phone: kpi.manager_whatsapp,
              name: kpi.manager_name,
              restaurantName: kpi.restaurant_name,
            }],
            message,
            skip_campaign: false,
          },
        });

        if (error) {
          failedCount++;
          console.error(`Failed to send to ${kpi.restaurant_name}:`, error);
        } else {
          sentCount++;
        }

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (failedCount === 0) {
        toast.success(`${sentCount} rapport(s) envoyé(s) avec succès`);
        setGeneratedKPIs([]);
        setSelectedReports(new Set());
        setEditedMessages({});
      } else {
        toast.warning(`${sentCount} envoyé(s), ${failedCount} échec(s)`);
      }
    } catch (err) {
      console.error("Error sending reports:", err);
      toast.error("Erreur lors de l'envoi des rapports");
    } finally {
      setIsSending(false);
    }
  };

  // Toggle card expansion
  const toggleCard = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  // Toggle report selection
  const toggleReport = (id: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReports(newSelected);
  };

  // Update message for a restaurant
  const updateMessage = (restaurantId: string, message: string) => {
    setEditedMessages(prev => ({ ...prev, [restaurantId]: message }));
  };

  // Regenerate message for a restaurant
  const regenerateMessage = (kpi: WeeklyKPIs) => {
    const message = generateMessage(kpi);
    setEditedMessages(prev => ({ ...prev, [kpi.restaurant_id]: message }));
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Rapports Hebdomadaires</h2>
          <p className="text-sm text-muted-foreground">
            Semaine du {format(lastWeek.start, "d MMMM", { locale: fr })} au {format(lastWeek.end, "d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Objectifs
          </Button>
          <Button
            onClick={generateReports}
            disabled={isGenerating || loadingRestaurants || restaurants.length === 0}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Générer les rapports
          </Button>
        </div>
      </div>

      {/* Info card when no reports */}
      {generatedKPIs.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Prêt à générer les rapports</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Cliquez sur "Générer les rapports" pour créer les rapports hebdomadaires pour vos {restaurants.length} restaurant(s) épinglé(s).
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {restaurants.slice(0, 5).map(r => (
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {r.name}
                </Badge>
              ))}
              {restaurants.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{restaurants.length - 5} autres
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated reports */}
      {generatedKPIs.length > 0 && (
        <>
          {/* Action bar */}
          <Card className="bg-secondary/30">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={selectedReports.size === generatedKPIs.filter(k => k.manager_whatsapp).length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedReports(new Set(generatedKPIs.filter(k => k.manager_whatsapp).map(k => k.restaurant_id)));
                    } else {
                      setSelectedReports(new Set());
                    }
                  }}
                />
                <span className="text-sm font-medium">
                  {selectedReports.size} / {generatedKPIs.filter(k => k.manager_whatsapp).length} sélectionné(s)
                </span>
              </div>
              <Button
                onClick={sendReports}
                disabled={isSending || selectedReports.size === 0}
                className="gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer {selectedReports.size > 0 ? `(${selectedReports.size})` : ""}
              </Button>
            </CardContent>
          </Card>

          {/* Report cards */}
          <div className="grid gap-4">
            <AnimatePresence>
              {generatedKPIs.map((kpi, index) => (
                <motion.div
                  key={kpi.restaurant_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={cn(
                    "transition-all",
                    selectedReports.has(kpi.restaurant_id) && "ring-2 ring-primary/30",
                    !kpi.manager_whatsapp && "opacity-50"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedReports.has(kpi.restaurant_id)}
                            onCheckedChange={() => toggleReport(kpi.restaurant_id)}
                            disabled={!kpi.manager_whatsapp}
                          />
                          <div>
                            <CardTitle className="text-base">{kpi.restaurant_name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {kpi.manager_name} {!kpi.manager_whatsapp && "(pas de WhatsApp)"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Quick KPI badges */}
                          <Badge variant="outline" className="gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            {kpi.order_count}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3" />
                            {kpi.average_rating?.toFixed(1) || "--"}
                          </Badge>
                          {kpi.error_rate !== null && kpi.error_rate > objectives.error_rate && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {kpi.error_rate.toFixed(1)}%
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCard(kpi.restaurant_id)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform",
                              expandedCards.has(kpi.restaurant_id) && "rotate-180"
                            )} />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <Collapsible open={expandedCards.has(kpi.restaurant_id)}>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <Separator className="mb-4" />
                          
                          {/* KPI Summary Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="p-3 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <ShoppingCart className="h-3 w-3" />
                                Commandes
                              </div>
                              <div className="font-semibold">{kpi.order_count}</div>
                              {kpi.order_variation !== null && (
                                <div className={cn("text-xs", kpi.order_variation >= 0 ? "text-green-600" : "text-red-600")}>
                                  {kpi.order_variation >= 0 ? "+" : ""}{kpi.order_variation.toFixed(0)}%
                                </div>
                              )}
                            </div>
                            <div className="p-3 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <Star className="h-3 w-3" />
                                Note moyenne
                              </div>
                              <div className="font-semibold flex items-center gap-1">
                                {kpi.average_rating?.toFixed(1) || "--"}
                                <span className="text-xs">{getStatusEmoji(kpi.average_rating, objectives.rating)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{kpi.review_count} avis</div>
                            </div>
                            <div className="p-3 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <Clock className="h-3 w-3" />
                                Temps prep
                              </div>
                              <div className="font-semibold flex items-center gap-1">
                                {formatDuration(kpi.avg_prep_time)}
                                <span className="text-xs">{getStatusEmoji(kpi.avg_prep_time, objectives.prep_time, true)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">Obj: -{objectives.prep_time}min</div>
                            </div>
                            <div className="p-3 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <AlertTriangle className="h-3 w-3" />
                                Erreurs
                              </div>
                              <div className="font-semibold flex items-center gap-1">
                                {formatPercent(kpi.error_rate)}
                                <span className="text-xs">{getStatusEmoji(kpi.error_rate, objectives.error_rate, true)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{kpi.error_count} erreurs</div>
                            </div>
                          </div>

                          {/* Editable message */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Message à envoyer</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => regenerateMessage(kpi)}
                                className="h-7 text-xs gap-1"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Régénérer
                              </Button>
                            </div>
                            <Textarea
                              value={editedMessages[kpi.restaurant_id] || generateMessage(kpi)}
                              onChange={(e) => updateMessage(kpi.restaurant_id, e.target.value)}
                              className="min-h-[200px] font-mono text-xs"
                              disabled={!kpi.manager_whatsapp}
                            />
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Configuration des objectifs
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Prep time objective */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temps de préparation max</Label>
                <Badge variant="secondary">{objectives.prep_time} min</Badge>
              </div>
              <Slider
                value={[objectives.prep_time]}
                onValueChange={([v]) => setObjectives(prev => ({ ...prev, prep_time: v }))}
                min={10}
                max={30}
                step={1}
              />
            </div>

            {/* Courier wait objective */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temps d'attente coursier max</Label>
                <Badge variant="secondary">{objectives.courier_wait} min</Badge>
              </div>
              <Slider
                value={[objectives.courier_wait]}
                onValueChange={([v]) => setObjectives(prev => ({ ...prev, courier_wait: v }))}
                min={1}
                max={10}
                step={1}
              />
            </div>

            {/* Rating objective */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Note moyenne minimum</Label>
                <Badge variant="secondary">{objectives.rating.toFixed(1)}</Badge>
              </div>
              <Slider
                value={[objectives.rating * 10]}
                onValueChange={([v]) => setObjectives(prev => ({ ...prev, rating: v / 10 }))}
                min={35}
                max={50}
                step={1}
              />
            </div>

            {/* Error rate objective */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Taux d'erreur maximum</Label>
                <Badge variant="secondary">{objectives.error_rate}%</Badge>
              </div>
              <Slider
                value={[objectives.error_rate]}
                onValueChange={([v]) => setObjectives(prev => ({ ...prev, error_rate: v }))}
                min={1}
                max={10}
                step={0.5}
              />
            </div>

            <Separator />

            {/* Intro/Outro templates */}
            <div className="space-y-3">
              <Label>Message d'introduction</Label>
              <Textarea
                value={introTemplate}
                onChange={(e) => setIntroTemplate(e.target.value)}
                placeholder="Variables: {prenom}, {date_debut}, {date_fin}"
                className="text-sm"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles: {"{prenom}"}, {"{date_debut}"}, {"{date_fin}"}
              </p>
            </div>

            <div className="space-y-3">
              <Label>Message de conclusion</Label>
              <Textarea
                value={outroTemplate}
                onChange={(e) => setOutroTemplate(e.target.value)}
                className="text-sm"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setObjectives(DEFAULT_OBJECTIVES)}>
              Réinitialiser
            </Button>
            <Button onClick={() => setShowSettings(false)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
