
# Corriger l'affichage de tous les mois en vue annuelle

## Probleme

La requete qui charge les donnees "payouts" pour toute l'annee ne specifie pas de limite, donc Supabase applique sa limite par defaut de **1 000 lignes**. L'annee 2025 contient **5 207 lignes** au total. Comme le tri est decroissant par date, seuls les 1 000 derniers enregistrements sont charges (Decembre + Novembre + un bout d'Octobre).

## Solution

Modifier la requete dans `src/pages/Analytics.tsx` (lignes 348-360) pour paginer les resultats ou utiliser une approche RPC agrégée.

**Approche retenue** : Ajouter `.limit(10000)` a la requete pour s'assurer de recuperer toutes les lignes. Supabase supporte des limites bien superieures a 1000, il suffit de la specifier explicitement.

```text
Avant:  query = supabase.from('payouts').select('*').gte(...).lte(...).order(...)
Apres:  query = supabase.from('payouts').select('*').gte(...).lte(...).order(...).limit(10000)
```

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/Analytics.tsx` | Ajouter `.limit(10000)` a la requete payouts annuelle (ligne ~360) |

Modification d'une seule ligne, impact immediat : tous les mois de janvier a decembre seront visibles.
