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
  ChevronUp,
  Calendar,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [tierFilter, setTierFilter] = useState<string>("all");

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

  // Filtered and sorted scores
  const filteredSortedScores = useMemo(() => {
    let filtered = latestScores;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(s => s.restaurants?.name?.toLowerCase().includes(lower));
    }

    if (tierFilter !== "all") {
      filtered = filtered.filter(s => s.score_tier === tierFilter);
    }

    return [...filtered].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "name":
          aVal = a.restaurants?.name?.toLowerCase() || "";
          bVal = b.restaurants?.name?.toLowerCase() || "";
          return sortDirection === "asc" ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
        case "score":
          const tierOrder: Record<string, number> = { Excellent: 1, Great: 2, Good: 3, Fair: 4, Poor: 5 };
          aVal = tierOrder[a.score_tier] || 99;
          bVal = tierOrder[b.score_tier] || 99;
          break;
        case "opex":
          aVal = a.operational_excellence ?? -1;
          bVal = b.operational_excellence ?? -1;
          break;
        case "ratings":
          aVal = a.ratings ?? -1;
          bVal = b.ratings ?? -1;
          break;
        case "menu":
          aVal = a.menu_details ?? -1;
          bVal = b.menu_details ?? -1;
          break;
        case "packaging":
          aVal = a.sustainable_packaging ?? -1;
          bVal = b.sustainable_packaging ?? -1;
          break;
        case "sales":
          aVal = a.sales_amount ?? -1;
          bVal = b.sales_amount ?? -1;
          break;
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [latestScores, searchTerm, tierFilter, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" /> 
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

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
    let totalSustainablePackaging = 0;
    let sustainablePackagingCount = 0;

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
      if (score.sustainable_packaging != null) {
        totalSustainablePackaging += score.sustainable_packaging;
        sustainablePackagingCount++;
      }
    }

    return {
      tierCounts,
      avgOperationalExcellence: opExCount > 0 ? totalOpEx / opExCount : null,
      avgRatings: ratingsCount > 0 ? totalRatings / ratingsCount : null,
      avgMenuDetails: menuDetailsCount > 0 ? totalMenuDetails / menuDetailsCount : null,
      avgSustainablePackaging: sustainablePackagingCount > 0 ? totalSustainablePackaging / sustainablePackagingCount : null,
      totalRestaurants: latestScores.length,
      latestMonth: latestScores[0]?.score_month,
    };
  }, [latestScores]);

  // Monthly history aggregation
  const monthlyHistory = useMemo(() => {
    if (!scores?.length) return [];
    
    // Group by score_month
    const byMonth = new Map<string, SuccessScore[]>();
    for (const score of scores) {
      const existing = byMonth.get(score.score_month) || [];
      existing.push(score);
      byMonth.set(score.score_month, existing);
    }
    
    // Calculate stats for each month
    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Most recent first
      .map(([month, monthScores]) => {
        const tierCounts: Record<string, number> = {
          Excellent: 0,
          Great: 0,
          Good: 0,
          Fair: 0,
          Poor: 0,
        };
        
        let totalOpEx = 0, opExCount = 0;
        let totalRatings = 0, ratingsCount = 0;
        let totalMenu = 0, menuCount = 0;
        let totalPackaging = 0, packagingCount = 0;
        let totalSales = 0;
        
        for (const score of monthScores) {
          const tier = score.score_tier as keyof typeof tierCounts;
          if (tierCounts[tier] !== undefined) tierCounts[tier]++;
          
          if (score.operational_excellence != null) {
            totalOpEx += score.operational_excellence;
            opExCount++;
          }
          if (score.ratings != null) {
            totalRatings += score.ratings;
            ratingsCount++;
          }
          if (score.menu_details != null) {
            totalMenu += score.menu_details;
            menuCount++;
          }
          if (score.sustainable_packaging != null) {
            totalPackaging += score.sustainable_packaging;
            packagingCount++;
          }
          if (score.sales_amount != null) {
            totalSales += score.sales_amount;
          }
        }
        
        // Find dominant tier
        const dominantTier = Object.entries(tierCounts)
          .sort((a, b) => b[1] - a[1])[0][0];
        
        return {
          month,
          restaurantCount: monthScores.length,
          dominantTier,
          tierCounts,
          avgOpEx: opExCount > 0 ? totalOpEx / opExCount : null,
          avgRatings: ratingsCount > 0 ? totalRatings / ratingsCount : null,
          avgMenu: menuCount > 0 ? totalMenu / menuCount : null,
          avgPackaging: packagingCount > 0 ? totalPackaging / packagingCount : null,
          totalSales,
        };
      });
  }, [scores]);

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
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            <Badge className={`${config.color} text-white`}>{config.label}</Badge>
                          </span>
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
                    <p className="text-2xl font-bold">
                      {networkStats.avgSustainablePackaging != null 
                        ? `${networkStats.avgSustainablePackaging.toFixed(0)}%` 
                        : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Objectif Excellent: 90%</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Détail par Restaurant
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 w-[200px] text-sm"
                />
              </div>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Tous les scores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="Excellent">Excellent</SelectItem>
                  <SelectItem value="Great">Très Bon</SelectItem>
                  <SelectItem value="Good">Bon</SelectItem>
                  <SelectItem value="Fair">Correct</SelectItem>
                  <SelectItem value="Poor">Insuffisant</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredSortedScores.length}/{latestScores.length}
              </span>
            </div>
          </div>
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
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("name")}>
                      Restaurant <SortIcon field="name" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("score")}>
                      Score <SortIcon field="score" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("opex")}>
                      Excellence Op. <SortIcon field="opex" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("ratings")}>
                      Notes <SortIcon field="ratings" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("menu")}>
                      Détails Menu <SortIcon field="menu" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("packaging")}>
                      Emballage <SortIcon field="packaging" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("sales")}>
                      CA <SortIcon field="sales" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSortedScores.map((score) => {
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
                          <TooltipTrigger asChild>
                            <span className={`${score.operational_excellence != null && score.operational_excellence >= 98.4 ? 'text-green-600 font-semibold' : 'text-orange-600'} cursor-help`}>
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
                        <span className={score.sustainable_packaging != null && score.sustainable_packaging >= 90 
                          ? 'text-green-600 font-semibold' 
                          : 'text-muted-foreground'}>
                          {score.sustainable_packaging != null 
                            ? `${score.sustainable_packaging.toFixed(0)}%` 
                            : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {score.sales_amount != null 
                          ? `${score.sales_amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                          : 'Non renseigné'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Monthly History */}
      {monthlyHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historique mensuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-center">Score dominant</TableHead>
                  <TableHead className="text-center">Excellence Op.</TableHead>
                  <TableHead className="text-center">Notes</TableHead>
                  <TableHead className="text-center">Menu</TableHead>
                  <TableHead className="text-center">Emballage</TableHead>
                  <TableHead className="text-right">CA total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyHistory.map((row) => {
                  const tierConfig = TIER_CONFIG[row.dominantTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.Fair;
                  
                  return (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">
                        {format(new Date(row.month), 'MMMM yyyy', { locale: fr })}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({row.restaurantCount} resto{row.restaurantCount > 1 ? 's' : ''})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${tierConfig.color} text-white`}>
                          {tierConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.avgOpEx != null ? `${row.avgOpEx.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.avgRatings != null ? row.avgRatings.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.avgMenu != null ? `${row.avgMenu.toFixed(0)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.avgPackaging != null ? `${row.avgPackaging.toFixed(0)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.totalSales > 0 
                          ? `${row.totalSales.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </div>
    </TooltipProvider>
  );
}
