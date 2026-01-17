/**
 * Centralized configuration for report imports
 * This is the SINGLE SOURCE OF TRUTH for report type -> edge function mapping
 * Used by both ReportImport.tsx and BulkImportTab.tsx to ensure consistency
 */

export interface ReportTypeConfig {
  label: string;
  description?: string;
  requiresRestaurant: boolean;
  edgeFunctionName: string;
  targetTables: string[];
  /** Columns that MUST be present to identify this report type */
  requiredColumns?: string[];
  /** Columns that should NOT be present (helps distinguish similar reports) */
  excludedColumns?: string[];
}

/**
 * Master configuration for all report types
 * IMPORTANT: When adding/modifying, ensure edgeFunctionName matches the actual edge function
 */
export const REPORT_TYPE_CONFIG: Record<string, ReportTypeConfig> = {
  sales_over_time: {
    label: "Sales Over Time",
    description: "CA, Commandes, Panier moyen - Source de vérité",
    requiresRestaurant: true,
    edgeFunctionName: "parse-sales-over-time",
    targetTables: ["daily_sales_uber"],
    requiredColumns: ["Période", "Ventes"],
  },
  
  payment_order_level: {
    label: "Paiements (commandes)",
    description: "Détail financier par commande",
    requiresRestaurant: false,
    edgeFunctionName: "parse-payment-report",
    targetTables: ["orders"],
    requiredColumns: ["Id. de la commande", "Id. du flux"],
    excludedColumns: ["Nom du plat/de l'article", "Titre de l'article"],
  },
  
  payment_item_level: {
    label: "Paiements (articles)",
    description: "Détail par article commandé",
    requiresRestaurant: false,
    // CRITICAL: This MUST call parse-item-report, NOT parse-payment-report
    edgeFunctionName: "parse-item-report",
    targetTables: ["order_items"],
    requiredColumns: ["Id. de la commande", "Nom du plat/de l'article"],
  },
  
  payout_summary: {
    label: "Récapitulatif versements",
    description: "Résumé agrégé par versement",
    requiresRestaurant: false,
    edgeFunctionName: "parse-payout-summary",
    targetTables: ["payouts"],
    requiredColumns: ["Identifiant de versement", "Date du versement"],
  },
  
  marketing_campaigns: {
    label: "Campagnes Marketing",
    description: "Offres promotionnelles et annonces publicitaires",
    requiresRestaurant: true,
    edgeFunctionName: "parse-marketing-campaigns",
    targetTables: ["promotions"],
    requiredColumns: ["Type d'offre", "Audience"],
  },
  
  conversion_funnel: {
    label: "Tunnel de conversion",
    description: "Visites, vues menu, ajouts panier, commandes",
    requiresRestaurant: true,
    edgeFunctionName: "parse-conversion-report",
    targetTables: ["daily_conversion"],
    requiredColumns: ["Utilisateurs ayant visité", "menu a été consulté"],
  },
  
  reviews_order: {
    label: "Avis (commandes)",
    description: "Notes globales et tags par commande",
    requiresRestaurant: false,
    edgeFunctionName: "parse-reviews-order",
    targetTables: ["customer_reviews"],
    requiredColumns: ["Note du restaurant", "UUID de la commande"],
  },
  
  reviews_item: {
    label: "Avis (articles)",
    description: "Notes et tags par article",
    requiresRestaurant: false,
    edgeFunctionName: "parse-reviews-item",
    targetTables: ["menu_item_reviews"],
    requiredColumns: ["Note de l'article", "Titre de l'article"],
  },
  
  downtime_report: {
    label: "Temps d'inactivité",
    description: "Disponibilité horaire des restaurants",
    requiresRestaurant: false,
    edgeFunctionName: "parse-downtime-report",
    targetTables: ["hourly_availability"],
    requiredColumns: ["Ouverture du restaurant", "Disponibilité du menu"],
  },
  
  order_history: {
    label: "Historique commandes",
    description: "Temps d'attente coursier, préparation, livraison",
    requiresRestaurant: false,
    edgeFunctionName: "parse-order-history",
    targetTables: ["order_history"],
    requiredColumns: ["Id. de la commande", "Temps d'attente du coursier"],
  },
  
  inaccurate_orders: {
    label: "Commandes incorrectes",
    description: "Détail des erreurs par commande",
    requiresRestaurant: false,
    edgeFunctionName: "parse-inaccurate-orders",
    targetTables: ["inaccurate_order_issues"],
    requiredColumns: ["Problème avec la commande", "Client remboursé"],
  },
  
  order_accuracy_summary: {
    label: "Résumé erreurs",
    description: "Données agrégées jour/mois",
    requiresRestaurant: true,
    edgeFunctionName: "parse-order-accuracy-summary",
    targetTables: ["daily_order_accuracy"],
    requiredColumns: ["Commandes incorrectes", "Articles manquants"],
  },
  
  item_issues_leaderboard: {
    label: "Top articles problématiques",
    description: "Classement des produits avec erreurs",
    requiresRestaurant: true,
    edgeFunctionName: "parse-item-issues-leaderboard",
    targetTables: ["product_issues_ranking"],
    requiredColumns: ["Articles incorrects", "Problème avec le plat"],
  },
};

