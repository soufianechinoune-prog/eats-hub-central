

## Objectif
Isoler les données éco-contribution par marque : snapshots REP, snapshots de lignes éco, et graphique d'évolution ne doivent afficher que les données de la marque active.

## Problemes confirmés
1. **"32 vérifications" dans le graphique d'évolution REP** : `useRepCheckPersistence` charge TOUS les `rep_check_snapshots` sans filtre — ce sont les scans Chicken Street qui s'affichent sur TASTY.
2. **"1 non trouvés" dans Adhésion REP** : le snapshot cached vient de Chicken Street, pas de TASTY.
3. **`eco_line_snapshots`** : chargé globalement à la ligne 109 de `EcoContributionSection.tsx`, sans filtre de marque.

## Plan de correction

### 1. Ajouter `chain_id` aux tables de snapshots
- Migration SQL : ajouter une colonne `chain_id` (UUID nullable) aux tables `rep_check_snapshots` et `eco_line_snapshots`.
- Les nouveaux scans enregistreront le `chain_id` actif.
- Les anciens snapshots (sans `chain_id`) resteront associés à Chicken Street par défaut.

### 2. Filtrer `useRepCheckPersistence` par marque
- `src/hooks/useRepCheckPersistence.ts`
- Ajouter un paramètre `chainId` au hook.
- Filtrer la query `rep_check_snapshots` par `chain_id`.
- L'écriture de snapshot inclura le `chain_id`.
- Le graphique d'évolution n'affichera que les scans de la marque active.

### 3. Filtrer `eco_line_snapshots` par marque
- `src/components/analytics/EcoContributionSection.tsx`
- Passer le `selectedChainId` au composant.
- Filtrer la query `eco_line_snapshots` par `chain_id`.
- L'écriture de snapshot inclura le `chain_id`.

### 4. Propager `selectedChainId` dans les props
- `src/pages/Analytics.tsx` : passer `selectedChainId` au composant `EcoContributionSection`.
- `src/components/analytics/EcoContributionSection.tsx` : passer `chainId` à `useRepCheckPersistence`.

### 5. Corriger le scan REP pour TASTY
- Le bouton "Actualiser adhésions" sur TASTY ne produit aucun résultat car il query les restaurants par `restaurantIds` qui sont correctement scopés.
- Mais le résultat du scan est sauvegardé dans un snapshot SANS `chain_id`, donc au prochain chargement il se mélange avec les snapshots CS.
- Après la correction, le scan TASTY créera un snapshot avec le bon `chain_id` et ne récupérera que ses propres snapshots.

### Résultat attendu
- TASTY : 0 vérification REP, graphique d'évolution vide, données éco-contribution vierges.
- Chicken Street : conserve ses 32 vérifications et toutes ses données intactes.
- Chaque nouveau scan est isolé par marque.

