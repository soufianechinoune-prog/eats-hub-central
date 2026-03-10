

## Problème

La page liste des restaurants (`/restaurants`) résout le nom du gérant via un join `manager_restaurants(managers(...))` **sans filtre**. Résultat : pour des restaurants comme Bourg-en-Bresse, Bonneuil, Athis-Mons et Juvisy, le premier enregistrement retourné dans `manager_restaurants` est celui de Jamel Chinoune (qui est lié à de nombreux restaurants), même s'il n'est pas le gérant principal.

La page détail, elle, utilise directement `manager_first_name` / `manager_last_name` de la table `restaurants`, d'où l'incohérence.

## Solution

Filtrer le join `manager_restaurants` pour ne récupérer que le gérant principal (`is_primary = true`). Si aucun lien primaire n'existe, fallback sur les champs legacy `manager_first_name` / `manager_last_name`.

## Fichier modifié

**`src/pages/Restaurants.tsx`** — 1 changement dans la query Supabase :

```
// Avant
manager_restaurants(managers(first_name, last_name))

// Après
manager_restaurants!inner(managers(first_name, last_name)).eq(is_primary, true)
```

En réalité, avec l'API Supabase PostgREST, le filtre sur une relation imbriquée se fait ainsi :

```typescript
.select(`
  *,
  manager_restaurants!left(managers!inner(first_name, last_name))
`)
// puis ajouter un filtre sur la relation
.eq("manager_restaurants.is_primary", true)
```

Le reste du code (affichage `[0]?.managers`, tri) reste identique car la structure de données ne change pas — on filtre juste pour ne garder que le bon enregistrement.

