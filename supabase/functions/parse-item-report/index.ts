import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Column mapping from French CSV headers to database fields
const COLUMN_MAPPING: Record<string, string> = {
  // Order identifiers
  "ID de commande Uber Eats": "uber_order_id",
  "ID du flux de travail": "uber_flow_id",
  
  // Item details
  "Nom du plat/de l'article": "item_title",
  "ID des données externes": "external_data",
  "Vendu par": "sold_by_unit",
  "Poids estimé (g)": "estimated_weight",
  "Poids demandé (g)": "requested_weight",
  "Poids final (g)": "final_weight",
  "Nb demandé": "requested_count",
  "Nb final": "final_count",
  "Qté demandée": "requested_quantity",
  "Qté finale": "final_quantity",
  
  // Item sales
  "Ventes HT (articles)": "sales_excl_vat",
  "TVA n° 1 (ventes d'articles)": "vat_1_sales",
  "TVA n° 2 (ventes d'articles)": "vat_2_sales",
  "TVA n° 3 (ventes d'articles)": "vat_3_sales",
  "Ventes TTC (articles)": "sales_incl_vat",
  
  // Item refunds
  "Remb. HT (articles)": "refund_excl_vat",
  "TVA n° 1 (remb. d'articles)": "vat_1_refund",
  "TVA n° 2 (remb. d'articles)": "vat_2_refund",
  "TVA n° 3 (remb. d'articles)": "vat_3_refund",
  "Remb. TTC (articles)": "refund_incl_vat",
  
  // Item promotions
  "Promo. articles HT": "item_promo_excl_vat",
  "TVA n° 1 (promo. sur les articles)": "vat_1_item_promo",
  "TVA n° 2 (promo. sur les articles)": "vat_2_item_promo",
  "TVA n° 3 (promo. sur les articles)": "vat_3_item_promo",
  "Promo. articles TTC": "item_promo_incl_vat",
};

