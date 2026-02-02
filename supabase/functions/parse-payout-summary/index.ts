import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Column mapping from French CSV headers to database fields
// Include variations to handle Uber Eats export inconsistencies (singular/plural, spacing)
const COLUMN_MAPPING: Record<string, string> = {
  'Nom du restaurant': 'restaurant_name',
  'Id. du restaurant': 'uber_store_id',
  'Nombre de commandes': 'order_count',
  "Nombre d'autres paiements": 'other_payments_count',
  'Ventes (hors TVA)': 'sales_excl_vat',
  'TVA 1 sur les ventes': 'vat_1_sales',
  'TVA 2 sur les ventes': 'vat_2_sales',
  'TVA 3 sur les ventes': 'vat_3_sales',
  // Handle both singular and plural variations
  'Ventes (TVA incluses)': 'sales_incl_vat',
  'Ventes (TVA incluse)': 'sales_incl_vat',
  'Remboursements (hors TVA)': 'refund_excl_vat',
  'TVA sur les remboursements': 'vat_refund',
  'Remboursements (TVA incluse)': 'refund_incl_vat',
  'Remboursements (TVA incluses)': 'refund_incl_vat',
  // NEW: "Ajustements liés à des erreurs de commande" variants (replaces "Remboursements" in new format)
  'Ajustements liés à des erreurs de commande (hors TVA)': 'refund_excl_vat',
  'TVA sur les ajustements liés à des erreurs de commande': 'vat_refund',
  'Ajustements liés à des erreurs de commande (TVA incluse)': 'refund_incl_vat',
  'Ajustements liés à des erreurs de commande (TVA incluses)': 'refund_incl_vat',
  // English variant found in mixed-language Uber exports
  'Order Error Adjustments (incl. VAT)': 'refund_incl_vat',
  // OLD format: "Promotion sur les plats/articles"
  'Promotion sur les plats/articles (hors TVA)': 'item_promo_excl_vat',
  'TVA 1 sur les offres sur les articles': 'vat_1_item_promo',
  'TVA 2 sur les offres sur les articles': 'vat_2_item_promo',
  'TVA 3 sur les offres sur les articles': 'vat_3_item_promo',
  'Promotion sur les plats/articles (TVA incluse)': 'item_promo_incl_vat',
  'Promotion sur les plats/articles (TVA incluses)': 'item_promo_incl_vat',
  // NEW format: "Offres sur les articles" (replaces "Promotion sur les plats/articles")
  'Offres sur les articles (hors TVA)': 'item_promo_excl_vat',
  'Offres sur les articles (TVA incluse)': 'item_promo_incl_vat',
  'Offres sur les articles (TVA incluses)': 'item_promo_incl_vat',
  // Marketing fee adjustment - both old and new format
  'Ajustement des frais de marketing': 'marketing_fee_adjustment',
  'Ajustement marketing (hors TVA)': 'marketing_fee_adjustment',
  'Ajustement marketing (TVA incluse)': 'marketing_fee_adjustment',
  'Titre-restaurant': 'meal_voucher_amount',
  'Ajustements du prix (hors TVA)': 'price_adjustment_excl_vat',
  'Ajustements de prix (hors TVA)': 'price_adjustment_excl_vat',
  'TVA sur les ajustements du prix': 'vat_price_adjustment',
  'TVA sur les ajustements de prix': 'vat_price_adjustment',
  'Ajustements du prix (TVA comprise)': 'price_adjustment_incl_vat',
  'Ajustements du prix (TVA incluse)': 'price_adjustment_incl_vat',
  'Ajustements de prix (TVA incluse)': 'price_adjustment_incl_vat',
  'Frais de livraison (hors TVA)': 'merchant_delivery_fee_excl_vat',
  'TVA 1 sur les frais de livraison': 'vat_1_merchant_delivery',
  'TVA 2 sur les frais de livraison': 'vat_2_merchant_delivery',
  'TVA 3 sur les frais de livraison': 'vat_3_merchant_delivery',
  'Frais de livraison (TVA incluse)': 'merchant_delivery_fee_incl_vat',
  'Frais de livraison (TVA incluses)': 'merchant_delivery_fee_incl_vat',
  // Packaging fees - both formats
  'Frais de préparation et d\'emballage': 'packaging_fee',
  'Frais de préparation et emballage': 'packaging_fee',
  'TVA sur les frais pour Préparation et emballage': 'vat_packaging_fee',
  'TVA sur les frais pour préparation et emballage': 'vat_packaging_fee',
  // Bag fee - both formats
  'Frais de sac de livraison': 'bag_fee',
  'Frais de sac': 'bag_fee',
  // OLD format: "Promotion sur la livraison"
  'Promotion sur la livraison (hors TVA)': 'delivery_promo_excl_vat',
  'Taxe sur les promotions sur la livraison': 'vat_delivery_promo',
  'Promotion sur la livraison (TVA incluse)': 'delivery_promo_incl_vat',
  'Promotion sur la livraison (TVA incluses)': 'delivery_promo_incl_vat',
  // NEW format: "Utilisations de l'offre de livraison" (replaces "Promotion sur la livraison")
  'Utilisations de l\'offre de livraison (hors TVA)': 'delivery_promo_excl_vat',
  'TVA sur les utilisations de l\'offre de livraison': 'vat_delivery_promo',
  'Utilisations de l\'offre de livraison (TVA incluse)': 'delivery_promo_incl_vat',
  'Utilisations de l\'offre de livraison (TVA incluses)': 'delivery_promo_incl_vat',
  'Total de la commande (TVA incluse)': 'order_total_incl_vat',
  'Total de la commande (TVA incluses)': 'order_total_incl_vat',
  'Coût de la livraison (hors TVA)': 'delivery_cost_excl_vat',
  'TVA sur le coût de la livraison': 'vat_delivery_cost',
  'Coût de la livraison (TVA incluse)': 'delivery_cost_incl_vat',
  'Coût de la livraison (TVA incluses)': 'delivery_cost_incl_vat',
  'Frais de service Uber avant promotion (hors TVA)': 'uber_fee_before_promo_excl_vat',
  'Promotion sur les frais de service de la Marketplace / frais de mise en relation (hors TVA)': 'uber_fee_promo_excl_vat',
  'Frais de service de la Marketplace / frais de mise en relation après promotion (hors TVA)': 'uber_fee_after_promo_excl_vat',
  'TVA sur les frais de service de la Marketplace / frais de mise en relation après offre': 'vat_uber_fee',
  'Frais de service de la Marketplace / fais de mise en relation après promotion (TVA incluse)': 'uber_fee_after_promo_incl_vat',
  'Frais de service de la Marketplace / frais de mise en relation après promotion (TVA incluse)': 'uber_fee_after_promo_incl_vat',
  'Ajustement de la TVA': 'vat_adjustment',
  'Gain sur les frais de livraison': 'delivery_fee_gain',
  'Pourboires': 'tips',
  'Autres paiements (TVA incluse)': 'other_payments_incl_vat',
  'Autres paiements (TVA incluses)': 'other_payments_incl_vat',
  'Montant total': 'net_payout',
  'Date du versement': 'payout_date',
  'Date de versement': 'payout_date',
  'Id. de référence du versement': 'payout_reference_id',
  'Identifiant de versement': 'payout_reference_id',
};

