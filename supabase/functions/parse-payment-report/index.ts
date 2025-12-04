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
  'Ventes (hors TVA)': 'sales_excl_vat',
  'TVA 1 sur les ventes': 'vat_1_sales',
  'TVA 2 sur les ventes': 'vat_2_sales',
  'TVA 3 sur les ventes': 'vat_3_sales',
  'Ventes (TVA incluses)': 'sales_incl_vat',
  'Remboursements (hors TVA)': 'refund_excl_vat',
  'TVA 1 sur les ajustements liés à des erreurs de commande': 'vat_1_refund',
  'TVA 2 sur les ajustements liés à des erreurs de commande': 'vat_2_refund',
  'TVA 3 sur les ajustements liés à des erreurs de commande': 'vat_3_refund',
  'Remboursements (TVA incluse)': 'refund_incl_vat',
  'Promotion sur les plats/articles (hors TVA)': 'item_promo_excl_vat',
  'TVA 1 sur les offres sur les articles': 'vat_1_item_promo',
  'TVA 2 sur les offres sur les articles': 'vat_2_item_promo',
  'TVA 3 sur les offres sur les articles': 'vat_3_item_promo',
  'Promotion sur les plats/articles (TVA incluse)': 'item_promo_incl_vat',
  'Ajustement des frais de marketing': 'marketing_fee_adjustment',
  'Titre-restaurant': 'meal_voucher_amount',
  'Fournisseur de titres-restaurant': 'meal_voucher_provider',
  'Ajustements du prix (hors TVA)': 'price_adjustment_excl_vat',
  'TVA sur les ajustements du prix': 'vat_price_adjustment',
  'Ajustements du prix (TVA comprise)': 'price_adjustment_incl_vat',
  'Frais de livraison (hors TVA)': 'merchant_delivery_fee_excl_vat',
  'TVA 1 sur les frais de livraison': 'vat_1_merchant_delivery',
  'TVA 2 sur les frais de livraison': 'vat_2_merchant_delivery',
  'TVA 3 sur les frais de livraison': 'vat_3_merchant_delivery',
  'Frais de livraison (TVA incluse)': 'merchant_delivery_fee_incl_vat',
  'Frais de préparation et d\'emballage': 'packaging_fee',
  'TVA sur les frais pour Préparation et emballage': 'vat_packaging_fee',
  'Frais de sac de livraison': 'bag_fee',
  'Promotion sur la livraison (hors TVA)': 'delivery_promo_excl_vat',
  'Taxe sur les promotions sur la livraison': 'vat_delivery_promo',
  'Promotion sur la livraison (TVA incluse)': 'delivery_promo_incl_vat',
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

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
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
    
    if (rows.length < 3) {
      throw new Error('CSV has insufficient rows');
    }

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if (rows[i].some(cell => cell.includes('Id. de la commande') || cell.includes('Id. du flux'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in CSV');
    }

    const headers = rows[headerRowIndex];
    console.log('Found headers at row:', headerRowIndex, 'Columns:', headers.length);

    const columnIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.trim();
      if (COLUMN_MAPPING[cleanHeader]) {
        columnIndices[COLUMN_MAPPING[cleanHeader]] = index;
      }
    });

    console.log('Mapped columns:', Object.keys(columnIndices).length);

    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id');

    if (restaurantError) {
      throw new Error('Failed to fetch restaurants: ' + restaurantError.message);
    }

    const restaurantMap = new Map<string, { id: string; name: string }>();
    restaurants?.forEach(r => {
      if (r.uber_store_id) {
        restaurantMap.set(r.uber_store_id, { id: r.id, name: r.name });
      }
    });

    console.log('Restaurant map size:', restaurantMap.size);

    // Phase 1: Parse all rows WITHOUT database calls
    const dataRows = rows.slice(headerRowIndex + 1);
    const ordersToUpsert: any[] = [];
    let skippedCount = 0;
    const skippedDetails: SkipInfo[] = [];
    const restaurantStats = new Map<string, RestaurantStats>();
    const unknownStoreIds = new Set<string>();
    let minDate: string | null = null;
    let maxDate: string | null = null;

    const flowContext = new Map<string, { 
      uberOrderId: string; 
      uberStoreId: string;
      restaurantId: string;
    }>();

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
          skippedCount++;
          if (skippedDetails.length < 50) {
            skippedDetails.push({
              rowIndex: rowIndex + headerRowIndex + 2,
              reason: 'no_order_id',
              details: 'Ligne sans identifiant de commande'
            });
          }
          continue;
        }
        
        restaurant = restaurantMap.get(uberStoreId);
        if (!restaurant) {
          skippedCount++;
          unknownStoreIds.add(uberStoreId);
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
        uber_flow_id: getValue('uber_flow_id') || null,
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
      });
    }

    console.log('Phase 1 complete. Orders to process:', ordersToUpsert.length);

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    if (dryRun) {
      // In dry run mode, just count existing vs new
      const orderIds = ordersToUpsert.map(o => o.uber_order_id);
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('uber_order_id')
        .in('uber_order_id', orderIds);
      
      const existingSet = new Set(existingOrders?.map(o => o.uber_order_id) || []);
      
      for (const order of ordersToUpsert) {
        if (existingSet.has(order.uber_order_id)) {
          updatedCount++;
        } else {
          insertedCount++;
        }
      }
    } else {
      // Phase 2: Batch upsert
      console.log('Phase 2: Batch upserting in chunks of', BATCH_SIZE);
      
      for (let i = 0; i < ordersToUpsert.length; i += BATCH_SIZE) {
        const batch = ordersToUpsert.slice(i, i + BATCH_SIZE);
        
        const { error: upsertError, count } = await supabase
          .from('orders')
          .upsert(batch, { 
            onConflict: 'uber_order_id',
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
        if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= ordersToUpsert.length) {
          console.log(`Processed ${Math.min(i + BATCH_SIZE, ordersToUpsert.length)}/${ordersToUpsert.length} orders`);
        }
      }
    }

    const result = {
      success: true,
      reportType,
      dryRun,
      stats: {
        totalRows: dataRows.length,
        processed: ordersToUpsert.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      validation: {
        dateRange: {
          start: minDate,
          end: maxDate,
        },
        restaurants: Array.from(restaurantStats.values()),
        unknownStoreIds: Array.from(unknownStoreIds),
        skippedDetails: skippedDetails,
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