function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
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
        currentLine.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentField.trim());
        if (currentLine.some(field => field !== '')) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some(field => field !== '')) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function parseNumber(value: string): number {
  if (!value || value === '' || value === '-') return 0;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[€$]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseInteger(value: string): number | null {
  if (!value || value === '' || value === '-') return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, reportType } = await req.json();

    if (!csvContent) {
      throw new Error('CSV content is required');
    }

    console.log('Parsing item-level report CSV...');
    const rows = parseCSV(csvContent);
    
    if (rows.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Find header row (contains "ID de commande Uber Eats")
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (rows[i].some(cell => cell.includes('ID de commande Uber Eats'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with "ID de commande Uber Eats"');
    }

    const headers = rows[headerRowIndex];
    console.log(`Found ${headers.length} columns, processing data rows...`);

    // Map headers to column indices
    const columnIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const dbField = COLUMN_MAPPING[header];
      if (dbField) {
        columnIndices[dbField] = index;
      }
    });

    console.log('Mapped columns:', Object.keys(columnIndices));

    // Process data rows - only items with a name
    const itemsToUpsert: any[] = [];
    let currentUberOrderId = '';
    let currentUberFlowId = '';
    let skippedRows = 0;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 5) continue;

      // Get uber_order_id and uber_flow_id (they might be on summary rows)
      const rowUberOrderId = columnIndices['uber_order_id'] !== undefined 
        ? row[columnIndices['uber_order_id']]?.trim() 
        : '';
      const rowUberFlowId = columnIndices['uber_flow_id'] !== undefined 
        ? row[columnIndices['uber_flow_id']]?.trim() 
        : '';

      // Update current order IDs if present
      if (rowUberOrderId) currentUberOrderId = rowUberOrderId;
      if (rowUberFlowId) currentUberFlowId = rowUberFlowId;

      // Check if this row has an item name
      const itemTitle = columnIndices['item_title'] !== undefined 
        ? row[columnIndices['item_title']]?.trim() 
        : '';

      if (!itemTitle) {
        skippedRows++;
        continue;
      }

      // This is an item row, extract all data
      const itemData: any = {
        uber_order_id: currentUberOrderId,
        uber_flow_id: currentUberFlowId,
        item_title: itemTitle,
        item_id: columnIndices['external_data'] !== undefined 
          ? row[columnIndices['external_data']]?.trim() || `item_${i}` 
          : `item_${i}`,
        external_data: columnIndices['external_data'] !== undefined 
          ? row[columnIndices['external_data']]?.trim() 
          : null,
        sold_by_unit: columnIndices['sold_by_unit'] !== undefined 
          ? row[columnIndices['sold_by_unit']]?.trim() 
          : null,
        
        // Weight/count fields
        estimated_weight: parseNumber(row[columnIndices['estimated_weight']] || ''),
        requested_weight: parseNumber(row[columnIndices['requested_weight']] || ''),
        final_weight: parseNumber(row[columnIndices['final_weight']] || ''),
        requested_count: parseInteger(row[columnIndices['requested_count']] || ''),
        final_count: parseInteger(row[columnIndices['final_count']] || ''),
        requested_quantity: parseInteger(row[columnIndices['requested_quantity']] || ''),
        final_quantity: parseInteger(row[columnIndices['final_quantity']] || ''),
        quantity: parseInteger(row[columnIndices['final_quantity']] || '') || 1,
        
        // Sales
        sales_excl_vat: parseNumber(row[columnIndices['sales_excl_vat']] || ''),
        vat_1_sales: parseNumber(row[columnIndices['vat_1_sales']] || ''),
        vat_2_sales: parseNumber(row[columnIndices['vat_2_sales']] || ''),
        vat_3_sales: parseNumber(row[columnIndices['vat_3_sales']] || ''),
        sales_incl_vat: parseNumber(row[columnIndices['sales_incl_vat']] || ''),
        
        // Refunds
        refund_excl_vat: parseNumber(row[columnIndices['refund_excl_vat']] || ''),
        vat_1_refund: parseNumber(row[columnIndices['vat_1_refund']] || ''),
        vat_2_refund: parseNumber(row[columnIndices['vat_2_refund']] || ''),
        vat_3_refund: parseNumber(row[columnIndices['vat_3_refund']] || ''),
        refund_incl_vat: parseNumber(row[columnIndices['refund_incl_vat']] || ''),
        
        // Promotions
        item_promo_excl_vat: parseNumber(row[columnIndices['item_promo_excl_vat']] || ''),
        vat_1_item_promo: parseNumber(row[columnIndices['vat_1_item_promo']] || ''),
        vat_2_item_promo: parseNumber(row[columnIndices['vat_2_item_promo']] || ''),
        vat_3_item_promo: parseNumber(row[columnIndices['vat_3_item_promo']] || ''),
        item_promo_incl_vat: parseNumber(row[columnIndices['item_promo_incl_vat']] || ''),
        
        // Calculated fields
        unit_price: parseNumber(row[columnIndices['sales_excl_vat']] || ''),
        total_price: parseNumber(row[columnIndices['sales_incl_vat']] || ''),
        tax_amount: parseNumber(row[columnIndices['vat_1_sales']] || '') + 
                    parseNumber(row[columnIndices['vat_2_sales']] || '') +
                    parseNumber(row[columnIndices['vat_3_sales']] || ''),
        
        // Import tracking
        imported_from_report: true,
        report_import_date: new Date().toISOString(),
      };

      itemsToUpsert.push(itemData);
    }

    console.log(`Found ${itemsToUpsert.length} items to process, ${skippedRows} summary rows skipped`);

    // Get unique uber_flow_ids to fetch order_ids
    const uniqueFlowIds = [...new Set(itemsToUpsert.map(item => item.uber_flow_id).filter(Boolean))];
    console.log(`Looking up ${uniqueFlowIds.length} unique flow IDs...`);

    // Fetch existing orders to get order_id mapping
    const { data: existingOrders, error: orderError } = await supabase
      .from('orders')
      .select('id, uber_flow_id, uber_order_id')
      .in('uber_flow_id', uniqueFlowIds);

    if (orderError) {
      console.error('Error fetching orders:', orderError);
    }

    // Create mapping from uber_flow_id to order_id
    const flowIdToOrderId: Record<string, string> = {};
    const orderIdToUberOrderId: Record<string, string> = {};
    
    if (existingOrders) {
      existingOrders.forEach(order => {
        if (order.uber_flow_id) {
          flowIdToOrderId[order.uber_flow_id] = order.id;
          orderIdToUberOrderId[order.uber_flow_id] = order.uber_order_id;
        }
      });
    }

    console.log(`Found ${Object.keys(flowIdToOrderId).length} matching orders`);

    // Process items in batches
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let orphanCount = 0;
    const errors: { row: number; error: string }[] = [];

    const batchSize = 100;
    for (let i = 0; i < itemsToUpsert.length; i += batchSize) {
      const batch = itemsToUpsert.slice(i, i + batchSize);
      
      for (const item of batch) {
        const orderId = flowIdToOrderId[item.uber_flow_id];
        
        if (!orderId) {
          orphanCount++;
          continue;
        }

        // Prepare the record for upsert
        const record = {
          order_id: orderId,
          ...item,
        };

        // Check if item already exists
        const { data: existingItem } = await supabase
          .from('order_items')
          .select('id')
          .eq('order_id', orderId)
          .eq('item_id', item.item_id)
          .single();

        if (existingItem) {
          // Update existing
          const { error: updateError } = await supabase
            .from('order_items')
            .update(record)
            .eq('id', existingItem.id);

          if (updateError) {
            errorCount++;
            errors.push({ row: i, error: updateError.message });
          } else {
            updatedCount++;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('order_items')
            .insert(record);

          if (insertError) {
            errorCount++;
            errors.push({ row: i, error: insertError.message });
          } else {
            insertedCount++;
          }
        }
      }
    }

    const result = {
      success: true,
      reportType,
      stats: {
        totalItems: itemsToUpsert.length,
        inserted: insertedCount,
        updated: updatedCount,
        orphaned: orphanCount,
        errors: errorCount,
      },
      errors: errors.slice(0, 10),
      message: `Import terminé: ${insertedCount} articles insérés, ${updatedCount} mis à jour, ${orphanCount} orphelins (commande non trouvée), ${errorCount} erreurs`
    };

    console.log('Import result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in parse-item-report:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stats: { totalItems: 0, inserted: 0, updated: 0, orphaned: 0, errors: 1 }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
