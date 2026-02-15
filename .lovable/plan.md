

# Corriger l'import CSV : colonnes manquantes, deduplication adjustments, header chunking

## Diagnostic

Apres analyse du fichier CSV uploade et du code, trois problemes sont identifies :

### 1. Colonnes du format 2025 non reconnues

Le fichier utilise de nouveaux noms de colonnes que le `COLUMN_MAPPING` ne connait pas :

| Colonne CSV (2025) | Mapping attendu | Statut |
|---|---|---|
| Ajustement marketing (TVA incluse) | marketing_fee_adjustment | MANQUANT |
| Frais de preparation et emballage | packaging_fee | MANQUANT |
| Frais de sac | bag_fee | MANQUANT |
| Ajustements de prix (hors TVA) | price_adjustment_excl_vat | MANQUANT |
| Ajustements de prix (TVA incluse) | price_adjustment_incl_vat | MANQUANT |
| Utilisations de l'offre de livraison (hors TVA) | delivery_promo_excl_vat | MANQUANT |
| TVA sur les utilisations de l'offre de livraison | vat_delivery_promo | MANQUANT |
| Utilisations de l'offre de livraison (TVA incluse) | delivery_promo_incl_vat | MANQUANT |
| TVA sur les frais pour preparation et emballage (minuscule) | vat_packaging_fee | MANQUANT |

### 2. Erreur "ON CONFLICT DO UPDATE cannot affect row a second time"

Les `payout_adjustments` (lignes sans uber_order_id, ex: "Depenses publicitaires") peuvent partager la meme cle composite `(payout_reference_id, description, uber_store_id)` dans un batch. PostgreSQL refuse l'upsert.

### 3. Chunks 2+ echouent : "Could not find header row"

Le fichier a 2 lignes pre-data : ligne 1 = descriptions longues, ligne 2 = headers courts. Le chunking n'envoie que la ligne 2 (headerLine). L'edge function cherche les headers dans les 20 premieres lignes et les trouve, mais certains formats necessitent aussi la ligne de description pour le parsing correct.

## Solution

### Fichier 1 : `supabase/functions/parse-payment-report/index.ts`

**A. Ajouter les colonnes manquantes au COLUMN_MAPPING (lignes 48-69)**

Ajouter toutes les variantes 2025 des noms de colonnes :

```text
'Ajustement marketing (TVA incluse)': 'marketing_fee_adjustment'
'Ajustements de prix (hors TVA)': 'price_adjustment_excl_vat'
'Ajustements de prix (TVA incluse)': 'price_adjustment_incl_vat'
'Frais de preparation et emballage': 'packaging_fee'  (sans "d'")
'TVA sur les frais pour preparation et emballage': 'vat_packaging_fee' (minuscule)
'Frais de sac': 'bag_fee'
"Utilisations de l'offre de livraison (hors TVA)": 'delivery_promo_excl_vat'
"TVA sur les utilisations de l'offre de livraison": 'vat_delivery_promo'
"Utilisations de l'offre de livraison (TVA incluse)": 'delivery_promo_incl_vat'
```

**B. Dedupliquer les adjustments avant upsert (Phase 4, lignes 853-882)**

Avant l'upsert, grouper les adjustments par cle `(payout_reference_id, description, uber_store_id)` en sommant les montants. Meme approche que la Phase 1.5 pour les orders.

### Fichier 2 : `src/pages/ReportImport.tsx`

**C. Inclure toutes les lignes pre-header dans chaque chunk (lignes 1063-1084)**

Remplacer `[headerLine, ...dataLines.slice(start, end)]` par `[...preHeaderLines, ...dataLines.slice(start, end)]` ou `preHeaderLines = allRecords.slice(0, headerIndex + 1)`. Cela inclut la ligne de description ET la ligne de header dans chaque chunk.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/parse-payment-report/index.ts` | ~10 nouvelles variantes de colonnes dans COLUMN_MAPPING ; deduplication des adjustments avant Phase 4 |
| `src/pages/ReportImport.tsx` | Inclure toutes les lignes pre-header (description + header) dans chaque chunk |

## Resultat attendu

- Toutes les colonnes financieres du format 2025 sont correctement mappees et importees
- Plus d'erreur "ON CONFLICT" sur les adjustments dupliques
- Tous les chunks trouvent le header correctement
- Le fichier de 1858 commandes devrait s'importer a 100% sans erreur

