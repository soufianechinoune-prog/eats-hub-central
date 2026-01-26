import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Star,
  TrendingUp,
  Users,
  ShoppingCart,
  Euro,
  Lightbulb,
  MessageSquare,
  Calendar,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
} from "lucide-react";
import {
  useBogoOfferHistory,
  useUpdateOfferAnnotation,
  BogoOfferHistoryItem,
} from "@/hooks/useBogoOfferHistory";

interface MenuItem {
  id: string;
  name: string;
  price_uber: number | null;
  food_cost: number | null;
  vat_rate: number | null;
}

interface BogoHistoryInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: MenuItem[];
  selectedRestaurantIds: string[];
  audience: string;
}

function StarRating({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  const starClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className={`${starClass} fill-amber-400 text-amber-400`} />
      ))}
      {hasHalf && (
        <Star className={`${starClass} fill-amber-400/50 text-amber-400`} />
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className={`${starClass} text-muted-foreground/30`} />
      ))}
    </div>
  );
}

function OfferCard({
  offer,
  rank,
  onAddNote,
}: {
  offer: BogoOfferHistoryItem;
  rank: number;
  onAddNote: (offer: BogoOfferHistoryItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <span className="text-lg">🥇</span>;
    if (rank === 2) return <span className="text-lg">🥈</span>;
    if (rank === 3) return <span className="text-lg">🥉</span>;
    return <span className="text-sm font-medium text-muted-foreground">#{rank}</span>;
  };

  const getScoreColor = (label: string) => {
    switch (label) {
      case "Excellent": return "text-emerald-600";
      case "Bon": return "text-blue-600";
      case "Correct": return "text-amber-600";
      case "Faible": return "text-orange-600";
      default: return "text-destructive";
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Main row */}
        <div
          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-8 flex justify-center">{getRankIcon(rank)}</div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {format(new Date(offer.startDate), "MMM yyyy", { locale: fr })}
              </span>
              <Badge variant="secondary" className="text-xs">
                {offer.audience}
              </Badge>
              {offer.uberFundingPercent && (
                <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-600">
                  Cofin. {offer.uberFundingPercent}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Euro className="h-3.5 w-3.5" />
                {formatCurrency(offer.salesEur)}
              </span>
              <span className="flex items-center gap-1">
                <ShoppingCart className="h-3.5 w-3.5" />
                {offer.orders} cmd
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {offer.newCustomers} nouveaux
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <StarRating score={offer.score} size="sm" />
              <span className={`text-sm font-medium ${getScoreColor(offer.scoreLabel)}`}>
                {offer.scoreLabel}
              </span>
            </div>
            {offer.userComment && (
              <MessageSquare className="h-4 w-4 text-primary" />
            )}
          </div>

          <div className="text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t bg-muted/20"
          >
            <div className="p-4 space-y-4">
              {/* Date range and articles */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Période</p>
                  <p className="font-medium">
                    {format(new Date(offer.startDate), "d MMM", { locale: fr })} - {" "}
                    {offer.endDate ? format(new Date(offer.endDate), "d MMM yyyy", { locale: fr }) : "En cours"}
                    <span className="text-muted-foreground ml-2">({offer.durationDays}j)</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Articles</p>
                  <p className="font-medium">{offer.articles.join(", ") || "Non spécifié"}</p>
                </div>
              </div>

              {/* Performance metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-background rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(offer.salesEur)}</p>
                  <p className="text-xs text-muted-foreground">CA total</p>
                </div>
                <div className="bg-background rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{offer.orders}</p>
                  <p className="text-xs text-muted-foreground">Commandes</p>
                </div>
                <div className="bg-background rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{offer.newCustomers}</p>
                  <p className="text-xs text-muted-foreground">Nouveaux clients</p>
                </div>
                <div className="bg-background rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{formatCurrency(offer.salesPerDay)}</p>
                  <p className="text-xs text-muted-foreground">CA/jour</p>
                </div>
              </div>

              {/* User comment if exists */}
              {offer.userComment && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary">Votre note</p>
                      <p className="text-sm">{offer.userComment}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* User learnings if exist */}
              {offer.learnings.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {offer.learnings.map((learning, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      💡 {learning}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add note button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNote(offer);
                }}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {offer.userComment ? "Modifier la note" : "Ajouter une note"}
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function AddNoteSheet({
  offer,
  onClose,
}: {
  offer: BogoOfferHistoryItem | null;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(offer?.userComment || "");
  const [rating, setRating] = useState(offer?.userRating || 0);
  const updateAnnotation = useUpdateOfferAnnotation();

  if (!offer) return null;

  const handleSave = async () => {
    await updateAnnotation.mutateAsync({
      offerId: offer.id,
      userRating: rating || undefined,
      userComment: comment || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="fixed bottom-0 left-0 right-0 max-h-[70vh] bg-background border-t rounded-t-xl shadow-lg"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Ajouter une note</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Votre évaluation</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="text-sm text-muted-foreground ml-2">{rating}/5</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire</Label>
            <Textarea
              id="comment"
              placeholder="Ex: Très bon ROI, à refaire en période creuse..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={updateAnnotation.isPending}
          >
            {updateAnnotation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function BogoHistoryInsightsDialog({
  open,
  onOpenChange,
  selectedItems,
  selectedRestaurantIds,
  audience,
}: BogoHistoryInsightsDialogProps) {
  const [noteOffer, setNoteOffer] = useState<BogoOfferHistoryItem | null>(null);

  const itemNames = selectedItems.map((item) => item.name);
  const { data, isLoading } = useBogoOfferHistory(itemNames, selectedRestaurantIds);

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Award className="h-5 w-5 text-primary" />
              </div>
              Historique des offres similaires
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Selected items badge */}
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((item) => (
                <Badge key={item.id} variant="secondary">
                  {item.name}
                </Badge>
              ))}
              {selectedItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun article sélectionné</p>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : data && data.offers.length > 0 ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {data.offers.length}
                      </p>
                      <p className="text-sm text-muted-foreground">offres similaires</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(data.insights?.avgSalesPerCampaign || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">CA moyen/campagne</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(data.insights?.avgNewCustomersPerCampaign || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">nouveaux clients/camp.</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Insights */}
                {data.insights && (
                  <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
                    <CardContent className="pt-4">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Insights basés sur ton historique
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>
                            Les BOGO sur ces articles génèrent en moyenne{" "}
                            <strong>{formatCurrency(data.insights.avgSalesPerCampaign)}</strong>{" "}
                            par campagne
                          </span>
                        </li>
                        {data.insights.bestAudience && (
                          <li className="flex items-start gap-2">
                            <Target className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>
                              Audience "<strong>{data.insights.bestAudience.audience}</strong>" :{" "}
                              <strong>+{Math.round(data.insights.bestAudience.improvement)}%</strong>{" "}
                              de nouveaux clients vs "Tous les clients"
                            </span>
                          </li>
                        )}
                        {data.insights.bestPeriod && (
                          <li className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>
                              Meilleure période : <strong>{data.insights.bestPeriod}</strong>
                            </span>
                          </li>
                        )}
                        {data.insights.optimalDuration && data.insights.optimalDuration > 0 && (
                          <li className="flex items-start gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>
                              Durée optimale observée :{" "}
                              <strong>{data.insights.optimalDuration} jours</strong>
                            </span>
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {/* Offer list */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Classement des offres passées</h3>
                  {data.offers.slice(0, 10).map((offer, index) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      rank={index + 1}
                      onAddNote={setNoteOffer}
                    />
                  ))}
                  {data.offers.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      + {data.offers.length - 10} autres offres
                    </p>
                  )}
                </div>
              </>
            ) : (
              <Card className="bg-muted/30">
                <CardContent className="pt-6 pb-6 text-center">
                  <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Aucune offre similaire trouvée</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pas d'offres BOGO passées pour les articles sélectionnés.
                    <br />
                    Ce sera la première !
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Note Sheet */}
      {noteOffer && (
        <AddNoteSheet offer={noteOffer} onClose={() => setNoteOffer(null)} />
      )}
    </>
  );
}
