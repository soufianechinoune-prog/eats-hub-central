import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

const Exports = () => {
  const { toast } = useToast();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-for-export"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const handleExport = async () => {
    try {
      let query = supabase
        .from("orders")
        .select(`
          *,
          restaurants (name, city)
        `)
        .gte("order_datetime", dateFrom)
        .lte("order_datetime", dateTo)
        .order("order_datetime", { ascending: false });

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      if (!orders || orders.length === 0) {
        toast({
          title: "Aucune donnée",
          description: "Aucune commande trouvée pour cette période",
        });
        return;
      }

      // Convert to CSV
      const headers = [
        "Date/Heure",
        "Restaurant",
        "Ville",
        "N° Commande Uber",
        "Statut",
        "Montant Brut",
        "Montant Net",
        "Frais Service",
        "Devise",
      ];

      const csvRows = [
        headers.join(";"),
        ...orders.map((order) =>
          [
            new Date(order.order_datetime || "").toLocaleString("fr-FR"),
            order.restaurants?.name || "",
            order.restaurants?.city || "",
            order.uber_order_id,
            order.status || "",
            order.gross_amount?.toFixed(2) || "0",
            order.net_amount?.toFixed(2) || "0",
            order.service_fee?.toFixed(2) || "0",
            order.currency || "EUR",
          ].join(";")
        ),
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      // Download
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `export_commandes_${dateFrom}_${dateTo}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Succès",
        description: `${orders.length} commandes exportées`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Exports</h2>
        <p className="text-muted-foreground">
          Exportez vos données de commandes en CSV
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configuration de l'export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="restaurant">Restaurant</Label>
            <Select
              value={selectedRestaurant}
              onValueChange={setSelectedRestaurant}
            >
              <SelectTrigger id="restaurant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les restaurants</SelectItem>
                {restaurants?.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name} - {restaurant.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Date de début</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Date de fin</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleExport} className="w-full" size="lg">
            <Download className="mr-2 h-4 w-4" />
            Exporter en CSV
          </Button>

          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Format du fichier CSV :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Séparateur : point-virgule (;)</li>
              <li>Encodage : UTF-8 avec BOM</li>
              <li>Compatible Excel</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Exports;
