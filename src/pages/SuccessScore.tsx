import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { 
  Award, 
  Upload, 
  TrendingUp, 
  Star, 
  UtensilsCrossed, 
  Leaf, 
  Settings2,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ManualEntryDialog } from "@/components/success-score/ManualEntryDialog";

// Tier configuration with colors and objectives
const TIER_CONFIG = {
  Excellent: { 
    color: 'bg-emerald-500', 
    textColor: 'text-emerald-600',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    order: 1,
    label: 'Excellent',
    description: 'Le niveau le plus élevé ! Votre restaurant fait partie des meilleurs et bénéficie de tous les avantages Uber Eats.',
    benefits: [
      'Crédits publicitaires gratuits',
      'Offres cofinancées',
      '0% de frais sur les offres utilisées',
      'Support contestation sans photo',
    ]
  },
  Great: { 
    color: 'bg-blue-500', 
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    order: 2,
    label: 'Très Bon',
    description: 'Excellentes performances ! Vous bénéficiez du badge Top Eats et d\'une visibilité accrue dans l\'app.',
    benefits: [
      'Réduction sur les frais d\'offre',
      'Badge Top Eats in-app',
      'Visibilité accrue (carousels)',
      'Campagnes marketing Uber Eats',
    ]
  },
  Good: { 
    color: 'bg-amber-500', 
    textColor: 'text-amber-600',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    order: 3,
    label: 'Bon',
    description: 'Bonnes performances ! Vous êtes mis en avant dans les carousels et pouvez bénéficier de réductions.',
    benefits: [
      'Placement dans les carousels',
      'Réduction sur les frais d\'offre (selon marché)',
    ]
  },
  Fair: { 
    color: 'bg-orange-500', 
    textColor: 'text-orange-600',
    bgLight: 'bg-orange-50 dark:bg-orange-950/30',
    order: 4,
    label: 'Correct',
    description: 'Niveau standard. Vous avez accès aux outils marketing de base. Améliorez vos métriques pour débloquer plus d\'avantages.',
    benefits: [
      'Accès aux publicités',
      'Accès aux offres promotionnelles',
      'Surfaces d\'upsell in-app',
    ]
  },
  Poor: { 
    color: 'bg-red-500', 
    textColor: 'text-red-600',
    bgLight: 'bg-red-50 dark:bg-red-950/30',
    order: 5,
    label: 'Insuffisant',
    description: 'Performances en dessous des attentes. Concentrez-vous sur l\'excellence opérationnelle pour progresser.',
    benefits: ['Aucun avantage']
  },
};

// Tier objectives (approximate targets)
const TIER_OBJECTIVES = {
  Excellent: { operationalExcellence: 98.5, menuDetails: 90, ratings: 4.7, sustainablePackaging: 90 },
  Great: { operationalExcellence: 98.0, menuDetails: 80, ratings: 4.5, sustainablePackaging: null },
  Good: { operationalExcellence: 97.5, menuDetails: null, ratings: null, sustainablePackaging: null },
  Fair: { operationalExcellence: 97.0, menuDetails: null, ratings: null, sustainablePackaging: null },
  Poor: { operationalExcellence: 0, menuDetails: null, ratings: null, sustainablePackaging: null },
};

interface SuccessScore {
  id: string;
  restaurant_id: string;
  score_month: string;
  score_tier: string;
  operational_excellence: number | null;
  ratings: number | null;
  menu_details: number | null;
  sustainable_packaging: number | null;
  sales_amount: number | null;
  restaurants?: { name: string };
}

