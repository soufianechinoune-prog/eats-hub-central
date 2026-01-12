import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse French date formats like "21 janv. 2025" or "27/04/2021"
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr === "-" || dateStr === "Ongoing") return null;
  
  // Normalize: remove quotes, trim
  const cleaned = dateStr.replace(/"/g, "").trim();
  
  // Extended month mapping with accent variants
  const frenchMonths: Record<string, string> = {
    "janv.": "01", "janv": "01",
    "fevr.": "02", "févr.": "02", "fevr": "02", "févr": "02",
    "mars": "03",
    "avr.": "04", "avr": "04",
    "mai": "05",
    "juin": "06",
    "juil.": "07", "juil": "07",
    "aout": "08", "août": "08",
    "sept.": "09", "sept": "09",
    "oct.": "10", "oct": "10",
    "nov.": "11", "nov": "11",
    "dec.": "12", "déc.": "12", "dec": "12", "déc": "12"
  };
  
  // Format: "21 janv. 2025" - use broader regex to capture accented chars
  const frenchMatch = cleaned.match(/(\d{1,2})\s+([a-zA-ZÀ-ÿ]+\.?)\s+(\d{4})/);
  if (frenchMatch) {
    const [, day, month, year] = frenchMatch;
    const monthLower = month.toLowerCase();
    // Try direct match, then normalized (accent-free) match
    const monthNormalized = monthLower
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // Remove accents
    
    const monthNum = frenchMonths[monthLower] || 
                     frenchMonths[monthNormalized] ||
                     frenchMonths[month];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, "0")}`;
    }
  }
  
  // Format: "27/04/2021"
  const slashMatch = cleaned.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function parseNumber(value: string): number | null {
  if (!value || value === "-") return null;
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      if (char === "\r") i++;
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function detectCsvType(headers: string[]): "offers" | "ads" | null {
  const headersLower = headers.map(h => h.toLowerCase());
  
  if (headersLower.some(h => h.includes("type d'offre") || h.includes("type d'offre"))) {
    return "offers";
  }
  if (headersLower.some(h => h.includes("nom de la campagne") || h.includes("impressions"))) {
    return "ads";
  }
  return null;
}

function mapOfferType(offerType: string): string {
  if (!offerType) return "Offre";
  if (offerType.includes("acheté") || offerType.includes("BOGO")) return "1 acheté = 1 offert";
  if (offerType.includes("Remise") || offerType.includes("%")) return "Remise %";
  if (offerType.includes("Livraison")) return "Livraison offerte";
  if (offerType.includes("Article offert")) return "Article offert";
  return offerType;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { csvContent, restaurantId, dryRun = false } = await req.json();

    if (!csvContent) {
      throw new Error("CSV content required");
    }

    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      throw new Error("CSV must have headers and at least one data row");
    }

    const headers = rows[0];
    const csvType = detectCsvType(headers);

    if (!csvType) {
      throw new Error("Unable to detect CSV type. Expected offers or ads campaign file.");
    }

    // For offers, restaurant ID is required
    if (csvType === "offers" && !restaurantId) {
      throw new Error("Restaurant ID required for offers import");
    }

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.trim()] = i;
    });

    const actions: any[] = [];
    let skipped = 0;
    const errors: string[] = [];
    const skippedDetails: { rowIndex: number; reason: string; details: string }[] = [];

    // Get selected restaurant name for validation display
    let selectedRestaurantName = "";
    if (restaurantId) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("name")
        .eq("id", restaurantId)
        .single();
      selectedRestaurantName = restaurant?.name || "";
    }

    // Normalize name for matching: lowercase, remove dashes, multiple spaces
    const normalizeName = (name: string) => 
      name.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();

    // For ads, we need to lookup restaurants by name
    let restaurantLookup: Record<string, string> = {};
    if (csvType === "ads") {
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name");
      
      if (restaurants) {
        restaurants.forEach(r => {
          restaurantLookup[normalizeName(r.name)] = r.id;
        });
      }
    }

    // Track date range
    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        if (csvType === "offers") {
          const offerType = row[headerMap["Type d'offre"]] || "";
          const articles = row[headerMap["Articles"]] || "";
          const startDate = parseDate(row[headerMap["Date de début"]]);
          const endDate = parseDate(row[headerMap["Date de fin"]]);
          const campaignId = row[headerMap["UUID de la campagne"]] || "";
          
          if (!startDate) {
            skipped++;
            skippedDetails.push({
              rowIndex: i + 1,
              reason: "no_date",
              details: "Date de début manquante ou invalide"
            });
            continue;
          }

          // Track date range
          if (!minDate || startDate < minDate) minDate = startDate;
          if (endDate && (!maxDate || endDate > maxDate)) maxDate = endDate;
          if (!maxDate || startDate > maxDate) maxDate = startDate;

          const action = {
            category: "promotions",
            action_type: mapOfferType(offerType),
            title: `${offerType}${articles ? ` - ${articles.substring(0, 50)}` : ""}`,
            start_date: startDate,
            end_date: endDate,
            restaurant_ids: [restaurantId],
            platform: "uber_eats",
            change_context: {
              uber_campaign_id: campaignId,
              source: "uber_import",
              campaign_type: "offer",
              offer_type: offerType,
              audience: row[headerMap["Audience"]] || null,
              status: row[headerMap["Statut"]] || null,
              sales_eur: parseNumber(row[headerMap["Ventes (EUR)"]]),
              new_customers: parseNumber(row[headerMap["Nouveaux clients"]]),
              orders: parseNumber(row[headerMap["Commandes"]]),
              uber_funding_percent: parseNumber(row[headerMap["Financement d'Uber (%)"]]),
              articles: articles ? articles.split(";").map(a => a.trim()) : []
            }
          };
          
          actions.push(action);

        } else if (csvType === "ads") {
          const campaignName = row[headerMap["Nom de la campagne"]] || "";
          const restaurantName = row[headerMap["Nom de l'établissement"]] || "";
          const startDate = parseDate(row[headerMap["Date de début"]]);
          const endDateStr = row[headerMap["Date de fin"]];
          const endDate = endDateStr === "Ongoing" ? null : parseDate(endDateStr);
          const campaignId = row[headerMap["UUID de la campagne"]] || "";
          
          if (!startDate) {
            skipped++;
            skippedDetails.push({
              rowIndex: i + 1,
              reason: "no_date",
              details: "Date de début manquante ou invalide"
            });
            continue;
          }

          // Track date range
          if (!minDate || startDate < minDate) minDate = startDate;
          if (endDate && (!maxDate || endDate > maxDate)) maxDate = endDate;
          if (!maxDate || startDate > maxDate) maxDate = startDate;

          // Find restaurant by name (use fallback restaurantId if provided)
          const foundRestaurantId = restaurantLookup[normalizeName(restaurantName)] || restaurantId;
          if (!foundRestaurantId) {
            errors.push(`Restaurant not found: ${restaurantName}`);
            skipped++;
            skippedDetails.push({
              rowIndex: i + 1,
              reason: "restaurant_not_found",
              details: `Restaurant non trouvé: ${restaurantName}`
            });
            continue;
          }

          const action = {
            category: "marketing",
            action_type: "Publicité",
            title: campaignName || "Campagne publicitaire",
            start_date: startDate,
            end_date: endDate,
            restaurant_ids: [foundRestaurantId],
            platform: "uber_eats",
            impact_value: parseNumber(row[headerMap["Budget"]]),
            impact_unit: `€/${(row[headerMap["Unité budgétaire"]] || "jour").toLowerCase()}`,
            change_context: {
              uber_campaign_id: campaignId,
              source: "uber_import",
              campaign_type: "ad",
              status: row[headerMap["Statut"]] || null,
              budget: parseNumber(row[headerMap["Budget"]]),
              budget_currency: row[headerMap["Devise du budget"]] || "EUR",
              budget_unit: row[headerMap["Unité budgétaire"]] || null,
              ad_sales: parseNumber(row[headerMap["Ventes générées par les annonces (EUR)"]]),
              ad_spend: parseNumber(row[headerMap["Dépenses publicitaires (EUR)"]]),
              rdp: parseNumber(row[headerMap["RDP"]]),
              cost_per_click: parseNumber(row[headerMap["Coût moyen par clic (EUR)"]]),
              cost_per_order: parseNumber(row[headerMap["Coût moyen par commande (EUR)"]]),
              impressions: parseNumber(row[headerMap["Impressions"]]),
              clicks: parseNumber(row[headerMap["Clics"]]),
              orders: parseNumber(row[headerMap["Commandes"]]),
              click_rate: parseNumber(row[headerMap["Taux de clics"]]),
              click_to_order_rate: parseNumber(row[headerMap["Taux de clics pour commander"]]),
              avg_order_value: parseNumber(row[headerMap["Montant moyen des commandes (EUR)"]])
            }
          };
          
          actions.push(action);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${i}: ${message}`);
        skipped++;
        skippedDetails.push({
          rowIndex: i + 1,
          reason: "parse_error",
          details: message
        });
      }
    }

    let inserted = 0;

    // Only insert if not dryRun
    if (!dryRun && actions.length > 0) {
      const { error: insertError } = await supabase
        .from("restaurant_actions")
        .insert(actions);

      if (insertError) {
        throw new Error(`Insert error: ${insertError.message}`);
      }
      inserted = actions.length;
    }

    // Build response in ImportResult format
    const response = {
      success: true,
      reportType: `marketing_campaigns_${csvType}`,
      dryRun,
      stats: {
        totalRows: rows.length - 1,
        inserted: dryRun ? actions.length : inserted,
        updated: 0,
        skipped,
        errors: errors.length
      },
      validation: {
        dateRange: {
          start: minDate,
          end: maxDate
        },
        restaurants: restaurantId ? [{
          id: restaurantId,
          name: selectedRestaurantName,
          orderCount: actions.length
        }] : [],
        unknownStoreIds: [],
        skippedDetails
      },
      errorDetails: errors.slice(0, 10)
    };

    console.log(`[parse-marketing-campaigns] ${csvType} - ${dryRun ? "DRY RUN" : "IMPORT"}: ${actions.length} actions, ${skipped} skipped`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message,
        stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 1 },
        errorDetails: [message]
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
