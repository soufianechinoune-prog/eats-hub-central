

# Gestion du Contexte Multi-Restaurant dans les Réponses WhatsApp

## Problème identifié

Jamel gère 5 restaurants et son restaurant "primaire" est Bourg-en-Bresse. Quand il reçoit un rapport pour Athis-Mons et répond "2", le système répond avec les données de Bourg-en-Bresse car il utilise `primaryRestaurant` par défaut.

## Solution

Implémenter un système de **contexte de conversation** qui :

1. Récupère le dernier rapport envoyé à ce numéro
2. Si trouvé → utilise ce restaurant pour la réponse
3. Si le gérant gère plusieurs restaurants et aucun contexte récent → demande de choisir

## Logique de détection du contexte

Quand un message interactif (1-5) est reçu :

1. Chercher le dernier message sortant de type `report` envoyé à ce numéro dans les dernières 24h
2. Si trouvé → extraire le `restaurant_id` de ce message → utiliser pour le rapport statistique
3. Si non trouvé et plusieurs restaurants → envoyer un message de clarification avec la liste des restaurants

## Modifications techniques

### Fichier : `supabase/functions/ultramsg-webhook/index.ts`

**Nouvelle fonction pour récupérer le contexte :**

```typescript
async function getRecentReportContext(
  supabase: any, 
  phone: string, 
  hours: number = 24
): Promise<{ restaurantId: string; restaurantName: string } | null> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data: recentReport } = await supabase
    .from('message_history')
    .select('restaurant_id, restaurant_name')
    .eq('direction', 'outbound')
    .eq('message_type', 'report')
    .eq('recipient_phone', phone)
    .not('restaurant_id', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (recentReport?.restaurant_id) {
    return {
      restaurantId: recentReport.restaurant_id,
      restaurantName: recentReport.restaurant_name
    };
  }
  return null;
}
```

**Nouvelle fonction pour demander clarification :**

```typescript
async function sendRestaurantSelectionPrompt(
  supabase: any,
  phone: string,
  restaurants: Array<{ id: string; name: string }>,
  reportType: string,
  detailLevel: string,
  managerName: string
) {
  // Extraire les noms de ville
  const restaurantList = restaurants.map((r, index) => {
    const cityName = extractCityName(r.name);
    return `${index + 1}. ${cityName}`;
  }).join('\n');
  
  const message = `Salut ${managerName} ! 👋

Tu gères plusieurs restaurants. Pour quel établissement veux-tu le rapport ?

${restaurantList}

💡 Réponds avec le numéro correspondant (ex: "1" pour ${extractCityName(restaurants[0].name)})`;

  // Envoyer le message via Ultramsg
  await sendWhatsAppMessage(supabase, phone, message);
  
  // Stocker le contexte d'attente de sélection
  // On pourra utiliser un cache temporaire ou une table dédiée
}
```

**Modification de la logique existante (lignes 1697-1715) :**

```typescript
if (managerRestaurants.length > 0 && menuResponse.isMenu && menuResponse.reportType) {
  console.log(`Interactive menu response detected: ${menuResponse.reportType} (${menuResponse.detailLevel})`);
  
  let targetRestaurant = null;
  
  // Si le gérant a plusieurs restaurants, chercher le contexte du dernier rapport
  if (managerRestaurants.length > 1) {
    const recentContext = await getRecentReportContext(supabase, normalizedPhone);
    
    if (recentContext) {
      // Trouver le restaurant correspondant
      targetRestaurant = managerRestaurants.find(
        (r: any) => r.id === recentContext.restaurantId
      );
      if (targetRestaurant) {
        console.log(`Using context from recent report: ${recentContext.restaurantName}`);
      }
    }
    
    // Si toujours pas de contexte, demander clarification
    if (!targetRestaurant) {
      console.log('Multiple restaurants, no recent context - asking for selection');
      await sendRestaurantSelectionPrompt(
        supabase,
        normalizedPhone,
        managerRestaurants,
        menuResponse.reportType,
        menuResponse.detailLevel,
        manager?.first_name || 'Manager'
      );
      return new Response(
        JSON.stringify({ success: true, type: 'awaiting_restaurant_selection' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } else {
    // Un seul restaurant - utiliser celui-là
    targetRestaurant = managerRestaurants[0];
  }
  
  // Générer le rapport pour le restaurant cible
  handleInteractiveReportRequest(
    supabase,
    targetRestaurant,
    menuResponse.reportType,
    menuResponse.detailLevel,
    normalizedPhone,
    manager?.first_name || targetRestaurant?.manager_first_name || 'Manager'
  ).catch((err: Error) => console.error('Interactive report error:', err));
  
  return new Response(
    JSON.stringify({ success: true, type: 'interactive_menu_response' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Gestion de la réponse à la sélection de restaurant :**

Ajouter une nouvelle détection pour les réponses numériques qui correspondent à une sélection de restaurant (après avoir demandé clarification).

## Flux utilisateur amélioré

### Cas 1 : Contexte récent trouvé
```
[Système] → Rapport Athis-Mons
[Gérant]  → "2"
[Système] → Rapport CA Athis-Mons ✅
```

### Cas 2 : Pas de contexte récent
```
[Gérant]  → "2"
[Système] → "Tu gères plusieurs restaurants. Lequel ?
              1. Athis-Mons
              2. Juvisy
              3. Antony
              4. Bourg-en-Bresse
              5. Bonneuil"
[Gérant]  → "1"
[Système] → Rapport CA Athis-Mons ✅
```

### Cas 3 : Gérant avec 1 seul restaurant
```
[Gérant]  → "2"
[Système] → Rapport CA (son unique restaurant) ✅
```

## Fichiers à modifier

| Fichier | Modifications |
|---------|--------------|
| `supabase/functions/ultramsg-webhook/index.ts` | Nouvelle fonction `getRecentReportContext`, `sendRestaurantSelectionPrompt`, et modification de la logique de détection du menu interactif |
| `src/lib/restaurantUtils.ts` | Réutilisation de `extractCityName` (déjà existant) |

## Considérations techniques

1. **Fenêtre de contexte** : 24h semble raisonnable. Au-delà, on demande clarification.
2. **Pas de table supplémentaire** : On utilise `message_history` existante pour le contexte.
3. **Performance** : Une seule requête supplémentaire pour récupérer le contexte.
4. **Dépendance** : Réutilise la fonction `extractCityName` pour afficher les noms courts dans la liste.

## Résultat attendu

Les gérants multi-restaurants recevront les rapports statistiques pour le bon restaurant basé sur le contexte de leur dernière interaction, ou seront guidés pour choisir si aucun contexte n'est disponible.

