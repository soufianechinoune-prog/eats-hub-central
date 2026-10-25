import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { REPORT_TYPE_CONFIG } from "@/lib/reportImportConfig";
import ImportCoverageMatrix from "@/components/reports/ImportCoverageMatrix";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { belongsToImportScope } from "@/lib/importHistoryScope";

interface CsvImport {
  id: string;
  file_name: string;
  file_size: number | null;
  report_type: string;
  imported_at: string;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  restaurants_count: number;
  file_url: string | null;
  status: string;
  label: string | null;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(REPORT_TYPE_CONFIG).map(([key, config]) => [key, config.label])),
  payment_order_level: "Niveau commande",
  payment_item_level: "Niveau articles",
  payout_summary: "Versements",
  deliveroo_statement: "Relevé Deliveroo",
};

export default function ImportHistory() {
  const { toast } = useToast();
  const { selectedChainId } = useAnalyticsContext();
  const [filterType, setFilterType] = useState<string>("all");
  const { data: restaurants = [], isLoading: restaurantsLoading } = useActiveRestaurants();
  const brandRestaurantIds = restaurants.map((restaurant) => restaurant.id);
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");
  const [matrixYear, setMatrixYear] = useState<number>(new Date().getFullYear());

  const scopeReady = Boolean(selectedChainId && selectedChainId !== "00000000-0000-0000-0000-000000000000");
  const { data: imports = [], isLoading: importsLoading, isError: hasError, refetch } = useQuery({
    queryKey: ["csv-import-history", selectedChainId, brandRestaurantIds, filterType],
    enabled: scopeReady && !restaurantsLoading,
    queryFn: async (): Promise<CsvImport[]> => {
      if (brandRestaurantIds.length === 0) return [];
      const records: CsvImport[] = [];
      const pageSize = 1000;
      let offset = 0;
      while (true) {
        let query = supabase.from("csv_imports").select("*")
          .overlaps("restaurant_ids", brandRestaurantIds)
          .order("imported_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (filterType !== "all") query = query.eq("report_type", filterType);
        const { data, error } = await query;
        if (error) throw error;
        const page = data ?? [];
        records.push(...page.filter((imp) => belongsToImportScope(imp.restaurant_ids, brandRestaurantIds)));
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      return records;
    },
  });
  const isLoading = !scopeReady || restaurantsLoading || importsLoading;
  const fetchImports = () => { void refetch(); };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("csv-imports")
        .download(fileUrl);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (importRecord: CsvImport) => {
    try {
      // Delete file from storage if exists
      if (importRecord.file_url) {
        await supabase.storage.from("csv-imports").remove([importRecord.file_url]);
      }

      // Delete record from database
      const { error } = await supabase
        .from("csv_imports")
        .delete()
        .eq("id", importRecord.id);

      if (error) throw error;

      toast({
        title: "Supprimé",
        description: "L'entrée a été supprimée de l'historique",
      });

      fetchImports();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'entrée",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const getStatusBadge = (status: string, errorCount: number) => {
    if (status === "reconstructed") return <Badge variant="outline">Reconstitué</Badge>;
    if (status === "failed") {
      return <Badge variant="destructive">Échoué</Badge>;
    }
    if (errorCount > 0) {
      return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">Partiel</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/20 text-green-700">Complet</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Historique des imports
            </CardTitle>
            <CardDescription>
              {imports.length} import{imports.length > 1 ? "s" : ""} enregistré{imports.length > 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(REPORT_TYPE_CONFIG).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
                <SelectItem value="deliveroo_statement">Relevé Deliveroo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchImports}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ImportCoverageMatrix
          imports={imports}
          year={matrixYear}
          onYearChange={setMatrixYear}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        {viewMode === "matrix" ? null : hasError ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <p className="font-medium text-foreground">Impossible de charger l'historique</p>
            <p className="text-sm mb-4">La base de données est temporairement surchargée</p>
            <Button variant="outline" onClick={fetchImports}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun import enregistré</p>
            <p className="text-sm">Les imports apparaîtront ici une fois effectués</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto">
             <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-center">Restaurants</TableHead>
                  <TableHead className="text-center">Lignes</TableHead>
                  <TableHead className="text-center">Insérées</TableHead>
                  <TableHead className="text-center">MAJ</TableHead>
                  <TableHead className="text-center">Erreurs</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell className="whitespace-nowrap">
                      <div>
                        <p className="font-medium">
                           {imp.status === "reconstructed" ? "Date d’import inconnue" : format(new Date(imp.imported_at), "dd MMM yyyy", { locale: fr })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                           {imp.status === "reconstructed" ? `Reconstitué le ${format(new Date(imp.imported_at), "dd/MM/yyyy")}` : format(new Date(imp.imported_at), "HH:mm")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                       <span className="text-sm font-medium" title={imp.label ?? undefined}>{imp.status === "reconstructed" ? "Historique reconstitué" : imp.label || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="font-medium truncate" title={imp.file_name}>
                          {imp.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(imp.file_size)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {REPORT_TYPE_LABELS[imp.report_type] || imp.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {imp.date_range_start ? `${format(new Date(imp.date_range_start), "dd/MM/yyyy")} → ${imp.date_range_end ? format(new Date(imp.date_range_end), "dd/MM/yyyy") : "—"}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">{imp.restaurants_count}</TableCell>
                    <TableCell className="text-center font-medium">
                      {imp.total_rows.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-center text-green-600 font-medium">
                       {imp.status === "reconstructed" ? "—" : imp.inserted_count.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-center text-blue-600 font-medium">
                       {imp.status === "reconstructed" ? "—" : imp.updated_count.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-center text-red-600 font-medium">
                      {imp.error_count > 0 ? imp.error_count.toLocaleString("fr-FR") : "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(imp.status, imp.error_count)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {imp.file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { if (imp.file_url) void handleDownload(imp.file_url, imp.file_name); }}
                            title="Télécharger le fichier original"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action supprimera l'entrée de l'historique et le fichier CSV original.
                                Les données déjà importées dans la base ne seront pas supprimées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(imp)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
