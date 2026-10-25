import { REPORT_TYPE_CONFIG } from "./reportImportConfig";

// Detect report type from filename (very reliable for Uber files)
export const detectReportTypeFromFilename = (filename: string): string | null => {
  const name = filename.toLowerCase();
  
  // Sales Over Time
  if (name.includes("sales_over_time") || name.includes("sales-over-time") || name.includes("ventes_sur")) {
    return "sales_over_time";
  }
  
  // Payout summary - CHECK BEFORE payment reports (common_template can be payout too)
  if (name.includes("payout") || name.includes("versement") || name.includes("payment_summary") || name.includes("payout_summary")) {
    return "payout_summary";
  }
  
  if (name.includes("quality-score") || name.includes("quality_score")) return "success_score";
  // Marketing campaigns
  if (name.includes("marketing") || name.includes("offers") || name.includes("ads") || 
      name.includes("offres") || name.includes("campagnes")) {
    return "marketing_campaigns";
  }
  
  // Downtime report
  if (name.includes("menu_downtime") || name.includes("downtime") || name.includes("inactivite") ||
      name.includes("inactivité")) {
    return "downtime_report";
  }
  
  // Order history
  if (name.includes("order_history") || name.includes("order-history") || 
      name.includes("historique_commandes") || name.includes("historique-commandes")) {
    return "order_history";
  }
  
  // Conversion funnel
  if (name.includes("user_conversion") || name.includes("conversion") || 
      name.includes("entonnoir") || name.includes("tunnel")) {
    return "conversion_funnel";
  }
  
  // Reviews - item level (has sku in name)
  if ((name.includes("restaurant_rating") || name.includes("rating") || name.includes("avis")) && 
      (name.includes("sku") || name.includes("item") || name.includes("article"))) {
    return "reviews_item";
  }
  
  // Reviews - order level
  if (name.includes("restaurant_rating") || name.includes("rating") || name.includes("avis")) {
    return "reviews_order";
  }
  
  if (name.includes("orders_with_errors")) return "inaccurate_orders";
  // Inaccurate orders
  if (name.includes("inaccurate_orders") || name.includes("inaccurate-orders") || 
      name.includes("commandes_incorrectes") || name.includes("erreur_commandes")) {
    return "inaccurate_orders";
  }
  
  // Item issues leaderboard
  if (name.includes("item_issues") || name.includes("item-issues") || 
      name.includes("articles_problematiques") || name.includes("problemes_articles")) {
    return "item_issues_leaderboard";
  }
  
  // Order accuracy summary
  if (name.includes("order_accuracy") || name.includes("accuracy") || 
      name.includes("precision_commandes") || name.includes("exactitude")) {
    return "order_accuracy_summary";
  }
  
  // Payment reports (common_template) - CHECK LAST as fallback
  // Only match if NOT already matched as payout_summary
  if (name.includes("common_template") || name.includes("payment")) {
    // Check if item level
    if (name.includes("item") || name.includes("article")) {
      return "payment_item_level";
    }
    return "payment_order_level";
  }
  
  return null;
};

