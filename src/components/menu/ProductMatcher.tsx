import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Link2, 
  Unlink, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { findPotentialMatches, calculateSimilarity, type MatchCandidate } from "@/lib/fuzzyMatch";

interface MenuItem {
  id: string;
  name: string;
  name_uber: string | null;
  name_deliveroo: string | null;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  description_uber: string | null;
  description_deliveroo: string | null;
}

interface ProductMatcherProps {
  menuItems: MenuItem[];
  onRefresh: () => void;
}

interface MatchSuggestion {
  uberItem: MenuItem;
  deliverooItem: MenuItem;
  similarity: number;
}

export function ProductMatcher({ menuItems, onRefresh }: ProductMatcherProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Dialog states
  const [selectedMatch, setSelectedMatch] = useState<MatchSuggestion | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [selectedUberItem, setSelectedUberItem] = useState<MenuItem | null>(null);
  const [selectedDeliverooItem, setSelectedDeliverooItem] = useState<MenuItem | null>(null);
  
  // Search states for manual merge dialog
  const [uberSearchQuery, setUberSearchQuery] = useState("");
  const [deliverooSearchQuery, setDeliverooSearchQuery] = useState("");

  // Separate items by platform
  const { uberOnlyItems, deliverooOnlyItems, matchSuggestions } = useMemo(() => {
    const uberOnly = menuItems.filter(i => i.price_uber && !i.price_deliveroo);
    const deliverooOnly = menuItems.filter(i => !i.price_uber && i.price_deliveroo);
    
    // Find potential matches
    const suggestions: MatchSuggestion[] = [];
    
    for (const uberItem of uberOnly) {
      const matches = findPotentialMatches(
        uberItem.name,
        deliverooOnly.map(d => ({ id: d.id, name: d.name, price_uber: d.price_uber, price_deliveroo: d.price_deliveroo })),
        60
      );
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        const deliverooItem = deliverooOnly.find(d => d.id === bestMatch.id);
        if (deliverooItem) {
          suggestions.push({
            uberItem,
            deliverooItem,
            similarity: bestMatch.similarity,
          });
        }
      }
    }
    
    // Sort by similarity descending
    suggestions.sort((a, b) => b.similarity - a.similarity);
    
    return { uberOnlyItems: uberOnly, deliverooOnlyItems: deliverooOnly, matchSuggestions: suggestions };
  }, [menuItems]);

  // Filter suggestions by search
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery) return matchSuggestions;
    const query = searchQuery.toLowerCase();
    return matchSuggestions.filter(s => 
      s.uberItem.name.toLowerCase().includes(query) || 
      s.deliverooItem.name.toLowerCase().includes(query)
    );
  }, [matchSuggestions, searchQuery]);

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(price);
  };

  // Merge two items into one
  const mergeItems = async (uberItem: MenuItem, deliverooItem: MenuItem) => {
    setIsProcessing(true);
    
    try {
      // Update the Uber item with Deliveroo data
      const { error: updateError } = await supabase
        .from("menu_items")
        .update({
          price_deliveroo: deliverooItem.price_deliveroo,
          description_deliveroo: deliverooItem.description_deliveroo,
          name_uber: uberItem.name !== deliverooItem.name ? uberItem.name : null,
          name_deliveroo: uberItem.name !== deliverooItem.name ? deliverooItem.name : null,
        })
        .eq("id", uberItem.id);

      if (updateError) throw updateError;

      // Delete the Deliveroo-only item
      const { error: deleteError } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", deliverooItem.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Produits fusionnés",
        description: `"${uberItem.name}" et "${deliverooItem.name}" ont été fusionnés`,
      });

      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de fusionner les produits",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsConfirmDialogOpen(false);
      setSelectedMatch(null);
    }
  };

  // Batch merge all suggestions
  const mergeAllSuggestions = async () => {
    if (matchSuggestions.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    
    let successCount = 0;
    const total = matchSuggestions.length;

    for (let i = 0; i < matchSuggestions.length; i++) {
      const { uberItem, deliverooItem } = matchSuggestions[i];
      
      try {
        const { error: updateError } = await supabase
          .from("menu_items")
          .update({
            price_deliveroo: deliverooItem.price_deliveroo,
            description_deliveroo: deliverooItem.description_deliveroo,
            name_uber: uberItem.name !== deliverooItem.name ? uberItem.name : null,
            name_deliveroo: uberItem.name !== deliverooItem.name ? deliverooItem.name : null,
          })
          .eq("id", uberItem.id);

        if (!updateError) {
          await supabase.from("menu_items").delete().eq("id", deliverooItem.id);
          successCount++;
        }
      } catch {
        // Continue with next item
      }
      
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    toast({
      title: "Fusion terminée",
      description: `${successCount} sur ${total} produits fusionnés`,
    });

    setIsProcessing(false);
    setProgress(0);
    onRefresh();
  };

  const openConfirmDialog = (suggestion: MatchSuggestion) => {
    setSelectedMatch(suggestion);
    setIsConfirmDialogOpen(true);
  };

  const openManualMergeDialog = () => {
    setSelectedUberItem(null);
    setSelectedDeliverooItem(null);
    setUberSearchQuery("");
    setDeliverooSearchQuery("");
    setIsMergeDialogOpen(true);
  };

  // Filtered lists for manual merge dialog
  const filteredUberItems = useMemo(() => {
    if (!uberSearchQuery) return uberOnlyItems;
    const query = uberSearchQuery.toLowerCase();
    return uberOnlyItems.filter(item => item.name.toLowerCase().includes(query));
  }, [uberOnlyItems, uberSearchQuery]);

  const filteredDeliverooItems = useMemo(() => {
    if (!deliverooSearchQuery) return deliverooOnlyItems;
    const query = deliverooSearchQuery.toLowerCase();
    return deliverooOnlyItems.filter(item => item.name.toLowerCase().includes(query));
  }, [deliverooOnlyItems, deliverooSearchQuery]);

  const handleManualMerge = () => {
    if (selectedUberItem && selectedDeliverooItem) {
      mergeItems(selectedUberItem, selectedDeliverooItem);
      setIsMergeDialogOpen(false);
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 90) return "text-emerald-500";
    if (similarity >= 75) return "text-amber-500";
    return "text-orange-500";
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <UberEatsIcon className="h-4 w-4" />
              <p className="text-2xl font-bold">{uberOnlyItems.length}</p>
            </div>
            <p className="text-xs text-muted-foreground">Uber uniquement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <DeliverooIcon className="h-4 w-4" />
              <p className="text-2xl font-bold">{deliverooOnlyItems.length}</p>
            </div>
            <p className="text-xs text-muted-foreground">Deliveroo uniquement</p>
          </CardContent>
        </Card>
        <Card className="border-primary">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold">{matchSuggestions.length}</p>
            </div>
            <p className="text-xs text-muted-foreground">Correspondances détectées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold">
                {menuItems.filter(i => i.price_uber && i.price_deliveroo).length}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Déjà appairés</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {matchSuggestions.length > 0 && (
        <div className="flex gap-3 items-center p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="font-medium">
              {matchSuggestions.length} correspondance{matchSuggestions.length > 1 ? "s" : ""} automatique{matchSuggestions.length > 1 ? "s" : ""} détectée{matchSuggestions.length > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Fusionnez les produits similaires entre Uber Eats et Deliveroo
            </p>
          </div>
          <Button onClick={mergeAllSuggestions} disabled={isProcessing} className="gap-2">
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Tout fusionner
          </Button>
        </div>
      )}

      {isProcessing && progress > 0 && (
        <Progress value={progress} className="h-2" />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={openManualMergeDialog} className="gap-2">
              <Link2 className="h-4 w-4" />
              Fusion manuelle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Correspondances suggérées ({filteredSuggestions.length})</CardTitle>
          <CardDescription>
            Produits détectés comme similaires entre Uber Eats et Deliveroo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSuggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">Aucune correspondance à traiter</p>
              <p className="text-sm">Tous les produits similaires ont été fusionnés</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <UberEatsIcon className="h-4 w-4" />
                        Produit Uber
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-[100px]">Similarité</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <DeliverooIcon className="h-4 w-4" />
                        Produit Deliveroo
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map((suggestion, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{suggestion.uberItem.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(suggestion.uberItem.price_uber)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className={getSimilarityColor(suggestion.similarity)}>
                            {suggestion.similarity}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{suggestion.deliverooItem.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(suggestion.deliverooItem.price_deliveroo)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openConfirmDialog(suggestion)}
                          disabled={isProcessing}
                          className="gap-1"
                        >
                          <Link2 className="h-3 w-3" />
                          Fusionner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Confirm Merge Dialog */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fusionner ces produits ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Les deux produits seront fusionnés en un seul avec les prix des deux plateformes.</p>
              
              {selectedMatch && (
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <UberEatsIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">Uber Eats</span>
                      </div>
                      <p className="font-medium">{selectedMatch.uberItem.name}</p>
                      <p className="text-sm">{formatPrice(selectedMatch.uberItem.price_uber)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DeliverooIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">Deliveroo</span>
                      </div>
                      <p className="font-medium">{selectedMatch.deliverooItem.name}</p>
                      <p className="text-sm">{formatPrice(selectedMatch.deliverooItem.price_deliveroo)}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedMatch && selectedMatch.uberItem.name !== selectedMatch.deliverooItem.name && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Les noms différents seront conservés pour chaque plateforme</span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMatch && mergeItems(selectedMatch.uberItem, selectedMatch.deliverooItem)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Fusionner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Merge Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Fusion manuelle</DialogTitle>
            <DialogDescription>
              Sélectionnez un produit Uber et un produit Deliveroo à fusionner
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Uber Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UberEatsIcon className="h-4 w-4" />
                <span className="font-medium">Produit Uber</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit Uber..."
                  value={uberSearchQuery}
                  onChange={(e) => setUberSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[250px] border rounded-lg p-2">
                {filteredUberItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun produit trouvé</p>
                ) : (
                  filteredUberItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2 rounded cursor-pointer mb-1 ${
                        selectedUberItem?.id === item.id 
                          ? "bg-primary/20 border border-primary" 
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedUberItem(item)}
                    >
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(item.price_uber)}</p>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>

            {/* Deliveroo Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DeliverooIcon className="h-4 w-4" />
                <span className="font-medium">Produit Deliveroo</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit Deliveroo..."
                  value={deliverooSearchQuery}
                  onChange={(e) => setDeliverooSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[250px] border rounded-lg p-2">
                {filteredDeliverooItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun produit trouvé</p>
                ) : (
                  filteredDeliverooItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2 rounded cursor-pointer mb-1 ${
                        selectedDeliverooItem?.id === item.id 
                          ? "bg-primary/20 border border-primary" 
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedDeliverooItem(item)}
                    >
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(item.price_deliveroo)}</p>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Similarity Preview */}
          {selectedUberItem && selectedDeliverooItem && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">
                Similarité : 
                <span className={`font-bold ml-2 ${getSimilarityColor(calculateSimilarity(selectedUberItem.name, selectedDeliverooItem.name))}`}>
                  {calculateSimilarity(selectedUberItem.name, selectedDeliverooItem.name)}%
                </span>
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleManualMerge} 
              disabled={!selectedUberItem || !selectedDeliverooItem || isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Fusionner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
