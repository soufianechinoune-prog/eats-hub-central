import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Copy,
  FileText,
  Lightbulb,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DisputeData {
  isContestable: boolean;
  successProbability: "faible" | "moyen" | "élevé";
  justification: string;
  suggestedEvidence: string[];
  reasoning: string;
}

const Disputes = () => {
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedDisputes, setGeneratedDisputes] = useState<
    Record<string, DisputeData>
  >({});
  const { toast } = useToast();

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Fetch order errors from last 30 days
  const { data: orderErrors, isLoading, refetch } = useQuery({
    queryKey: ["order-errors", selectedRestaurant],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from("order_errors")
        .select(
          `
          *,
          orders!inner (
            uber_order_id,
            order_datetime,
            gross_amount,
            restaurants!inner (
              name,
              city
            )
          )
        `
        )
        .gte("error_date", thirtyDaysAgo.toISOString())
        .order("error_date", { ascending: false });

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  const handleGenerateDispute = async (errorId: string) => {
    setGeneratingFor(errorId);

    try {
      const { data, error } = await supabase.functions.invoke("generate-dispute", {
        body: { orderErrorId: errorId },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erreur",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setGeneratedDisputes((prev) => ({
        ...prev,
        [errorId]: data.dispute,
      }));

      toast({
        title: "Contestation générée",
        description: "L'IA a analysé l'erreur et généré une justification.",
      });
    } catch (error) {
      console.error("Error generating dispute:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la contestation.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleCopyJustification = (justification: string) => {
    navigator.clipboard.writeText(justification);
    toast({
      title: "Copié !",
      description: "La justification a été copiée dans le presse-papiers.",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getProbabilityColor = (prob: string) => {
    switch (prob) {
      case "élevé":
        return "bg-green-500";
      case "moyen":
        return "bg-yellow-500";
      case "faible":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Contestations IA
          </h2>
          <p className="text-muted-foreground">
            Générez automatiquement des justifications pour contester les
            remboursements Uber Eats
          </p>
        </div>
        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger className="w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les restaurants</SelectItem>
            {restaurants?.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900">
                Comment contester un remboursement sur Uber Eats ?
              </p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Cliquez sur "Générer contestation" pour une erreur</li>
                <li>L'IA analyse l'erreur et génère une justification</li>
                <li>Copiez la justification et les preuves suggérées</li>
                <li>
                  Connectez-vous à{" "}
                  <a
                    href="https://merchants.ubereats.com/manager/orders"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Uber Eats Manager
                  </a>
                </li>
                <li>
                  Filtrez par "Store refunded", sélectionnez la commande et
                  cliquez "Dispute"
                </li>
                <li>Collez la justification et soumettez les preuves</li>
              </ol>
              <p className="text-xs text-blue-600 italic">
                ⏰ Vous avez 30 jours après la commande pour contester
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orderErrors && orderErrors.length > 0 ? (
        <div className="space-y-4">
          {orderErrors.map((error: any) => {
            const dispute = generatedDisputes[error.id];
            const isGenerating = generatingFor === error.id;
            const errorDate = new Date(error.error_date);
            const daysLeft = Math.max(
              0,
              30 - Math.floor((Date.now() - errorDate.getTime()) / (1000 * 60 * 60 * 24))
            );

            return (
              <Card key={error.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {error.orders.restaurants.name} - {error.orders.uber_order_id}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {new Date(error.error_date).toLocaleDateString("fr-FR")}
                        </span>
                        <span>•</span>
                        <span>{error.error_type}</span>
                        {error.item_title && (
                          <>
                            <span>•</span>
                            <span>{error.item_title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={daysLeft < 7 ? "destructive" : "outline"}>
                        {daysLeft}j restants
                      </Badge>
                      {error.financial_impact && (
                        <Badge variant="secondary">
                          {formatCurrency(error.financial_impact)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error.error_description && (
                    <div>
                      <p className="text-sm font-medium mb-1">Description:</p>
                      <p className="text-sm text-muted-foreground">
                        {error.error_description}
                      </p>
                    </div>
                  )}

                  {!dispute && !isGenerating && (
                    <Button
                      onClick={() => handleGenerateDispute(error.id)}
                      className="w-full"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Générer contestation IA
                    </Button>
                  )}

                  {isGenerating && (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>L'IA analyse l'erreur...</span>
                    </div>
                  )}

                  {dispute && (
                    <div className="space-y-4 border-t pt-4">
                      {/* Contestability */}
                      <div className="flex items-center gap-2">
                        {dispute.isContestable ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">
                          {dispute.isContestable
                            ? "Contestation recommandée"
                            : "Contestation non recommandée"}
                        </span>
                        <Badge className={getProbabilityColor(dispute.successProbability)}>
                          Chances: {dispute.successProbability}
                        </Badge>
                      </div>

                      {/* Reasoning */}
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Analyse IA:
                        </p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                          {dispute.reasoning}
                        </p>
                      </div>

                      {dispute.isContestable && (
                        <>
                          <Separator />

                          {/* Justification */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">
                                Justification à copier:
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleCopyJustification(dispute.justification)
                                }
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copier
                              </Button>
                            </div>
                            <div className="bg-background border p-4 rounded-md text-sm whitespace-pre-wrap">
                              {dispute.justification}
                            </div>
                          </div>

                          {/* Suggested Evidence */}
                          {dispute.suggestedEvidence.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">
                                Preuves à joindre:
                              </p>
                              <ul className="space-y-1">
                                {dispute.suggestedEvidence.map((evidence, idx) => (
                                  <li
                                    key={idx}
                                    className="text-sm text-muted-foreground flex items-start gap-2"
                                  >
                                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>{evidence}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <Button
                            className="w-full"
                            asChild
                          >
                            <a
                              href="https://merchants.ubereats.com/manager/orders"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ouvrir Uber Eats Manager
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune erreur de commande à contester pour le moment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Disputes;