export default function SuccessScore() {
  const navigate = useNavigate();
  const [showBenefits, setShowBenefits] = useState(false);

  // Fetch latest success scores
  const { data: scores, isLoading, refetch } = useQuery({
    queryKey: ['success-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('success_scores')
        .select(`
          *,
          restaurants!inner(name)
        `)
        .order('score_month', { ascending: false });
      
      if (error) throw error;
      return data as SuccessScore[];
    },
  });

  // Group by month and get latest
  const latestScores = useMemo(() => {
    if (!scores?.length) return [];
    
    // Get the most recent month
    const latestMonth = scores[0]?.score_month;
    return scores.filter(s => s.score_month === latestMonth);
  }, [scores]);

  // Calculate network stats
  const networkStats = useMemo(() => {
    if (!latestScores.length) return null;

    const tierCounts = {
      Excellent: 0,
      Great: 0,
      Good: 0,
      Fair: 0,
      Poor: 0,
    };

    let totalOpEx = 0;
    let opExCount = 0;
    let totalRatings = 0;
    let ratingsCount = 0;
    let totalMenuDetails = 0;
    let menuDetailsCount = 0;

    for (const score of latestScores) {
      const tier = score.score_tier as keyof typeof tierCounts;
      if (tierCounts[tier] !== undefined) {
        tierCounts[tier]++;
      }
      
      if (score.operational_excellence != null) {
        totalOpEx += score.operational_excellence;
        opExCount++;
      }
      if (score.ratings != null) {
        totalRatings += score.ratings;
        ratingsCount++;
      }
      if (score.menu_details != null) {
        totalMenuDetails += score.menu_details;
        menuDetailsCount++;
      }
    }

    return {
      tierCounts,
      avgOperationalExcellence: opExCount > 0 ? totalOpEx / opExCount : null,
      avgRatings: ratingsCount > 0 ? totalRatings / ratingsCount : null,
      avgMenuDetails: menuDetailsCount > 0 ? totalMenuDetails / menuDetailsCount : null,
      totalRestaurants: latestScores.length,
      latestMonth: latestScores[0]?.score_month,
    };
  }, [latestScores]);

  // Get progress to next tier
  const getProgressToNextTier = (score: SuccessScore) => {
    const currentTier = score.score_tier as keyof typeof TIER_OBJECTIVES;
    const tierOrder = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === tierOrder.length - 1) return null; // Already at top
    
    const nextTier = tierOrder[currentIndex + 1] as keyof typeof TIER_OBJECTIVES;
    const objectives = TIER_OBJECTIVES[nextTier];
    
    const gaps: { metric: string; current: number | null; target: number; gap: number }[] = [];
    const missingMetrics: string[] = [];
    
    // Check operational excellence
    if (objectives.operationalExcellence) {
      if (score.operational_excellence != null) {
        gaps.push({
          metric: 'Excellence Op.',
          current: score.operational_excellence,
          target: objectives.operationalExcellence,
          gap: objectives.operationalExcellence - score.operational_excellence,
        });
      } else {
        missingMetrics.push('Excellence Op.');
      }
    }
    
    // Check menu details
    if (objectives.menuDetails) {
      if (score.menu_details != null) {
        gaps.push({
          metric: 'Détails Menu',
          current: score.menu_details,
          target: objectives.menuDetails,
          gap: objectives.menuDetails - score.menu_details,
        });
      } else {
        missingMetrics.push('Détails Menu');
      }
    }
    
    // Check ratings
    if (objectives.ratings) {
      if (score.ratings != null) {
        gaps.push({
          metric: 'Notes',
          current: score.ratings,
          target: objectives.ratings,
          gap: objectives.ratings - score.ratings,
        });
      } else {
        missingMetrics.push('Notes');
      }
    }
    
    return { nextTier, gaps, missingMetrics };
  };

  const getTierBadge = (tier: string) => {
    const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.Fair;
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Score de Réussite Uber Eats
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivez vos performances et débloquez des avantages
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <ManualEntryDialog onSuccess={() => refetch()} />
            <Button 
              onClick={() => navigate('/report-import?type=success_score')} 
              variant="outline"
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Importer CSV
            </Button>
          </div>
        </div>

      {/* Benefits Accordion */}
      <Collapsible open={showBenefits} onOpenChange={setShowBenefits}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Avantages par niveau
                </span>
                {showBenefits ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Object.entries(TIER_CONFIG).sort((a, b) => a[1].order - b[1].order).map(([tier, config]) => (
                  <div key={tier} className={`rounded-lg p-4 ${config.bgLight}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${config.color}`} />
                      <span className={`font-semibold ${config.textColor}`}>{config.label}</span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {config.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Network Overview */}
      {networkStats && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Réseau - {networkStats.latestMonth ? format(new Date(networkStats.latestMonth), 'MMMM yyyy', { locale: fr }) : 'Aucune donnée'}
            </h2>
            <span className="text-sm text-muted-foreground">
              {networkStats.totalRestaurants} restaurants
            </span>
          </div>

          {/* Tier Distribution */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(TIER_CONFIG).sort((a, b) => a[1].order - b[1].order).map(([tier, config]) => {
              const count = networkStats.tierCounts[tier as keyof typeof networkStats.tierCounts] || 0;
              const percentage = networkStats.totalRestaurants > 0 
                ? Math.round((count / networkStats.totalRestaurants) * 100) 
                : 0;
              
              return (
                <Card key={tier} className={`${config.bgLight} border-none`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className={`${config.color} text-white cursor-help`}>{config.label}</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs p-3">
                          <p className="font-semibold mb-1">{config.label}</p>
                          <p className="text-sm text-muted-foreground">{config.description}</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-2xl font-bold">{count}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{percentage}% du réseau</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Network KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Settings2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Excellence Opérationnelle</p>
                    <p className="text-2xl font-bold">
                      {networkStats.avgOperationalExcellence != null 
                        ? `${networkStats.avgOperationalExcellence.toFixed(1)}%` 
                        : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Objectif Bon: 98.4%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Star className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Notes Clients</p>
                    <p className="text-2xl font-bold">
                      {networkStats.avgRatings?.toFixed(2) || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Objectif Très Bon: 4.5</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <UtensilsCrossed className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Détails Menu</p>
                    <p className="text-2xl font-bold">
                      {networkStats.avgMenuDetails != null 
                        ? `${networkStats.avgMenuDetails.toFixed(0)}%` 
                        : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Objectif Très Bon: 80%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Leaf className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Emballages Durables</p>
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground">Non applicable en France</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Restaurant Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Détail par Restaurant
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : latestScores.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune donnée de score disponible</p>
              <p className="text-sm text-muted-foreground mt-1">
                Importez un fichier CSV depuis Uber Eats Manager
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Excellence Op.</TableHead>
                  <TableHead className="text-center">Notes</TableHead>
                  <TableHead className="text-center">Détails Menu</TableHead>
                  <TableHead className="text-center">CA</TableHead>
                  <TableHead>Prochain objectif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestScores.map((score) => {
                  const progress = getProgressToNextTier(score);
                  const config = TIER_CONFIG[score.score_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.Fair;
                  
                  return (
                    <TableRow key={score.id}>
                      <TableCell className="font-medium">
                        {score.restaurants?.name || 'Restaurant inconnu'}
                      </TableCell>
                      <TableCell className="text-center">
                        {getTierBadge(score.score_tier)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className={score.operational_excellence != null && score.operational_excellence >= 98.4 ? 'text-green-600 font-semibold' : 'text-orange-600'}>
                              {score.operational_excellence != null ? `${score.operational_excellence.toFixed(1)}%` : 'Non renseigné'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Objectif "Bon": ≥ 98.4%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-center">
                        {score.ratings != null ? score.ratings.toFixed(2) : 'Non renseigné'}
                      </TableCell>
                      <TableCell className="text-center">
                        {score.menu_details != null ? `${score.menu_details.toFixed(0)}%` : 'Non renseigné'}
                      </TableCell>
                      <TableCell className="text-center">
                        {score.sales_amount != null 
                          ? `${score.sales_amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                          : 'Non renseigné'}
                      </TableCell>
                      <TableCell>
                        {progress ? (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                              Pour atteindre {TIER_CONFIG[progress.nextTier as keyof typeof TIER_CONFIG]?.label}:
                            </span>
                            {/* Afficher les gaps positifs (objectifs non atteints) */}
                            {progress.gaps.filter(g => g.gap > 0).slice(0, 2).map((gap, i) => (
                              <div key={i} className="text-xs flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-orange-500" />
                                <span>{gap.metric}: +{gap.gap.toFixed(1)}{gap.metric === 'Notes' ? '' : '%'}</span>
                              </div>
                            ))}
                            {/* Afficher les métriques manquantes */}
                            {progress.missingMetrics.length > 0 && (
                              <div className="text-xs flex items-center gap-1 text-muted-foreground">
                                <Info className="h-3 w-3" />
                                <span>Non renseigné: {progress.missingMetrics.join(', ')}</span>
                              </div>
                            )}
                            {/* Si tous les gaps sont atteints et pas de métriques manquantes */}
                            {progress.gaps.filter(g => g.gap > 0).length === 0 && progress.missingMetrics.length === 0 && (
                              <div className="text-xs flex items-center gap-1 text-amber-600">
                                <Info className="h-3 w-3" />
                                <span>Critères Uber non détaillés</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="h-3 w-3" />
                            <span>Niveau maximum atteint</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}
