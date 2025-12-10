import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileSpreadsheet, Calendar, Clock, Database, ImageIcon, ExternalLink, Upload, Trash2, Loader2, Video, TrendingUp, Megaphone, Star, MessageSquare, AlertTriangle, Play } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
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
  theme: "sales" | "marketing" | "reviews" | "operations";
}

const THEME_CONFIG = {
  sales: { 
    label: "Ventes & Finances", 
    icon: TrendingUp, 
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30"
  },
  marketing: { 
    label: "Marketing", 
    icon: Megaphone, 
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30"
  },
  reviews: { 
    label: "Avis Clients", 
    icon: Star, 
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30"
  },
  operations: { 
    label: "Opérations", 
    icon: Clock, 
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30"
  },
};

const fileGuides: FileGuide[] = [
  // === VENTES & FINANCES ===
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
    theme: "sales"
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
    theme: "sales"
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
    theme: "sales"
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
    theme: "sales"
  },

  // === MARKETING ===
  {
    id: "marketing-campaigns",
    title: "Campagnes Marketing",
    description: "Offres promotionnelles et annonces publicitaires. Importe les détails des campagnes marketing dans les actions restaurant.",
    frequency: "Mensuel",
    frequencyBadge: "secondary",
    path: [
      "Uber Eats Manager → Marketing",
      "Onglet 'Performances' ou 'Annonces'",
      "Bouton 'Télécharger' ou 'Exporter'"
    ],
    parameters: [
      "Type : Offres promotionnelles OU Annonces publicitaires",
      "Période : Mois complet ou période de campagne",
      "Format : CSV"
    ],
    dataImported: [
      "Type d'offre / Nom campagne",
      "Audience ciblée",
      "Produits concernés",
      "Dates de validité",
      "Impressions / Clics",
      "Budget dépensé",
      "Ventes générées"
    ],
    targetTable: "restaurant_actions",
    yearsApplicable: "Tous",
    theme: "marketing"
  },

  // === AVIS CLIENTS ===
  {
    id: "reviews-order",
    title: "Avis par commande (restaurant_rating_local)",
    description: "Notes globales et tags de satisfaction par commande. Permet d'analyser la satisfaction client globale.",
    frequency: "Hebdomadaire",
    frequencyBadge: "default",
    path: [
      "Uber Eats Manager → Avis",
      "Onglet 'Avis clients'",
      "Bouton 'Télécharger' ou Export CSV"
    ],
    parameters: [
      "Période : Semaine ou mois",
      "Type : Avis par commande (restaurant_rating_local)",
      "Format : CSV"
    ],
    dataImported: [
      "UUID commande",
      "Date de l'avis",
      "Note restaurant (1-5)",
      "Note livraison",
      "Note nourriture",
      "Commentaire client",
      "Tags (food quality, delivery, etc.)"
    ],
    targetTable: "customer_reviews",
    yearsApplicable: "Tous",
    theme: "reviews"
  },
  {
    id: "reviews-item",
    title: "Avis par produit (restaurant_rating_sku_local)",
    description: "Notes et tags spécifiques par article commandé. Identifie les produits les mieux/moins bien notés.",
    frequency: "Hebdomadaire",
    frequencyBadge: "default",
    path: [
      "Uber Eats Manager → Avis",
      "Onglet 'Avis articles' ou export produits",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Semaine ou mois",
      "Type : Avis par article (restaurant_rating_sku_local)",
      "Format : CSV"
    ],
    dataImported: [
      "ID article",
      "Nom article",
      "Note (thumbs up/down)",
      "Tags produit (item_fresh, item_cold_melted, etc.)",
      "Commentaires spécifiques",
      "Date de l'avis"
    ],
    targetTable: "menu_item_reviews",
    yearsApplicable: "Tous",
    theme: "reviews"
  },

  // === OPÉRATIONS ===
  {
    id: "downtime-report",
    title: "Temps d'inactivité (menu_downtime_local)",
    description: "Disponibilité horaire des restaurants : temps en ligne, hors ligne, et disponibilité menu.",
    frequency: "Hebdomadaire",
    frequencyBadge: "default",
    path: [
      "Uber Eats Manager → Rapports",
      "Section 'Temps d'inactivité'",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Semaine ou mois",
      "Granularité : Par heure",
      "Format : CSV"
    ],
    dataImported: [
      "Heure de début",
      "Minutes en ligne",
      "Minutes hors ligne",
      "Minutes disponibilité menu",
      "Raison d'inactivité"
    ],
    targetTable: "hourly_availability",
    yearsApplicable: "Tous",
    theme: "operations"
  },
  {
    id: "order-history",
    title: "Historique des commandes (order_history_local)",
    description: "Temps d'attente coursier, préparation et livraison pour chaque commande. Essentiel pour l'analyse opérationnelle.",
    frequency: "Hebdomadaire",
    frequencyBadge: "default",
    path: [
      "Uber Eats Manager → Commandes",
      "Section 'Historique des commandes'",
      "Bouton 'Télécharger'"
    ],
    parameters: [
      "Période : Semaine ou mois",
      "Statut : Toutes les commandes",
      "Format : CSV"
    ],
    dataImported: [
      "ID commande",
      "Date/heure commande",
      "Temps d'attente coursier",
      "Temps d'attente évitable",
      "Temps de préparation initial",
      "Statut livraison",
      "Montant commande"
    ],
    targetTable: "order_history",
    yearsApplicable: "Tous",
    theme: "operations"
  },
  {
    id: "order-accuracy-summary",
    title: "Résumé commandes incorrectes",
    description: "Données officielles Uber agrégées par jour/mois : nombre d'erreurs par type et remboursements associés.",
    frequency: "Mensuel",
    frequencyBadge: "secondary",
    path: [
      "Uber Eats Manager → Qualité",
      "Section 'Exactitude des commandes'",
      "Bouton 'Télécharger le rapport'"
    ],
    parameters: [
      "Période : Mois complet",
      "Type : Résumé par période (daily ou monthly)",
      "Format : CSV (order-accuracy-inaccurate-issues-summary)"
    ],
    dataImported: [
      "Jour ou Mois",
      "Nombre commandes incorrectes",
      "Articles manquants (count + refund)",
      "Personnalisations manquantes (count + refund)",
      "Mauvaise commande (count + refund)",
      "Article incorrect (count + refund)",
      "Variation N-1"
    ],
    targetTable: "daily_order_accuracy / monthly_order_accuracy",
    yearsApplicable: "Tous",
    theme: "operations"
  },
  {
    id: "item-issues-leaderboard",
    title: "Top articles problématiques",
    description: "Classement des produits avec le plus d'erreurs. Identifie les articles nécessitant une attention particulière.",
    frequency: "Mensuel",
    frequencyBadge: "secondary",
    path: [
      "Uber Eats Manager → Qualité",
      "Section 'Exactitude des commandes'",
      "Tableau des articles problématiques → Exporter"
    ],
    parameters: [
      "Période : Mois ou trimestre",
      "Tri : Par volume d'erreurs",
      "Format : CSV (item-issues-leaderboard)"
    ],
    dataImported: [
      "Nom article",
      "Volume d'erreurs",
      "Score de problème",
      "Type d'erreur principal",
      "Personnalisation manquante (oui/non)",
      "Variation % vs période précédente"
    ],
    targetTable: "product_issues_ranking",
    yearsApplicable: "Tous",
    theme: "operations"
  }
];

