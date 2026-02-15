import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Column mapping from French CSV headers to database fields
const COLUMN_MAPPING: Record<string, string> = {
  'Id. de la commande': 'uber_order_id',
  'Id. du flux': 'uber_flow_id',
  'Nom du restaurant': 'restaurant_name',
  'Id. du restaurant': 'uber_store_id',
  'Date de la commande': 'order_date',
  'Heure d\'acceptation de la commande': 'order_datetime',
  'Type de restauration': 'fulfillment_type',
  'Mode de paiement': 'payment_method',
  'Canal de commande': 'order_channel',
  'Statut de l\'abonnement Uber du client': 'uber_one_status',
  
  // Ventes - ancien et nouveau format
  'Ventes (hors TVA)': 'sales_excl_vat',
  'TVA 1 sur les ventes': 'vat_1_sales',
  'TVA 2 sur les ventes': 'vat_2_sales',
  'TVA 3 sur les ventes': 'vat_3_sales',
  'Ventes (TVA incluses)': 'sales_incl_vat', // Ancien format
  'Ventes (TVA incluse)': 'sales_incl_vat', // Nouveau format 2025+
  
  // Remboursements - ancien et nouveau format
  'Remboursements (hors TVA)': 'refund_excl_vat',
  'Ajustements liés à des erreurs de commande (hors TVA)': 'refund_excl_vat', // Nouveau format
  'TVA 1 sur les ajustements liés à des erreurs de commande': 'vat_1_refund',
  'TVA 2 sur les ajustements liés à des erreurs de commande': 'vat_2_refund',
  'TVA 3 sur les ajustements liés à des erreurs de commande': 'vat_3_refund',
  'Remboursements (TVA incluse)': 'refund_incl_vat', // Ancien format
  'Ajustements liés à des erreurs de commande (TVA incluse)': 'refund_incl_vat', // Nouveau format
  'Order Error Adjustments (incl. VAT)': 'refund_incl_vat', // Format anglais
  
  // Promotions articles - ancien et nouveau format
  'Promotion sur les plats/articles (hors TVA)': 'item_promo_excl_vat', // Ancien format
  'Offres sur les articles (hors TVA)': 'item_promo_excl_vat', // Nouveau format
  'TVA 1 sur les offres sur les articles': 'vat_1_item_promo',
  'TVA 2 sur les offres sur les articles': 'vat_2_item_promo',
  'TVA 3 sur les offres sur les articles': 'vat_3_item_promo',
  'Promotion sur les plats/articles (TVA incluse)': 'item_promo_incl_vat', // Ancien format
  'Offres sur les articles (TVA incluse)': 'item_promo_incl_vat', // Nouveau format
  
  'Ajustement des frais de marketing': 'marketing_fee_adjustment',
  'Ajustement marketing (TVA incluse)': 'marketing_fee_adjustment', // Format 2025
  'Titre-restaurant': 'meal_voucher_amount',
  'Fournisseur de titres-restaurant': 'meal_voucher_provider',
  'Ajustements du prix (hors TVA)': 'price_adjustment_excl_vat',
  'Ajustements de prix (hors TVA)': 'price_adjustment_excl_vat', // Format 2025
  'TVA sur les ajustements du prix': 'vat_price_adjustment',
  'Ajustements du prix (TVA comprise)': 'price_adjustment_incl_vat',
  'Ajustements de prix (TVA incluse)': 'price_adjustment_incl_vat', // Format 2025
  'Frais de livraison (hors TVA)': 'merchant_delivery_fee_excl_vat',
  'TVA 1 sur les frais de livraison': 'vat_1_merchant_delivery',
  'TVA 2 sur les frais de livraison': 'vat_2_merchant_delivery',
  'TVA 3 sur les frais de livraison': 'vat_3_merchant_delivery',
  'Frais de livraison (TVA incluse)': 'merchant_delivery_fee_incl_vat',
  'Frais de préparation et d\'emballage': 'packaging_fee',
  'Frais de préparation et emballage': 'packaging_fee', // Format 2025 (sans "d'")
  'TVA sur les frais pour Préparation et emballage': 'vat_packaging_fee',
  'TVA sur les frais pour préparation et emballage': 'vat_packaging_fee', // Format 2025 (minuscule)
  'Frais de sac de livraison': 'bag_fee',
  'Frais de sac': 'bag_fee', // Format 2025
  
  // Promotions livraison - ancien et nouveau format
  'Promotion sur la livraison (hors TVA)': 'delivery_promo_excl_vat',
  'Offres de livraison (hors TVA)': 'delivery_promo_excl_vat', // Nouveau format
  "Utilisations de l'offre de livraison (hors TVA)": 'delivery_promo_excl_vat', // Format 2025
  'Taxe sur les promotions sur la livraison': 'vat_delivery_promo',
  'TVA sur les offres de livraison': 'vat_delivery_promo', // Nouveau format
  "TVA sur les utilisations de l'offre de livraison": 'vat_delivery_promo', // Format 2025
  'Promotion sur la livraison (TVA incluse)': 'delivery_promo_incl_vat',
  'Offres de livraison (TVA incluse)': 'delivery_promo_incl_vat', // Nouveau format
  "Utilisations de l'offre de livraison (TVA incluse)": 'delivery_promo_incl_vat', // Format 2025
  
  'Total de la commande (TVA incluse)': 'order_total_incl_vat',
  'Lien vers la facture du commerçant pour le client': 'customer_invoice_url',
  'Coût de la livraison (hors TVA)': 'delivery_cost_excl_vat',
  'TVA sur le coût de la livraison': 'vat_delivery_cost',
  'Coût de la livraison (TVA incluse)': 'delivery_cost_incl_vat',
  'Lien vers la facture du coursier pour le commerçant': 'courier_invoice_url',
  'Frais de service Uber avant promotion (hors TVA)': 'uber_fee_before_promo_excl_vat',
  'Promotion sur les frais de service de la Marketplace / frais de mise en relation (hors TVA)': 'uber_fee_promo_excl_vat',
  'Frais de service de la Marketplace / frais de mise en relation après promotion (hors TVA)': 'uber_fee_after_promo_excl_vat',
  'TVA sur les frais de service de la Marketplace / frais de mise en relation après offre': 'vat_uber_fee',
  'Frais de service de la Marketplace / fais de mise en relation après promotion (TVA incluse)': 'uber_fee_after_promo_incl_vat',
  'Lien vers la facture Uber pour le commerçant': 'uber_invoice_url',
  'Ajustement de la TVA': 'vat_adjustment',
  'Gain sur les frais de livraison': 'delivery_fee_gain',
  'Pourboires': 'tip_amount',
  'Description des autres paiements': 'other_payments_description',
  'Autres paiements (TVA incluse)': 'other_payments_incl_vat',
  'Montant total': 'net_payout',
  'Date du versement': 'payout_date',
  'Statut de la commande': 'status',
  'Identifiant du programme de fidélité du commerçant': 'loyalty_id',
  'Id. de référence du versement': 'payout_reference_id',
};

