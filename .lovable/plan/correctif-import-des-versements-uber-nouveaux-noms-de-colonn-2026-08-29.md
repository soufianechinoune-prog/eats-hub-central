# Correctif import des versements Uber (nouveaux noms de colonnes)

## Objectif

Reprendre en compte les colonnes renommées par Uber dans les rapports de versement, puis re-importer les données depuis juin 2026 pour rattraper ce qui a été perdu.

## Ce qui sera fait

### 1. Ajouter les nouveaux noms de colonnes aux deux parseurs

Dans `parse-payment-report` et `parse-payout-summary`, ajouter en alias (les anciens noms restent supportés, aucun fichier historique cassé) :

| Nouveau nom Uber | Champ interne |
|---|---|
| Identifiant de l'établissement externe | identifiant restaurant (secondaire) |
| UUID de l'établissement | identifiant restaurant |
| Montant de la facturation rétroactive (hors TVA) | ajustement erreurs de commande HT |
| TVA sur le montant de la facturation rétroactive | TVA sur ajustement |
| Montant de la facturation rétroactive (TVA incluse) | ajustement erreurs de commande TTC |

Règle de priorité conservée : `Id. du restaurant` reste la source principale tant qu'il est présent ; les nouveaux identifiants ne servent qu'en secours, pour éviter toute régression de rattachement.

### 2. Élucider la chute des montants publicitaires depuis juin

Constat vérifié : mêmes volumes de lignes mais plus aucune ligne pub > 300 € depuis juin (moyenne 266 € → 40 €), sur les deux enseignes. Ce n'est pas expliqué par les renommages ci-dessus.

Étape de diagnostic avant toute correction : comparer, sur une même semaine et un même restaurant, la ligne « Dépenses publicitaires » du rapport Uber brut avec ce qui est stocké, pour déterminer si Uber a scindé la facturation pub (nouvelle colonne / nouvelle description) ou si la dépense a réellement baissé. Le correctif éventuel dépendra de ce résultat, il n'est pas décidé d'avance.

### 3. Re-parser l'historique depuis juin 2026

Une fois les parseurs corrigés, relancer le parsing des rapports `PAYMENT_DETAILS_REPORT` déjà reçus (juin → août 2026) pour les deux enseignes, par lots pour éviter les timeouts. Les écritures sont en upsert : pas de doublons créés.

### 4. Vérification finale

- Les ajustements « facturation rétroactive » remontent bien dans `orders` (remboursements) pour juillet-août.
- Aucune ligne orpheline (restaurant non rattaché) sur les imports rejoués.
- Comparaison avant/après des totaux mensuels par catégorie dans `payout_adjustments`.

## Détails techniques

- Fichiers : `supabase/functions/parse-payment-report/index.ts` (COLUMN_MAPPING + `inferColumnMapping`), `supabase/functions/parse-payout-summary/index.ts` (COLUMN_MAPPING).
- Attention aux apostrophes typographiques : Uber utilise `’` (U+2019) dans « Identifiant de l’établissement externe ». `normalizeHeader` sera étendu pour normaliser `’` en `'` afin que les deux variantes matchent.
- Le re-parsing réutilise `parse-report-csv` / l'appel direct de `parse-payment-report` sur les rapports stockés, aucune nouvelle demande à l'API Uber n'est nécessaire.
- Aucun changement de schéma de base de données.
