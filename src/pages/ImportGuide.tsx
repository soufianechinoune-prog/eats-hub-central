import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileSpreadsheet, Calendar, Clock, Database, ImageIcon, ExternalLink, Upload, Trash2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileGuide {
  id: string;
  title: string;
  description: string;
  frequency: string;
  frequencyBadge: "default" | "secondary" | "outline";
  path: string[];
  parameters: string[];
  dataImported: string[];
  targetTable: string;
  yearsApplicable: string;
  screenshotPlaceholder: string;
}

const fileGuides: FileGuide[] = [
  {
    id: "sales-over-time",
    title: "Sales Over Time (Ventes au fil du temps)",
    description: "Données agrégées officielles Uber Eats : CA, commandes, panier moyen par jour. Source autoritaire pour les KPIs 2025+.",
    frequency: "Hebdomadaire",
    frequencyBadge: "default",
    path: [
      "Uber Eats Manager → Rapports",
      "Section 'Ventes au fil du temps'",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Mois en cours ou période souhaitée",
      "Format : CSV",
      "Granularité : Par jour"
    ],
    dataImported: [
      "Date",
      "Chiffre d'affaires TTC",
      "Nombre de commandes",
      "Panier moyen",
      "Période comparative (N-4 semaines)"
    ],
    targetTable: "daily_sales_uber",
    yearsApplicable: "2025+",
    screenshotPlaceholder: "Screenshot : Menu Rapports → Sales Over Time"
  },
  {
    id: "payment-orders",
    title: "Informations de paiement (niveau commande)",
    description: "Détails financiers de chaque commande : montants, frais Uber, TVA, remises, versements.",
    frequency: "Mensuel",
    frequencyBadge: "secondary",
    path: [
      "Uber Eats Manager → Rapports",
      "Section 'Informations de paiement'",
      "Niveau : 'Commande'",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Mois complet (ex: 01/11/2024 - 30/11/2024)",
      "Niveau de détail : Commande",
      "Format : CSV"
    ],
    dataImported: [
      "ID commande Uber",
      "Date/heure commande",
      "Total TTC",
      "Frais Uber (avant/après promo)",
      "TVA détaillée (3 taux)",
      "Remises articles/livraison",
      "Ajustements prix",
      "Versement net"
    ],
    targetTable: "orders",
    yearsApplicable: "2024 et avant",
    screenshotPlaceholder: "Screenshot : Informations de paiement → Niveau Commande"
  },
  {
    id: "payment-items",
    title: "Informations de paiement (niveau articles)",
    description: "Détails par article de chaque commande : quantités, prix unitaires, TVA par article.",
    frequency: "Mensuel",
    frequencyBadge: "secondary",
    path: [
      "Uber Eats Manager → Rapports",
      "Section 'Informations de paiement'",
      "Niveau : 'Articles'",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Mois complet (ex: 01/11/2024 - 30/11/2024)",
      "Niveau de détail : Articles",
      "Format : CSV"
    ],
    dataImported: [
      "ID article",
      "Nom article",
      "Catégorie",
      "Quantité",
      "Prix unitaire",
      "Total article",
      "TVA article",
      "Remises article"
    ],
    targetTable: "order_items",
    yearsApplicable: "2024 et avant",
    screenshotPlaceholder: "Screenshot : Informations de paiement → Niveau Articles"
  },
  {
    id: "payout-summary",
    title: "Récapitulatif des versements",
    description: "Synthèse des versements bancaires avec ventilation des frais, remises et ajustements.",
    frequency: "Hebdomadaire",
    frequencyBadge: "default",
    path: [
      "Uber Eats Manager → Rapports",
      "Section 'Récapitulatif des versements'",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Semaine ou mois",
      "Format : CSV"
    ],
    dataImported: [
      "Date versement",
      "Référence versement",
      "Nombre de commandes",
      "Total ventes TTC",
      "Frais Uber détaillés",
      "Remises totales",
      "Ajustements",
      "Versement net"
    ],
    targetTable: "payouts",
    yearsApplicable: "Tous",
    screenshotPlaceholder: "Screenshot : Récapitulatif des versements"
  }
];

interface ScreenshotData {
  id: string;
  guide_section_id: string;
  screenshot_url: string;
  uploaded_at: string;
  notes: string | null;
}

