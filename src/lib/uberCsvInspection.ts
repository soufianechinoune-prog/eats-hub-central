import { REPORT_TYPE_CONFIG } from "./reportImportConfig";

const normalizeHeader = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/\u00a0/g, ' ').toLowerCase().trim();

// Detect report type from filename (very reliable for Uber files)
export const detectReportTypeFromFilename = (filename: string): string | null => {
  const name = filename.toLowerCase().replace(/-/g, '_');
  
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
  // Normalize accents, smart apostrophes and spaces before matching FR/EN exports.
  const lowerHeader = normalizeHeader(headerLine);
  const matches = (value: string) => lowerHeader.includes(normalizeHeader(value));
  
  if (lowerHeader.includes("operational excellence") && lowerHeader.includes("store name") && lowerHeader.includes("status")) return "success_score";
  if (lowerHeader.includes("problème avec la commande") && lowerHeader.includes("client remboursé")) return "inaccurate_orders";
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
       hasSkuItemColumns) && !lowerHeader.includes("problème avec la commande") &&
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


export interface UberCsvInspection {
  type: string | null;
  formatLabel: string | null;
  headers: string[];
  records: string[];
  headerIndex: number;
  rowCount: number;
  stores: { id: string; name: string }[];
  dateRange: { start: string | null; end: string | null };
  unsupported: string | null;
}

export function csvRecords(content: string): string[] {
  const records: string[] = [];
  let quoted = false, start = 0;
  const clean = content.replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '"') {
      if (quoted && clean[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    }
    if (!quoted && clean[i] === '\n') {
      const row = clean.slice(start, i).replace(/\r$/, '');
      if (row.trim()) records.push(row);
      start = i + 1;
    }
  }
  const last = clean.slice(start).trim();
  if (last) records.push(last);
  return records;
}

export function csvFields(record: string): string[] {
  const values: string[] = [];
  let value = '', quoted = false;
  for (let i = 0; i < record.length; i++) {
    const c = record[i];
    if (c === '"') {
      if (quoted && record[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += c;
  }
  values.push(value.trim());
  return values;
}

export function inspectUberCsv(content: string, filename: string): UberCsvInspection {
  const records = csvRecords(content);
  const headerNames = ['id. de la commande', 'id. du flux', 'uuid de la commande', 'nom du restaurant', 'restaurant', 'restaurant name', 'store name', 'store id', 'store_id', 'id. externe du restaurant', 'période', 'period', 'jour', 'mois', 'date du versement', "type d'offre", 'ouverture du restaurant à', 'restaurant open at'].map(normalizeHeader);
  // Score candidates so a metadata line mentioning a restaurant cannot hide the real header.
  let headerIndex = -1, bestScore = 0;
  records.slice(0, 20).forEach((record, index) => {
    const fields = csvFields(record).map(normalizeHeader);
    const score = fields.filter(field => headerNames.includes(field)).length;
    if (fields.length > 1 && score > bestScore) { bestScore = score; headerIndex = index; }
  });
  if (headerIndex < 0) headerIndex = 0;
  const headers = csvFields(records[headerIndex] || '');
  const header = headers.join(',');
  const lower = headers.map(normalizeHeader);
  const has = (names: string[]) => names.some(name => lower.includes(normalizeHeader(name)));
  const hourlyAvailability = has(['Ouverture du restaurant à', 'Restaurant Open At']) && has(['Disponibilité du menu', 'Menu Availability']);
  const pause = /store[_-]pause|pause[_-]history/i.test(filename) || has(['Pause start', 'Début de la pause', 'Pause reason', 'Motif de la pause']);
  const availability = /store[_-]availability/i.test(filename) || has(["Récapitulatif de l'événement", 'Event summary']);
  const itemErrors = /items[_-]with[_-]errors/i.test(filename) || (has(['Nom du plat', "Nom de l'article", 'Item title']) && has(['Problème avec la commande', 'Order issue']) && !has(['Client remboursé', 'Customer refund']));
  const formatLabel = hourlyAvailability ? REPORT_TYPE_CONFIG.downtime_report.label : pause ? 'Pauses des restaurants' : availability ? 'Disponibilité des restaurants' : itemErrors ? 'Erreurs par article' : null;
  // Event logs are not hourly totals: never route them to hourly_availability by filename alone.
  const unsupported = !hourlyAvailability && (pause || availability || itemErrors)
    ? 'Format reconnu ; import de ce rapport pas encore disponible' : null;
  const type = unsupported ? null : hourlyAvailability ? 'downtime_report' : detectReportTypeFromContent(header) || detectReportTypeFromFilename(filename);
  const findColumn = (names: string[]) => lower.findIndex(h => names.map(normalizeHeader).includes(h));
  const idIndex = findColumn(['id. du restaurant', 'id. externe du restaurant', "uuid de l'établissement", 'restaurant id', 'store id', 'store_id', 'external store id']);
  const nameIndex = findColumn(['nom du restaurant', 'restaurant', 'store name', 'restaurant name']);
  const dateIndices = lower.flatMap((h, index) => /date|heure de la commande|ouverture du restaurant|restaurant open|pause start|pause end|debut de la pause|fin de la pause|^jour$|^periode$|^period$/.test(h) ? [index] : []);
  const stores = new Map<string, { id: string; name: string }>();
  let start: string | null = null, end: string | null = null;
  for (const record of records.slice(headerIndex + 1)) {
    const values = csvFields(record);
    const id = values[idIndex] || '', name = values[nameIndex] || '';
    if (id || name) stores.set(id || name, { id, name });
    for (const dateIndex of dateIndices) {
    const raw = values[dateIndex] || '';
    const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const fr = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const date = iso || (fr ? `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}` : null);
    if (date && (!start || date < start)) start = date;
    if (date && (!end || date > end)) end = date;
    }
  }
  if (!start && !end) {
    const filenameDates = filename.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (filenameDates.length >= 2) {
      const sorted = filenameDates.sort();
      start = sorted[0]; end = sorted[sorted.length - 1];
    }
  }
  return { type: type && REPORT_TYPE_CONFIG[type] ? type : null, formatLabel, headers, records, headerIndex,
    rowCount: Math.max(0, records.length - headerIndex - 1), stores: [...stores.values()], dateRange: { start, end }, unsupported };
}