// Normalize header strings to handle Unicode variants and special spaces
function normalizeHeader(header: string): string {
  return header
    .replace(/\u00A0/g, ' ')  // Replace non-breaking spaces
    .replace(/\u202F/g, ' ')  // Replace narrow no-break space
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .normalize('NFC')
    .trim();
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

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(/[€\s]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseInteger(value: string): number {
  if (!value || value.trim() === '') return 0;
  const parsed = parseInt(value.replace(/\s/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  // Format: DD/MM/YYYY
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

interface SkippedDetail {
  rowIndex: number;
  reason: string;
  details?: string;
}

interface RestaurantStat {
  id: string;
  name: string;
  orderCount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { csvContent, dryRun = false } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'No CSV content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing payout summary report (dryRun: ${dryRun})...`);
    const rows = parseCSV(csvContent);
    
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'CSV file is empty or has no data rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find header row (first row with recognizable headers)
    let headerRowIndex = 0;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      if (row.some(cell => cell.includes('Id. de référence du versement') || cell.includes('Montant total'))) {
        headerRowIndex = i;
        headers = row.map(h => h.replace(/^\uFEFF/, '').trim());
        break;
      }
    }

    if (headers.length === 0) {
      headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
    }

    console.log('Found headers:', headers.slice(0, 10), '...');

    // Map column indices - normalize headers to handle Unicode variants and trailing spaces
    const columnIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const cleanHeader = normalizeHeader(header);
      const mappedField = COLUMN_MAPPING[cleanHeader];
      if (mappedField) {
        // Handle duplicate "Id. du restaurant" - first one is often empty, second is UUID
        if (mappedField === 'uber_store_id' && columnIndices[mappedField] !== undefined) {
          // Keep the second occurrence (usually the UUID)
          columnIndices[mappedField] = index;
        } else if (columnIndices[mappedField] === undefined) {
          columnIndices[mappedField] = index;
        }
      }
    });
    
    // Log unmapped columns for diagnostics
    const unmappedHeaders = headers.filter(h => !COLUMN_MAPPING[normalizeHeader(h)]);
    if (unmappedHeaders.length > 0) {
      console.log('Unmapped columns:', unmappedHeaders.slice(0, 10));
    }

    console.log('Mapped columns:', Object.keys(columnIndices));

    // Fetch restaurants for mapping
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, uber_store_id, name');

    if (restaurantsError) {
      console.error('Error fetching restaurants:', restaurantsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch restaurants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const restaurantMap = new Map<string, { id: string; name: string }>();
    restaurants?.forEach(r => {
      if (r.uber_store_id) {
        restaurantMap.set(r.uber_store_id, { id: r.id, name: r.name });
      }
    });

    console.log(`Loaded ${restaurantMap.size} restaurants with uber_store_id`);

    // Process data rows
    const dataRows = rows.slice(headerRowIndex + 1);
    const skippedDetails: SkippedDetail[] = [];
    const unknownStoreIds: Set<string> = new Set();
    const restaurantStats = new Map<string, RestaurantStat>();
    const payoutsToInsert: any[] = [];
    let minDate: string | null = null;
    let maxDate: string | null = null;

    const results = {
      totalRows: dataRows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + headerRowIndex + 2;

      try {
        const getValue = (field: string): string => {
          const idx = columnIndices[field];
          return idx !== undefined && row[idx] !== undefined ? row[idx] : '';
        };

        const uberStoreId = getValue('uber_store_id');
        const payoutReferenceId = getValue('payout_reference_id');
        const payoutDateStr = getValue('payout_date');

        if (!payoutReferenceId || !payoutDateStr) {
          results.skipped++;
          skippedDetails.push({
            rowIndex: rowNumber,
            reason: 'missing_required_fields',
            details: `Missing payout_reference_id or payout_date`
          });
          continue;
        }

        const restaurant = restaurantMap.get(uberStoreId);
        if (!restaurant) {
          results.skipped++;
          unknownStoreIds.add(uberStoreId);
          skippedDetails.push({
            rowIndex: rowNumber,
            reason: 'unknown_restaurant',
            details: `uber_store_id: ${uberStoreId}`
          });
          continue;
        }

        const payoutDate = parseDate(payoutDateStr);
        if (!payoutDate) {
          results.skipped++;
          skippedDetails.push({
            rowIndex: rowNumber,
            reason: 'invalid_date',
            details: `Invalid payout date: ${payoutDateStr}`
          });
          continue;
        }

        // Track date range
        if (!minDate || payoutDate < minDate) minDate = payoutDate;
        if (!maxDate || payoutDate > maxDate) maxDate = payoutDate;

        // Track restaurant stats
        const orderCount = parseInteger(getValue('order_count'));
        if (restaurantStats.has(restaurant.id)) {
          const stat = restaurantStats.get(restaurant.id)!;
          stat.orderCount += orderCount;
        } else {
          restaurantStats.set(restaurant.id, {
            id: restaurant.id,
            name: restaurant.name,
            orderCount: orderCount
          });
        }

        const payoutData = {
          restaurant_id: restaurant.id,
          payout_reference_id: payoutReferenceId,
          payout_date: payoutDate,
          uber_store_id: uberStoreId,
          order_count: orderCount,
          other_payments_count: parseInteger(getValue('other_payments_count')),
          sales_excl_vat: parseNumber(getValue('sales_excl_vat')),
          vat_1_sales: parseNumber(getValue('vat_1_sales')),
          vat_2_sales: parseNumber(getValue('vat_2_sales')),
          vat_3_sales: parseNumber(getValue('vat_3_sales')),
          sales_incl_vat: parseNumber(getValue('sales_incl_vat')),
          refund_excl_vat: parseNumber(getValue('refund_excl_vat')),
          vat_refund: parseNumber(getValue('vat_refund')),
          refund_incl_vat: parseNumber(getValue('refund_incl_vat')),
          item_promo_excl_vat: parseNumber(getValue('item_promo_excl_vat')),
          vat_1_item_promo: parseNumber(getValue('vat_1_item_promo')),
          vat_2_item_promo: parseNumber(getValue('vat_2_item_promo')),
          vat_3_item_promo: parseNumber(getValue('vat_3_item_promo')),
          item_promo_incl_vat: parseNumber(getValue('item_promo_incl_vat')),
          marketing_fee_adjustment: parseNumber(getValue('marketing_fee_adjustment')),
          meal_voucher_amount: parseNumber(getValue('meal_voucher_amount')),
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
          delivery_cost_excl_vat: parseNumber(getValue('delivery_cost_excl_vat')),
          vat_delivery_cost: parseNumber(getValue('vat_delivery_cost')),
          delivery_cost_incl_vat: parseNumber(getValue('delivery_cost_incl_vat')),
          uber_fee_before_promo_excl_vat: parseNumber(getValue('uber_fee_before_promo_excl_vat')),
          uber_fee_promo_excl_vat: parseNumber(getValue('uber_fee_promo_excl_vat')),
          uber_fee_after_promo_excl_vat: parseNumber(getValue('uber_fee_after_promo_excl_vat')),
          vat_uber_fee: parseNumber(getValue('vat_uber_fee')),
          uber_fee_after_promo_incl_vat: parseNumber(getValue('uber_fee_after_promo_incl_vat')),
          vat_adjustment: parseNumber(getValue('vat_adjustment')),
          delivery_fee_gain: parseNumber(getValue('delivery_fee_gain')),
          tips: parseNumber(getValue('tips')),
          other_payments_incl_vat: parseNumber(getValue('other_payments_incl_vat')),
          net_payout: parseNumber(getValue('net_payout')),
        };

        if (dryRun) {
          // Just accumulate for validation
          payoutsToInsert.push(payoutData);
          results.inserted++;
        } else {
          // Upsert payout
          const { error: upsertError } = await supabase
            .from('payouts')
            .upsert(payoutData, { 
              onConflict: 'restaurant_id,payout_reference_id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`Error upserting payout row ${rowNumber}:`, upsertError);
            results.errors++;
            skippedDetails.push({
              rowIndex: rowNumber,
              reason: 'database_error',
              details: upsertError.message
            });
          } else {
            results.inserted++;
          }
        }
      } catch (err) {
        console.error(`Error processing row ${rowNumber}:`, err);
        results.errors++;
        skippedDetails.push({
          rowIndex: rowNumber,
          reason: 'processing_error',
          details: String(err)
        });
      }
    }

    console.log('Processing complete:', results);

    // Build response in expected format
    const response = {
      success: true,
      dryRun,
      reportType: 'payout_summary',
      stats: {
        totalRows: results.totalRows,
        inserted: results.inserted,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors,
      },
      validation: {
        dateRange: {
          start: minDate,
          end: maxDate,
        },
        restaurants: Array.from(restaurantStats.values()),
        unknownStoreIds: Array.from(unknownStoreIds),
        skippedDetails,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-payout-summary:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
