
# Correction : Gérer les réponses à la sélection de restaurant

## Problème identifié

Le flux actuel :
1. Gérant envoie "2" → Système détecte menu option 2 (CA) → Envoie prompt de sélection restaurant
2. Gérant répond "3" → Système détecte menu option 3 (Notes) → Envoie ENCORE prompt de sélection restaurant

Le problème : le système ne distingue pas entre :
- "3" = réponse au menu principal (demande rapport Notes)
- "3" = réponse à la sélection de restaurant (choix Antony)

## Solution

**Ajouter une vérification AVANT la détection de menu interactif** :
1. Chercher si un prompt de sélection (`message_type: 'restaurant_selection'`) a été envoyé récemment (5 minutes)
2. Si oui ET que le message est un numéro simple (1-9) → c'est une réponse de sélection
3. Utiliser le restaurant correspondant et générer le rapport demandé

## Modifications techniques

### Fichier : `supabase/functions/ultramsg-webhook/index.ts`

**1. Nouvelle fonction pour récupérer la sélection en attente :**

```typescript
async function getPendingRestaurantSelection(
  supabase: any, 
  phone: string
): Promise<{
  reportType: string;
  detailLevel: 'basic' | 'detailed';
  restaurants: Array<{ id: string; name: string }>;
} | null> {
  // Find recent restaurant_selection prompt (last 5 minutes)
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: pendingSelection } = await supabase
    .from('message_history')
    .select('message_content, created_at')
    .eq('direction', 'outbound')
    .eq('message_type', 'restaurant_selection')
    .eq('recipient_phone', phone)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!pendingSelection) return null;
  
  // Parse the report type from the message content
  // The message contains: "...rapport "CA & Commandes" ?"
  const reportTypeMatch = pendingSelection.message_content.match(/rapport "([^"]+)"/);
  if (!reportTypeMatch) return null;
  
  // Map back to report type key
  const labelToType: Record<string, string> = {
    'Erreurs': 'errors',
    'CA & Commandes': 'revenue',
    'Notes clients': 'rating',
    'Temps opérationnels': 'operations',
    'Promotions': 'promotions'
  };
  
  const reportType = labelToType[reportTypeMatch[1]];
  if (!reportType) return null;
  
  return {
    reportType,
    detailLevel: 'basic', // Default to basic for selection responses
  };
}
```

**2. Modifier le flux principal (avant la détection de menu) :**

```typescript
// === RESTAURANT SELECTION RESPONSE DETECTION ===
// Check FIRST if the user is responding to a pending restaurant selection
const selectionNumber = parseInt(messageData.body.trim());
if (!isNaN(selectionNumber) && selectionNumber >= 1 && selectionNumber <= 9) {
  const pendingSelection = await getPendingRestaurantSelection(supabase, normalizedPhone);
  
  if (pendingSelection && managerRestaurants.length > 1) {
    // This is a response to restaurant selection, not a menu choice
    const selectedIndex = selectionNumber - 1;
    
    if (selectedIndex >= 0 && selectedIndex < managerRestaurants.length) {
      const selectedRestaurant = managerRestaurants[selectedIndex];
      console.log(`Restaurant selection: User chose ${selectedRestaurant.name}`);
      
      // Generate the report for the selected restaurant
      handleInteractiveReportRequest(
        supabase,
        selectedRestaurant,
        pendingSelection.reportType,
        pendingSelection.detailLevel,
        normalizedPhone,
        manager?.first_name || selectedRestaurant?.manager_first_name || 'Manager'
      ).catch((err: Error) => console.error('Selection report error:', err));
      
      return new Response(
        JSON.stringify({ success: true, type: 'restaurant_selection_response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Invalid selection number
      await sendWhatsAppReply(normalizedPhone, 
        `❌ Numéro invalide. Réponds avec un numéro entre 1 et ${managerRestaurants.length}.`
      );
      return new Response(
        JSON.stringify({ success: true, type: 'invalid_selection' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
}

// === INTERACTIVE MENU DETECTION (existing code) ===
// Only reaches here if NOT responding to a pending selection
const menuResponse = isInteractiveMenuResponse(messageData.body);
// ... rest of existing code
```

**3. Stocker le type de rapport dans le prompt :**

Modifier `sendRestaurantSelectionPrompt` pour stocker `reportType` et `detailLevel` en metadata (optionnel, le parsing du message fonctionne aussi).

## Nouveau flux utilisateur

```
[Système] → Rapports IA pour Athis-Mons, Antony, Bonneuil
[Gérant]  → "2"
[Système] → Vérifie: pas de sélection en attente → Menu option 2 (CA)
[Système] → "Tu gères plusieurs restaurants. Lequel ? 1. Bourg-En-Bresse, 2. Athis-Mons, 3. Antony..."
[Gérant]  → "3"
[Système] → Vérifie: sélection en attente trouvée (CA) → Index 2 = Antony
[Système] → Rapport CA Antony ✅
```

## Fichiers à modifier

| Fichier | Modifications |
|---------|--------------|
| `supabase/functions/ultramsg-webhook/index.ts` | Ajouter `getPendingRestaurantSelection`, insérer vérification avant menu detection |

## Considérations

- **Fenêtre de 5 minutes** : si le gérant répond après 5 min, on traite comme une nouvelle demande
- **Priorité claire** : sélection en attente > menu interactif > chatbot
- **Gestion d'erreur** : si numéro hors plage, message d'erreur explicite
