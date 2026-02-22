import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Column mapping from French CSV headers to database fields
// Supports both old format and new Europe/Middle East/Africa format
const COLUMN_MAPPING: Record<string, string> = {
  // Order identifiers - Old format
  "ID de commande Uber Eats": "uber_order_id",
  "ID du flux de travail": "uber_flow_id",
  
  // Order identifiers - Europe/Middle East/Africa format
  "Id. de la commande": "uber_order_id",
  "Id. du flux": "uber_flow_id",
  "Id. du restaurant": "restaurant_id_uber",
  "Nom du restaurant": "restaurant_name",
  "Date de la commande": "order_date",
  
  // Item details - Both formats
  "Nom du plat/de l'article": "item_title",
  "Id. externe": "item_id",
  "ID des données externes": "external_data",
  "Données externes": "external_data",
  "Vendu par": "sold_by_unit",
  "Unité vendue par": "sold_by_unit",
  "Poids estimé (g)": "estimated_weight",
  "Poids moyen estimé": "estimated_weight",
  "Poids demandé (g)": "requested_weight",
  "Poids demandé": "requested_weight",
  "Poids final (g)": "final_weight",
  "Poids final": "final_weight",
  "Nb demandé": "requested_count",
  "Nombre demandé": "requested_count",
  "Nb final": "final_count",
  "Décompte final": "final_count",
  "Qté demandée": "requested_quantity",
  "Quantité demandée": "requested_quantity",
  "Qté finale": "final_quantity",
  "Quantité finale": "final_quantity",
  "prix à l'unité": "unit_price_raw",
  "Prix de l'article :": "item_price",
  
  // Item sales - Old format
  "Ventes HT (articles)": "sales_excl_vat",
  "TVA n° 1 (ventes d'articles)": "vat_1_sales",
  "TVA n° 2 (ventes d'articles)": "vat_2_sales",
  "TVA n° 3 (ventes d'articles)": "vat_3_sales",
  "Ventes TTC (articles)": "sales_incl_vat",
  
  // Item sales - Europe/Middle East/Africa format
  "Ventes (hors TVA)": "sales_excl_vat",
  "TVA 1 sur les ventes": "vat_1_sales",
  "TVA 2 sur les ventes": "vat_2_sales",
  "TVA 3 sur les ventes": "vat_3_sales",
  "Ventes (TVA incluses)": "sales_incl_vat",
  
  // Item refunds - Old format
  "Remb. HT (articles)": "refund_excl_vat",
  "TVA n° 1 (remb. d'articles)": "vat_1_refund",
  "TVA n° 2 (remb. d'articles)": "vat_2_refund",
  "TVA n° 3 (remb. d'articles)": "vat_3_refund",
  "Remb. TTC (articles)": "refund_incl_vat",
  
  // Item refunds - Europe/Middle East/Africa format
  "Remboursements (hors TVA)": "refund_excl_vat",
  "TVA 1 sur les ajustements liés à des erreurs de commande": "vat_1_refund",
  "TVA 2 sur les ajustements liés à des erreurs de commande": "vat_2_refund",
  "TVA 3 sur les ajustements liés à des erreurs de commande": "vat_3_refund",
  "Remboursements (TVA incluse)": "refund_incl_vat",
  
  // Item promotions - Old format
  "Promo. articles HT": "item_promo_excl_vat",
  "TVA n° 1 (promo. sur les articles)": "vat_1_item_promo",
  "TVA n° 2 (promo. sur les articles)": "vat_2_item_promo",
  "TVA n° 3 (promo. sur les articles)": "vat_3_item_promo",
  "Promo. articles TTC": "item_promo_incl_vat",
  
  // Item promotions - Europe/Middle East/Africa format
  "Promotion sur les plats/articles (hors TVA)": "item_promo_excl_vat",
  "TVA 1 sur les offres sur les articles": "vat_1_item_promo",
  "TVA 2 sur les offres sur les articles": "vat_2_item_promo",
  "TVA 3 sur les offres sur les articles": "vat_3_item_promo",
  "Promotion sur les plats/articles (TVA incluse)": "item_promo_incl_vat",
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

    const { csvContent, reportType, dryRun = false } = await req.json();

    if (!csvContent) {
      throw new Error('CSV content is required');
    }

    console.log(`Parsing item-level report CSV... (dryRun: ${dryRun})`);
    const rows = parseCSV(csvContent);
    
    if (rows.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Find header row (contains order ID column - supports both formats)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (rows[i].some(cell => cell.includes('Id. de la commande') || cell.includes('ID de commande Uber Eats'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with order ID column ("Id. de la commande" or "ID de commande Uber Eats")');
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

    // GUARDRAIL: Check if this file has item_title column
    // If not, it's likely an order-level file sent to the wrong parser
    const hasItemTitleColumn = columnIndices['item_title'] !== undefined;
    
    if (!hasItemTitleColumn) {
      console.warn('WRONG PARSER: This file does not contain item-level columns (item_title missing). Should use parse-payment-report.');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'wrong_report_type',
          reportType: 'payment_item_level',
          message: "Ce fichier ne contient pas de données par article (colonne 'Nom du plat/de l'article' absente). Utilisez 'Informations de paiement (niveau commande)' pour l'importer correctement.",
          stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
          suggestion: {
            correctType: 'payment_order_level',
            correctLabel: 'Informations de paiement (niveau commande)',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
      // For item_id: prefer 'item_id' (Id. externe) column, fallback to 'external_data'
      const extractedItemId = columnIndices['item_id'] !== undefined 
        ? row[columnIndices['item_id']]?.trim()
        : (columnIndices['external_data'] !== undefined 
          ? row[columnIndices['external_data']]?.trim() 
          : null);
          
      const itemData: any = {
        uber_order_id: currentUberOrderId,
        uber_flow_id: currentUberFlowId,
        item_title: itemTitle,
        item_id: extractedItemId || `item_${i}`,
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

    // Extract order dates from items for better error messages
    const orderDates: string[] = [];
    const orderDateIdx = columnIndices['order_date'];
    if (orderDateIdx !== undefined) {
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const dateStr = rows[i][orderDateIdx]?.trim();
        if (dateStr) orderDates.push(dateStr);
      }
    }

    // Get unique uber_flow_ids to fetch order_ids
    const uniqueFlowIds = [...new Set(itemsToUpsert.map(item => item.uber_flow_id).filter(Boolean))];
    console.log(`Looking up ${uniqueFlowIds.length} unique flow IDs...`);

    // Chunk the flow IDs to avoid URL too long errors
    const LOOKUP_CHUNK_SIZE = 20;
    const flowIdChunks: string[][] = [];
    for (let j = 0; j < uniqueFlowIds.length; j += LOOKUP_CHUNK_SIZE) {
      flowIdChunks.push(uniqueFlowIds.slice(j, j + LOOKUP_CHUNK_SIZE));
    }

    console.log(`Fetching orders in ${flowIdChunks.length} chunks of max ${LOOKUP_CHUNK_SIZE}...`);

    let allExistingOrders: { id: string; uber_flow_id: string; uber_order_id: string; restaurant_id: string }[] = [];
    for (const chunk of flowIdChunks) {
      let chunkSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data: chunkOrders, error: chunkError } = await supabase
          .from('orders')
          .select('id, uber_flow_id, uber_order_id, restaurant_id')
          .in('uber_flow_id', chunk);
        
        if (!chunkError && chunkOrders) {
          allExistingOrders = allExistingOrders.concat(chunkOrders);
          chunkSuccess = true;
          break;
        }
        
        console.warn(`Lookup chunk attempt ${attempt}/3 failed: ${chunkError?.message}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
      if (!chunkSuccess) {
        console.error('Lookup chunk failed after 3 attempts, continuing...');
      }
      // Delay between lookup chunks to reduce DB pressure
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`Found ${allExistingOrders.length} matching orders from chunks`);
    const existingOrders = allExistingOrders;

    // Create mapping from uber_flow_id to order_id and restaurant_id
    const flowIdToOrderId: Record<string, string> = {};
    const orderIdToUberOrderId: Record<string, string> = {};
    const flowIdToRestaurantId: Record<string, string> = {};
    
    if (existingOrders) {
      existingOrders.forEach(order => {
        if (order.uber_flow_id) {
          flowIdToOrderId[order.uber_flow_id] = order.id;
          orderIdToUberOrderId[order.uber_flow_id] = order.uber_order_id;
          flowIdToRestaurantId[order.uber_flow_id] = order.restaurant_id;
        }
      });
    }

    console.log(`Found ${Object.keys(flowIdToOrderId).length} matching orders`);

    // Collect orphan flow IDs for detailed error reporting
    const orphanFlowIds: string[] = [];
    const foundFlowIds = new Set(Object.keys(flowIdToOrderId));
    
    for (const flowId of uniqueFlowIds) {
      if (!foundFlowIds.has(flowId)) {
        orphanFlowIds.push(flowId);
      }
    }

    // Parse date range from order dates
    let dateRangeStart: string | null = null;
    let dateRangeEnd: string | null = null;
    
    if (orderDates.length > 0) {
      const parsedDates = orderDates
        .map(d => {
          // Parse DD/MM/YYYY format
          const match = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (match) {
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          }
          return null;
        })
        .filter(Boolean)
        .sort();
      
      if (parsedDates.length > 0) {
        dateRangeStart = parsedDates[0]!;
        dateRangeEnd = parsedDates[parsedDates.length - 1]!;
      }
    }

    // For dry run, simulate what would happen
    if (dryRun) {
      let wouldInsert = 0;
      let wouldUpdate = 0;
      let orphanCount = 0;

      // Get existing items for all orders in batches
      const orderIds = Object.values(flowIdToOrderId);
      const existingItemsMap: Record<string, Set<string>> = {};

      if (orderIds.length > 0) {
        const orderIdChunks: string[][] = [];
        for (let j = 0; j < orderIds.length; j += LOOKUP_CHUNK_SIZE) {
          orderIdChunks.push(orderIds.slice(j, j + LOOKUP_CHUNK_SIZE));
        }

        for (const chunk of orderIdChunks) {
          const { data: existingItems } = await supabase
            .from('order_items')
            .select('order_id, item_id')
            .in('order_id', chunk);

          if (existingItems) {
            for (const item of existingItems) {
              if (!existingItemsMap[item.order_id]) {
                existingItemsMap[item.order_id] = new Set();
              }
              existingItemsMap[item.order_id].add(item.item_id);
            }
          }
        }
      }

      for (const item of itemsToUpsert) {
        const orderId = flowIdToOrderId[item.uber_flow_id];
        
        if (!orderId) {
          orphanCount++;
          continue;
        }

        const existingItemIds = existingItemsMap[orderId];
        if (existingItemIds && existingItemIds.has(item.item_id)) {
          wouldUpdate++;
        } else {
          wouldInsert++;
        }
      }

      // Build detailed orphan info for UI
      const orphanInfo = orphanCount > 0 ? {
        count: orphanCount,
        missingFlowIds: orphanFlowIds.slice(0, 10),
        totalMissingFlowIds: orphanFlowIds.length,
        dateRange: {
          start: dateRangeStart,
          end: dateRangeEnd,
        },
        recommendation: "Importez d'abord le fichier 'Récapitulatif de paiement' (niveau commande) pour la même période avant d'importer ce fichier articles.",
      } : null;

      const result = {
        success: true,
        reportType: "payment_item_level",
        stats: {
          totalRows: itemsToUpsert.length,
          totalItems: itemsToUpsert.length,
          inserted: wouldInsert,
          updated: wouldUpdate,
        skipped: orphanCount + skippedRows,
        orphaned: orphanCount,
        errors: 0,
        },
        orphanInfo,
        message: orphanCount > 0 
          ? `⚠️ ${orphanCount} articles orphelins détectés - commandes parentes introuvables (période: ${dateRangeStart || '?'} → ${dateRangeEnd || '?'}). Importez d'abord le Récapitulatif de paiement.`
          : `Validation: ${wouldInsert} articles à insérer, ${wouldUpdate} à mettre à jour`
      };

      console.log('Dry run result:', result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare all records with order_id (filter orphans)
    // Deduplicate by order_id + item_id to avoid "cannot affect row a second time" error
    const recordsMap = new Map<string, any>();
    let orphanCount = 0;
    let duplicateCount = 0;
    
    for (const item of itemsToUpsert) {
      const orderId = flowIdToOrderId[item.uber_flow_id];
      
      if (!orderId) {
        orphanCount++;
        continue;
      }
      
      const restaurantId = flowIdToRestaurantId[item.uber_flow_id];
      const key = `${orderId}::${item.item_id}`;
      
      // Keep the last occurrence (or merge values if needed)
      if (recordsMap.has(key)) {
        duplicateCount++;
        // Merge quantities and amounts for duplicate items
        const existing = recordsMap.get(key);
        existing.quantity = (existing.quantity || 0) + (item.quantity || 1);
        existing.sales_incl_vat = (existing.sales_incl_vat || 0) + (item.sales_incl_vat || 0);
        existing.sales_excl_vat = (existing.sales_excl_vat || 0) + (item.sales_excl_vat || 0);
        existing.refund_incl_vat = (existing.refund_incl_vat || 0) + (item.refund_incl_vat || 0);
        existing.total_price = (existing.total_price || 0) + (item.total_price || 0);
      } else {
        recordsMap.set(key, {
          order_id: orderId,
          restaurant_id: restaurantId,
          ...item,
        });
      }
    }

    const recordsToUpsert = Array.from(recordsMap.values());
    console.log(`Prepared ${recordsToUpsert.length} unique records for batch upsert, ${orphanCount} orphans, ${duplicateCount} duplicates merged`);

    // Batch upsert with parallel processing (2 concurrent batches)
    const BATCH_SIZE = 25;
    const CONCURRENCY = 1;
    const INTER_BATCH_DELAY = 500;
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: { batch: number; error: string }[] = [];

    // Helper: upsert a single batch with retry
    async function upsertWithRetry(batch: any[], batchIndex: number, maxRetries = 3): Promise<{ success: boolean; count: number }> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const { error: upsertError } = await supabase
          .from('order_items')
          .upsert(batch, { 
            onConflict: 'order_id,item_id',
            ignoreDuplicates: false 
          });

        if (!upsertError) {
          if (attempt > 1) {
            console.log(`Batch ${batchIndex}: ${batch.length} items upserted (retry ${attempt})`);
          } else {
            console.log(`Batch ${batchIndex}: ${batch.length} items upserted`);
          }
          return { success: true, count: batch.length };
        }

        console.warn(`Batch ${batchIndex} attempt ${attempt}/${maxRetries} failed: ${upsertError.message}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else {
          console.error(`Batch ${batchIndex} failed after ${maxRetries} attempts`);
          errors.push({ batch: batchIndex, error: upsertError.message });
          return { success: false, count: batch.length };
        }
      }
      return { success: false, count: 0 };
    }

    // Process batches in pairs (CONCURRENCY = 2)
    for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE * CONCURRENCY) {
      const batchPromises: Promise<{ success: boolean; count: number }>[] = [];
      
      for (let c = 0; c < CONCURRENCY; c++) {
        const start = i + c * BATCH_SIZE;
        if (start >= recordsToUpsert.length) break;
        const batch = recordsToUpsert.slice(start, start + BATCH_SIZE);
        const batchIndex = Math.floor(start / BATCH_SIZE);
        batchPromises.push(upsertWithRetry(batch, batchIndex));
      }
      
      const results = await Promise.all(batchPromises);
      for (const result of results) {
        if (result.success) {
          insertedCount += result.count;
        } else {
          errorCount += result.count;
        }
      }

      // Small delay between batch pairs to reduce DB pressure
      if (i + BATCH_SIZE * CONCURRENCY < recordsToUpsert.length) {
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
      }
    }

    // Build detailed orphan info for UI (also for real import)
    const orphanInfo = orphanCount > 0 ? {
      count: orphanCount,
      missingFlowIds: orphanFlowIds.slice(0, 10),
      totalMissingFlowIds: orphanFlowIds.length,
      dateRange: {
        start: dateRangeStart,
        end: dateRangeEnd,
      },
      recommendation: "Importez d'abord le fichier 'Récapitulatif de paiement' (niveau commande) pour la même période avant d'importer ce fichier articles.",
    } : null;

    const result = {
      success: true,
      reportType: "payment_item_level",
      stats: {
        totalRows: itemsToUpsert.length,
        totalItems: itemsToUpsert.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: orphanCount + skippedRows,
        orphaned: orphanCount,
        errors: errorCount,
      },
      orphanInfo,
      errors: errors.slice(0, 10),
      message: orphanCount > 0 
        ? `⚠️ Import partiel: ${insertedCount} articles insérés, ${updatedCount} mis à jour, ${orphanCount} orphelins (commandes parentes introuvables pour la période ${dateRangeStart || '?'} → ${dateRangeEnd || '?'})`
        : `Import terminé: ${insertedCount} articles insérés, ${updatedCount} mis à jour, ${errorCount} erreurs`
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
        stats: { totalRows: 0, totalItems: 0, inserted: 0, updated: 0, skipped: 0, orphaned: 0, errors: 1 }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