const ImportGuide = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Fetch existing screenshots
  const { data: screenshots = [] } = useQuery({
    queryKey: ["import-guide-screenshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_guide_screenshots")
        .select("*");
      if (error) throw error;
      return data as ScreenshotData[];
    },
  });

  // Get screenshot URL for a section
  const getScreenshotForSection = (sectionId: string) => {
    return screenshots.find(s => s.guide_section_id === sectionId);
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ sectionId, file }: { sectionId: string; file: File }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${sectionId}_${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("import-guide-screenshots")
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("import-guide-screenshots")
        .getPublicUrl(fileName);

      // Upsert to database
      const { error: dbError } = await supabase
        .from("import_guide_screenshots")
        .upsert({
          guide_section_id: sectionId,
          screenshot_url: publicUrl,
          uploaded_at: new Date().toISOString(),
        }, { onConflict: "guide_section_id" });

      if (dbError) throw dbError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-guide-screenshots"] });
      toast({ title: "Screenshot uploadé avec succès" });
      setUploadingSection(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'upload",
        description: error.message,
        variant: "destructive",
      });
      setUploadingSection(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const screenshot = getScreenshotForSection(sectionId);
      if (!screenshot) return;

      // Extract filename from URL
      const urlParts = screenshot.screenshot_url.split("/");
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      await supabase.storage
        .from("import-guide-screenshots")
        .remove([fileName]);

      // Delete from database
      const { error } = await supabase
        .from("import_guide_screenshots")
        .delete()
        .eq("guide_section_id", sectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-guide-screenshots"] });
      toast({ title: "Screenshot supprimé" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de suppression",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (sectionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner une image (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    setUploadingSection(sectionId);
    uploadMutation.mutate({ sectionId, file });
  };

  const triggerFileInput = (sectionId: string) => {
    fileInputRefs.current[sectionId]?.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/report-import")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Guide d'Import des Données Uber Eats</h1>
            <p className="text-muted-foreground">
              Référence complète des fichiers à télécharger depuis Uber Eats Manager
            </p>
          </div>
        </div>

        {/* Summary Table */}
        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Tableau récapitulatif
            </CardTitle>
            <CardDescription>
              Vue d'ensemble des 4 types de fichiers à importer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Table cible</TableHead>
                  <TableHead>Années</TableHead>
                  <TableHead>Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fileGuides.map((guide) => (
                  <TableRow key={guide.id}>
                    <TableCell className="font-medium">{guide.title}</TableCell>
                    <TableCell>
                      <Badge variant={guide.frequencyBadge}>{guide.frequency}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{guide.targetTable}</code>
                    </TableCell>
                    <TableCell>{guide.yearsApplicable}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {guide.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detailed Sections */}
        <Accordion type="multiple" defaultValue={["sales-over-time"]} className="space-y-4">
          {fileGuides.map((guide) => {
            const screenshot = getScreenshotForSection(guide.id);
            const isUploading = uploadingSection === guide.id;

            return (
              <AccordionItem 
                key={guide.id} 
                value={guide.id}
                className="border rounded-lg backdrop-blur-xl bg-card/80 border-border/50 px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{guide.title}</span>
                    <Badge variant={guide.frequencyBadge} className="ml-2">
                      {guide.frequency}
                    </Badge>
                    {screenshot && (
                      <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Screenshot
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Info */}
                    <div className="space-y-4">
                      {/* Description */}
                      <div>
                        <p className="text-muted-foreground">{guide.description}</p>
                      </div>

                      {/* Path */}
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Où trouver ce fichier
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                          {guide.path.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Parameters */}
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Paramètres à sélectionner
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {guide.parameters.map((param, idx) => (
                            <li key={idx}>{param}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Frequency */}
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Quand importer
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          <Badge variant={guide.frequencyBadge}>{guide.frequency}</Badge>
                          {guide.frequency === "Hebdomadaire" && (
                            <span className="ml-2">— Idéalement chaque lundi pour la semaine précédente</span>
                          )}
                          {guide.frequency === "Mensuel" && (
                            <span className="ml-2">— En début de mois pour le mois précédent</span>
                          )}
                        </p>
                      </div>

                      {/* Data Imported */}
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Données importées
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {guide.dataImported.map((field, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Screenshot */}
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Screenshot annoté
                      </h4>
                      
                      {/* Hidden file input */}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => (fileInputRefs.current[guide.id] = el)}
                        onChange={(e) => handleFileSelect(guide.id, e)}
                      />

                      {screenshot ? (
                        <div className="relative group">
                          <img
                            src={screenshot.screenshot_url}
                            alt={guide.screenshotPlaceholder}
                            className="w-full rounded-lg border border-border shadow-lg"
                          />
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => triggerFileInput(guide.id)}
                              disabled={isUploading}
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              Remplacer
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteMutation.mutate(guide.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px] bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => triggerFileInput(guide.id)}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                              <p className="text-sm text-muted-foreground">Upload en cours...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                              <p className="text-sm text-muted-foreground text-center">
                                {guide.screenshotPlaceholder}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-2 text-center">
                                Cliquez pour uploader une capture d'écran annotée
                              </p>
                              <Button variant="outline" size="sm" className="mt-4">
                                <Upload className="h-4 w-4 mr-2" />
                                Choisir une image
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Tips Section */}
        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Conseils pratiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Pour 2025+ :</strong> Utilisez principalement "Sales Over Time" pour les KPIs agrégés. 
              C'est la source officielle Uber et elle permet la comparaison "période glissante".
            </p>
            <p>
              <strong>Pour 2024 et avant :</strong> Les fichiers "Informations de paiement" (commandes + articles) 
              sont nécessaires car les exports "Sales Over Time" historiques ne sont pas disponibles.
            </p>
            <p>
              <strong>Récapitulatif des versements :</strong> À importer régulièrement pour valider 
              les versements bancaires et avoir une vue consolidée des frais.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ImportGuide;
