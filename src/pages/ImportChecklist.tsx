import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, isWithinInterval, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  FileUp,
  BookOpen,
  TrendingUp,
  DollarSign,
  Star,
  Settings2,
  Megaphone,
  Clock,
  LayoutGrid,
  List,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Define all import types with their schedule
const IMPORT_SCHEDULE = [
  // Weekly reports
  { 
    type: "sales_over_time", 
    label: "Sales Over Time", 
    shortLabel: "Ventes",
    description: "Ventes quotidiennes par restaurant",
    frequency: "weekly" as const, 
    guideSection: "sales-over-time",
    icon: TrendingUp,
    theme: "Ventes"
  },
  { 
    type: "conversion_funnel", 
    label: "Tunnel de conversion", 
    shortLabel: "Conversion",
    description: "Visites → Menu → Panier → Commande",
    frequency: "weekly" as const, 
    guideSection: "conversion-funnel",
    icon: TrendingUp,
    theme: "Marketing"
  },
  { 
    type: "reviews_order", 
    label: "Avis par commande", 
    shortLabel: "Avis Cmd",
    description: "Notes et commentaires clients",
    frequency: "weekly" as const, 
    guideSection: "reviews-order",
    icon: Star,
    theme: "Avis"
  },
  { 
    type: "reviews_item", 
    label: "Avis par produit", 
    shortLabel: "Avis Prod",
    description: "Thumbs up/down par article",
    frequency: "weekly" as const, 
    guideSection: "reviews-item",
    icon: Star,
    theme: "Avis"
  },
  { 
    type: "downtime_report", 
    label: "Temps d'inactivité", 
    shortLabel: "Downtime",
    description: "Périodes de fermeture non planifiées",
    frequency: "weekly" as const, 
    guideSection: "downtime-report",
    icon: Clock,
    theme: "Opérations"
  },
  { 
    type: "order_history", 
    label: "Historique commandes", 
    shortLabel: "Historique",
    description: "Détail de chaque commande",
    frequency: "weekly" as const, 
    guideSection: "order-history",
    icon: FileUp,
    theme: "Ventes"
  },
  
  // Monthly reports
  { 
    type: "order_accuracy_summary", 
    label: "Résumé commandes incorrectes", 
    shortLabel: "Erreurs",
    description: "Synthèse mensuelle des erreurs",
    frequency: "monthly" as const, 
    guideSection: "order-accuracy-summary",
    icon: Settings2,
    theme: "Opérations"
  },
  { 
    type: "inaccurate_orders", 
    label: "Commandes incorrectes (détail)", 
    shortLabel: "Err. Détail",
    description: "Détail des erreurs par commande",
    frequency: "monthly" as const, 
    guideSection: "inaccurate-orders",
    icon: Settings2,
    theme: "Opérations"
  },
  { 
    type: "item_issues_leaderboard", 
    label: "Top articles problématiques", 
    shortLabel: "Top Err.",
    description: "Classement des erreurs par produit",
    frequency: "monthly" as const, 
    guideSection: "item-issues-leaderboard",
    icon: AlertTriangle,
    theme: "Opérations"
  },
  { 
    type: "marketing_campaigns", 
    label: "Campagnes Marketing", 
    shortLabel: "Marketing",
    description: "Performance des promotions",
    frequency: "monthly" as const, 
    guideSection: "marketing-campaigns",
    icon: Megaphone,
    theme: "Marketing"
  },
  { 
    type: "payment_order_level", 
    label: "Payment Orders", 
    shortLabel: "Pay. Cmd",
    description: "Détail financier par commande",
    frequency: "monthly" as const, 
    guideSection: "payment-orders",
    icon: DollarSign,
    theme: "Finance"
  },
  { 
    type: "payment_item_level", 
    label: "Payment Items", 
    shortLabel: "Pay. Items",
    description: "Détail financier par article",
    frequency: "monthly" as const, 
    guideSection: "payment-items",
    icon: DollarSign,
    theme: "Finance"
  },
  { 
    type: "payout_summary", 
    label: "Payout Summary", 
    shortLabel: "Payout",
    description: "Résumé des versements",
    frequency: "monthly" as const, 
    guideSection: "payout-summary",
    icon: DollarSign,
    theme: "Finance"
  },
];

