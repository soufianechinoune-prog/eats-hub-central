

# Plan : Import automatique + création des nouveaux restaurants

## Ce que le système fera

```text
┌──────────────────────────────────────────────────────────────────┐
│  Pour chaque restaurant dans le CSV :                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Est-ce un des 4 protégés ?                                   │
│     → OUI : On ne touche à rien                                  │
│     → NON : Continuer                                            │
│                                                                  │
│  2. Match trouvé en base (similarité > 70%) ?                    │
│     → OUI : Renommer avec le nom CSV + ajouter uber_store_id     │
│     → NON : CRÉER un nouveau restaurant avec le nom CSV          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Interface simplifiée

```text
┌─────────────────────────────────────────────────────────────────┐
│  Import des restaurants Uber Eats                               │
├─────────────────────────────────────────────────────────────────┤
│  📄 restaurant_rating_local.csv                                 │
│                                                                 │
│  Résumé :                                                       │
│  🔒 4 protégés (Antony, Athis-Mons, Bonneuil, Juvisy)          │
│  ✏️  52 à renommer (match trouvé en base)                       │
│  ➕ 34 à créer (pas de match)                                   │
│                                                                 │
│  ┌────────────────────────────┬───────────────────┬────────────┐│
│  │ Nom CSV                    │ Action            │ Match %    ││
│  ├────────────────────────────┼───────────────────┼────────────┤│
│  │ Chicken Street - Annecy    │ ✏️ Renommer       │ 85%        ││
│  │ Chicken Street - Lyon 1    │ ➕ Créer          │ —          ││
│  │ Chicken Street - Antony    │ 🔒 Protégé        │ —          ││
│  └────────────────────────────┴───────────────────┴────────────┘│
│                                                                 │
│           [ Appliquer les changements ]                         │
└─────────────────────────────────────────────────────────────────┘
```

## Actions automatiques

| Situation | Action |
|-----------|--------|
| Restaurant protégé (déjà uber_store_id) | Aucune modification |
| Match trouvé (similarité > 70%) | `UPDATE name = csvName, uber_store_id = storeId` |
| Pas de match | `INSERT INTO restaurants (name, chain_id, uber_store_id, is_active)` |

## Après l'import

Toi tu pourras :
1. Voir la liste des restaurants en base
2. Supprimer manuellement les doublons/orphelins (ceux qui n'ont pas été matchés)
3. Faire un autre import si nécessaire

## Modifications techniques

### Fichier : `src/pages/UberStoreMapping.tsx`

1. **Simplifier le parsing du CSV**
   - Extraire `store_id` et `store_name` pour chaque ligne
   - Calculer automatiquement le meilleur match en base

2. **Catégoriser chaque restaurant**
   ```typescript
   type ImportAction = 'protected' | 'rename' | 'create';
   
   interface ImportItem {
     storeId: string;
     storeName: string;        // Nom du CSV
     action: ImportAction;
     matchedRestaurantId?: string;
     matchedRestaurantName?: string;
     similarity?: number;
   }
   ```

3. **Nouvelle mutation d'import**
   ```typescript
   // Pour les renommages
   await supabase
     .from("restaurants")
     .update({ name: storeName, uber_store_id: storeId })
     .eq("id", matchedId);
   
   // Pour les créations
   await supabase
     .from("restaurants")
     .insert({
       name: storeName,
       uber_store_id: storeId,
       chain_id: "chicken-street",  // ID de la chaîne par défaut
       is_active: true
     });
   ```

4. **Affichage simplifié**
   - Liste avec icônes : 🔒 Protégé, ✏️ Renommer, ➕ Créer
   - Bouton unique "Appliquer les changements"
   - Compteurs en haut (protégés, renommés, créés)

## Sécurités

- Les 4 restaurants avec `uber_store_id` existant ne sont JAMAIS modifiés
- Affichage clair de ce qui va se passer AVANT validation
- Possibilité de voir le % de similarité pour les renommages

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/pages/UberStoreMapping.tsx` | Refonte pour import automatique + création |

