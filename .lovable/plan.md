## Export API Uber pur — Chicken Street Argenteuil, mai 2026

### Objectif
Générer un ZIP contenant **uniquement les données issues de l'API Uber** (exclusion totale des imports CSV manuels), plus la liste des rapports API appelés et non appelés.

### Contenu du ZIP `uber_api_chicken_street_argenteuil_mai2026.zip`

**Dossier `tables_avec_data_api/`** — filtrage strict `data_source = 'uber_api'` :
- `orders.csv` — ~2 781 lignes (source: `PAYMENT_DETAILS_REPORT`)
- `hourly_availability.csv` — 744 lignes (source: `DOWNTIME_REPORT`)
- `payout_adjustments.csv` — 7 lignes (source: `PAYMENT_DETAILS_REPORT`)

**Fichier `reports_appels_API.csv`** — historique complet des appels API Uber pour ce restaurant en mai 2026 :
- colonnes : `report_type`, `start_date`, `end_date`, `status`, `created_at`, `completed_at`, `workflow_id`

**Fichier `RAPPORTS_API_NON_APPELES.txt`** — liste des 7 rapports Uber disponibles via l'API mais jamais appelés pour ce restaurant/période, avec mapping vers les tables qu'ils alimenteraient :
- `ORDER_HISTORY_REPORT` → `order_history`, `order_items`, `delivery_stats`
- `MENU_ITEM_FEEDBACK_REPORT` → `menu_item_reviews`
- `CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` → `customer_reviews`
- `SALES_OVER_TIME_REPORT` → `daily_sales_uber`
- `MARKETPLACE_FUNNEL_REPORT` → `daily_conversion`, `monthly_conversion`
- `ORDER_ERRORS_REPORT` → `order_errors`, `daily_order_accuracy`
- `DOWNTIME_REPORT` (variante `downtime_logs`) → `downtime_logs`

**Fichier `README.txt`** — explique la méthode (filtre `data_source='uber_api'`), les comptes de lignes, et pourquoi les autres tables sont absentes.

### Méthode technique
- `psql COPY` filtré par `restaurant_id = 'd69579a6-987a-4d42-9937-bcb6c8373155'`, plage mai 2026, et `data_source = 'uber_api'` quand la colonne existe.
- Aucune modification de code projet — script ponctuel sous `/tmp/`.
- Livraison via `<presentation-artifact>`.