// Auto-detect report type based on CSV headers
// CRITICAL: Order of detection matters! Item-level MUST be checked BEFORE payout_summary
// because item-level files also contain "Id. de référence du versement" column
export const detectReportTypeFromContent = (headerLine: string): string | null => {
  const lowerHeader = headerLine.toLowerCase();
  
  if (lowerHeader.includes("operational excellence") && lowerHeader.includes("store name") && lowerHeader.includes("status")) return "success_score";
  // Helper: Check if this looks like item-level data (article/item columns present)
  const hasItemColumns = 
    lowerHeader.includes("nom du plat") || 
    lowerHeader.includes("titre de l'article") || 
    lowerHeader.includes("item title") ||
    lowerHeader.includes("nom du plat/de l'article") ||
    lowerHeader.includes("nom de l'article");
  
  // Helper: Check if this has order-level identifiers
  const hasOrderId = 
    lowerHeader.includes("id. de la commande") || 
    lowerHeader.includes("id de la commande") ||
    lowerHeader.includes("order id");
  
  const hasFlowId = 
    lowerHeader.includes("id. du flux") || 
    lowerHeader.includes("flow id");
  
  // =========================================================
  // PRIORITY 1: ITEM-LEVEL PAYMENT REPORTS (most specific)
  // These have order/flow IDs AND item columns
  // =========================================================
  if ((hasOrderId || hasFlowId) && hasItemColumns && !lowerHeader.includes("valeur de la note") && !lowerHeader.includes("problème avec la commande")) {
    return "payment_item_level";
  }
  
  // =========================================================
  // PRIORITY 2: OTHER SPECIFIC REPORT TYPES
  // =========================================================
  
  // Marketing campaigns - Offers
  if ((lowerHeader.includes("type d'offre") || lowerHeader.includes("offer type")) && 
      (lowerHeader.includes("audience") || lowerHeader.includes("budget"))) {
    return "marketing_campaigns";
  }
  // Marketing campaigns - Ads
  if ((lowerHeader.includes("nom de la campagne") || lowerHeader.includes("campaign name")) && 
      (lowerHeader.includes("impressions") || lowerHeader.includes("clics") || lowerHeader.includes("clicks"))) {
    return "marketing_campaigns";
  }
  // Sales Over Time
  if ((lowerHeader.includes("période") || lowerHeader.includes("period")) && 
      (lowerHeader.includes("ventes") || lowerHeader.includes("sales"))) {
    return "sales_over_time";
  }
  // Reviews Item Level - MUST be checked BEFORE reviews_order because SKU files contain BOTH sets of headers
  // SKU files have: "nom du plat", "prix du plat", "catégorie du menu" + "uuid de la commande" + "valeur de la note"
  const hasSkuItemColumns = lowerHeader.includes("nom du plat") || lowerHeader.includes("prix du plat") || 
                            lowerHeader.includes("catégorie du menu") || lowerHeader.includes("id. externe de l'article");
  if ((lowerHeader.includes("note de l'article") || lowerHeader.includes("item rating") || lowerHeader.includes("note article") ||
       lowerHeader.includes("titre de l'article") || lowerHeader.includes("item title") || lowerHeader.includes("titre article") ||
       hasSkuItemColumns) && 
      (lowerHeader.includes("uuid de la commande") || lowerHeader.includes("order uuid") ||
       lowerHeader.includes("note de l'article") || lowerHeader.includes("titre de l'article"))) {
    return "reviews_item";
  }
  // Reviews Order Level - MUST be checked AFTER reviews_item
  if ((lowerHeader.includes("note du restaurant") || lowerHeader.includes("restaurant rating") || 
       lowerHeader.includes("valeur de la note")) && 
      (lowerHeader.includes("uuid de la commande") || lowerHeader.includes("order uuid")) &&
      !hasSkuItemColumns) {
    return "reviews_order";
  }
  // Downtime Report
  if ((lowerHeader.includes("ouverture du restaurant") || lowerHeader.includes("restaurant open")) && 
      (lowerHeader.includes("disponibilité du menu") || lowerHeader.includes("menu availability"))) {
    return "downtime_report";
  }
  // Order History - has order ID + specific time columns (NOT item columns)
  if (hasOrderId && !hasItemColumns &&
      (lowerHeader.includes("temps d'attente du coursier") || lowerHeader.includes("heure de la commande") || lowerHeader.includes("courier wait time"))) {
    return "order_history";
  }
  // Inaccurate Orders (detail)
  if ((lowerHeader.includes("problème avec la commande") || lowerHeader.includes("articles incorrects") || lowerHeader.includes("order issue")) &&
      (lowerHeader.includes("client remboursé") || lowerHeader.includes("customer refund"))) {
    return "inaccurate_orders";
  }
  // Item Issues Leaderboard
  if ((lowerHeader.includes("articles incorrects") || lowerHeader.includes("incorrect items")) && 
      lowerHeader.includes("nombre") &&
      (lowerHeader.includes("problème avec le plat") || lowerHeader.includes("dish issue"))) {
    return "item_issues_leaderboard";
  }
  // Order Accuracy Summary
  if ((lowerHeader.includes("jour") || lowerHeader.includes("mois") || lowerHeader.includes("day") || lowerHeader.includes("month")) && 
      (lowerHeader.includes("commandes incorrectes") || lowerHeader.includes("articles manquants") || lowerHeader.includes("inaccurate orders"))) {
    return "order_accuracy_summary";
  }
  // Conversion Funnel
  if ((lowerHeader.includes("utilisateurs ayant visité") || lowerHeader.includes("utilisateurs ayant visite") || lowerHeader.includes("users who visited")) &&
      (lowerHeader.includes("menu a été consulté") || lowerHeader.includes("menu consulté") || lowerHeader.includes("plat ajouté") || lowerHeader.includes("item added"))) {
    return "conversion_funnel";
  }
  
  // =========================================================
  // PRIORITY 3: PAYOUT SUMMARY (aggregated data, NO order IDs)
  // CRITICAL: Only detect as payout_summary if NO order ID present!
  // =========================================================
  if (!hasOrderId && !hasFlowId) {
    // Has order count + total amount = aggregated payout summary
    if ((lowerHeader.includes("nombre de commandes") || lowerHeader.includes("order count")) &&
        (lowerHeader.includes("montant total") || lowerHeader.includes("total amount") || lowerHeader.includes("order total"))) {
      return "payout_summary";
    }
    // Has payout-specific identifiers
    if ((lowerHeader.includes("identifiant de versement") || lowerHeader.includes("payout id") ||
         lowerHeader.includes("id. de référence du versement") || lowerHeader.includes("payout reference"))) {
      return "payout_summary";
    }
    if ((lowerHeader.includes("date du versement") || lowerHeader.includes("date de versement") || lowerHeader.includes("payout date"))) {
      return "payout_summary";
    }
  }
  
  // =========================================================
  // PRIORITY 4: ORDER-LEVEL PAYMENT REPORTS (fallback)
  // Has order/flow IDs but no item columns
  // =========================================================
  if (hasOrderId || hasFlowId) {
    return "payment_order_level";
  }
  
  return null;
};