/**
 * Get the correct edge function name for a report type
 * Includes guardrails to prevent misconfigurations
 */
export function getEdgeFunctionName(reportType: string): string {
  const config = REPORT_TYPE_CONFIG[reportType];
  
  if (!config) {
    console.warn(`Unknown report type: ${reportType}`);
    return "parse-report-csv"; // fallback
  }
  
  // GUARDRAIL: Ensure item-level reports always go to parse-item-report
  if (reportType === "payment_item_level") {
    return "parse-item-report";
  }
  
  return config.edgeFunctionName;
}

/**
 * Get target database tables for a report type (used for rollback/deletion)
 */
export function getTargetTables(reportType: string): string[] {
  return REPORT_TYPE_CONFIG[reportType]?.targetTables || [];
}

/**
 * Check if a report type requires a restaurant selection
 */
export function requiresRestaurant(reportType: string): boolean {
  return REPORT_TYPE_CONFIG[reportType]?.requiresRestaurant ?? false;
}

/**
 * Detect if CSV content looks like an item-level file
 * Used to warn users if they selected the wrong report type
 */
export function detectsAsItemLevel(headerLine: string): boolean {
  const lower = headerLine.toLowerCase();
  return (
    lower.includes("nom du plat") ||
    lower.includes("titre de l'article") ||
    lower.includes("item title") ||
    lower.includes("nom de l'article")
  );
}

/**
 * Detect if CSV content looks like an order-level file
 */
export function detectsAsOrderLevel(headerLine: string): boolean {
  const lower = headerLine.toLowerCase();
  const hasOrderId = lower.includes("id. de la commande") || lower.includes("id. du flux");
  const hasNoItemTitle = !detectsAsItemLevel(headerLine);
  return hasOrderId && hasNoItemTitle;
}

/**
 * Validate that the selected report type matches the CSV content
 * Returns null if valid, or an error message if mismatched
 */
export function validateReportTypeForContent(
  selectedType: string,
  headerLine: string
): string | null {
  const isItemLevel = detectsAsItemLevel(headerLine);
  const isOrderLevel = detectsAsOrderLevel(headerLine);
  
  // Check for mismatches
  if (selectedType === "payment_order_level" && isItemLevel) {
    return "Ce fichier contient des données par article. Utilisez 'Paiements (articles)' à la place.";
  }
  
  if (selectedType === "payment_item_level" && isOrderLevel && !isItemLevel) {
    return "Ce fichier contient des données par commande. Utilisez 'Paiements (commandes)' à la place.";
  }
  
  return null;
}