type ImportStatus = "done" | "pending" | "overdue" | "critical";

interface ImportStatusInfo {
  status: ImportStatus;
  lastImport: Date | null;
  importCount: number;
  daysOverdue?: number;
}

export default function ImportChecklist() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");
  
  // Calculate week and month ranges
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // Fetch import history - use date_range to check period coverage
  const { data: imports, isLoading } = useQuery({
    queryKey: ["csv-imports-checklist", format(weekStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csv_imports")
        .select("report_type, imported_at, status, restaurant_ids, date_range_start, date_range_end")
        .eq("status", "completed");
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch pinned restaurants
  const { data: pinnedRestaurants } = useQuery({
    queryKey: ["pinned-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_pinned", true)
        .order("name");
      
      if (error) throw error;
      return data;
    }
  });

  // Calculate status for each report type
  // Uses date_range_start/end to check if import covers the selected period
  // For monthly reports: require COMPLETE coverage (import must contain the full period)
  // For weekly reports: require overlap is sufficient
  const getImportStatus = (reportType: string, frequency: "weekly" | "monthly", restaurantId?: string): ImportStatusInfo => {
    if (!imports) return { status: "pending", lastImport: null, importCount: 0 };

    const periodStart = frequency === "weekly" ? weekStart : monthStart;
    const periodEnd = frequency === "weekly" ? weekEnd : monthEnd;

    const relevantImports = imports.filter(imp => {
      if (imp.report_type !== reportType) return false;
      
      // If restaurantId provided, check if this import includes that restaurant
      if (restaurantId && imp.restaurant_ids) {
        if (!imp.restaurant_ids.includes(restaurantId)) return false;
      }
      
      // Check if the import's date range matches the selected period
      if (imp.date_range_start && imp.date_range_end) {
        const importStart = new Date(imp.date_range_start);
        const importEnd = new Date(imp.date_range_end);
        
        // Ignore imports with suspiciously large ranges (full year fallback = bad data)
        const importDays = differenceInDays(importEnd, importStart);
        if (importDays > 60) {
          // This is likely a fallback "full year" range - ignore it
          return false;
        }
        
        if (frequency === "weekly") {
          // For weekly: check for overlap
          const hasOverlap = importStart <= periodEnd && importEnd >= periodStart;
          return hasOverlap;
        } else {
          // For monthly: require complete coverage OR exact match for the period
          // Import must fully contain the period: importStart <= periodStart AND importEnd >= periodEnd
          const coversFullPeriod = importStart <= periodStart && importEnd >= periodEnd;
          
          // Also accept if the import period is within the month (partial month import for that month)
          // Check if import overlaps with the month AND is specifically for this month
          const importMonth = importStart.getMonth();
          const importYear = importStart.getFullYear();
          const periodMonth = periodStart.getMonth();
          const periodYear = periodStart.getFullYear();
          const sameMonthImport = importMonth === periodMonth && importYear === periodYear;
          
          return coversFullPeriod || sameMonthImport;
        }
      }
      
      // Fallback: use imported_at if no date range available
      const importDate = new Date(imp.imported_at);
      return isWithinInterval(importDate, { start: periodStart, end: periodEnd });
    });

    if (relevantImports.length > 0) {
      const lastImport = new Date(Math.max(...relevantImports.map(i => new Date(i.imported_at).getTime())));
      return { status: "done", lastImport, importCount: relevantImports.length };
    }

    // Check if we're past the period (overdue)
    const now = new Date();
    if (now > periodEnd) {
      const daysOverdue = differenceInDays(now, periodEnd);
      // Critical if more than 7 days overdue
      if (daysOverdue > 7) {
        return { status: "critical", lastImport: null, importCount: 0, daysOverdue };
      }
      return { status: "overdue", lastImport: null, importCount: 0, daysOverdue };
    }

    return { status: "pending", lastImport: null, importCount: 0 };
  };

  // Separate weekly and monthly reports
  const weeklyReports = IMPORT_SCHEDULE.filter(r => r.frequency === "weekly");
  const monthlyReports = IMPORT_SCHEDULE.filter(r => r.frequency === "monthly");

  // Calculate progress
  const weeklyProgress = useMemo(() => {
    const done = weeklyReports.filter(r => getImportStatus(r.type, r.frequency).status === "done").length;
    const critical = weeklyReports.filter(r => getImportStatus(r.type, r.frequency).status === "critical").length;
    return { done, total: weeklyReports.length, percentage: Math.round((done / weeklyReports.length) * 100), critical };
  }, [imports, weekStart, weekEnd]);

  const monthlyProgress = useMemo(() => {
    const done = monthlyReports.filter(r => getImportStatus(r.type, r.frequency).status === "done").length;
    const critical = monthlyReports.filter(r => getImportStatus(r.type, r.frequency).status === "critical").length;
    return { done, total: monthlyReports.length, percentage: Math.round((done / monthlyReports.length) * 100), critical };
  }, [imports, monthStart, monthEnd]);

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedDate(prev => direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const StatusIcon = ({ status }: { status: ImportStatus }) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "critical":
        return <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />;
      case "overdue":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const StatusCell = ({ status, daysOverdue }: { status: ImportStatus; daysOverdue?: number }) => {
    const baseClasses = "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium";
    
    switch (status) {
      case "done":
        return (
          <div className={`${baseClasses} bg-green-500 text-white`}>
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case "critical":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={`${baseClasses} bg-destructive text-destructive-foreground animate-pulse relative`}>
                  <AlertCircle className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 bg-destructive text-[10px] rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                    {daysOverdue}j
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{daysOverdue} jours de retard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "overdue":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={`${baseClasses} bg-orange-500 text-white`}>
                  <AlertTriangle className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{daysOverdue} jours de retard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return <div className={`${baseClasses} bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/30`} />;
    }
  };

  const ReportCard = ({ report }: { report: typeof IMPORT_SCHEDULE[0] }) => {
    const statusInfo = getImportStatus(report.type, report.frequency);
    const Icon = report.icon;

    return (
      <div 
        className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
          statusInfo.status === "done" 
            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
            : statusInfo.status === "critical"
            ? "bg-destructive/10 border-destructive/50"
            : statusInfo.status === "overdue"
            ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
            : "bg-card border-border hover:bg-accent/50"
        }`}
      >
        <StatusIcon status={statusInfo.status} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate">{report.label}</span>
            <Badge variant="outline" className="text-xs">
              {report.theme}
            </Badge>
            {statusInfo.status === "critical" && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                {statusInfo.daysOverdue}+ jours de retard
              </Badge>
            )}
            {statusInfo.status === "overdue" && statusInfo.daysOverdue && statusInfo.daysOverdue <= 7 && (
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {statusInfo.daysOverdue} jour{statusInfo.daysOverdue > 1 ? 's' : ''} de retard
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{report.description}</p>
          {statusInfo.lastImport && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Importé le {format(statusInfo.lastImport, "dd/MM à HH:mm", { locale: fr })}
              {statusInfo.importCount > 1 && ` (${statusInfo.importCount} imports)`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground"
          >
            <Link to={`/import-guide#${report.guideSection}`}>
              <BookOpen className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant={statusInfo.status === "done" ? "outline" : "default"}
            size="sm"
            asChild
          >
            <Link to={`/report-import?type=${report.type}`}>
              <FileUp className="h-4 w-4 mr-1" />
              {statusInfo.status === "done" ? "Réimporter" : "Importer"}
            </Link>
          </Button>
        </div>
      </div>
    );
  };

  // Matrix View Component
  const MatrixView = ({ reports, frequency }: { reports: typeof IMPORT_SCHEDULE; frequency: "weekly" | "monthly" }) => {
    if (!pinnedRestaurants || pinnedRestaurants.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun restaurant épinglé</p>
          <p className="text-sm">Épinglez des restaurants pour voir la vue matrice</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b font-medium text-sm sticky left-0 bg-background z-10 min-w-[180px]">
                Restaurant
              </th>
              {reports.map(report => (
                <th key={report.type} className="p-2 border-b text-center min-w-[60px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <span className="text-xs font-medium text-muted-foreground">
                          {report.shortLabel}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{report.label}</p>
                        <p className="text-xs text-muted-foreground">{report.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
              ))}
              <th className="p-2 border-b text-center min-w-[80px]">
                <span className="text-xs font-medium text-muted-foreground">Progression</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pinnedRestaurants.map(restaurant => {
              const restaurantStats = reports.map(report => 
                getImportStatus(report.type, frequency, restaurant.id)
              );
              const doneCount = restaurantStats.filter(s => s.status === "done").length;
              const criticalCount = restaurantStats.filter(s => s.status === "critical").length;
              const progressPercent = Math.round((doneCount / reports.length) * 100);
              
              return (
                <tr key={restaurant.id} className="hover:bg-muted/50">
                  <td className="p-2 border-b sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate max-w-[160px]" title={restaurant.name}>
                        {restaurant.name.replace("CHICKEN STREET ", "")}
                      </span>
                      {criticalCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          {criticalCount}
                        </Badge>
                      )}
                    </div>
                  </td>
                  {reports.map((report, idx) => {
                    const status = restaurantStats[idx];
                    return (
                      <td key={report.type} className="p-2 border-b text-center">
                        <div className="flex justify-center">
                          <StatusCell status={status.status} daysOverdue={status.daysOverdue} />
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 border-b">
                    <div className="flex items-center gap-2">
                      <Progress value={progressPercent} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-8">{doneCount}/{reports.length}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Checklist des Imports</h1>
          <p className="text-muted-foreground">
            Suivez vos imports hebdomadaires et mensuels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "matrix")}>
            <TabsList>
              <TabsTrigger value="list" className="gap-1">
                <List className="h-4 w-4" />
                Liste
              </TabsTrigger>
              <TabsTrigger value="matrix" className="gap-1">
                <LayoutGrid className="h-4 w-4" />
                Matrice
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" asChild>
            <Link to="/import-guide">
              <BookOpen className="h-4 w-4 mr-2" />
              Guide complet
            </Link>
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {(weeklyProgress.critical > 0 || monthlyProgress.critical > 0) && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
              <div>
                <p className="font-medium text-destructive">Rapports en retard critique</p>
                <p className="text-sm text-muted-foreground">
                  {weeklyProgress.critical > 0 && `${weeklyProgress.critical} rapport(s) hebdomadaire(s)`}
                  {weeklyProgress.critical > 0 && monthlyProgress.critical > 0 && " et "}
                  {monthlyProgress.critical > 0 && `${monthlyProgress.critical} rapport(s) mensuel(s)`}
                  {" "}en retard de plus d'une semaine
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="font-medium">
                Semaine du {format(weekStart, "d MMMM", { locale: fr })} au {format(weekEnd, "d MMMM yyyy", { locale: fr })}
              </p>
              <p className="text-sm text-muted-foreground">
                Mois de {format(monthStart, "MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === "list" ? (
        <>
          {/* Weekly Reports - List View */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Imports Hebdomadaires
                  {weeklyProgress.critical > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {weeklyProgress.critical} en retard
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {weeklyProgress.done}/{weeklyProgress.total}
                  </span>
                  <Progress value={weeklyProgress.percentage} className="w-24 h-2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : (
                weeklyReports.map(report => (
                  <ReportCard key={report.type} report={report} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Monthly Reports - List View */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Imports Mensuels
                  <Badge variant="secondary" className="ml-2">
                    {format(monthStart, "MMMM yyyy", { locale: fr })}
                  </Badge>
                  {monthlyProgress.critical > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {monthlyProgress.critical} en retard
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {monthlyProgress.done}/{monthlyProgress.total}
                  </span>
                  <Progress value={monthlyProgress.percentage} className="w-24 h-2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : (
                monthlyReports.map(report => (
                  <ReportCard key={report.type} report={report} />
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Weekly Reports - Matrix View */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Imports Hebdomadaires par Restaurant
                  {weeklyProgress.critical > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {weeklyProgress.critical} en retard
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : (
                <MatrixView reports={weeklyReports} frequency="weekly" />
              )}
            </CardContent>
          </Card>

          {/* Monthly Reports - Matrix View */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Imports Mensuels par Restaurant
                  <Badge variant="secondary" className="ml-2">
                    {format(monthStart, "MMMM yyyy", { locale: fr })}
                  </Badge>
                  {monthlyProgress.critical > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {monthlyProgress.critical} en retard
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : (
                <MatrixView reports={monthlyReports} frequency="monthly" />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>Importé</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="h-4 w-4" />
          <span>À faire</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span>En retard</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span>Retard critique (+7j)</span>
        </div>
      </div>
    </div>
  );
}