interface MediaData {
  id: string;
  guide_section_id: string;
  screenshot_url: string;
  uploaded_at: string;
  notes: string | null;
  media_type?: "image" | "video";
}

const ImportGuide = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Get section from URL hash
  const targetSection = location.hash.replace("#", "");

  // Fetch existing screenshots/videos
  const { data: screenshots = [] } = useQuery({
    queryKey: ["import-guide-screenshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_guide_screenshots")
        .select("*");
      if (error) throw error;
      return data as MediaData[];
    },
  });

  // Get media for a section
  const getMediaForSection = (sectionId: string) => {
    return screenshots.find(s => s.guide_section_id === sectionId);
  };

  // Detect media type from file
  const getMediaType = (file: File): "image" | "video" => {
    if (file.type.startsWith("video/")) return "video";
    return "image";
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ sectionId, file }: { sectionId: string; file: File }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${sectionId}_${Date.now()}.${fileExt}`;
      const mediaType = getMediaType(file);
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("import-guide-screenshots")
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("import-guide-screenshots")
        .getPublicUrl(fileName);

      // Upsert to database with media type
      const { error: dbError } = await supabase
        .from("import_guide_screenshots")
        .upsert({
          guide_section_id: sectionId,
          screenshot_url: publicUrl,
          uploaded_at: new Date().toISOString(),
          notes: mediaType, // Store media type in notes field
        }, { onConflict: "guide_section_id" });

      if (dbError) throw dbError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-guide-screenshots"] });
      toast({ title: "Média uploadé avec succès" });
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
      const media = getMediaForSection(sectionId);
      if (!media) return;

      const urlParts = media.screenshot_url.split("/");
      const fileName = urlParts[urlParts.length - 1];

      await supabase.storage
        .from("import-guide-screenshots")
        .remove([fileName]);

      const { error } = await supabase
        .from("import_guide_screenshots")
        .delete()
        .eq("guide_section_id", sectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-guide-screenshots"] });
      toast({ title: "Média supprimé" });
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

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    
    if (!isImage && !isVideo) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner une image (PNG, JPG) ou une vidéo (MP4, MOV, WebM)",
        variant: "destructive",
      });
      return;
    }

    // Limit video size to 50MB
    if (isVideo && file.size > 50 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La vidéo ne doit pas dépasser 50 Mo",
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

  // Group guides by theme
  const guidesByTheme = fileGuides.reduce((acc, guide) => {
    if (!acc[guide.theme]) acc[guide.theme] = [];
    acc[guide.theme].push(guide);
    return acc;
  }, {} as Record<string, FileGuide[]>);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
              Référence complète des {fileGuides.length} types de fichiers à importer
            </p>
          </div>
        </div>

        {/* Table of Contents */}
        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Sommaire
            </CardTitle>
            <CardDescription>
              Cliquez sur une catégorie pour accéder directement aux guides
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(THEME_CONFIG) as Array<keyof typeof THEME_CONFIG>).map((themeKey) => {
                const theme = THEME_CONFIG[themeKey];
                const ThemeIcon = theme.icon;
                const count = guidesByTheme[themeKey]?.length || 0;
                
                return (
                  <button
                    key={themeKey}
                    onClick={() => scrollToSection(`theme-${themeKey}`)}
                    className={`p-4 rounded-lg border ${theme.borderColor} ${theme.bgColor} hover:scale-105 transition-transform text-left`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ThemeIcon className={`h-5 w-5 ${theme.color}`} />
                      <span className="font-medium">{theme.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{count} fichier{count > 1 ? "s" : ""}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Summary Table */}
        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Tableau récapitulatif
            </CardTitle>
            <CardDescription>
              Vue d'ensemble des {fileGuides.length} types de fichiers à importer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Table cible</TableHead>
                  <TableHead>Tuto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fileGuides.map((guide) => {
                  const theme = THEME_CONFIG[guide.theme];
                  const ThemeIcon = theme.icon;
                  const media = getMediaForSection(guide.id);
                  const isVideo = media?.notes === "video";
                  
                  return (
                    <TableRow 
                      key={guide.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => scrollToSection(guide.id)}
                    >
                      <TableCell>
                        <div className={`flex items-center gap-2 px-2 py-1 rounded ${theme.bgColor}`}>
                          <ThemeIcon className={`h-4 w-4 ${theme.color}`} />
                          <span className={`text-xs ${theme.color}`}>{theme.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[250px] truncate">{guide.title}</TableCell>
                      <TableCell>
                        <Badge variant={guide.frequencyBadge}>{guide.frequency}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{guide.targetTable}</code>
                      </TableCell>
                      <TableCell>
                        {media ? (
                          <Badge variant="outline" className={isVideo ? "text-violet-600 border-violet-600" : "text-green-600 border-green-600"}>
                            {isVideo ? <Video className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                            {isVideo ? "Vidéo" : "Photo"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Non ajouté
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detailed Sections by Theme */}
        {(Object.keys(THEME_CONFIG) as Array<keyof typeof THEME_CONFIG>).map((themeKey) => {
          const theme = THEME_CONFIG[themeKey];
          const ThemeIcon = theme.icon;
          const guides = guidesByTheme[themeKey] || [];

          return (
            <div key={themeKey} id={`theme-${themeKey}`} className="space-y-4">
              {/* Theme Header */}
              <div className={`flex items-center gap-3 p-4 rounded-lg ${theme.bgColor} ${theme.borderColor} border`}>
                <ThemeIcon className={`h-6 w-6 ${theme.color}`} />
                <h2 className="text-xl font-bold">{theme.label}</h2>
                <Badge variant="secondary">{guides.length} fichier{guides.length > 1 ? "s" : ""}</Badge>
              </div>

              <Accordion 
                type="multiple" 
                defaultValue={targetSection ? [targetSection] : []}
                className="space-y-4"
              >
                {guides.map((guide) => {
                  const media = getMediaForSection(guide.id);
                  const isUploading = uploadingSection === guide.id;
                  const isVideo = media?.notes === "video";

                  return (
                    <AccordionItem 
                      key={guide.id}
                      id={guide.id}
                      value={guide.id}
                      className={`border rounded-lg backdrop-blur-xl bg-card/80 ${theme.borderColor} px-4`}
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className={`h-5 w-5 ${theme.color}`} />
                          <span className="font-semibold text-left">{guide.title}</span>
                          <Badge variant={guide.frequencyBadge} className="ml-2">
                            {guide.frequency}
                          </Badge>
                          {media && (
                            <Badge variant="outline" className={isVideo ? "ml-2 text-violet-600 border-violet-600" : "ml-2 text-green-600 border-green-600"}>
                              {isVideo ? <Video className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                              {isVideo ? "Vidéo" : "Screenshot"}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Column - Info */}
                          <div className="space-y-4">
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
                                Données importées → <code className="text-xs bg-muted px-2 py-1 rounded">{guide.targetTable}</code>
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

                          {/* Right Column - Media */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              {isVideo ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                              Tutoriel (screenshot ou vidéo)
                            </h4>
                            
                            {/* Hidden file input - accepts images and videos */}
                            <input
                              type="file"
                              accept="image/*,video/mp4,video/quicktime,video/webm"
                              className="hidden"
                              ref={(el) => (fileInputRefs.current[guide.id] = el)}
                              onChange={(e) => handleFileSelect(guide.id, e)}
                            />

                            {media ? (
                              <div className="relative group">
                                {isVideo ? (
                                  <video
                                    src={media.screenshot_url}
                                    controls
                                    className="w-full rounded-lg border border-border shadow-lg"
                                    style={{ maxHeight: "400px" }}
                                  >
                                    Votre navigateur ne supporte pas la lecture vidéo.
                                  </video>
                                ) : (
                                  <img
                                    src={media.screenshot_url}
                                    alt={`Guide pour ${guide.title}`}
                                    className="w-full rounded-lg border border-border shadow-lg"
                                  />
                                )}
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
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className={`border-2 border-dashed rounded-lg p-8 text-center ${theme.borderColor} hover:bg-muted/50 transition-colors cursor-pointer`}
                                onClick={() => triggerFileInput(guide.id)}
                              >
                                {isUploading ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Upload en cours...</p>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="flex gap-2">
                                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                      <Video className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      Cliquez pour ajouter une image ou une vidéo
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      PNG, JPG, MP4, MOV, WebM (max 50 Mo pour les vidéos)
                                    </p>
                                  </div>
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
            </div>
          );
        })}

        {/* Tips Section */}
        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>💡 Conseils pratiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <h4 className="font-medium mb-2">📅 Routine hebdomadaire</h4>
                <p className="text-sm text-muted-foreground">
                  Chaque lundi, importez : Sales Over Time, Avis clients, Temps d'inactivité et Historique des commandes pour la semaine passée.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30">
                <h4 className="font-medium mb-2">📊 Routine mensuelle</h4>
                <p className="text-sm text-muted-foreground">
                  En début de mois, importez : Informations de paiement (commande + articles), Campagnes marketing, et Résumé des erreurs.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <h4 className="font-medium mb-2">🎬 Vidéos tutoriels</h4>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez enregistrer votre écran et uploader des vidéos pour vous souvenir exactement comment naviguer dans Uber Manager.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <h4 className="font-medium mb-2">⚠️ Attention aux dates</h4>
                <p className="text-sm text-muted-foreground">
                  Assurez-vous de sélectionner la bonne période dans Uber Manager. Les dates doivent correspondre à ce que vous souhaitez analyser.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ImportGuide;
