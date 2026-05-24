# Diagnostic commande #9065E (Amiens, avril 2026)

La commande **existe bien en base** :

| Champ | Valeur |
|---|---|
| `uber_order_id` | #9065E |
| `order_datetime` | 20/04/2026 12:33 |
| `refund_incl_vat` | 2,50 € |
| `refund_contested_incl_vat` | 0 |
| `dispute_status` | **NULL** |
| `data_source` | `uber_api` |
| `imported_from_report` | true |

**Pourquoi elle n'apparaît pas dans "Contestées gagnées" :** les colonnes `dispute_status` et `refund_contested_incl_vat` ne sont **pas remontées par l'API Uber**. Elles ne sont remplies qu'après re-parsing du **rapport CSV Paiements Uber** (col 64 "Statut commande" + col 65 "Remboursement contesté"). Pour janvier 2026 sur Argenteuil, on avait lancé `uber-backfill-reports` — c'est exactement ce qui manque ici pour avril sur Amiens.

**Ce n'est donc pas un délai Uber** (la donnée existe côté Uber dès que le litige est tranché). C'est notre backfill du rapport Paiements qui n'a pas encore tourné sur Amiens / avril.

---

# Plan d'action

## 1. Backfill rapport Paiements Uber — Amiens avril 2026
Lancer `uber-backfill-reports` sur TASTY CROUSTY AMIENS pour la période 01/04 → 30/04/2026, afin de remplir `dispute_status` et `refund_contested_incl_vat` (idem ce qu'on a fait pour Argenteuil janvier).

Après backfill, vérifier que #9065E remonte avec `dispute_status='Remboursements contestés'` et `refund_contested_incl_vat=2,50` → la commande passera mécaniquement dans l'étage **2. Contestées gagnées** du funnel.

## 2. Ajout d'une table "Détail des commandes" sous le funnel
Sous le bloc funnel actuel dans `RefundsSection.tsx`, ajouter une table listant **toutes les commandes ayant un remboursement** sur la période + restaurants sélectionnés.

**Colonnes :**
- Date / heure
- Restaurant
- N° commande Uber (ex. #9065E)
- Montant remboursé client (TTC)
- Montant recrédité après contestation (TTC)
- Solde net (= remboursé + contesté gagné)
- Statut litige (badge couleur : `Remboursement` orange / `Remboursements contestés` vert / `—` gris si NULL)

**Tri par défaut :** date desc. **Pagination** 25 lignes. **Export CSV** (bouton en haut à droite de la table).

**Source de données :** nouveau RPC `get_refund_orders_detail(p_restaurant_ids uuid[], p_start_date date, p_end_date date)` retournant les colonnes ci-dessus, filtré sur `refund_incl_vat < 0 OR refund_contested_incl_vat > 0`. `SECURITY DEFINER`, `statement_timeout 30s`, ordonné par `order_datetime desc`.

## Hors scope
- Pas de modif du funnel existant (déjà validé).
- Pas d'autres pages touchées.
- Pas de drill-down par item (Uber ne fournit pas le détail par produit pour les litiges).

## Détails techniques
- Nouveau composant `RefundOrdersTable.tsx` consommé par `RefundsSection.tsx`.
- `useQuery` avec `enabled = analyticsReady && restaurantIds.length > 0`.
- Types Supabase régénérés automatiquement après migration RPC.
- Aucune modif du parser ni du backfill worker (déjà en place).
