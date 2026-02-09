
# Résolution interactive des store_id non configurés

## Objectif

Quand l'écran `/report-import` détecte des `unknownStoreIds`, au lieu de simplement afficher un avertissement, on propose à l'utilisateur de :
1. Choisir un restaurant existant dans la liste pour y associer le store_id
2. OU créer un nouveau restaurant avec le nom du fichier

## UX proposée

Dans l'alerte "Restaurants non configurés", on ajoute :
- Un bouton pour chaque store_id inconnu qui ouvre un **popover/dialog** avec :
  - Une liste déroulante des restaurants existants
  - Un bouton "Créer un nouveau restaurant"
- Le nom du restaurant dans le CSV sera affiché si disponible
- Une fois tous les store_id mappés → l'import peut continuer

## Modifications techniques

### Fichier : `src/pages/ReportImport.tsx`

**1. Ajouter un état pour stocker les mappings en cours**
```typescript
const [storeIdMappings, setStoreIdMappings] = useState<Record<string, string | null>>({});
const [unknownStoreNames, setUnknownStoreNames] = useState<Record<string, string>>({});
```

**2. Modifier la zone d'alerte des unknownStoreIds (lignes ~1700-1730)**
- Pour chaque store_id inconnu, afficher un **Select** avec :
  - Liste des restaurants existants
  - Option "Créer nouveau restaurant"
- Stocker le choix dans `storeIdMappings[storeId] = restaurantId`

**3. Ajouter une fonction pour appliquer les mappings**
```typescript
const applyStoreIdMappings = async () => {
  for (const [storeId, restaurantId] of Object.entries(storeIdMappings)) {
    if (!restaurantId) continue;
    
    if (restaurantId === "__create__") {
      // Créer un nouveau restaurant avec le nom du fichier
      const storeName = unknownStoreNames[storeId] || `Restaurant ${storeId.slice(0, 8)}`;
      const { data: newResto } = await supabase.from("restaurants").insert({
        name: storeName,
        uber_store_id: storeId,
        is_active: true,
      }).select().single();
      // Re-mapper avec le nouvel ID
    } else {
      // Mettre à jour le restaurant existant avec le nouveau store_id
      await supabase.from("restaurants")
        .update({ uber_store_id: storeId })
        .eq("id", restaurantId);
    }
  }
  // Invalider le cache et relancer la validation
  queryClient.invalidateQueries({ queryKey: ["restaurants-for-import"] });
  await handleValidate(); // Re-valider
};
```

**4. Récupérer les noms de restaurants depuis le CSV pendant la validation**
- Modifier l'appel au backend pour qu'il retourne aussi les noms correspondant aux store_id inconnus
- Ou parser le CSV côté frontend pour extraire les noms

**5. Ajouter un bouton "Appliquer les correspondances"**
- Désactivé tant que tous les store_id ne sont pas mappés
- Au clic, applique les mappings et relance la validation

### Fichier : Edge Functions (optionnel mais recommandé)

Modifier les parsers (`parse-payout-summary`, `parse-payment-report`) pour retourner :
```typescript
unknownStoreIds: ["uuid1", "uuid2"],
unknownStoreDetails: {
  "uuid1": { name: "Chicken Street - Bonneuil" },
  "uuid2": { name: "Chicken Street - Juvisy" },
}
```

Cela évite de re-parser le CSV côté frontend.

## Interface utilisateur finale

```
┌──────────────────────────────────────────────────────────┐
│ ⚠️ 3 restaurants non configurés                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ a9c2e15c... (Chicken Street - Bonneuil)                 │
│ [▼ Sélectionner un restaurant      ] [Créer nouveau]    │
│                                                          │
│ 8bb9922a... (Chicken Street - Juvisy)                   │
│ [▼ Sélectionner un restaurant      ] [Créer nouveau]    │
│                                                          │
│ 4c9abb94... (Chicken Street - ???)                      │
│ [▼ Sélectionner un restaurant      ] [Créer nouveau]    │
│                                                          │
│                    [Appliquer et revalider]             │
└──────────────────────────────────────────────────────────┘
```

## Avantages

- **Pas besoin d'aller sur /uber-mapping** : tout se fait directement dans le flux d'import
- **On voit le nom du CSV** : ça aide à choisir le bon restaurant
- **Création rapide** : si le restaurant n'existe pas, on peut le créer immédiatement
- **Re-validation automatique** : après mapping, on re-valide pour confirmer que tout est bon

## Fichiers modifiés

1. `src/pages/ReportImport.tsx` - Interface de mapping interactive
2. `supabase/functions/parse-payout-summary/index.ts` - Retourner les noms avec les store_id inconnus (optionnel)
3. `supabase/functions/parse-payment-report/index.ts` - Idem (optionnel)
