import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Upload,
  TrendingDown,
  Euro,
  Package,
  Clock,
  Wifi,
  BarChart3,
} from "lucide-react";
import { OperationsImportDialog } from "@/components/operations/OperationsImportDialog";
import { OrderAccuracyDashboard } from "@/components/operations/OrderAccuracyDashboard";

const Operations = () => {
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

  // Generate year options (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Opérations</h2>
          <p className="text-muted-foreground">
            Analysez les performances opérationnelles de vos restaurants
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Restaurant" />
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

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedMonth === "all" ? "all" : selectedMonth.toString()} 
            onValueChange={(v) => setSelectedMonth(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'année</SelectItem>
              {monthNames.map((name, idx) => (
                <SelectItem key={idx} value={(idx + 1).toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importer données
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="order-accuracy" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="order-accuracy" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Commandes incorrectes</span>
            <span className="sm:hidden">Erreurs</span>
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-2" disabled>
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Livraison</span>
            <span className="sm:hidden">Livraison</span>
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2" disabled>
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Disponibilité</span>
            <span className="sm:hidden">Dispo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="order-accuracy">
          <OrderAccuracyDashboard
            selectedRestaurant={selectedRestaurant}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            restaurants={restaurants || []}
          />
        </TabsContent>

        <TabsContent value="delivery">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                L'analyse des temps de livraison sera disponible prochainement
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                L'analyse de disponibilité sera disponible prochainement
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <OperationsImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        restaurants={restaurants || []}
      />
    </div>
  );
};

export default Operations;
