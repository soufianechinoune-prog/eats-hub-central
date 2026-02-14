
# Correction des erreurs d'import des commandes incorrectes

## Problemes identifies

### 1. 500 erreurs : incompatibilite NULL dans l'upsert
L'index unique en base utilise `COALESCE(item_title, '')` mais le code envoie `item_title: null` quand il n'y a pas d'article. PostgreSQL ne peut pas resoudre le conflit avec des valeurs NULL (NULL != NULL en SQL), donc l'upsert echoue pour toutes les lignes sans item.

### 2. 393 ignorees : restaurants non trouves
Certaines lignes du CSV contiennent des noms de restaurants qui ne matchent pas avec la base. Le matching actuel normalise le nom et cherche une correspondance exacte ou partielle via "Chicken Street - [ville]". Si le nom dans le CSV differe (accents, tirets, espaces), le match echoue.

### 3. Mauvaise agregation des resultats par chunk
Le code de chunking (initialement ecrit pour `order_history`) cherche les donnees aux mauvais chemins dans la reponse du parser `inaccurate_orders` :
- `chunkResult.errors` au lieu de `chunkResult.errorDetails`
- `chunkResult.restaurants` au lieu de `chunkResult.validation.restaurants`
- `chunkResult.dateRange` au lieu de `chunkResult.validation.dateRange`

## Corrections prevues

### Fichier : `supabase/functions/parse-inaccurate-orders/index.ts`

**Correction 1 - NULL -> chaine vide** (ligne 345) :
```text
// AVANT
item_title: itemTitle || null,

// APRES
item_title: itemTitle || '',
```
Cela garantit que la valeur correspond au `COALESCE(item_title, '')` de l'index unique.

**Correction 2 - Meilleur matching des restaurants** :
Ajouter un matching par `uber_store_id` si la colonne "ID restaurant" ou "Store ID" est presente dans le CSV, et ameliorer le matching partiel pour gerer les variations courantes (accents, tirets, espaces supplementaires).

### Fichier : `src/pages/ReportImport.tsx`

**Correction 3 - Agregation des chunks** (lignes ~972-998) :
Adapter le code de chunking pour lire les donnees au bon chemin selon le type de rapport :
```text
// Pour inaccurate_orders, les donnees sont dans validation.*
const restaurants = chunkResult.validation?.restaurants || chunkResult.restaurants || [];
const dateRange = chunkResult.validation?.dateRange || chunkResult.dateRange;
const errors = chunkResult.errorDetails || chunkResult.errors || [];
```

## Resume des changements

| Fichier | Changement | Impact |
|---------|-----------|--------|
| Edge Function `parse-inaccurate-orders` | `item_title` : null -> '' | Elimine les 500 erreurs d'upsert |
| Edge Function `parse-inaccurate-orders` | Matching restaurant ameliore | Reduit les 393 ignorees |
| `ReportImport.tsx` | Chemins d'agregation adaptes | Affichage correct des stats et erreurs par chunk |
