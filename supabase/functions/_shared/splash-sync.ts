// Mapping et ingestion des tickets Splash (api/export/orders).
// Partagé entre l'import manuel (splash-orders-sync) et le worker de rattrapage.

export type Json = Record<string, any>;

export const TOKEN_URL = "https://api2.splash360.fr/oauth/v2/token";
export const ORDERS_URL = "https://api2.splash360.fr/api/export/orders";
export const PAGE_SIZE = 100;

export async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: "GET" });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const token = data.access_token ?? data.accessToken;
  if (!token) throw new Error("Token absent de la réponse OAuth");
  return token;
}

// Splash exprime les montants de ticket et de ligne en centimes.
export function fromCents(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n / 100;
}

// Les règlements (reglements[].valeur) sont déjà en euros.
export function asEuros(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function normalizePayment(raw: string | null): { category: string; brand: string | null } {
  const s = (raw ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!s) return { category: "Autre", brand: null };
  const brands: [string, string][] = [
    ["SWILE", "Swile"], ["PLUXEE", "Pluxee"], ["SODEXO", "Pluxee"], ["EDENRED", "Edenred"],
    ["TICKET RESTAURANT", "Edenred"], ["UP DEJ", "Up"], ["UPDEJ", "Up"], ["BIMPLI", "Bimpli"],
    ["APETIZ", "Bimpli"], ["CONECS", "Conecs"], ["RESTOFLASH", "Restoflash"],
  ];
  const hit = brands.find(([k]) => s.includes(k));
  if (hit || s === "TICKET" || s === "TICKETS" || /TITRE|^TR$|\bTR\b|TICKET.?RESTO|RESTO.?TICKET/.test(s)) {
    return { category: "Titres-resto", brand: hit ? hit[1] : null };
  }
  if (/ESPECE|CASH|LIQUIDE/.test(s)) return { category: "Espèces", brand: null };
  if (/CB|CARTE|BANCAIRE|VISA|MASTERCARD|AMEX|TPE|SANS.?CONTACT|STRIPE|PAIEMENT.?EN.?LIGNE/.test(s)) {
    return { category: "Carte", brand: null };
  }
  if (/UBER|DELIVEROO|JUST.?EAT|PLATEFORME/.test(s)) return { category: "Plateforme", brand: null };
  return { category: "Autre", brand: null };
}

export function normalizeService(raw: string | null): string | null {
  const s = (raw ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!s) return null;
  if (/LIVR|DELIVER/.test(s)) return "livraison";
  if (/EMPORT|TAKE|COLLECT/.test(s)) return "emporter";
  if (/PLACE|EAT.?IN|DINE/.test(s)) return "sur_place";
  return s.toLowerCase();
}

// RGPD : on ne stocke jamais de donnée identifiante client dans le brut.
const PII_KEYS = new Set([
  "client", "clients", "customer", "nom_client", "prenom", "prenom_client",
  "telephone", "tel", "phone", "mobile", "email", "mail", "adresse", "address",
  "adresse_livraison", "code_postal", "ville_client", "customer_name",
  "customer_phone", "customer_email", "loyalty_card", "carte_fidelite",
]);

export function stripPii(value: any): any {
  if (Array.isArray(value)) return value.map(stripPii);
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.has(k.toLowerCase())) continue;
      out[k] = stripPii(v);
    }
    return out;
  }
  return value;
}

export function extractLines(order: Json): Json[] {
  return Array.isArray(order.items) ? order.items : [];
}

