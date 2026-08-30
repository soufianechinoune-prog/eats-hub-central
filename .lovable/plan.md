# Intégration Deliveroo — CA par commande (rapport « Commandes »)

Oui, je suis d'accord avec l'ordre proposé par ton dev : table → ingestion → mapping → dashboard → front. Deux ajustements par rapport à la spec, justifiés par ce qui existe déjà dans la base.

## Ce qui existe déjà (vérifié)

- Table `deliveroo_orders` : construite pour les **relevés** Deliveroo (`history_type`, `total_payable`, `adjustment_amount`…), alimentée par l'edge function `parse-deliveroo-statement`. Elle est **vide (0 ligne)** aujourd'hui.
- Table de correspondance `restaurant_deliveroo_ids` (nom Deliveroo → restaurant) : **94 lignes déjà mappées**, avec une page de rapprochement `/deliveroo-matching`.
- Le CA Deliveroo affiché (tuile « CA par canal », comparatif restaurants) vient du RPC `get_network_deliveroo_summary`, qui lit `deliveroo_orders` — donc **0 € partout** actuellement.

Conséquence : pas besoin de créer `deliveroo_restaurant_map` (on réutilise `restaurant_deliveroo_ids`, déjà peuplé à 94/98 noms), et il faut une table distincte pour le rapport « Commandes » car sa sémantique diffère du relevé.

## Étape 1 — Table

Nouvelle table `deliveroo_sales_orders` :
`id`, `chain_id`, `restaurant_id` (nullable), `deliveroo_name`, `normalized_name`, `order_number`, `status`, `sent_at`, `delivered_at`, `subtotal`, `commission`, `commission_vat`, `net`, `currency`, `source_file`, `imported_at`.
Unicité `(deliveroo_name, order_number)` → upsert idempotent. RLS `TO authenticated` via `user_has_chain_access(chain_id)`, GRANT explicites, index `(chain_id, sent_at)` et `(restaurant_id, sent_at)`.

## Étape 2 — Ingestion

Edge function `ingest-deliveroo-orders` :
lignes CSV reçues → normalisation du nom (emoji 🌯, accents, casse, espaces — même `normalizeForAlias` que les imports Uber) → lookup mapping → `restaurant_id` + `chain_id` → calcul `net = subtotal − commission − commission_vat` → upsert par lots → retour `{received, upserted, matched, unmatched[]}`.
Sécurité : appel authentifié (utilisateur connecté) ; clé d'ingestion partagée en plus pour le collecteur automatisé de phase 2.

## Étape 3 — Mapping

Seed des 98 noms du fichier fourni dans `restaurant_deliveroo_ids` pour les noms encore absents, avec routage multi-marques :
- Chicken Street / CS Original → chain Chicken Street
- Bangkok Factory → sa chain si elle existe, sinon marqué **exclu** (`restaurant_id` nul + flag) pour ne pas polluer le CA CS.
Les noms non rapprochés remontent dans l'écran d'import et sur `/deliveroo-matching`.

## Étape 4 — Branchement dashboard

- `get_network_deliveroo_summary` réécrit pour lire `deliveroo_sales_orders` : CA = somme des `subtotal` des commandes **`Terminée`** uniquement, agrégé en `AT TIME ZONE 'Europe/Paris'` sur `sent_at`, filtré par restaurants autorisés. Commission et net exposés en plus.
- Alimente automatiquement : tuile « CA Deliveroo », répartition réseau, mix canaux, comparatif restaurants, vue quotidienne.
- Vues Finances / Versements : Deliveroo en brut / commission / net, même format de sortie qu'Uber.
- `deliveroo_orders` (relevés) reste en place et continue d'alimenter éco-contribution / ajustements ; aucune régression.

## Étape 5 — Front

Onglet « Deliveroo — Commandes » dans la page Imports : dépôt du CSV, aperçu (nb lignes, période, total CA/commission/net, noms non reconnus), bouton d'import, résumé post-import, historique. Réutilise les composants d'import existants.

## Point à trancher

La spec signale que le « Sous-total » du rapport Commandes est ~30 % supérieur aux « Ventes brutes » du rapport Performance (probablement les promos). Par défaut je prends **Sous-total = CA brut TTC**, cohérent avec le CA Uber affiché TTC avant promos. À réviser quand l'export Performance sera fourni — le champ étant stocké tel quel, aucun ré-import ne sera nécessaire.

## Validation

Import du fichier `deliveroo_orders_clean_20260701_16.csv` (22 156 commandes) puis contrôle des totaux attendus côté Chicken Street : CA 527 958 €, commission + TVA 114 276 €, net 413 683 €.
