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

// Parse CSV with proper handling of quoted fields
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

// Parse numeric value from French format
function parseNumber(value: string): number {
  if (!value || value === '') return 0;
  // French format uses comma as decimal separator
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse date from DD/MM/YYYY format
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr === '') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Parse datetime from combined date and time
function parseDateTime(dateStr: string, timeStr: string): string | null {
  const date = parseDate(dateStr);
  if (!date) return null;
  if (timeStr && timeStr.includes(':')) {
    return `${date}T${timeStr}:00`;
  }
  return `${date}T00:00:00`;
}

// Clean URL (remove backslash escapes)
function cleanUrl(url: string): string | null {
  if (!url || url === '') return null;
  return url.replace(/\\\\/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, reportType = 'payment_order_level' } = await req.json();

    if (!csvContent) {
      throw new Error('Missing csvContent in request body');
    }

    console.log('Parsing payment report, type:', reportType);
    console.log('CSV content length:', csvContent.length);

    // Parse CSV
    const rows = parseCSV(csvContent);
    
    if (rows.length < 3) {
      throw new Error('CSV has insufficient rows (needs header descriptions + headers + data)');
    }

    // The first row is descriptions, second is headers, data starts from third row
    // But in the actual file, it seems to be: row 0 = descriptions, row 1 = separator, row 2 = headers
    // Let's find the header row by looking for "Id. de la commande"
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
    console.log('Found headers at row:', headerRowIndex);
    console.log('Number of columns:', headers.length);

    // Map headers to column indices
    const columnIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.trim();
      if (COLUMN_MAPPING[cleanHeader]) {
        columnIndices[COLUMN_MAPPING[cleanHeader]] = index;
      }
    });

    console.log('Mapped columns:', Object.keys(columnIndices).length);

    // Get all restaurants for mapping by uber_store_id
    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id');

    if (restaurantError) {
      console.error('Error fetching restaurants:', restaurantError);
      throw new Error('Failed to fetch restaurants');
    }

    // Create lookup map by uber_store_id
    const restaurantMap = new Map<string, { id: string; name: string }>();
    restaurants?.forEach(r => {
      if (r.uber_store_id) {
        restaurantMap.set(r.uber_store_id, { id: r.id, name: r.name });
      }
    });

    console.log('Restaurant map size:', restaurantMap.size);

    // Process data rows
    const dataRows = rows.slice(headerRowIndex + 1);
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Context map to propagate uber_order_id and restaurant from parent rows to child rows
    // In Uber CSVs, multi-line orders have the order_id and store_id only on the first line
    // Subsequent lines with the same flow_id are child rows that belong to the same order
    const flowContext = new Map<string, { 
      uberOrderId: string; 
      uberStoreId: string;
      restaurantId: string;
    }>();

    for (const row of dataRows) {
      if (row.length < 5) continue; // Skip empty or malformed rows

      try {
        const getValue = (field: string): string => {
          const idx = columnIndices[field];
          return idx !== undefined ? row[idx] || '' : '';
        };

        const uberFlowId = getValue('uber_flow_id');
        let uberOrderId = getValue('uber_order_id');
        let uberStoreId = getValue('uber_store_id');
        let restaurant: { id: string; name: string } | undefined;
        
        // Check if this is a child row (has flow_id but no order_id)
        // If so, try to get context from the parent row
        if (uberFlowId && (!uberOrderId || uberOrderId === '')) {
          const context = flowContext.get(uberFlowId);
          if (context) {
            uberOrderId = context.uberOrderId;
            uberStoreId = context.uberStoreId;
            restaurant = { id: context.restaurantId, name: '' };
            console.log(`Propagated context for flow ${uberFlowId}: order=${uberOrderId}`);
          } else {
            // No context found for this flow_id, skip the row
            console.warn(`No context found for flow_id ${uberFlowId}, skipping child row`);
            skippedCount++;
            continue;
          }
        } else {
          // This is a parent row with order_id, look up the restaurant
          if (!uberOrderId || uberOrderId === '') {
            skippedCount++;
            continue;
          }
          
          restaurant = restaurantMap.get(uberStoreId);
          if (!restaurant) {
            console.warn('Restaurant not found for uber_store_id:', uberStoreId);
            skippedCount++;
            continue;
          }
          
          // Save context for potential child rows with the same flow_id
          if (uberFlowId) {
            flowContext.set(uberFlowId, {
              uberOrderId,
              uberStoreId,
              restaurantId: restaurant.id,
            });
          }
        }

        const orderDate = getValue('order_date');
        const orderTime = getValue('order_datetime');

        const orderData = {
          uber_order_id: uberOrderId,
          uber_flow_id: getValue('uber_flow_id') || null,
          restaurant_id: restaurant.id,
          order_datetime: parseDateTime(orderDate, orderTime),
          fulfillment_type: getValue('fulfillment_type') || null,
          payment_method: getValue('payment_method') || null,
          order_channel: getValue('order_channel') || null,
          uber_one_status: getValue('uber_one_status') || null,
          
          // Sales
          sales_excl_vat: parseNumber(getValue('sales_excl_vat')),
          vat_1_sales: parseNumber(getValue('vat_1_sales')),
          vat_2_sales: parseNumber(getValue('vat_2_sales')),
          vat_3_sales: parseNumber(getValue('vat_3_sales')),
          sales_incl_vat: parseNumber(getValue('sales_incl_vat')),
          gross_amount: parseNumber(getValue('sales_incl_vat')), // Map to existing field
          
          // Refunds
          refund_excl_vat: parseNumber(getValue('refund_excl_vat')),
          vat_1_refund: parseNumber(getValue('vat_1_refund')),
          vat_2_refund: parseNumber(getValue('vat_2_refund')),
          vat_3_refund: parseNumber(getValue('vat_3_refund')),
          refund_incl_vat: parseNumber(getValue('refund_incl_vat')),
          
          // Promotions
          item_promo_excl_vat: parseNumber(getValue('item_promo_excl_vat')),
          vat_1_item_promo: parseNumber(getValue('vat_1_item_promo')),
          vat_2_item_promo: parseNumber(getValue('vat_2_item_promo')),
          vat_3_item_promo: parseNumber(getValue('vat_3_item_promo')),
          item_promo_incl_vat: parseNumber(getValue('item_promo_incl_vat')),
          promotion_discount: Math.abs(parseNumber(getValue('item_promo_incl_vat'))), // Map to existing
          
          // Marketing
          marketing_fee_adjustment: parseNumber(getValue('marketing_fee_adjustment')),
          meal_voucher_amount: parseNumber(getValue('meal_voucher_amount')),
          meal_voucher_provider: getValue('meal_voucher_provider') || null,
          
          // Price adjustments
          price_adjustment_excl_vat: parseNumber(getValue('price_adjustment_excl_vat')),
          vat_price_adjustment: parseNumber(getValue('vat_price_adjustment')),
          price_adjustment_incl_vat: parseNumber(getValue('price_adjustment_incl_vat')),
          
          // Merchant delivery
          merchant_delivery_fee_excl_vat: parseNumber(getValue('merchant_delivery_fee_excl_vat')),
          vat_1_merchant_delivery: parseNumber(getValue('vat_1_merchant_delivery')),
          vat_2_merchant_delivery: parseNumber(getValue('vat_2_merchant_delivery')),
          vat_3_merchant_delivery: parseNumber(getValue('vat_3_merchant_delivery')),
          merchant_delivery_fee_incl_vat: parseNumber(getValue('merchant_delivery_fee_incl_vat')),
          
          // Packaging
          packaging_fee: parseNumber(getValue('packaging_fee')),
          vat_packaging_fee: parseNumber(getValue('vat_packaging_fee')),
          bag_fee: parseNumber(getValue('bag_fee')),
          
          // Delivery promo
          delivery_promo_excl_vat: parseNumber(getValue('delivery_promo_excl_vat')),
          vat_delivery_promo: parseNumber(getValue('vat_delivery_promo')),
          delivery_promo_incl_vat: parseNumber(getValue('delivery_promo_incl_vat')),
          
          // Order total
          order_total_incl_vat: parseNumber(getValue('order_total_incl_vat')),
          customer_invoice_url: cleanUrl(getValue('customer_invoice_url')),
          
          // Delivery cost
          delivery_cost_excl_vat: parseNumber(getValue('delivery_cost_excl_vat')),
          vat_delivery_cost: parseNumber(getValue('vat_delivery_cost')),
          delivery_cost_incl_vat: parseNumber(getValue('delivery_cost_incl_vat')),
          delivery_fee: parseNumber(getValue('delivery_cost_incl_vat')), // Map to existing
          courier_invoice_url: cleanUrl(getValue('courier_invoice_url')),
          
          // Uber fees
          uber_fee_before_promo_excl_vat: parseNumber(getValue('uber_fee_before_promo_excl_vat')),
          uber_fee_promo_excl_vat: parseNumber(getValue('uber_fee_promo_excl_vat')),
          uber_fee_after_promo_excl_vat: parseNumber(getValue('uber_fee_after_promo_excl_vat')),
          vat_uber_fee: parseNumber(getValue('vat_uber_fee')),
          uber_fee_after_promo_incl_vat: parseNumber(getValue('uber_fee_after_promo_incl_vat')),
          service_fee: Math.abs(parseNumber(getValue('uber_fee_after_promo_incl_vat'))), // Map to existing
          uber_invoice_url: cleanUrl(getValue('uber_invoice_url')),
          
          // Other
          vat_adjustment: parseNumber(getValue('vat_adjustment')),
          delivery_fee_gain: parseNumber(getValue('delivery_fee_gain')),
          tip_amount: parseNumber(getValue('tip_amount')),
          other_payments_description: getValue('other_payments_description') || null,
          other_payments_incl_vat: parseNumber(getValue('other_payments_incl_vat')),
          
          // Payout
          net_payout: parseNumber(getValue('net_payout')),
          net_amount: parseNumber(getValue('net_payout')), // Map to existing
          payout_date: parseDate(getValue('payout_date')),
          payout_reference_id: getValue('payout_reference_id') || null,
          loyalty_id: getValue('loyalty_id') || null,
          
          // Status mapping
          status: mapStatus(getValue('status')),
          
          // Calculate tax_amount (sum of all VAT)
          tax_amount: parseNumber(getValue('vat_1_sales')) + 
                      parseNumber(getValue('vat_2_sales')) + 
                      parseNumber(getValue('vat_3_sales')),
          
          // Import tracking
          imported_from_report: true,
          report_import_date: new Date().toISOString(),
          currency: 'EUR',
        };

        // Upsert order by uber_order_id + uber_flow_id (to handle refunds separately)
        // Build query with proper NULL handling for uber_flow_id
        let query = supabase
          .from('orders')
          .select('id')
          .eq('uber_order_id', uberOrderId);
        
        // Handle NULL flow_id properly - use .is() for null, .eq() for values
        if (orderData.uber_flow_id) {
          query = query.eq('uber_flow_id', orderData.uber_flow_id);
        } else {
          query = query.is('uber_flow_id', null);
        }
        
        const { data: existingOrder, error: checkError } = await query.maybeSingle();

        if (checkError) {
          console.error('Error checking existing order:', checkError);
          errorCount++;
          errors.push(`Order ${uberOrderId}: ${checkError.message}`);
          continue;
        }

        if (existingOrder) {
          // Update existing
          const { error: updateError } = await supabase
            .from('orders')
            .update(orderData)
            .eq('id', existingOrder.id);
          
          if (updateError) {
            console.error('Error updating order:', updateError);
            errorCount++;
            errors.push(`Order ${uberOrderId}: ${updateError.message}`);
          } else {
            updatedCount++;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('orders')
            .insert(orderData);
          
          if (insertError) {
            // Handle duplicate key error gracefully - treat as update needed
            if (insertError.code === '23505') {
              console.log(`Duplicate found for ${uberOrderId}, attempting update`);
              // Try to update by uber_order_id only
              const { error: fallbackUpdateError } = await supabase
                .from('orders')
                .update(orderData)
                .eq('uber_order_id', uberOrderId);
              
              if (fallbackUpdateError) {
                console.error('Error in fallback update:', fallbackUpdateError);
                errorCount++;
                errors.push(`Order ${uberOrderId}: ${fallbackUpdateError.message}`);
              } else {
                updatedCount++;
              }
            } else {
              console.error('Error inserting order:', insertError);
              errorCount++;
              errors.push(`Order ${uberOrderId}: ${insertError.message}`);
            }
          } else {
            insertedCount++;
          }
        }
      } catch (rowError: any) {
        console.error('Error processing row:', rowError);
        errorCount++;
        errors.push(`Row error: ${rowError.message}`);
      }
    }

    const result = {
      success: true,
      reportType,
      stats: {
        totalRows: dataRows.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      errorDetails: errors.slice(0, 10), // Return first 10 errors
    };

    console.log('Import completed:', result);

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

// Map French status to standardized status
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
