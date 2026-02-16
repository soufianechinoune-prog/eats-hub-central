

# Remplacer la source CA/CMDS par la table `orders`

## Contexte

Le tableau "Comparatif des restaurants" (Overview) et les KPIs reseau utilisent la vue `daily_sales_uber_deduped` pour le CA (revenue) et le nombre de commandes. Cette vue est alimentee par le fichier "Sales Over Time" d'Uber Eats.

**Probleme** : ce fichier n'a ete importe que pour 4 restaurants sur 94. Les 90 autres affichent 0 EUR / 0 commandes.

**Solution** : la table `orders` (alimentee par le fichier "Detail par commande", deja importe pour 94 restaurants / 1,6M lignes) contient toutes les donnees necessaires : `sales_incl_vat` (CA TTC) et le comptage des lignes (nombre de commandes).

## Plan technique

### 1. Creer une fonction RPC d'agregation `get_daily_sales_from_orders`

Creer une fonction SQL qui agrege la table `orders` par restaurant et par jour, retournant les memes colonnes que `daily_sales_uber_deduped` :

- `restaurant_id`
- `date` (extrait de `order_datetime`)
- `revenue_ttc` = SUM(`sales_incl_vat`)
- `order_count` = COUNT(*)
- `average_basket` = revenue_ttc / order_count

Filtres : periode (start_date, end_date) et optionnellement liste de restaurant_ids.

### 2. Modifier `useNetworkStats.ts`

Remplacer la requete sur `daily_sales_uber_deduped` par un appel a la nouvelle RPC `get_daily_sales_from_orders`. Les colonnes retournees sont identiques, donc le reste du hook ne change pas.

### 3. Modifier `Overview.tsx`

Meme remplacement : la requete paginee sur `daily_sales_uber_deduped` (lignes ~367-390) devient un appel RPC. Le format de sortie reste le meme (`restaurant_id, date, revenue_ttc, order_count, average_basket`).

### 4. Verifier les autres consommateurs

Rechercher tous les usages de `daily_sales_uber_deduped` dans le code et les migrer vers la nouvelle RPC :
- `useNetworkStats.ts` (KPIs reseau)
- `Overview.tsx` (tableau comparatif)
- `generate-weekly-report` (edge function pour rapports WhatsApp)
- Tout autre fichier referençant cette vue

### 5. Conservation de `daily_sales_uber` comme source secondaire

La table `daily_sales_uber` et sa vue ne sont pas supprimees. Elles restent disponibles comme reference mais ne sont plus la source primaire pour CA/CMDS.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Creer la RPC `get_daily_sales_from_orders` |
| `src/hooks/useNetworkStats.ts` | Remplacer `daily_sales_uber_deduped` par appel RPC |
| `src/pages/Overview.tsx` | Remplacer `daily_sales_uber_deduped` par appel RPC |
| `supabase/functions/generate-weekly-report/index.ts` | Remplacer `daily_sales_uber_deduped` par requete directe sur `orders` |

## Resultat attendu

- Les 94 restaurants afficheront leur vrai CA et nombre de commandes
- Plus besoin d'importer le fichier "Sales Over Time" un par un
- Les donnees sont coherentes avec le fichier "Detail par commande" deja importe en masse
