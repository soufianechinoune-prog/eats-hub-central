

# Plan : Renommer les restaurants avec les noms du CSV Uber

## Objectif

Modifier l'outil de mapping pour qu'il :
1. **Renomme** les restaurants en base avec les noms officiels du CSV Uber
2. **Protège** les 4 restaurants déjà matchés (ne pas modifier leurs noms)
3. **Associe** les `uber_store_id` comme avant

## Restaurants protégés (ne seront PAS modifiés)

| Restaurant | uber_store_id |
|------------|---------------|
| CHICKEN STREET ANTONY | 250e04f7-... |
| CHICKEN STREET ATHIS-MONS | adeed447-... |
| CHICKEN STREET BONNEUIL-SUR-MARNE | 723fa695-... |
| CHICKEN STREET JUVISY-SUR-ORGE | 051979ae-... |

## Comportement modifié

```text
┌─────────────────────────────────────────────────────────────────┐
│  Mapping Uber Eats                                              │
├─────────────────────────────────────────────────────────────────┤
│  Store CSV                │ Restaurant à associer │ Nouveau nom │
│───────────────────────────┼───────────────────────┼─────────────│
│  Chicken Street - Annecy  │ [CHICKEN STREET...]▼  │ ✓ Renommer  │
│  Chicken Street - Lyon 1  │ [CHICKEN STREET...]▼  │ ✓ Renommer  │
│  Chicken Street - Antony  │ ✓ Déjà associé        │ 🔒 Protégé  │
├─────────────────────────────────────────────────────────────────┤
│                    [ Enregistrer ]                              │
└─────────────────────────────────────────────────────────────────┘
```

## Modifications techniques

### Fichier : `src/pages/UberStoreMapping.tsx`

1. **Ajouter une colonne "Renommer"** dans le tableau
   - Afficher le nouveau nom proposé (depuis le CSV)
   - Cocher par défaut pour les restaurants non protégés

2. **Protéger les 4 restaurants matchés**
   - Si `matchedRestaurantId` existe → badge "🔒 Protégé"
   - Pas de modification du nom ni du mapping

3. **Modifier la mutation de sauvegarde**
   - En plus de mettre à jour `uber_store_id`
   - Mettre à jour `name` avec le nom du CSV (si coché)

```typescript
// Dans la mutation de sauvegarde
for (const { storeId, restaurantId, newName } of updates) {
  const updateData: any = { uber_store_id: storeId };
  
  // Renommer seulement si demandé
  if (newName) {
    updateData.name = newName;
  }
  
  await supabase
    .from("restaurants")
    .update(updateData)
    .eq("id", restaurantId);
}
```

4. **Ajouter un état pour les renommages**
   - `renamings: Record<storeId, { restaurantId, newName, enabled }>`
   - Checkbox pour activer/désactiver le renommage par restaurant

## Sécurités

- Les 4 restaurants avec `uber_store_id` existant ne seront jamais modifiés
- Confirmation visuelle avec badge "🔒 Protégé"
- Pas de checkbox de renommage pour les restaurants protégés

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/pages/UberStoreMapping.tsx` | Ajouter colonne renommage + protection des 4 matchés |

