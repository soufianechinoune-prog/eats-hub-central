## Investigation : pourquoi commandes incorrectes & temps préparation manquent à partir d'avril

### Constat dans la base
| Table | Métrique affichée | Dernière donnée |
|---|---|---|
| `order_history` | Temps préparation, temps prépa+livraison | **31 mars 2026** ❌ |
| `order_errors` | Commandes incorrectes | **31 mars 2026** ❌ |
| `delivery_stats` | (table cible alternative) | **0 ligne** ❌ |
| `customer_reviews` | Note moyenne | OK jusqu'à juin |
| `customer_reviews` (avis produits) | 79 % mars | OK |

Pourtant côté rapports Uber c'est correct :
- **1 277 rapports `ORDER_ERRORS_TRANSACTION_REPORT`** marqués `completed` depuis avril
- **1 417 rapports `ORDER_HISTORY_REPORT`** marqués `completed` depuis avril

Donc Uber renvoie bien les CSV, le webhook les reçoit, mais **le parser n'écrit rien dans les bonnes tables**.

### Cause racine (bug dans `parse-report-csv`)

La fonction `supabase/functions/parse-report-csv/index.ts` est appelée automatiquement par le webhook. Elle a deux problèmes :

**1. `parseOrderHistory` écrit dans la mauvaise table**
```ts
// ligne 150 — devrait être 'order_history' (où tu lis les temps de prépa)
await supabase.from('delivery_stats').upsert(data, ...)
```
Le front lit `order_history.initial_prep_time_minutes`, mais le parser auto écrit dans `delivery_stats` (qui n'existe quasiment plus). Et même `delivery_stats` est vide à 0 ligne → l'insert échoue silencieusement (colonnes ou format de date incompatibles).

**2. Mapping de colonnes CSV erroné pour les deux parsers**
Le code essaie de lire `row.order_id`, `row.Order_ID`, `row.error_category`, `row.Error_Date`… alors que les vrais CSV Uber utilisent des entêtes avec **espaces et casse différente** (ex. `"Order ID"`, `"Refund Date"`, `"Customer Name"`). Aucun champ ne matche → tous les inserts insèrent des `null` et sont rejetés (ou créent des lignes vides invisibles à l'UI).

C'est confirmé par les imports manuels janvier-mars qui, eux, passent par `parse-inaccurate-orders` et `parse-order-history` (fonctions séparées avec le bon mapping) → c'est pour ça que mars a la data : tu avais importé les CSV à la main.

### Pourquoi mars marche et avril pas
- Jan/Fév/Mars : données poussées via **imports CSV manuels** dans Reports (bonnes fonctions)
- Avril/Mai/Juin : repose uniquement sur le **flux automatique via webhook** → tombe dans le parser cassé

---

## Plan de correction

### Étape 1 — Réparer `parse-report-csv`
Réécrire 3 sections du fichier `supabase/functions/parse-report-csv/index.ts` :

- **`parseOrderHistory`** : insérer dans `order_history` (pas `delivery_stats`), avec les vraies colonnes Uber (`Order ID`, `Order Date`, `Preparation Time`, `Total Delivery Time`, `Courier Wait Time`, `Customer Wait Time`, etc.). S'appuyer sur le mapping déjà validé dans `supabase/functions/parse-order-history/index.ts`.

- **`parseOrderErrors`** : aligner les headers sur le format Uber réel (`Order ID`, `Refund Date`, `Customer Name`, `Item Title`, `Refund Amount`, `Error Category`…). S'appuyer sur `supabase/functions/parse-inaccurate-orders/index.ts`.

- **`parseDowntime`** et **`parseCustomerFeedback`** : vérifier rapidement le même type de bug et corriger si besoin.

### Étape 2 — Re-parser l'historique avril/mai/juin
Les rapports sont déjà téléchargés et marqués `completed` côté Uber. Une fois le parser corrigé, lancer un script de re-parse :
- récupérer dans `reports` toutes les lignes `completed` pour `ORDER_HISTORY_REPORT` et `ORDER_ERRORS_TRANSACTION_REPORT` depuis le 1er avril
- ré-invoquer `parse-report-csv` sur chacune (avec le `download_url` stocké dans `sections`)

### Étape 3 — Vérifier
- `SELECT MAX(order_datetime) FROM order_history` → doit atteindre fin mai / début juin
- `SELECT MAX(error_date) FROM order_errors` → idem
- La carte Avril du restaurant doit afficher temps prépa et % erreurs

---

### Détails techniques
- Aucun changement de schéma DB nécessaire — les tables existent et sont correctes.
- Pas de modif au worker ou au cron — ils font leur job.
- Le re-parse de l'historique = ~2 700 invocations de `parse-report-csv` (à throttler à 5-10/s pour éviter les rate limits Uber sur les downloads).
- Pour les `customer_reviews` / `menu_item_reviews` (qui ont l'air OK), on garde sauf si on détecte des trous similaires.

Tu veux que j'enchaîne sur l'implémentation (étape 1 + 2) ?