// Normalize headers to handle invisible characters (BOM, NBSP, Unicode variations)
function normalizeHeader(h: string): string {
  return h
    // Remove BOM
    .replace(/^\uFEFF/, '')
    // Replace NBSP and exotic whitespaces with normal space
    .replace(/[\u00A0\u2007\u202F\u2060\u200B\u200C\u200D\uFEFF]/g, ' ')
    // Normalize Unicode (curved apostrophes, etc.)
    .normalize('NFKC')
    // Replace curved apostrophes with straight ones
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Compress multiple spaces into one
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

// Pre-normalize all COLUMN_MAPPING keys for faster lookup
const NORMALIZED_COLUMN_MAPPING: Record<string, string> = {};
for (const [key, value] of Object.entries(COLUMN_MAPPING)) {
  NORMALIZED_COLUMN_MAPPING[normalizeHeader(key)] = value;
}

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }

  // Push last row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseNumber(value: string): number {
  if (!value || value === '') return 0;
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr === '') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseDateTime(dateStr: string, timeStr: string): string | null {
  const date = parseDate(dateStr);
  if (!date) return null;
  if (timeStr && timeStr.includes(':')) {
    return `${date}T${timeStr}:00`;
  }
  return `${date}T00:00:00`;
}

function cleanUrl(url: string): string | null {
  if (!url || url === '') return null;
  return url.replace(/\\\\/g, '');
}

function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Terminée': 'completed',
    'Annulée': 'cancelled',
    'Remboursée': 'refunded',
    'Remboursement': 'refunded',
    'Échec': 'failed',
    'En cours': 'in_progress',
  };
  return statusMap[status] || status || 'unknown';
}

interface SkipInfo {
  rowIndex: number;
  reason: string;
  details: string;
}

interface RestaurantStats {
  id: string;
  name: string;
  orderCount: number;
}

