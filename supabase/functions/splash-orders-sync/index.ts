import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN_URL = "https://api2.splash360.fr/oauth/v2/token";
const ORDERS_URL = "https://api2.splash360.fr/api/export/orders";
const PAGE_SIZE = 100;

type Json = Record<string, any>;

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: "GET" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const token = data.access_token ?? data.accessToken;
  if (!token) throw new Error("Token absent de la réponse OAuth");
  return token;
}

function pick(obj: Json, keys: string[]): any {
  for (const k of keys) {
    if (obj == null) continue;
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

// Splash exprime les montants de ticket et de ligne en centimes.
function fromCents(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n / 100;
}

// Les règlements (reglements[].valeur) sont déjà en euros.
function asEuros(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function normalizePayment(raw: string | null): { category: string; brand: string | null } {
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

function normalizeService(raw: string | null): string | null {
  const s = (raw ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!s) return null;
  if (/LIVR|DELIVER/.test(s)) return "livraison";
  if (/EMPORT|TAKE|COLLECT/.test(s)) return "emporter";
  if (/PLACE|EAT.?IN|DINE/.test(s)) return "sur_place";
  return s.toLowerCase();
}

function extractLines(order: Json): Json[] {
  const v = order.items;
  return Array.isArray(v) ? v : [];
}


async function fetchPage(token: string, from: string, to: string, page: number): Promise<Json[]> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    fromDate: from,
    toDate: to,
  });
  const res = await fetch(`${ORDERS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`THROTTLE ${res.status}`);
  }
  if (!res.ok) throw new Error(`Orders ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.items ?? data.data ?? data.orders ?? data.content ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await caller.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const { data: isSuperAdmin } = await caller.rpc("is_super_admin");
    if (!isSuperAdmin) return json({ error: "Forbidden: super_admin only" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode: "probe" | "sync" = body.mode ?? "probe";
    const restaurantId: string | undefined = body.restaurant_id;
    const from: string = body.from ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const to: string = body.to ?? from;
    if (!restaurantId) return json({ error: "restaurant_id requis" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: creds, error: credError } = await admin
      .from("splash_restaurant_credentials")
      .select("id, restaurant_id, chain_id, station, client_id, client_secret, is_active")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true);
    if (credError) throw credError;
    if (!creds?.length) return json({ error: "Aucun accès Splash pour ce restaurant" }, 404);

    const report: Json[] = [];

    for (const cred of creds) {
      let token: string;
      try {
        token = await getToken(cred.client_id, cred.client_secret);
      } catch (e) {
        await admin
          .from("splash_restaurant_credentials")
          .update({ last_error: String((e as Error).message).slice(0, 500) })
          .eq("id", cred.id);
        report.push({ station: cred.station, error: "auth", detail: String((e as Error).message) });
        continue;
      }

      if (mode === "probe") {
        const page = await fetchPage(token, from, to, 0);
        const sample = page[0] ?? null;
        report.push({
          station: cred.station,
          orders_on_page: page.length,
          order_keys: sample ? Object.keys(sample) : [],
          line_keys: sample ? Object.keys(extractLines(sample)[0] ?? {}) : [],
          sample,
        });
        continue;
      }

      if (mode === "survey") {
        // Relevé des valeurs réelles (mode, centre de revenu, moyens de règlement).
        const counts: Record<string, Record<string, number>> = { mode: {}, centre_revenu: {}, moyen: {}, status: {} };
        const bump = (k: string, v: string) => {
          counts[k][v] = (counts[k][v] ?? 0) + 1;
        };
        let page = 0;
        let seen = 0;
        const maxPages = Number(body.max_pages ?? 5);
        for (let p = 0; p < maxPages; p++) {
          const orders = await fetchPage(token, from, to, page);
          seen += orders.length;
          for (const o of orders) {
            bump("mode", String(o.mode ?? "∅"));
            bump("centre_revenu", String(o.centre_revenu ?? "∅"));
            bump("status", String(o.status ?? "∅"));
            for (const r of (o.reglements ?? []) as Json[]) bump("moyen", String(r.moyen ?? "∅"));
          }
          if (orders.length < PAGE_SIZE) break;
          page++;
          await new Promise((r) => setTimeout(r, 400));
        }
        report.push({ station: cred.station, tickets_seen: seen, counts });
        continue;
      }

      // mode sync
      let page = Number(body.start_page ?? 0);
      let tickets = 0;
      let lines = 0;
      let payments = 0;
      let fetched = 0;
      const maxPages = Number(body.max_pages ?? 50);
      for (let p = 0; p < maxPages; p++) {
        const orders = await fetchPage(token, from, to, page);
        fetched += orders.length;
        if (!orders.length) break;

        const ticketRows: Json[] = [];
        const byTicketId = new Map<string, Json>();
        for (const order of orders) {
          const splashTicketId = String(order.ticket_id ?? order.local_id ?? "");
          if (!splashTicketId) continue;
          const dt = order.createdAt ? new Date(order.createdAt) : null;
          if (!dt || Number.isNaN(dt.getTime())) continue;

          // Date métier en heure de Paris.
          const ticketDate = new Intl.DateTimeFormat("fr-CA", {
            timeZone: "Europe/Paris",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(dt);

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
            ticket_date: ticketDate,
            service_type: normalizeService(String(order.mode ?? "") || null),
            revenue_center: order.centre_revenu ? String(order.centre_revenu) : null,
            status: order.status ? String(order.status) : null,
            payment_label_raw: mainLabel,
            payment_category: mainPayment.category,
            payment_brand: mainPayment.brand,
            total_amount: fromCents(order.prix_ttc) ?? asEuros(order.total),
            total_ht: fromCents(order.prix_ht),
            total_vat: fromCents(order.montant_tva),
            discount_amount: null,
            raw: rawSafe,
            updated_at: new Date().toISOString(),
          });
          byTicketId.set(splashTicketId, order);
        }

        if (ticketRows.length) {
          const { error: tErr } = await admin
            .from("splash_tickets")
            .upsert(ticketRows, { onConflict: "restaurant_id,station,splash_ticket_id" });
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
            const items = extractLines(order);
            items.forEach((l: Json, idx: number) => {
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
              // Ingrédients / suppléments payants rattachés à la même ligne mère.
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

          for (let i = 0; i < lineRows.length; i += 500) {
            const { error } = await admin
              .from("splash_ticket_lines")
              .upsert(lineRows.slice(i, i + 500), { onConflict: "ticket_uuid,line_key" });
            if (error) throw error;
          }
          lines += lineRows.length;

          for (let i = 0; i < payRows.length; i += 500) {
            const { error } = await admin
              .from("splash_ticket_payments")
              .upsert(payRows.slice(i, i + 500), { onConflict: "ticket_uuid,payment_key" });
            if (error) throw error;
          }
          payments += payRows.length;
        }


        if (orders.length < PAGE_SIZE) break;
        page++;
        await new Promise((r) => setTimeout(r, 400)); // pacing entre pages
      }

      await admin
        .from("splash_restaurant_credentials")
        .update({ last_ok_at: new Date().toISOString(), last_error: null })
        .eq("id", cred.id);

      report.push({ station: cred.station, fetched, tickets_upserted: tickets, lines_upserted: lines, payments_upserted: payments, last_page: page });
    }

    return json({ mode, restaurant_id: restaurantId, from, to, report });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
