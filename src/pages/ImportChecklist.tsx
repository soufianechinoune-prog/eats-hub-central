import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, isWithinInterval } from "date-fns";
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
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Define all import types with their schedule
const IMPORT_SCHEDULE = [
  // Weekly reports
  { 
    type: "sales_over_time", 
    label: "Sales Over Time", 
    description: "Ventes quotidiennes par restaurant",
    frequency: "weekly" as const, 
    guideSection: "sales-over-time",
    icon: TrendingUp,
    theme: "Ventes"
  },
  { 
    type: "conversion_funnel", 
    label: "Tunnel de conversion", 
    description: "Visites → Menu → Panier → Commande",
    frequency: "weekly" as const, 
    guideSection: "conversion-funnel",
    icon: TrendingUp,
    theme: "Marketing"
  },
  { 
    type: "reviews_order", 
    label: "Avis par commande", 
    description: "Notes et commentaires clients",
    frequency: "weekly" as const, 
    guideSection: "reviews-order",
    icon: Star,
    theme: "Avis"
  },
  { 
    type: "reviews_item", 
    label: "Avis par produit", 
    description: "Thumbs up/down par article",
    frequency: "weekly" as const, 
    guideSection: "reviews-item",
    icon: Star,
    theme: "Avis"
  },
  { 
    type: "downtime_report", 
    label: "Temps d'inactivité", 
    description: "Périodes de fermeture non planifiées",
    frequency: "weekly" as const, 
    guideSection: "downtime-report",
    icon: Clock,
    theme: "Opérations"
  },
  { 
    type: "order_history", 
    label: "Historique commandes", 
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
    description: "Synthèse mensuelle des erreurs",
    frequency: "monthly" as const, 
    guideSection: "order-accuracy-summary",
    icon: Settings2,
    theme: "Opérations"
  },
  { 
    type: "inaccurate_orders", 
    label: "Commandes incorrectes (détail)", 
    description: "Détail des erreurs par commande",
    frequency: "monthly" as const, 
    guideSection: "inaccurate-orders",
    icon: Settings2,
    theme: "Opérations"
  },
  { 
    type: "item_issues_leaderboard", 
    label: "Top articles problématiques", 
    description: "Classement des erreurs par produit",
    frequency: "monthly" as const, 
    guideSection: "item-issues-leaderboard",
    icon: AlertTriangle,
    theme: "Opérations"
  },
  { 
    type: "marketing_campaigns", 
    label: "Campagnes Marketing", 
    description: "Performance des promotions",
    frequency: "monthly" as const, 
    guideSection: "marketing-campaigns",
    icon: Megaphone,
    theme: "Marketing"
  },
  { 
    type: "payment_order_level", 
    label: "Payment Orders", 
    description: "Détail financier par commande",
    frequency: "monthly" as const, 
    guideSection: "payment-orders",
    icon: DollarSign,
    theme: "Finance"
  },
  { 
    type: "payment_item_level", 
    label: "Payment Items", 
    description: "Détail financier par article",
    frequency: "monthly" as const, 
    guideSection: "payment-items",
    icon: DollarSign,
    theme: "Finance"
  },
  { 
    type: "payout_summary", 
    label: "Payout Summary", 
    description: "Résumé des versements",
    frequency: "monthly" as const, 
    guideSection: "payout-summary",
    icon: DollarSign,
    theme: "Finance"
  },
];

type ImportStatus = "done" | "pending" | "overdue";

interface ImportStatusInfo {
  status: ImportStatus;
  lastImport: Date | null;
  importCount: number;
}

export default function ImportChecklist() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Calculate week and month ranges
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // Fetch import history
  const { data: imports, isLoading } = useQuery({
    queryKey: ["csv-imports-checklist", format(weekStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csv_imports")
        .select("report_type, imported_at, status")
        .gte("imported_at", monthStart.toISOString())
        .lte("imported_at", monthEnd.toISOString())
        .eq("status", "success");
      
      if (error) throw error;
      return data;
    }
  });

  // Calculate status for each report type
  const getImportStatus = (reportType: string, frequency: "weekly" | "monthly"): ImportStatusInfo => {
    if (!imports) return { status: "pending", lastImport: null, importCount: 0 };

    const relevantImports = imports.filter(imp => {
      if (imp.report_type !== reportType) return false;
      
      const importDate = new Date(imp.imported_at);
      
      if (frequency === "weekly") {
        return isWithinInterval(importDate, { start: weekStart, end: weekEnd });
      } else {
        return isWithinInterval(importDate, { start: monthStart, end: monthEnd });
      }
    });

    if (relevantImports.length > 0) {
      const lastImport = new Date(Math.max(...relevantImports.map(i => new Date(i.imported_at).getTime())));
      return { status: "done", lastImport, importCount: relevantImports.length };
    }

    // Check if we're past the period (overdue)
    const now = new Date();
    if (frequency === "weekly" && now > weekEnd) {
      return { status: "overdue", lastImport: null, importCount: 0 };
    }
    if (frequency === "monthly" && now > monthEnd) {
      return { status: "overdue", lastImport: null, importCount: 0 };
    }

    return { status: "pending", lastImport: null, importCount: 0 };
  };

  // Separate weekly and monthly reports
  const weeklyReports = IMPORT_SCHEDULE.filter(r => r.frequency === "weekly");
  const monthlyReports = IMPORT_SCHEDULE.filter(r => r.frequency === "monthly");

  // Calculate progress
  const weeklyProgress = useMemo(() => {
    const done = weeklyReports.filter(r => getImportStatus(r.type, r.frequency).status === "done").length;
    return { done, total: weeklyReports.length, percentage: Math.round((done / weeklyReports.length) * 100) };
  }, [imports, weekStart, weekEnd]);

  const monthlyProgress = useMemo(() => {
    const done = monthlyReports.filter(r => getImportStatus(r.type, r.frequency).status === "done").length;
    return { done, total: monthlyReports.length, percentage: Math.round((done / monthlyReports.length) * 100) };
  }, [imports, monthStart, monthEnd]);

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedDate(prev => direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const StatusIcon = ({ status }: { status: ImportStatus }) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "overdue":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
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
            : statusInfo.status === "overdue"
            ? "bg-destructive/5 border-destructive/30"
            : "bg-card border-border hover:bg-accent/50"
        }`}
      >
        <StatusIcon status={statusInfo.status} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate">{report.label}</span>
            <Badge variant="outline" className="text-xs">
              {report.theme}
            </Badge>
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checklist des Imports</h1>
          <p className="text-muted-foreground">
            Suivez vos imports hebdomadaires et mensuels
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/import-guide">
            <BookOpen className="h-4 w-4 mr-2" />
            Guide complet
          </Link>
        </Button>
      </div>

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

      {/* Weekly Reports */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Imports Hebdomadaires
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

      {/* Monthly Reports */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Imports Mensuels
              <Badge variant="secondary" className="ml-2">
                {format(monthStart, "MMMM yyyy", { locale: fr })}
              </Badge>
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

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>Importé</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="h-4 w-4" />
          <span>À faire</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>En retard</span>
        </div>
      </div>
    </div>
  );
}