export function dedupe(rows: Json[], key: (r: Json) => string): Json[] {
  const seen = new Set<string>();
  const out: Json[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export async function fetchPage(
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

export function parisDate(dt: Date): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

export type Cred = {
  id: string;
  restaurant_id: string;
  chain_id: string;
  station: string;
  client_id: string;
  client_secret: string;
};

export type SyncResult = {
  fetched: number;
  tickets: number;
  lines: number;
  payments: number;
  next_page: number;
  done: boolean;
};

/**
 * Ingère une plage de dates pour une caisse, page par page, de façon idempotente.
 * S'arrête proprement à `deadlineMs` (reprise possible via `next_page`).
 */
export async function syncRange(
  admin: any,
  cred: Cred,
  from: string,
  to: string,
  startPage = 0,
  maxPages = 50,
  deadlineMs = Number.POSITIVE_INFINITY,
): Promise<SyncResult> {
  const token = await getToken(cred.client_id, cred.client_secret);
  let page = startPage;
  let fetched = 0;
  let tickets = 0;
  let lines = 0;
  let payments = 0;
  let done = false;

  for (let p = 0; p < maxPages; p++) {
    if (Date.now() > deadlineMs) break;
    const orders = await fetchPage(token, from, to, page);
    fetched += orders.length;
    if (!orders.length) {
      done = true;
      break;
    }

    const ticketRows: Json[] = [];
    const byTicketId = new Map<string, Json>();
    for (const order of orders) {
      const splashTicketId = String(order.ticket_id ?? order.local_id ?? "");
      if (!splashTicketId) continue;
      const dt = order.createdAt ? new Date(order.createdAt) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;

      const reglements = (order.reglements ?? []) as Json[];
      const main = [...reglements].sort((a, b) => Number(b.valeur ?? 0) - Number(a.valeur ?? 0))[0];
      const mainLabel = main ? String(main.moyen ?? "") : null;
      const mainPayment = normalizePayment(mainLabel);

      // On ne conserve jamais les coordonnées client dans le brut.
      const { client: _client, ...rawSafe } = order as Json;

      ticketRows.push({
        restaurant_id: cred.restaurant_id,
        chain_id: cred.chain_id,
        station: cred.station,
        splash_ticket_id: splashTicketId,
        ticket_datetime: dt.toISOString(),
        ticket_date: parisDate(dt),
        service_type: normalizeService(String(order.mode ?? "") || null),
        revenue_center: order.centre_revenu ? String(order.centre_revenu) : null,
        status: order.status ? String(order.status) : null,
        payment_label_raw: mainLabel,
        payment_category: mainPayment.category,
        payment_brand: mainPayment.brand,
        total_amount: fromCents(order.prix_ttc) ?? asEuros(order.total),
        total_ht: fromCents(order.prix_ht),
        total_vat: fromCents(order.montant_tva),
        raw: rawSafe,
        updated_at: new Date().toISOString(),
      });
      byTicketId.set(splashTicketId, order);
    }

    if (ticketRows.length) {
      const { error: tErr } = await admin
        .from("splash_tickets")
        .upsert(dedupe(ticketRows, (r) => String(r.splash_ticket_id)), {
          onConflict: "restaurant_id,station,splash_ticket_id",
        });
      if (tErr) throw tErr;
      tickets += ticketRows.length;

      const { data: stored, error: sErr } = await admin
        .from("splash_tickets")
        .select("id, splash_ticket_id, ticket_date")
        .eq("restaurant_id", cred.restaurant_id)
        .eq("station", cred.station)
        .in("splash_ticket_id", [...byTicketId.keys()]);
      if (sErr) throw sErr;

      const lineRows: Json[] = [];
      const payRows: Json[] = [];
      for (const t of stored ?? []) {
        const order = byTicketId.get(t.splash_ticket_id)!;
        extractLines(order).forEach((l: Json, idx: number) => {
          lineRows.push({
            ticket_uuid: t.id,
            restaurant_id: cred.restaurant_id,
            chain_id: cred.chain_id,
            ticket_date: t.ticket_date,
            line_key: String(l.itemid ?? idx),
            product_name: String(l.nom ?? ""),
            product_ref: l.produitid ? String(l.produitid) : null,
            category: null,
            quantity: Number(l.quantite ?? 1),
            unit_price: fromCents(l.prix_unitaire_ttc),
            total_price: fromCents(l.prix_ttc),
            depth: 0,
          });
          for (const ing of (l.ingredients ?? []) as Json[]) {
            lineRows.push({
              ticket_uuid: t.id,
              restaurant_id: cred.restaurant_id,
              chain_id: cred.chain_id,
              ticket_date: t.ticket_date,
              line_key: `${String(l.itemid ?? idx)}:${String(ing.ingredient ?? "")}`,
              product_name: String(ing.nom ?? ""),
              product_ref: ing.ingredient ? String(ing.ingredient) : null,
              category: null,
              quantity: Number(ing.qte ?? 1),
              unit_price: fromCents(ing.prix_unitaire_ttc),
              total_price: fromCents(ing.prix_ttc),
              depth: 1,
            });
          }
        });

        ((order.reglements ?? []) as Json[]).forEach((r: Json, idx: number) => {
          const norm = normalizePayment(String(r.moyen ?? ""));
          payRows.push({
            ticket_uuid: t.id,
            restaurant_id: cred.restaurant_id,
            chain_id: cred.chain_id,
            ticket_date: t.ticket_date,
            payment_key: String(r.reglementId ?? idx),
            raw_label: r.moyen ? String(r.moyen) : null,
            category: norm.category,
            brand: norm.brand,
            amount: asEuros(r.valeur),
          });
        });
      }

      const uLines = dedupe(lineRows, (r) => `${r.ticket_uuid}|${r.line_key}`);
      for (let i = 0; i < uLines.length; i += 500) {
        const { error } = await admin
          .from("splash_ticket_lines")
          .upsert(uLines.slice(i, i + 500), { onConflict: "ticket_uuid,line_key" });
        if (error) throw error;
      }
      lines += uLines.length;

      const uPays = dedupe(payRows, (r) => `${r.ticket_uuid}|${r.payment_key}`);
      for (let i = 0; i < uPays.length; i += 500) {
        const { error } = await admin
          .from("splash_ticket_payments")
          .upsert(uPays.slice(i, i + 500), { onConflict: "ticket_uuid,payment_key" });
        if (error) throw error;
      }
      payments += uPays.length;
    }

    if (orders.length < PAGE_SIZE) {
      done = true;
      page++;
      break;
    }
    page++;
    await new Promise((r) => setTimeout(r, 400)); // pacing entre pages
  }

  return { fetched, tickets, lines, payments, next_page: page, done };
}
