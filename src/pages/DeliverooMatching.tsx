import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchDeliverooToRestaurant, type DeliverooMatchResult } from "@/lib/fuzzyMatch";
import { useToast } from "@/hooks/use-toast";
import { Upload, Save, CheckCircle2, AlertTriangle, XCircle, Ban, Link2, Clock, Undo2 } from "lucide-react";
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
  isPending: boolean;
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
          const row = parseCSVLine(lines[i]);
          if (row[etabIdx]) {
            const name = row[etabIdx].replace(/"/g, "").trim();
            if (name && name.toLowerCase() !== "tous les etablissements" && name.toLowerCase() !== "tous les établissements") {
              deliverooNames.push(name);
            }
          }
        }

        const results: MatchRow[] = deliverooNames.map((name) => {
          const result = matchDeliverooToRestaurant(name, restaurants);
          return {
            ...result,
            selectedRestaurantId: result.matchedRestaurantId,
            isPending: false,
          };
        });

        results.sort(sortMatches);
        setMatches(results);
      };
      reader.readAsText(file);
    },
    [restaurants, toast]
  );

  const handleRestaurantChange = useCallback((deliverooName: string, value: string) => {
    setMatches((prev) => {
      const updated = prev.map((m) => {
        if (m.deliverooName !== deliverooName) return m;
        if (value === "pending") {
          return { ...m, isPending: true, selectedRestaurantId: null };
        }
        return {
          ...m,
          isPending: false,
          selectedRestaurantId: value === "none" ? null : value,
        };
      });
      return [...updated].sort(sortMatches);
    });
  }, []);

  const togglePending = useCallback((deliverooName: string) => {
    setMatches((prev) => {
      const updated = prev.map((m) => {
        if (m.deliverooName !== deliverooName) return m;
        return { ...m, isPending: !m.isPending, selectedRestaurantId: m.isPending ? m.matchedRestaurantId : null };
      });
      return [...updated].sort(sortMatches);
    });
  }, []);

  const handleSave = useCallback(async () => {
    const toSave = matches.filter(
      (m) => !m.isIgnored && !m.isPending && m.selectedRestaurantId && !m.isAlreadyLinked
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
      if (error) errorCount++;
      else successCount++;
    }

    setSaving(false);
    toast({
      title: "Enregistrement terminé",
      description: `${successCount} correspondance(s) sauvegardée(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}`,
    });

    setMatches((prev) =>
      prev.map((m) =>
        toSave.some((s) => s.deliverooName === m.deliverooName)
          ? { ...m, isAlreadyLinked: true }
          : m
      )
    );
  }, [matches, toast]);

  // Set of restaurant IDs already used by other rows or already linked in DB
  const usedRestaurantIds = useMemo(() => {
    const used = new Set<string>();
    // Add IDs selected in current matches
    matches.forEach((m) => {
      if (m.selectedRestaurantId && !m.isIgnored) {
        used.add(m.selectedRestaurantId);
      }
    });
    // Add IDs of restaurants already linked in DB (have deliveroo_store_id)
    restaurants.forEach((r) => {
      if (r.deliveroo_store_id) {
        used.add(r.id);
      }
    });
    return used;
  }, [matches, restaurants]);

  const getAvailableRestaurants = useCallback((currentMatch: MatchRow) => {
    return restaurants.filter((r) => {
      // Always show the currently selected restaurant for this row
      if (r.id === currentMatch.selectedRestaurantId) return true;
      // Hide if used by another row or already linked in DB
      return !usedRestaurantIds.has(r.id);
    });
  }, [restaurants, usedRestaurantIds]);

  const stats = useMemo(() => {
    const active = matches.filter((m) => !m.isIgnored);
    return {
      total: matches.length,
      ignored: matches.filter((m) => m.isIgnored).length,
      alreadyLinked: active.filter((m) => m.isAlreadyLinked).length,
      pending: active.filter((m) => m.isPending && !m.isAlreadyLinked).length,
      highConfidence: active.filter((m) => !m.isAlreadyLinked && !m.isPending && m.confidence >= 90).length,
      mediumConfidence: active.filter((m) => !m.isAlreadyLinked && !m.isPending && m.confidence >= 70 && m.confidence < 90).length,
      lowConfidence: active.filter((m) => !m.isAlreadyLinked && !m.isPending && m.confidence < 70).length,
      toSave: active.filter((m) => !m.isAlreadyLinked && !m.isPending && m.selectedRestaurantId).length,
    };
  }, [matches]);

  const getConfidenceBadge = (match: MatchRow) => {
    const { confidence, isAlreadyLinked, isIgnored, isOverride, isPending } = match;
    if (isIgnored) return <Badge variant="outline" className="gap-1"><Ban className="h-3 w-3" /> Ignoré</Badge>;
    if (isAlreadyLinked) return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600"><Link2 className="h-3 w-3" /> Déjà lié</Badge>;
    if (isPending) return <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"><Clock className="h-3 w-3" /> En attente</Badge>;
    if (isOverride) return <Badge className="gap-1 bg-purple-500 hover:bg-purple-600">Override</Badge>;
    if (confidence >= 90) return <Badge className="gap-1 bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" /> {confidence}%</Badge>;
    if (confidence >= 70) return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><AlertTriangle className="h-3 w-3" /> {confidence}%</Badge>;
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {confidence}%</Badge>;
  };

  const getSelectValue = (match: MatchRow) => {
    if (match.isPending) return "pending";
    return match.selectedRestaurantId || "none";
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
            <Badge className="text-sm py-1 px-3 bg-yellow-500 text-white">{stats.pending} en attente</Badge>
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
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow
                      key={match.deliverooName}
                      className={
                        match.isIgnored ? "opacity-40" :
                        match.isPending ? "bg-yellow-50 dark:bg-yellow-950/20" : ""
                      }
                    >
                      <TableCell className="font-medium text-sm max-w-[300px] truncate">
                        {match.deliverooName}
                      </TableCell>
                      <TableCell>
                        {match.isIgnored ? (
                          <span className="text-muted-foreground text-sm italic">Hors réseau</span>
                        ) : (
                          <Select
                            value={getSelectValue(match)}
                            onValueChange={(v) => handleRestaurantChange(match.deliverooName, v)}
                            disabled={match.isAlreadyLinked}
                          >
                            <SelectTrigger className="w-full max-w-[350px] h-8 text-sm">
                              <SelectValue placeholder="Sélectionner un restaurant" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Aucun —</SelectItem>
                              <SelectItem value="pending" className="text-yellow-600">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" /> En attente
                                </span>
                              </SelectItem>
                              {getAvailableRestaurants(match).map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(match)}
                      </TableCell>
                      <TableCell>
                        {!match.isIgnored && !match.isAlreadyLinked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => togglePending(match.deliverooName)}
                            title={match.isPending ? "Remettre actif" : "Mettre en attente"}
                          >
                            {match.isPending ? <Undo2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5 text-yellow-600" />}
                          </Button>
                        )}
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

/** Sort: low confidence > medium > pending > high > already linked > ignored */
function sortMatches(a: MatchRow, b: MatchRow): number {
  const priority = (m: MatchRow): number => {
    if (m.isIgnored) return 6;
    if (m.isAlreadyLinked) return 5;
    if (m.isPending) return 3;
    if (m.confidence >= 90) return 4;
    if (m.confidence >= 70) return 2;
    return 1; // low confidence first
  };
  return priority(a) - priority(b);
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
