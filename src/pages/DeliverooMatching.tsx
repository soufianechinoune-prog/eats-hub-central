import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchDeliverooToRestaurant, type DeliverooMatchResult } from "@/lib/fuzzyMatch";
import { useToast } from "@/hooks/use-toast";
import { Upload, Save, CheckCircle2, AlertTriangle, XCircle, Ban, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MatchRow extends DeliverooMatchResult {
  selectedRestaurantId: string | null;
}

export default function DeliverooMatching() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-for-deliveroo-matching"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, deliveroo_store_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        // Find header line
        const headerIdx = lines.findIndex((l) =>
          l.toLowerCase().includes("etablissement") || l.toLowerCase().includes("établissement")
        );
        if (headerIdx === -1) {
          toast({ title: "Erreur", description: "Colonne 'Etablissement' non trouvée dans le CSV", variant: "destructive" });
          return;
        }

        const headers = lines[headerIdx].split(",").map((h) => h.replace(/"/g, "").trim());
        const etabIdx = headers.findIndex((h) =>
          h.toLowerCase().includes("etablissement") || h.toLowerCase().includes("établissement")
        );

        const deliverooNames: string[] = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
          // Simple CSV parse (handle commas inside quotes)
          const row = parseCSVLine(lines[i]);
          if (row[etabIdx]) {
            const name = row[etabIdx].replace(/"/g, "").trim();
            if (name && name.toLowerCase() !== "tous les etablissements" && name.toLowerCase() !== "tous les établissements") {
              deliverooNames.push(name);
            }
          }
        }

        // Run matching
        const results: MatchRow[] = deliverooNames.map((name) => {
          const result = matchDeliverooToRestaurant(name, restaurants);
          return {
            ...result,
            selectedRestaurantId: result.matchedRestaurantId,
          };
        });

        // Sort: unmatched first, then low confidence, then matched
        results.sort((a, b) => {
          if (a.isIgnored !== b.isIgnored) return a.isIgnored ? 1 : -1;
          if (a.isAlreadyLinked !== b.isAlreadyLinked) return a.isAlreadyLinked ? 1 : -1;
          return a.confidence - b.confidence;
        });

        setMatches(results);
      };
      reader.readAsText(file);
    },
    [restaurants, toast]
  );

  const handleRestaurantChange = useCallback((deliverooName: string, restaurantId: string) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.deliverooName === deliverooName
          ? { ...m, selectedRestaurantId: restaurantId === "none" ? null : restaurantId }
          : m
      )
    );
  }, []);

  const handleSave = useCallback(async () => {
    const toSave = matches.filter(
      (m) => !m.isIgnored && m.selectedRestaurantId && !m.isAlreadyLinked
    );
    if (toSave.length === 0) {
      toast({ title: "Rien à enregistrer", description: "Aucune nouvelle correspondance à sauvegarder." });
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const match of toSave) {
      const { error } = await supabase
        .from("restaurants")
        .update({ deliveroo_store_id: match.deliverooName })
        .eq("id", match.selectedRestaurantId!);
      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    setSaving(false);
    toast({
      title: "Enregistrement terminé",
      description: `${successCount} correspondance(s) sauvegardée(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}`,
    });

    // Mark saved ones as already linked
    setMatches((prev) =>
      prev.map((m) =>
        toSave.some((s) => s.deliverooName === m.deliverooName)
          ? { ...m, isAlreadyLinked: true }
          : m
      )
    );
  }, [matches, toast]);

  const stats = useMemo(() => {
    const active = matches.filter((m) => !m.isIgnored);
    return {
      total: matches.length,
      ignored: matches.filter((m) => m.isIgnored).length,
      alreadyLinked: active.filter((m) => m.isAlreadyLinked).length,
      highConfidence: active.filter((m) => !m.isAlreadyLinked && m.confidence >= 90).length,
      mediumConfidence: active.filter((m) => !m.isAlreadyLinked && m.confidence >= 70 && m.confidence < 90).length,
      lowConfidence: active.filter((m) => !m.isAlreadyLinked && m.confidence < 70).length,
      toSave: active.filter((m) => !m.isAlreadyLinked && m.selectedRestaurantId).length,
    };
  }, [matches]);

  const getConfidenceBadge = (confidence: number, isAlreadyLinked: boolean, isIgnored: boolean, isOverride: boolean) => {
    if (isIgnored) return <Badge variant="outline" className="gap-1"><Ban className="h-3 w-3" /> Ignoré</Badge>;
    if (isAlreadyLinked) return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600"><Link2 className="h-3 w-3" /> Déjà lié</Badge>;
    if (isOverride) return <Badge className="gap-1 bg-purple-500 hover:bg-purple-600">Override</Badge>;
    if (confidence >= 90) return <Badge className="gap-1 bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" /> {confidence}%</Badge>;
    if (confidence >= 70) return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><AlertTriangle className="h-3 w-3" /> {confidence}%</Badge>;
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {confidence}%</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matching Deliveroo</h1>
        <p className="text-muted-foreground">
          Associer les noms Deliveroo aux restaurants en base pour les futurs imports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Charger un CSV Deliveroo</CardTitle>
          <CardDescription>
            Uploadez un rapport de performance Deliveroo (rs-performance-report_xxx.csv)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {fileName || "Choisir un fichier CSV"}
              </span>
            </Button>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="text-sm py-1 px-3">{stats.total} total</Badge>
            <Badge className="text-sm py-1 px-3 bg-green-500">{stats.highConfidence} auto-matchés</Badge>
            <Badge className="text-sm py-1 px-3 bg-orange-500">{stats.mediumConfidence} à vérifier</Badge>
            <Badge variant="destructive" className="text-sm py-1 px-3">{stats.lowConfidence} non trouvés</Badge>
            <Badge className="text-sm py-1 px-3 bg-blue-500">{stats.alreadyLinked} déjà liés</Badge>
            <Badge variant="outline" className="text-sm py-1 px-3">{stats.ignored} ignorés</Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom Deliveroo</TableHead>
                    <TableHead>Restaurant en base</TableHead>
                    <TableHead className="w-[140px]">Confiance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow
                      key={match.deliverooName}
                      className={match.isIgnored ? "opacity-40" : ""}
                    >
                      <TableCell className="font-medium text-sm max-w-[300px] truncate">
                        {match.deliverooName}
                      </TableCell>
                      <TableCell>
                        {match.isIgnored ? (
                          <span className="text-muted-foreground text-sm italic">Hors réseau</span>
                        ) : (
                          <Select
                            value={match.selectedRestaurantId || "none"}
                            onValueChange={(v) => handleRestaurantChange(match.deliverooName, v)}
                            disabled={match.isAlreadyLinked}
                          >
                            <SelectTrigger className="w-full max-w-[350px] h-8 text-sm">
                              <SelectValue placeholder="Sélectionner un restaurant" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Aucun —</SelectItem>
                              {restaurants.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(match.confidence, match.isAlreadyLinked, match.isIgnored, match.isOverride)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || stats.toSave === 0} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement..." : `Enregistrer ${stats.toSave} correspondance(s)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Simple CSV line parser that handles quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
