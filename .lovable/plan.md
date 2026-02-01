

# Simplification : Toujours demander le restaurant pour les gérants multi-sites

## Problème actuel

La logique actuelle essaie d'être "intelligente" :
1. Si plusieurs restaurants → cherche le contexte du dernier rapport envoyé
2. Si contexte trouvé → utilise ce restaurant
3. Si pas de contexte → demande de choisir

**Mais c'est un mauvais comportement !** Quand tu as reçu 3 rapports (Antony, Athis-Mons, Bonneuil) et que tu réponds "2", le système ne devrait pas deviner. Il devrait te demander.

## Solution proposée

**Supprimer la logique de contexte** et toujours demander quand le gérant a plusieurs restaurants :

```text
Gérant avec 1 restaurant → Génère directement le rapport
Gérant avec N restaurants → Toujours demande lequel
```

## Modifications techniques

### Fichier : `supabase/functions/ultramsg-webhook/index.ts`

**Simplifier la logique (lignes 1820-1862) :**

Avant (complexe) :
```typescript
if (managerRestaurants.length > 1) {
  const recentContext = await getRecentReportContext(supabase, normalizedPhone);
  if (recentContext) {
    targetRestaurant = managerRestaurants.find(...);
  }
  if (!targetRestaurant) {
    await sendRestaurantSelectionPrompt(...);
  }
}
```

Après (simple) :
```typescript
if (managerRestaurants.length > 1) {
  // Toujours demander pour un gérant multi-restaurants
  await sendRestaurantSelectionPrompt(
    supabase,
    normalizedPhone,
    managerRestaurants.map((r: any) => ({ id: r.id, name: r.name })),
    menuResponse.reportType,
    menuResponse.detailLevel,
    manager?.first_name || 'Manager'
  );
  return new Response(
    JSON.stringify({ success: true, type: 'awaiting_restaurant_selection' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
} else {
  // Un seul restaurant - utiliser celui-là
  targetRestaurant = managerRestaurants[0];
}
```

### Optionnel : Supprimer `getRecentReportContext`

Cette fonction devient inutile avec la nouvelle logique. On peut la supprimer ou la garder pour un usage futur.

## Nouveau flux utilisateur

### Gérant avec 1 restaurant
```
[Gérant]  → "2"
[Système] → Rapport CA (son unique restaurant) ✅
```

### Gérant avec plusieurs restaurants
```
[Système] → Rapport Athis-Mons
[Système] → Rapport Antony
[Système] → Rapport Bonneuil
[Gérant]  → "2"
[Système] → "Tu gères plusieurs restaurants. Lequel ?
              1. Athis-Mons
              2. Juvisy
              3. Antony
              4. Bonneuil
              5. Bourg-en-Bresse"
[Gérant]  → "3"
[Système] → Rapport CA Antony ✅
```

## Fichiers à modifier

| Fichier | Modifications |
|---------|--------------|
| `supabase/functions/ultramsg-webhook/index.ts` | Supprimer la logique de contexte, toujours demander pour multi-restaurants |

## Résultat attendu

- Plus de confusion sur "quel restaurant"
- Comportement prévisible et clair
- Le gérant choisit toujours explicitement quand il a plusieurs restaurants