const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, reportType = 'payment_order_level', dryRun = false } = await req.json();

    if (!csvContent) {
      throw new Error('Missing csvContent in request body');
    }

    console.log('Parsing payment report, type:', reportType, 'dryRun:', dryRun);
    console.log('CSV content length:', csvContent.length);

    const rows = parseCSV(csvContent);
    
    console.log('Total parsed rows:', rows.length);
    
    // Find header row - look for known column headers
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const rowText = rows[i].join(' ');
      if (rowText.includes('Id. de la commande') || rowText.includes('Id. du flux') || 
          rowText.includes('Nom du restaurant') || rowText.includes('Date de la commande')) {
        headerRowIndex = i;
        console.log('Found header at row', i, ':', rows[i].slice(0, 5).join(', '));
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Log first few rows for debugging
      console.log('Could not find header. First 5 rows:', JSON.stringify(rows.slice(0, 5)));
      throw new Error('Could not find header row in CSV. Expected columns like "Id. de la commande", "Nom du restaurant"');
    }
    
    // Check if there are data rows after header
    const dataRowCount = rows.length - headerRowIndex - 1;
    if (dataRowCount < 1) {
      console.log('No data rows after header at row', headerRowIndex);
      return new Response(
        JSON.stringify({
          success: true,
          reportType,
          stats: {
            totalRows: 0,
            insertedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            errorCount: 0,
          },
          dateRange: { start: null, end: null },
          restaurants: [],
          message: 'Le fichier CSV est vide (pas de données après les en-têtes)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = rows[headerRowIndex];
    console.log('Found headers at row:', headerRowIndex, 'Columns:', headers.length);

    // GUARDRAIL: Detect if this is actually an item-level file
    const headerLine = headers.join(' ').toLowerCase();
    const hasItemColumns = headerLine.includes("nom du plat") || 
                          headerLine.includes("titre de l'article") ||
                          headerLine.includes("item title") ||
                          headerLine.includes("nom de l'article");
    
    if (hasItemColumns) {
      console.warn('WRONG PARSER: This file contains item-level columns. Should use parse-item-report.');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'wrong_report_type',
          reportType: 'payment_order_level',
          message: "Ce fichier contient des données par article (colonnes détectées: 'Nom du plat', 'Titre de l'article'). Utilisez 'Informations de paiement (niveau articles)' pour l'importer correctement.",
          stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
          suggestion: {
            correctType: 'payment_item_level',
            correctLabel: 'Informations de paiement (niveau articles)',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build column indices with normalized header matching
    const columnIndices: Record<string, number> = {};
    const recognizedColumns: { original: string; normalized: string; dbField: string }[] = [];
    const unrecognizedColumns: string[] = [];
    
    headers.forEach((header, index) => {
      const normalizedHeader = normalizeHeader(header);
      const dbField = NORMALIZED_COLUMN_MAPPING[normalizedHeader];
      
      if (dbField) {
        columnIndices[dbField] = index;
        recognizedColumns.push({ original: header, normalized: normalizedHeader, dbField });
      } else if (normalizedHeader && normalizedHeader.length > 0) {
        unrecognizedColumns.push(normalizedHeader);
      }
    });

    // Check critical columns
    const criticalColumnsFound = {
      sales_incl_vat: 'sales_incl_vat' in columnIndices,
      net_payout: 'net_payout' in columnIndices,
      item_promo_incl_vat: 'item_promo_incl_vat' in columnIndices,
      refund_incl_vat: 'refund_incl_vat' in columnIndices,
    };

    console.log('Mapped columns:', Object.keys(columnIndices).length);
    console.log('Critical columns found:', JSON.stringify(criticalColumnsFound));
    if (!criticalColumnsFound.sales_incl_vat) {
      console.warn('WARNING: sales_incl_vat column NOT FOUND! Unrecognized headers:', unrecognizedColumns.slice(0, 10));
    }

    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id');

    if (restaurantError) {
      throw new Error('Failed to fetch restaurants: ' + restaurantError.message);
    }

    // Also fetch from the multi-UUID mapping table
    const { data: uberIdMappings } = await supabase
      .from('restaurant_uber_ids')
      .select('restaurant_id, uber_store_id');

    const restaurantMap = new Map<string, { id: string; name: string }>();
    
    // First, add from restaurants.uber_store_id (legacy)
    restaurants?.forEach(r => {
      if (r.uber_store_id) {
        restaurantMap.set(r.uber_store_id, { id: r.id, name: r.name });
      }
    });

    // Then, add from the multi-UUID mapping table (may have additional UUIDs)
    if (uberIdMappings && restaurants) {
      const restaurantById = new Map(restaurants.map(r => [r.id, r]));
      uberIdMappings.forEach(mapping => {
        const restaurant = restaurantById.get(mapping.restaurant_id);
        if (restaurant && mapping.uber_store_id) {
          restaurantMap.set(mapping.uber_store_id, { id: restaurant.id, name: restaurant.name });
        }
      });
    }

    console.log('Restaurant UUID map size:', restaurantMap.size);

    // Phase 1: Parse all rows WITHOUT database calls
    const dataRows = rows.slice(headerRowIndex + 1);
    const ordersToUpsert: any[] = [];
    const adjustmentsToUpsert: any[] = [];
    let skippedCount = 0;
    const skippedDetails: SkipInfo[] = [];
    const restaurantStats = new Map<string, RestaurantStats>();
    const unknownStoreIds = new Set<string>();
    const unknownStoreDetails: Record<string, { name: string }> = {};
    let minDate: string | null = null;
    let maxDate: string | null = null;

    const flowContext = new Map<string, { 
      uberOrderId: string; 
      uberStoreId: string;
      restaurantId: string;
    }>();

    // Track eco-contribution refunds (lines without uber_order_id but with positive "Autres frais")
    const ecoContributionByPayout = new Map<string, { amount: number; restaurantId: string }>();
    let ecoContributionRowCount = 0;

    // Build a set of recognized DB fields for extra_columns detection
    const recognizedDbFields = new Set(Object.values(NORMALIZED_COLUMN_MAPPING));

    // Helper: build raw_columns object from a CSV row
    const buildRawColumns = (row: string[]): Record<string, string> => {
      const raw: Record<string, string> = {};
      headers.forEach((header, idx) => {
        const normalizedHeader = normalizeHeader(header);
        if (normalizedHeader && idx < row.length) {
          raw[normalizedHeader] = row[idx] || '';
        }
      });
      return raw;
    };

    // Helper: build extra_columns (unmapped columns only)
    const buildExtraColumns = (row: string[]): Record<string, string> | null => {
      const extra: Record<string, string> = {};
      let hasExtra = false;
      headers.forEach((header, idx) => {
        const normalizedHeader = normalizeHeader(header);
        const dbField = NORMALIZED_COLUMN_MAPPING[normalizedHeader];
        if (!dbField && normalizedHeader && normalizedHeader.length > 0 && idx < row.length && row[idx]?.trim()) {
          extra[normalizedHeader] = row[idx];
          hasExtra = true;
        }
      });
      return hasExtra ? extra : null;
    };

    // Helper: categorize adjustment description
    const categorizeAdjustment = (description: string): string => {
      const lower = description.toLowerCase();
      if (lower.includes('publicitaire') || lower.includes('advertising') || lower.includes(' ads') || lower.includes('dépenses publicitaires') || lower.includes('depenses publicitaires')) {
        return 'advertising';
      }
      if (lower.includes('eco') || lower.includes('éco') || lower.includes('contribution') || lower.includes('environnement')) {
        return 'eco_contribution';
      }
      if (lower.includes('ajustement') || lower.includes('adjustment')) {
        return 'adjustment';
      }
      return 'other_fee';
    };

    const importTimestamp = new Date().toISOString();

    console.log('Phase 1: Parsing', dataRows.length, 'rows...');

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      if (row.length < 5) continue;

      const getValue = (field: string): string => {
        const idx = columnIndices[field];
        return idx !== undefined ? row[idx] || '' : '';
      };

      const uberFlowId = getValue('uber_flow_id');
      let uberOrderId = getValue('uber_order_id');
      let uberStoreId = getValue('uber_store_id');
      let restaurant: { id: string; name: string } | undefined;
      
      if (uberFlowId && (!uberOrderId || uberOrderId === '')) {
        const context = flowContext.get(uberFlowId);
        if (context) {
          uberOrderId = context.uberOrderId;
          uberStoreId = context.uberStoreId;
          restaurant = { id: context.restaurantId, name: '' };
        } else {
          skippedCount++;
          if (skippedDetails.length < 50) {
            skippedDetails.push({
              rowIndex: rowIndex + headerRowIndex + 2,
              reason: 'context_missing',
              details: `Ligne enfant sans contexte parent (flow_id: ${uberFlowId})`
            });
          }
          continue;
        }
      } else {
        if (!uberOrderId || uberOrderId === '') {
          // Lines without order id → store as payout_adjustments
          const payoutRefId = getValue('payout_reference_id');
          const otherDescRaw = getValue('other_payments_description') || '';
          const otherDesc = otherDescRaw.toLowerCase().trim();
          const uberStoreIdVal = getValue('uber_store_id');
          const restaurantNameVal = getValue('restaurant_name') || '';

          const otherPaymentsInclVat = parseNumber(getValue('other_payments_incl_vat'));
          const totalAmount = parseNumber(getValue('net_payout'));
          const candidateAmount = otherPaymentsInclVat !== 0 ? otherPaymentsInclVat : totalAmount;

          // Still track eco-contribution for payout updates (backward compat)
          const isExcluded = 
            otherDesc.includes('dépenses publicitaires') ||
            otherDesc.includes('depenses publicitaires') ||
            otherDesc.includes('advertising') ||
            otherDesc.includes(' ads');

          const isEcoKeyword = 
            otherDesc.includes('eco') ||
            otherDesc.includes('éco') ||
            otherDesc.includes('contribution') ||
            otherDesc.includes('environnement') ||
            otherDesc.includes('autres frais');

          const isEcoContribution = !!payoutRefId && candidateAmount !== 0 && isEcoKeyword && !isExcluded;

          if (isEcoContribution) {
            const normalizedAmount = Math.abs(candidateAmount);
            const existing = ecoContributionByPayout.get(payoutRefId);
            if (existing) {
              existing.amount += normalizedAmount;
            } else {
              ecoContributionByPayout.set(payoutRefId, {
                amount: normalizedAmount,
                restaurantId: '',
              });
            }
            ecoContributionRowCount++;
          }

          // Insert into payout_adjustments (ALL non-order rows, including eco)
          if (payoutRefId && uberStoreIdVal) {
            const matchedRestaurant = restaurantMap.get(uberStoreIdVal);
            const category = otherDesc ? categorizeAdjustment(otherDesc) : 'other_fee';
            
            adjustmentsToUpsert.push({
              restaurant_id: matchedRestaurant?.id || null,
              uber_store_id: uberStoreIdVal,
              restaurant_name: restaurantNameVal || matchedRestaurant?.name || null,
              payout_reference_id: payoutRefId,
              payout_date: parseDate(getValue('payout_date')),
              description: otherDescRaw || null,
              category,
              amount: candidateAmount,
              raw_columns: buildRawColumns(row),
            });
          } else {
            skippedCount++;
            if (skippedDetails.length < 50) {
              skippedDetails.push({
                rowIndex: rowIndex + headerRowIndex + 2,
                reason: 'no_order_id_no_payout',
                details: `Ligne sans identifiant de commande ni référence versement`,
              });
            }
          }
          continue;
        }
        
        restaurant = restaurantMap.get(uberStoreId);
        if (!restaurant) {
          skippedCount++;
          unknownStoreIds.add(uberStoreId);
          // Store the restaurant name from CSV for UI display
          const restaurantName = getValue('restaurant_name');
          if (restaurantName && !unknownStoreDetails[uberStoreId]) {
            unknownStoreDetails[uberStoreId] = { name: restaurantName };
          }
          if (skippedDetails.length < 50) {
            skippedDetails.push({
              rowIndex: rowIndex + headerRowIndex + 2,
              reason: 'restaurant_not_found',
              details: `Restaurant non trouvé (uber_store_id: ${uberStoreId})`
            });
          }
          continue;
        }
        
        if (uberFlowId) {
          flowContext.set(uberFlowId, {
            uberOrderId,
            uberStoreId,
            restaurantId: restaurant.id,
          });
        }
      }

      const orderDate = getValue('order_date');
      const parsedDate = parseDate(orderDate);
      if (parsedDate) {
        if (!minDate || parsedDate < minDate) minDate = parsedDate;
        if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
      }

      if (restaurant) {
        const existing = restaurantStats.get(restaurant.id);
        if (existing) {
          existing.orderCount++;
        } else {
          restaurantStats.set(restaurant.id, {
            id: restaurant.id,
            name: restaurant.name,
            orderCount: 1
          });
        }
      }

      const orderTime = getValue('order_datetime');

      ordersToUpsert.push({
        uber_order_id: uberOrderId,
        uber_flow_id: getValue('uber_flow_id') || '',
        restaurant_id: restaurant.id,
        order_datetime: parseDateTime(orderDate, orderTime),
        fulfillment_type: getValue('fulfillment_type') || null,
        payment_method: getValue('payment_method') || null,
        order_channel: getValue('order_channel') || null,
        uber_one_status: getValue('uber_one_status') || null,
        sales_excl_vat: parseNumber(getValue('sales_excl_vat')),
        vat_1_sales: parseNumber(getValue('vat_1_sales')),
        vat_2_sales: parseNumber(getValue('vat_2_sales')),
        vat_3_sales: parseNumber(getValue('vat_3_sales')),
        sales_incl_vat: parseNumber(getValue('sales_incl_vat')),
        gross_amount: parseNumber(getValue('sales_incl_vat')),
        refund_excl_vat: parseNumber(getValue('refund_excl_vat')),
        vat_1_refund: parseNumber(getValue('vat_1_refund')),
        vat_2_refund: parseNumber(getValue('vat_2_refund')),
        vat_3_refund: parseNumber(getValue('vat_3_refund')),
        refund_incl_vat: parseNumber(getValue('refund_incl_vat')),
        item_promo_excl_vat: parseNumber(getValue('item_promo_excl_vat')),
        vat_1_item_promo: parseNumber(getValue('vat_1_item_promo')),
        vat_2_item_promo: parseNumber(getValue('vat_2_item_promo')),
        vat_3_item_promo: parseNumber(getValue('vat_3_item_promo')),
        item_promo_incl_vat: parseNumber(getValue('item_promo_incl_vat')),
        promotion_discount: Math.abs(parseNumber(getValue('item_promo_incl_vat'))),
        marketing_fee_adjustment: parseNumber(getValue('marketing_fee_adjustment')),
        meal_voucher_amount: parseNumber(getValue('meal_voucher_amount')),
        meal_voucher_provider: getValue('meal_voucher_provider') || null,
        price_adjustment_excl_vat: parseNumber(getValue('price_adjustment_excl_vat')),
        vat_price_adjustment: parseNumber(getValue('vat_price_adjustment')),
        price_adjustment_incl_vat: parseNumber(getValue('price_adjustment_incl_vat')),
        merchant_delivery_fee_excl_vat: parseNumber(getValue('merchant_delivery_fee_excl_vat')),
        vat_1_merchant_delivery: parseNumber(getValue('vat_1_merchant_delivery')),
        vat_2_merchant_delivery: parseNumber(getValue('vat_2_merchant_delivery')),
        vat_3_merchant_delivery: parseNumber(getValue('vat_3_merchant_delivery')),
        merchant_delivery_fee_incl_vat: parseNumber(getValue('merchant_delivery_fee_incl_vat')),
        packaging_fee: parseNumber(getValue('packaging_fee')),
        vat_packaging_fee: parseNumber(getValue('vat_packaging_fee')),
        bag_fee: parseNumber(getValue('bag_fee')),
        delivery_promo_excl_vat: parseNumber(getValue('delivery_promo_excl_vat')),
        vat_delivery_promo: parseNumber(getValue('vat_delivery_promo')),
        delivery_promo_incl_vat: parseNumber(getValue('delivery_promo_incl_vat')),
        order_total_incl_vat: parseNumber(getValue('order_total_incl_vat')),
        customer_invoice_url: cleanUrl(getValue('customer_invoice_url')),
        delivery_cost_excl_vat: parseNumber(getValue('delivery_cost_excl_vat')),
        vat_delivery_cost: parseNumber(getValue('vat_delivery_cost')),
        delivery_cost_incl_vat: parseNumber(getValue('delivery_cost_incl_vat')),
        delivery_fee: parseNumber(getValue('delivery_cost_incl_vat')),
        courier_invoice_url: cleanUrl(getValue('courier_invoice_url')),
        uber_fee_before_promo_excl_vat: parseNumber(getValue('uber_fee_before_promo_excl_vat')),
        uber_fee_promo_excl_vat: parseNumber(getValue('uber_fee_promo_excl_vat')),
        uber_fee_after_promo_excl_vat: parseNumber(getValue('uber_fee_after_promo_excl_vat')),
        vat_uber_fee: parseNumber(getValue('vat_uber_fee')),
        uber_fee_after_promo_incl_vat: parseNumber(getValue('uber_fee_after_promo_incl_vat')),
        service_fee: Math.abs(parseNumber(getValue('uber_fee_after_promo_incl_vat'))),
        uber_invoice_url: cleanUrl(getValue('uber_invoice_url')),
        vat_adjustment: parseNumber(getValue('vat_adjustment')),
        delivery_fee_gain: parseNumber(getValue('delivery_fee_gain')),
        tip_amount: parseNumber(getValue('tip_amount')),
        other_payments_description: getValue('other_payments_description') || null,
        other_payments_incl_vat: parseNumber(getValue('other_payments_incl_vat')),
        net_payout: parseNumber(getValue('net_payout')),
        net_amount: parseNumber(getValue('net_payout')),
        payout_date: parseDate(getValue('payout_date')),
        payout_reference_id: getValue('payout_reference_id') || null,
        loyalty_id: getValue('loyalty_id') || null,
        status: mapStatus(getValue('status')),
        tax_amount: parseNumber(getValue('vat_1_sales')) + 
                    parseNumber(getValue('vat_2_sales')) + 
                    parseNumber(getValue('vat_3_sales')),
        imported_from_report: true,
        report_import_date: importTimestamp,
        currency: 'EUR',
        extra_columns: buildExtraColumns(row),
      });
    }

    console.log('Phase 1 parsing complete. Raw orders:', ordersToUpsert.length, ', adjustments:', adjustmentsToUpsert.length);

    console.log(`Eco-contribution rows detected: ${ecoContributionRowCount}`);
    console.log(`Eco-contribution payouts: ${ecoContributionByPayout.size}`);

    // Phase 1.5: Deduplicate orders by (uber_order_id, uber_flow_id)
    // Multiple CSV lines can have the same key - merge them by summing financial fields
    const ordersMap = new Map<string, any>();

    for (const order of ordersToUpsert) {
      const key = `${order.uber_order_id}_${order.uber_flow_id}`;
      const existing = ordersMap.get(key);
      
      if (existing) {
        // Merge: TOTALS use MAX (they are repeated identically on each CSV line)
        existing.sales_excl_vat = Math.max(existing.sales_excl_vat || 0, order.sales_excl_vat || 0);
        existing.sales_incl_vat = Math.max(existing.sales_incl_vat || 0, order.sales_incl_vat || 0);
        existing.gross_amount = Math.max(existing.gross_amount || 0, order.gross_amount || 0);
        existing.order_total_incl_vat = Math.max(existing.order_total_incl_vat || 0, order.order_total_incl_vat || 0);
        
        // COMPONENTS: sum (they differ between CSV lines for the same order)
        existing.vat_1_sales = (existing.vat_1_sales || 0) + (order.vat_1_sales || 0);
        existing.vat_2_sales = (existing.vat_2_sales || 0) + (order.vat_2_sales || 0);
        existing.vat_3_sales = (existing.vat_3_sales || 0) + (order.vat_3_sales || 0);
        existing.refund_excl_vat = (existing.refund_excl_vat || 0) + (order.refund_excl_vat || 0);
        existing.vat_1_refund = (existing.vat_1_refund || 0) + (order.vat_1_refund || 0);
        existing.vat_2_refund = (existing.vat_2_refund || 0) + (order.vat_2_refund || 0);
        existing.vat_3_refund = (existing.vat_3_refund || 0) + (order.vat_3_refund || 0);
        existing.refund_incl_vat = (existing.refund_incl_vat || 0) + (order.refund_incl_vat || 0);
        existing.item_promo_excl_vat = (existing.item_promo_excl_vat || 0) + (order.item_promo_excl_vat || 0);
        existing.vat_1_item_promo = (existing.vat_1_item_promo || 0) + (order.vat_1_item_promo || 0);
        existing.vat_2_item_promo = (existing.vat_2_item_promo || 0) + (order.vat_2_item_promo || 0);
        existing.vat_3_item_promo = (existing.vat_3_item_promo || 0) + (order.vat_3_item_promo || 0);
        existing.item_promo_incl_vat = (existing.item_promo_incl_vat || 0) + (order.item_promo_incl_vat || 0);
        existing.promotion_discount = (existing.promotion_discount || 0) + (order.promotion_discount || 0);
        existing.marketing_fee_adjustment = (existing.marketing_fee_adjustment || 0) + (order.marketing_fee_adjustment || 0);
        existing.meal_voucher_amount = (existing.meal_voucher_amount || 0) + (order.meal_voucher_amount || 0);
        existing.price_adjustment_excl_vat = (existing.price_adjustment_excl_vat || 0) + (order.price_adjustment_excl_vat || 0);
        existing.vat_price_adjustment = (existing.vat_price_adjustment || 0) + (order.vat_price_adjustment || 0);
        existing.price_adjustment_incl_vat = (existing.price_adjustment_incl_vat || 0) + (order.price_adjustment_incl_vat || 0);
        existing.merchant_delivery_fee_excl_vat = (existing.merchant_delivery_fee_excl_vat || 0) + (order.merchant_delivery_fee_excl_vat || 0);
        existing.vat_1_merchant_delivery = (existing.vat_1_merchant_delivery || 0) + (order.vat_1_merchant_delivery || 0);
        existing.vat_2_merchant_delivery = (existing.vat_2_merchant_delivery || 0) + (order.vat_2_merchant_delivery || 0);
        existing.vat_3_merchant_delivery = (existing.vat_3_merchant_delivery || 0) + (order.vat_3_merchant_delivery || 0);
        existing.merchant_delivery_fee_incl_vat = (existing.merchant_delivery_fee_incl_vat || 0) + (order.merchant_delivery_fee_incl_vat || 0);
        existing.packaging_fee = (existing.packaging_fee || 0) + (order.packaging_fee || 0);
        existing.vat_packaging_fee = (existing.vat_packaging_fee || 0) + (order.vat_packaging_fee || 0);
        existing.bag_fee = (existing.bag_fee || 0) + (order.bag_fee || 0);
        existing.delivery_promo_excl_vat = (existing.delivery_promo_excl_vat || 0) + (order.delivery_promo_excl_vat || 0);
        existing.vat_delivery_promo = (existing.vat_delivery_promo || 0) + (order.vat_delivery_promo || 0);
        existing.delivery_promo_incl_vat = (existing.delivery_promo_incl_vat || 0) + (order.delivery_promo_incl_vat || 0);
        existing.delivery_cost_excl_vat = (existing.delivery_cost_excl_vat || 0) + (order.delivery_cost_excl_vat || 0);
        existing.vat_delivery_cost = (existing.vat_delivery_cost || 0) + (order.vat_delivery_cost || 0);
        existing.delivery_cost_incl_vat = (existing.delivery_cost_incl_vat || 0) + (order.delivery_cost_incl_vat || 0);
        existing.delivery_fee = (existing.delivery_fee || 0) + (order.delivery_fee || 0);
        existing.uber_fee_before_promo_excl_vat = (existing.uber_fee_before_promo_excl_vat || 0) + (order.uber_fee_before_promo_excl_vat || 0);
        existing.uber_fee_promo_excl_vat = (existing.uber_fee_promo_excl_vat || 0) + (order.uber_fee_promo_excl_vat || 0);
        existing.uber_fee_after_promo_excl_vat = (existing.uber_fee_after_promo_excl_vat || 0) + (order.uber_fee_after_promo_excl_vat || 0);
        existing.vat_uber_fee = (existing.vat_uber_fee || 0) + (order.vat_uber_fee || 0);
        existing.uber_fee_after_promo_incl_vat = (existing.uber_fee_after_promo_incl_vat || 0) + (order.uber_fee_after_promo_incl_vat || 0);
        existing.service_fee = (existing.service_fee || 0) + (order.service_fee || 0);
        existing.vat_adjustment = (existing.vat_adjustment || 0) + (order.vat_adjustment || 0);
        existing.delivery_fee_gain = (existing.delivery_fee_gain || 0) + (order.delivery_fee_gain || 0);
        existing.tip_amount = (existing.tip_amount || 0) + (order.tip_amount || 0);
        existing.other_payments_incl_vat = (existing.other_payments_incl_vat || 0) + (order.other_payments_incl_vat || 0);
        existing.net_payout = (existing.net_payout || 0) + (order.net_payout || 0);
        existing.net_amount = (existing.net_amount || 0) + (order.net_amount || 0);
        existing.tax_amount = (existing.tax_amount || 0) + (order.tax_amount || 0);
        
        // Keep non-null text values from latest entry
        if (order.meal_voucher_provider) existing.meal_voucher_provider = order.meal_voucher_provider;
        if (order.other_payments_description) existing.other_payments_description = order.other_payments_description;
        if (order.customer_invoice_url) existing.customer_invoice_url = order.customer_invoice_url;
        if (order.courier_invoice_url) existing.courier_invoice_url = order.courier_invoice_url;
        if (order.uber_invoice_url) existing.uber_invoice_url = order.uber_invoice_url;
        if (order.payout_date) existing.payout_date = order.payout_date;
        if (order.payout_reference_id) existing.payout_reference_id = order.payout_reference_id;
        if (order.loyalty_id) existing.loyalty_id = order.loyalty_id;
        if (order.status && order.status !== 'unknown') existing.status = order.status;
      } else {
        ordersMap.set(key, { ...order });
      }
    }

    const deduplicatedOrders = Array.from(ordersMap.values());
    console.log('Phase 1.5 deduplication complete. Unique orders:', deduplicatedOrders.length, '(merged', ordersToUpsert.length - deduplicatedOrders.length, 'duplicates)');

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    if (dryRun) {
      // In dry run mode, just count existing vs new
      const orderIds = deduplicatedOrders.map(o => o.uber_order_id);
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('uber_order_id')
        .in('uber_order_id', orderIds);
      
      const existingSet = new Set(existingOrders?.map(o => o.uber_order_id) || []);
      
      for (const order of deduplicatedOrders) {
        if (existingSet.has(order.uber_order_id)) {
          updatedCount++;
        } else {
          insertedCount++;
        }
      }
    } else {
      // Phase 2: Batch upsert with deduplicated orders
      console.log('Phase 2: Batch upserting', deduplicatedOrders.length, 'unique orders in chunks of', BATCH_SIZE);
      
      for (let i = 0; i < deduplicatedOrders.length; i += BATCH_SIZE) {
        const batch = deduplicatedOrders.slice(i, i + BATCH_SIZE);
        
        const { error: upsertError, count } = await supabase
          .from('orders')
          .upsert(batch, { 
            onConflict: 'uber_order_id,uber_flow_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error('Batch upsert error:', upsertError.message);
          errorCount += batch.length;
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertError.message}`);
        } else {
          // All in batch successful - assume half updates, half inserts as approximation
          insertedCount += Math.ceil(batch.length / 2);
          updatedCount += Math.floor(batch.length / 2);
        }
        
        // Log progress
        if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= deduplicatedOrders.length) {
          console.log(`Processed ${Math.min(i + BATCH_SIZE, deduplicatedOrders.length)}/${deduplicatedOrders.length} orders`);
        }
      }
    }

    // Phase 3: Update payouts with eco-contribution amounts
    let ecoContributionPayoutsUpdated = 0;
    let ecoContributionTotalAmount = 0;
    
    if (!dryRun && ecoContributionByPayout.size > 0) {
      console.log('Phase 3: Updating payouts with eco-contribution for', ecoContributionByPayout.size, 'payouts');
      
      for (const [payoutRefId, { amount }] of ecoContributionByPayout) {
        // Update payout by payout_reference_id ONLY (works even without restaurant mapping)
        const { data: updateData, error: updateError } = await supabase
          .from('payouts')
          .update({ eco_contribution_refund: amount })
          .eq('payout_reference_id', payoutRefId)
          .select('id, restaurant_id');
        
        if (!updateError && updateData && updateData.length > 0) {
          ecoContributionPayoutsUpdated++;
          ecoContributionTotalAmount += amount;
          console.log(`[eco-contrib] Updated payout ${payoutRefId}: ${amount} € (matched ${updateData.length} row(s))`);
        } else if (updateError) {
          console.warn('Failed to update payout eco-contribution:', payoutRefId, updateError.message);
        } else {
          console.warn(`[eco-contrib] No payout found for reference: ${payoutRefId}`);
        }
      }
      
      console.log('Eco-contribution update complete:', ecoContributionPayoutsUpdated, 'payouts updated, total:', ecoContributionTotalAmount, '€');
    }

    // Phase 3.5: Deduplicate adjustments by (payout_reference_id, description, uber_store_id)
    // Multiple CSV lines can share the same composite key - merge by summing amounts
    const adjustmentsMap = new Map<string, any>();
    for (const adj of adjustmentsToUpsert) {
      const key = `${adj.payout_reference_id}__${adj.description || ''}__${adj.uber_store_id}`;
      const existing = adjustmentsMap.get(key);
      if (existing) {
        existing.amount = (existing.amount || 0) + (adj.amount || 0);
        // Keep non-null text values from latest entry
        if (adj.restaurant_id) existing.restaurant_id = adj.restaurant_id;
        if (adj.restaurant_name) existing.restaurant_name = adj.restaurant_name;
        if (adj.payout_date) existing.payout_date = adj.payout_date;
        if (adj.category) existing.category = adj.category;
      } else {
        adjustmentsMap.set(key, { ...adj });
      }
    }
    const deduplicatedAdjustments = Array.from(adjustmentsMap.values());
    console.log('Phase 3.5 adjustment dedup:', adjustmentsToUpsert.length, '->', deduplicatedAdjustments.length);

    // Phase 4: Upsert payout_adjustments
    let adjustmentsInserted = 0;
    let adjustmentsErrors = 0;

    if (!dryRun && deduplicatedAdjustments.length > 0) {
      console.log('Phase 4: Upserting', deduplicatedAdjustments.length, 'payout adjustments');
      
      for (let i = 0; i < deduplicatedAdjustments.length; i += BATCH_SIZE) {
        const batch = deduplicatedAdjustments.slice(i, i + BATCH_SIZE);
        
        const { error: adjError } = await supabase
          .from('payout_adjustments')
          .upsert(batch, {
            onConflict: 'payout_reference_id,description,uber_store_id',
            ignoreDuplicates: false,
          });

        if (adjError) {
          console.error('Adjustments upsert error:', adjError.message);
          adjustmentsErrors += batch.length;
          errors.push(`Adjustments batch: ${adjError.message}`);
        } else {
          adjustmentsInserted += batch.length;
        }
      }
      
      console.log('Phase 4 complete:', adjustmentsInserted, 'adjustments upserted,', adjustmentsErrors, 'errors');
    } else if (dryRun) {
      adjustmentsInserted = deduplicatedAdjustments.length;
    }

    // Sample first order's critical values for debugging
    const sampleOrder = deduplicatedOrders[0];
    const sampleCriticalValues = sampleOrder ? {
      sales_incl_vat: sampleOrder.sales_incl_vat,
      net_payout: sampleOrder.net_payout,
      item_promo_incl_vat: sampleOrder.item_promo_incl_vat,
      refund_incl_vat: sampleOrder.refund_incl_vat,
    } : null;

    const result = {
      success: true,
      reportType,
      dryRun,
      stats: {
        totalRows: dataRows.length,
        processed: deduplicatedOrders.length,
        rawParsed: ordersToUpsert.length,
        merged: ordersToUpsert.length - deduplicatedOrders.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        adjustments: adjustmentsInserted,
        adjustmentsErrors,
      },
      ecoContribution: {
        rowsDetected: ecoContributionRowCount,
        payoutsUpdated: ecoContributionPayoutsUpdated,
        totalAmount: ecoContributionTotalAmount,
      },
      validation: {
        dateRange: {
          start: minDate,
          end: maxDate,
        },
        restaurants: Array.from(restaurantStats.values()),
        unknownStoreIds: Array.from(unknownStoreIds),
        unknownStoreDetails,
        skippedDetails: skippedDetails,
      },
      diagnostics: {
        criticalColumnsFound,
        recognizedColumnsCount: recognizedColumns.length,
        unrecognizedColumns: unrecognizedColumns.slice(0, 30),
        sampleCriticalValues,
      },
      errorDetails: errors.slice(0, 10),
    };

    console.log('Processing completed:', result.stats);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error parsing payment report:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
