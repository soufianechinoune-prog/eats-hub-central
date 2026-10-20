// Ingestion des commandes Splash ANNULÉES avant paiement (status=deleted).
// Module volontairement séparé de splash-sync.ts : ces commandes n'ont jamais
// été encaissées et ne doivent JAMAIS entrer dans le CA (caisse_tickets,
// rollups, splash360_daily_sales restent intacts).
// Destination unique : public.caisse_deleted_orders (audit / démarque / abandons).

import {
  ORDERS_URL,
  PAGE_SIZE,
  extractLines,
  fromCents,
  getToken,
  normalizeService,
  parisDate,
  type Cred,
  type Json,
} from "./splash-sync.ts";

export type DeletedSyncResult = {
  fetched: number;
  orders: number;
  next_page: number;
  done: boolean;
};

// Récupère UNIQUEMENT les commandes annulées (paramètre status=deleted,
// ajouté par Splash le 13/10/2026, disponible sur tout l'historique).
// Le filtre fromDate/toDate porte sur la date de création de la commande.
export async function fetchDeletedPage(
  token: string,
  from: string,
  to: string,
  page: number,
): Promise<Json[]> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    fromDate: from,
    toDate: to,
    status: "deleted",
  });
  const res = await fetch(`${ORDERS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429 || res.status >= 500) throw new Error(`THROTTLE ${res.status}`);
  if (!res.ok) throw new Error(`Orders ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.items ?? data.data ?? data.orders ?? data.content ?? [];
}

/**
 * Ingère les commandes annulées d'une plage de dates pour une caisse,
 * page par page, de façon idempotente. Aucune écriture hors caisse_deleted_orders.
 */
export async function syncDeletedRange(
  admin: any,
  cred: Cred,
  from: string,
  to: string,
  startPage = 0,
  maxPages = 50,
  deadlineMs = Number.POSITIVE_INFINITY,
): Promise<DeletedSyncResult> {
  const token = await getToken(cred.client_id, cred.client_secret);
  let page = startPage;
  let fetched = 0;
  let orders = 0;
  let done = false;

  for (let p = 0; p < maxPages; p++) {
    if (Date.now() > deadlineMs) break;
    const pageOrders = await fetchDeletedPage(token, from, to, page);
    fetched += pageOrders.length;
    if (!pageOrders.length) {
      done = true;
      break;
    }

    const rows: Json[] = [];
    const seen = new Set<string>();
    for (const order of pageOrders) {
      const splashTicketId = String(order.ticket_id ?? order.local_id ?? "");
      if (!splashTicketId || seen.has(splashTicketId)) continue;
      seen.add(splashTicketId);
      const dt = order.createdAt ? new Date(order.createdAt) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;

      rows.push({
        restaurant_id: cred.restaurant_id,
        chain_id: cred.chain_id,
        station: cred.station,
        splash_ticket_id: splashTicketId,
        ticket_datetime: dt.toISOString(),
        ticket_date: parisDate(dt),
        service_type: normalizeService(String(order.mode ?? "") || null),
        revenue_center: order.centre_revenu ? String(order.centre_revenu) : null,
        status: order.status ? String(order.status) : "deleted",
        total_amount: fromCents(order.prix_ttc),
        total_ht: fromCents(order.prix_ht),
        total_vat: fromCents(order.montant_tva),
        items_count: extractLines(order).length,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error } = await admin
        .from("caisse_deleted_orders")
        .upsert(rows, { onConflict: "restaurant_id,station,splash_ticket_id,ticket_date" });
      if (error) throw error;
      orders += rows.length;
    }

    if (pageOrders.length < PAGE_SIZE) {
      done = true;
      page++;
      break;
    }
    page++;
    await new Promise((r) => setTimeout(r, 400)); // pacing entre pages
  }

  return { fetched, orders, next_page: page, done };
}
