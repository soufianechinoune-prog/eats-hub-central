
# Plan : Corriger le matching des avis pour 100 restaurants

## Problème identifié

Le système d'import des avis (`parse-reviews-order`) ne trouve que **4 restaurants sur 97** car :

1. **Seulement 4 restaurants ont un `uber_store_id` renseigné** dans la base
2. Le matching par nom échoue car les noms dans le CSV Uber ne correspondent pas exactement aux noms en base
3. **2245 lignes ont été ignorées** lors de l'import (restaurants non trouvés)

## Solution proposée

### Etape 1 : Enrichir les restaurants avec les `uber_store_id`

Le CSV importé contient une colonne avec l'UUID du restaurant Uber. Il faut :

1. Extraire tous les UUID uniques du CSV avec leur nom de restaurant
2. Afficher une interface de mapping pour associer chaque UUID à un restaurant existant
3. Mettre à jour la colonne `uber_store_id` pour chaque restaurant

### Etape 2 : Améliorer le matching par nom (fallback)

Améliorer la fonction `normalizeName` dans l'Edge Function pour mieux gérer :
- Les variations de noms (CHICKEN STREET vs Chicken Street)
- Les tirets vs espaces (ATHIS-MONS vs ATHIS MONS)
- Les accents et caractères spéciaux

### Etape 3 : Ré-importer les avis

Une fois les `uber_store_id` renseignés, ré-importer le fichier CSV pour que tous les restaurants soient correctement matchés.

---

## Modifications techniques

### Fichier 1 : Nouvelle page de mapping `src/pages/UberStoreMapping.tsx`

Créer une interface qui :
1. Lit le CSV et extrait les paires `(store_id, store_name)`
2. Pour chaque store_id non trouvé, propose un dropdown pour sélectionner le restaurant correspondant
3. Met à jour en masse les `uber_store_id` dans la table `restaurants`

```text
+--------------------------------------------------+
|  Mapping des restaurants Uber Eats               |
+--------------------------------------------------+
| Store Uber                  | Restaurant lié     |
|-----------------------------|--------------------|
| 250e04f7-... (CS Antony)    | ✓ CHICKEN STREET   |
| 723fa695-... (CS Bonneuil)  | ✓ CHICKEN STREET   |
| f8a3b2c1-... (CS Lyon 2e)   | [ Sélectionner ▼ ] |
| d4e5f6a7-... (CS Marseille) | [ Sélectionner ▼ ] |
+--------------------------------------------------+
|        [ Enregistrer les associations ]          |
+--------------------------------------------------+
```

### Fichier 2 : Edge Function `supabase/functions/extract-uber-stores/index.ts`

Nouvelle fonction qui :
1. Parse le CSV
2. Extrait les paires uniques `(uuid, store_name)`
3. Compare avec les `uber_store_id` existants
4. Retourne la liste des stores non associés

### Fichier 3 : Mise à jour de la sidebar

Ajouter un lien vers la page de mapping dans le menu Données.

---

## Alternative rapide (recommandée)

Si tu as le fichier avec tous les UUID Uber, je peux créer un script SQL qui met à jour directement les `uber_store_id` en matchant par nom de ville.

Par exemple :
```sql
-- Associer automatiquement par extraction du nom de ville
UPDATE restaurants 
SET uber_store_id = 'uuid-du-csv'
WHERE name ILIKE '%ATHIS-MONS%';
```

---

## Prochaines étapes

1. **Option A** : Tu me fournis un fichier avec la correspondance nom → UUID Uber, je mets à jour la base
2. **Option B** : Je crée l'interface de mapping pour faire ça visuellement
3. **Option C** : On améliore le matching par nom pour qu'il soit plus tolérant

Quelle option préfères-tu ?
