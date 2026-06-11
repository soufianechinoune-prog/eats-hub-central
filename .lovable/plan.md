## Contexte

- ✅ Import W23 réussi (1 845 commandes, 84 shops, 39 311 € TTC, ~9s)
- ✅ Croisement Dishop vs Uber W23 cohérent (caisse = 7-25% du CA mappé)
- ❌ Sondage historique : **aucune URL ne marche** — l'API Dishop ne sert que la semaine en cours
- ⚠️ 7 shops Dishop encore non mappés (64 commandes orphelines)

## Plan en 3 lots

### Lot 1 — Sécuriser le flux hebdo (priorité haute)

**Objectif :** ne plus jamais rater une semaine.

- Activer un **cron pg_cron** qui appelle `dishop-sync-week` chaque **lundi 06:00 Europe/Paris** pour toutes les `chain_pos_connections` Dishop actives.
- Logguer chaque run dans `dishop_sync_runs` (déjà en place).
- Ajouter sur la carte Dishop un **bandeau "Dernière synchro : lundi X à 06:00 — N commandes"** + bouton "Relancer maintenant" (déjà présent, à renommer "Synchroniser semaine courante").
- Ajouter un **toast d'alerte** si le dernier run a échoué ou date de + de 8 jours.

### Lot 2 — Upload ZIP manuel pour le backfill historique

**Objectif :** ingérer les semaines passées si Dishop nous envoie les ZIP par email.

- Bouton **"Importer un ZIP Dishop"** sur la carte Dishop → file picker (`.zip` uniquement, multi-files).
- Edge function `dishop-import-zip` qui :
  - reçoit le ZIP en multipart,
  - réutilise **exactement** le parser existant de `dishop-sync-week` (3 CSV : orders, items, customers),
  - détecte automatiquement la semaine via le `order_date` min/max,
  - insère avec dédup `(dishop_order_id, dishop_shop_id)`,
  - logge dans `dishop_sync_runs` avec `source = 'manual_upload'`.
- Affichage du résultat dans le même "Historique des imports".

### Lot 3 — Intégrer Dishop dans l'Overview comme 3ᵉ canal

**Objectif :** rendre la donnée caisse **visible** à côté d'Uber et Deliveroo.

- **Overview / KPIs réseau** : ajouter une carte **"Caisse / Sur place"** (icône 🏪) à côté d'Uber et Deliveroo, avec CA TTC, nb commandes, panier moyen.
- **Overview / Mix canal** : ajouter une 3ᵉ part au donut "Répartition CA par canal" (Uber / Deliveroo / Caisse).
- **Comparatif restaurants** : ajouter colonne "Dishop" dans le tableau, expandable comme Uber/Deliveroo.
- **Reste hors scope ce lot** : Finances détaillées (commissions Dishop par type de paiement CB/espèces/tickets) → lot 4 séparé.

### Détails techniques

- RPC à créer : `get_network_dishop_summary(restaurant_ids uuid[], start_date date, end_date date)` retournant `{ revenue_ttc, orders_count, avg_basket, by_restaurant }`. SECURITY DEFINER, filtre `chain_id` via `has_chain_access`.
- Hook React : `useNetworkDishop(period)` aligné sur `useNetworkStats`.
- Composant : `<DishopChannelCard />` dans `src/components/overview/`.
- Cron SQL via `supabase--insert` (jamais en migration — contient URL + anon key).
- Upload ZIP : limite 50 Mo par fichier, parsing côté edge function (déjà ~9s pour 84 shops → OK).

### Hors scope

- Récupération automatique de l'historique via API Dishop (impossible — confirmé par sondage)
- Finalisation des 7 mappings manquants (l'user le fait à la main, non bloquant)
- Page Finances dédiée Dishop (commissions, types de paiement) — lot 4 si jugé utile

---

**Démarrage proposé : Lot 1 (cron + bandeau) puis Lot 3 (Overview) en parallèle, Lot 2 ensuite.**
Tu valides ?