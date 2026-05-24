## Objectif

Afficher sur la page **Analytics → Remboursements** un funnel de contestation à 3 étages :

1. **Demandes de remboursement client** (commandes débitées) — nb + montant
2. **Recréditées suite à contestation gagnée** — nb + montant
3. **Delta = net réellement à charge du restaurant** — nb + montant

## État actuel de la data

Vérifié sur Argenteuil janvier 2026 :

| Étage | Source | Statut |
|---|---|---|
| 1 — Remb. client | `orders.refund_incl_vat` (API Uber) | ✅ 82 cmd / −629,82 € |
| 2 — Contestée gagnée | `orders.refund_contested_incl_vat` + `orders.dispute_status` (CSV col 64) | ❌ vide partout |
| 3 — Delta | Calcul (1) + (2) | ❌ dépend de l'étage 2 |

**Cause** : l'API Uber ne renvoie pas le statut de litige. Cette info arrive uniquement dans le rapport CSV de paiement (colonne 64 "Statut de la commande" : "Remboursement" vs "Remboursements contestés"). Le parser est déjà déployé mais aucune commande historique n'a été re-traitée.

## Plan en 2 étapes

### Étape 1 — Rétro-remplissage des colonnes "contestation"

Lancer un **backfill** ciblé qui re-télécharge les rapports `PAYMENT_DETAILS_REPORT` via l'API Uber pour la période et les restaurants choisis, et fait passer chaque ligne par le parser existant (qui lit la col 64) pour remplir :
- `orders.dispute_status`
- `orders.refund_contested_incl_vat`

Périmètre proposé pour vérification :
- **Tasty Crousty Argenteuil — janvier 2026** d'abord (validation)
- Si OK → élargir au reste du réseau / autres mois via la table `backfill_jobs` existante

Aucun nouveau code de parsing : on réutilise l'edge function `uber-create-report` et le worker `backfill-worker` déjà en place.

### Étape 2 — UI : carte funnel sur la page Remboursements

Dans `src/components/analytics/RefundsSection.tsx`, ajouter un bloc **"Funnel de contestation"** sous les 4 KPI cards existantes :

```text
┌─ Demandes remb. ─┐    ┌─ Contestées gagnées ─┐    ┌─ Net à charge ─┐
│   82 cmd          │ →  │   X cmd (Y%)         │ → │   Z cmd        │
│   −629,82 €       │    │   +N €               │   │   −M €         │
└──────────────────┘    └──────────────────────┘    └────────────────┘
```

Nouvelle RPC `get_refund_contestation_funnel(p_restaurant_ids, p_start, p_end)` retournant :
- `refunded_count`, `refunded_amount`
- `contested_won_count`, `contested_won_amount` (somme `refund_contested_incl_vat > 0`)
- `net_count`, `net_amount`

La RPC suit le standard projet (SECURITY DEFINER, AT TIME ZONE Europe/Paris, filtre par `p_restaurant_ids`).

Affichage uniquement en `€` (pas de toggle %) pour ce bloc, granularité = période sélectionnée (pas de courbe pour l'instant).

## Validation utilisateur

À la fin de l'étape 1, je te livre un tableau comparatif **Argenteuil janvier 2026** :
- Données AVANT backfill (82 / −629,82 € / 0 / 0)
- Données APRÈS backfill (82 / −629,82 € / X / +Y €)
- Tu valides la cohérence avant qu'on passe à l'UI et qu'on élargisse le backfill.

## Ce qui n'est PAS dans ce plan

- Pas de modif des autres pages (Finances, Overview…)
- Pas de re-parse des CSV uploadés manuellement (on passe uniquement par l'API)
- Pas d'historisation séparée du funnel (calcul live à partir de `orders`)
