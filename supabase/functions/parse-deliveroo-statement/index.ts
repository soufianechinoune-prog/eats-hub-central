import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Parse a Deliveroo payment statement CSV.
 * Handles multi-line Note fields and French decimal format.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, fileName, dryRun } = await req.json();

    if (!csvContent) {
      throw new Error('csvContent is required');
    }

    console.log(`Parsing Deliveroo statement: ${fileName || 'unknown'}`);

    // Step 1: Parse CSV with multi-line support
    const records = parseCSVWithMultiline(csvContent);
    console.log(`Total raw records: ${records.length}`);

    // Step 2: Detect sections and parse rows
    const parsedRows = extractRows(records, fileName || '');
    console.log(`Parsed rows: ${parsedRows.length}`);

    if (parsedRows.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
        restaurants: [],
        dateRange: { start: null, end: null },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 3: Resolve restaurants via deliveroo_store_id
    const uniqueNames = [...new Set(parsedRows.map(r => r.restaurant_name))];
    console.log(`Unique restaurant names: ${uniqueNames.join(', ')}`);

    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, deliveroo_store_id')
      .not('deliveroo_store_id', 'is', null);

    const nameToRestaurantId: Record<string, string> = {};
    const unmatchedNames: string[] = [];

    for (const csvName of uniqueNames) {
      const match = (restaurants || []).find(r => r.deliveroo_store_id === csvName);
      if (match) {
        nameToRestaurantId[csvName] = match.id;
      } else {
        unmatchedNames.push(csvName);
      }
    }

    if (unmatchedNames.length > 0) {
      console.warn(`Unmatched restaurant names: ${unmatchedNames.join(', ')}`);
    }

    // Step 4: Build records for upsert
    const dbRecords = parsedRows.map(row => ({
      restaurant_id: nameToRestaurantId[row.restaurant_name] || null,
      restaurant_name: row.restaurant_name,
      deliveroo_order_id: row.deliveroo_order_id || null,
      deliveroo_uuid: row.deliveroo_uuid || null,
      delivery_datetime: row.delivery_datetime || null,
      history_type: row.history_type,
      order_amount: row.order_amount,
      adjustment_amount: row.adjustment_amount,
      commission_rate: row.commission_rate || null,
      commission_amount: row.commission_amount,
      vat_rate: row.vat_rate,
      vat_amount: row.vat_amount,
      total_payable: row.total_payable,
      note: row.note || null,
      section: row.section,
      statement_file: row.statement_file,
    }));

    // Step 4.5: Deduplicate records to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueMap = new Map<string, typeof dbRecords[0]>();
    for (const record of dbRecords) {
      const key = `${record.deliveroo_uuid}|${record.history_type}|${record.delivery_datetime}`;
      uniqueMap.set(key, record);
    }
    const deduplicatedRecords = Array.from(uniqueMap.values());
    const duplicatesRemoved = dbRecords.length - deduplicatedRecords.length;
    if (duplicatesRemoved > 0) {
      console.log(`Deduplication: removed ${duplicatesRemoved} duplicate records`);
    }

    if (dryRun) {
      // Compute date range
      const dates = dbRecords
        .filter(r => r.delivery_datetime)
        .map(r => r.delivery_datetime!);
      dates.sort();

      // Build restaurant stats
      const restStats: Record<string, { id: string; name: string; count: number }> = {};
      for (const r of dbRecords) {
        const rid = r.restaurant_id || 'unknown';
        if (!restStats[rid]) {
          restStats[rid] = { id: rid, name: r.restaurant_name, count: 0 };
        }
        restStats[rid].count++;
      }

      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        stats: { totalRows: dbRecords.length, inserted: 0, updated: 0, skipped: 0, errors: 0 },
        restaurants: Object.values(restStats),
        unmatchedNames,
        dateRange: {
          start: dates[0] || null,
          end: dates[dates.length - 1] || null,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 5: Upsert in batches
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < deduplicatedRecords.length; i += BATCH_SIZE) {
      const batch = deduplicatedRecords.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from('deliveroo_orders')
        .upsert(batch, {
          onConflict: 'deliveroo_uuid,history_type,delivery_datetime',
          ignoreDuplicates: false,
        })
        .select('id');

      if (error) {
        console.error(`Batch ${i} error: ${error.message}`);
        errors += batch.length;
        errorDetails.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    // Compute date range
    const dates = deduplicatedRecords
      .filter(r => r.delivery_datetime)
      .map(r => r.delivery_datetime!);
    dates.sort();

    // Build restaurant stats
    const restStats: Record<string, { id: string; name: string; count: number }> = {};
    for (const r of deduplicatedRecords) {
      const rid = r.restaurant_id || 'unknown';
      if (!restStats[rid]) {
        restStats[rid] = { id: rid, name: r.restaurant_name, count: 0 };
      }
      restStats[rid].count++;
    }

    console.log(`Import done: ${inserted} inserted, ${errors} errors, ${duplicatesRemoved} duplicates removed`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalRows: dbRecords.length,
        inserted,
        updated,
        skipped,
        errors,
        duplicatesRemoved,
      },
      restaurants: Object.values(restStats),
      unmatchedNames,
      dateRange: {
        start: dates[0] || null,
        end: dates[dates.length - 1] || null,
      },
      errorDetails,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error parsing Deliveroo statement:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== CSV Parsing Helpers ==========

const SECTION_MARKERS: Record<string, string> = {
  'Orders and related adjustments': 'orders',
  'Payments for contested customer refunds': 'contested_refunds',
  'Other payments and fees': 'other_payments',
};

const HEADER_MARKER = 'Nom du restaurant';

interface ParsedDeliverooRow {
  restaurant_name: string;
  deliveroo_order_id: string;
  deliveroo_uuid: string;
  delivery_datetime: string | null;
  history_type: string;
  order_amount: number;
  adjustment_amount: number;
  commission_rate: string;
  commission_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_payable: number;
  note: string;
  section: string;
  statement_file: string;
}

/**
 * Parse CSV content handling multi-line fields (fields in quotes with newlines).
 * Returns an array of raw line strings, where each element is a complete CSV record.
 */
function parseCSVWithMultiline(content: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '""';
        i++;
      } else if (char === '"') {
        current += char;
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        current += char;
        inQuotes = true;
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (current.trim()) {
          records.push(current);
        }
        current = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        current += char;
      }
    }
  }
  if (current.trim()) {
    records.push(current);
  }
  return records;
}

/**
 * Parse a single CSV line into fields, handling quoted values.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse French decimal format: "15,50" -> 15.50, "-3,72" -> -3.72
 */
function parseFrenchDecimal(value: string | undefined): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract data rows from parsed CSV records, tracking sections.
 */
function extractRows(records: string[], fileName: string): ParsedDeliverooRow[] {
  const rows: ParsedDeliverooRow[] = [];
  let currentSection = 'orders';

  for (const record of records) {
    // Check if this is a section title
    let isSection = false;
    for (const [marker, sectionId] of Object.entries(SECTION_MARKERS)) {
      if (record.startsWith(marker)) {
        currentSection = sectionId;
        isSection = true;
        break;
      }
    }
    if (isSection) continue;

    // Skip header rows
    if (record.startsWith(HEADER_MARKER) || record.includes('Numéro de commande') && record.includes('Historique')) {
      continue;
    }

    // Parse data row
    const fields = parseCSVLine(record);
    if (fields.length < 11) continue;

    const restaurantName = fields[0];
    if (!restaurantName || restaurantName.trim() === '') continue;

    const deliverooOrderId = fields[1] || '';
    const datetimeStr = fields[2] || '';
    const historyType = fields[3] || '';
    const orderAmount = parseFrenchDecimal(fields[4]);
    const adjustmentAmount = parseFrenchDecimal(fields[5]);
    const commissionRate = fields[6] || '';
    const commissionAmount = parseFrenchDecimal(fields[7]);
    const vatRate = parseFrenchDecimal(fields[8]);
    const vatAmount = parseFrenchDecimal(fields[9]);
    const totalPayable = parseFrenchDecimal(fields[10]);
    const note = fields[11] || '';
    const deliverooUuid = fields[12] || '';

    // Parse datetime
    let deliveryDatetime: string | null = null;
    if (datetimeStr) {
      try {
        const d = new Date(datetimeStr);
        if (!isNaN(d.getTime())) {
          deliveryDatetime = d.toISOString();
        }
      } catch {
        // skip invalid dates
      }
    }

    if (!historyType) continue;

    rows.push({
      restaurant_name: restaurantName,
      deliveroo_order_id: deliverooOrderId,
      deliveroo_uuid: deliverooUuid,
      delivery_datetime: deliveryDatetime,
      history_type: historyType,
      order_amount: orderAmount,
      adjustment_amount: adjustmentAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_payable: totalPayable,
      note: note,
      section: currentSection,
      statement_file: fileName,
    });
  }

  return rows;
}
